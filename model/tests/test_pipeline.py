"""Unit tests for data ingestion, online Poisson model, walk-forward backtest, and daily pipeline."""

from __future__ import annotations

import json
import math
from pathlib import Path

import pandas as pd
import pytest

from model import config
from model.backtest import remove_bookmaker_margin, run_walk_forward_backtest
from model.data import (
    clean_and_normalise_dataframe,
    normalise_team_name,
    resolve_odds_columns,
)
from model.model import OnlinePoissonModel
from model.run_daily import build_picks_payload, run_daily_pipeline


def test_team_name_normalisation() -> None:
    assert normalise_team_name("Man United") == "Man Utd"
    assert normalise_team_name("Spurs") == "Tottenham"
    assert normalise_team_name("Nott'm Forest") == "Nottingham Forest"
    assert normalise_team_name("Arsenal") == "Arsenal"


def test_day_first_date_parsing_and_missing_row_filtering() -> None:
    raw = pd.DataFrame(
        {
            "Div": ["E0", "E0", "E0", "E0"],
            "Date": ["14/08/2023", "15/08/23", "invalid-date", "16/08/2023"],
            "HomeTeam": ["Man United", "Arsenal", "Chelsea", "Liverpool"],
            "AwayTeam": ["Wolves", "Nott'm Forest", "Liverpool", "Bournemouth"],
            "FTHG": [1, 2, 1, None],
            "FTAG": [0, 1, 1, 1],
            "FTR": ["H", "H", "D", "D"],
            "PSCH": [1.35, 1.22, 2.90, 1.30],
            "PSCD": [5.40, 6.80, 3.40, 5.50],
            "PSCA": [9.00, 13.50, 2.50, 9.50],
        }
    )
    cleaned = clean_and_normalise_dataframe(raw)
    assert len(cleaned) == 2
    assert list(cleaned["HomeTeam"]) == ["Man Utd", "Arsenal"]
    assert cleaned.iloc[0]["Date"] == pd.Timestamp("2023-08-14")
    assert cleaned.iloc[1]["Date"] == pd.Timestamp("2023-08-15")
    assert all(cleaned["OddsSource"] == "PSC")


def test_odds_source_priority_fallback() -> None:
    raw = pd.DataFrame(
        {
            "PSCH": [None, 2.10, None],
            "PSCD": [None, 3.40, None],
            "PSCA": [None, 3.60, None],
            "B365H": [1.80, 2.00, None],
            "B365D": [3.60, 3.30, None],
            "B365A": [4.50, 3.50, None],
            "AvgH": [1.78, 2.05, 2.40],
            "AvgD": [3.55, 3.35, 3.25],
            "AvgA": [4.40, 3.55, 2.95],
        }
    )
    oh, od, oa, src = resolve_odds_columns(raw)
    assert list(src) == ["B365", "PSC", "Avg"]
    assert math.isclose(float(oh.iloc[0]), 1.80)
    assert math.isclose(float(oh.iloc[1]), 2.10)
    assert math.isclose(float(oh.iloc[2]), 2.40)


def test_online_poisson_probabilities_sum_to_one_and_no_lookahead() -> None:
    model = OnlinePoissonModel()
    p_before = model.predict_proba("E0", "Arsenal", "Liverpool")
    assert math.isclose(sum(p_before), 1.0, rel_tol=1e-9)
    assert all(0.0 < p < 1.0 for p in p_before)

    # Predicting again without calling observe_match must yield identical probabilities
    p_repeat = model.predict_proba("E0", "Arsenal", "Liverpool")
    assert p_before == p_repeat

    # Observing a 3-0 home win increases Arsenal's subsequent home win probability
    model.observe_match("E0", "Arsenal", "Liverpool", fthg=3, ftag=0, home_shots=18, away_shots=8)
    p_after = model.predict_proba("E0", "Arsenal", "Liverpool")
    assert math.isclose(sum(p_after), 1.0, rel_tol=1e-9)
    assert p_after[0] > p_before[0]


def test_walk_forward_backtest_and_picks_payload_schema() -> None:
    rows = []
    teams = ["Arsenal", "Liverpool", "Chelsea", "Tottenham", "Everton", "Aston Villa"]
    for i in range(40):
        h = teams[i % len(teams)]
        a = teams[(i + 1 + (i // len(teams))) % len(teams)]
        if h == a:
            a = teams[(i + 2) % len(teams)]
        rows.append(
            {
                "Div": "E0",
                "Date": pd.Timestamp("2024-01-01") + pd.Timedelta(days=i),
                "HomeTeam": h,
                "AwayTeam": a,
                "FTHG": (i % 3),
                "FTAG": ((i + 1) % 2),
                "FTR": "H" if (i % 3) > ((i + 1) % 2) else ("D" if (i % 3) == ((i + 1) % 2) else "A"),
                "OddsH": 2.10,
                "OddsD": 3.40,
                "OddsA": 3.50,
                "OddsSource": "PSC",
                "HS": 14.0,
                "AS": 11.0,
            }
        )
    df = pd.DataFrame(rows)
    report, _ = run_walk_forward_backtest(df, test_fraction=0.4)
    assert report.test_matches == 16
    assert report.log_loss_model > 0
    assert report.log_loss_book > 0

    payload = build_picks_payload(df, report, max_matches=6)
    serialized = json.dumps(payload)
    assert len(serialized.encode("utf-8")) < config.MAX_PICKS_JSON_BYTES
    assert payload["schema_version"] == "1.1"
    for match in payload["matches"]:
        assert math.isclose(sum(match["p"]), 1.0, abs_tol=1e-3)
        assert match["isDemo"] is False
    assert payload["data_status"] == "no_fixtures"
    assert payload["matches"] == []
    assert payload["recent_comparisons"] == []


def test_remove_bookmaker_margin() -> None:
    p_fair = remove_bookmaker_margin(2.0, 3.5, 4.0)
    assert math.isclose(sum(p_fair), 1.0, rel_tol=1e-9)
