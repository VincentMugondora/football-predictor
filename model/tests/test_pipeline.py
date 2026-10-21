"""Unit tests for data ingestion, online Poisson model, walk-forward backtest, and daily pipeline."""

from __future__ import annotations

import json
import math
from pathlib import Path
from datetime import datetime, timedelta, timezone

import pandas as pd
import pytest

from model import config
from model.backtest import remove_bookmaker_margin, run_walk_forward_backtest
from model.data import (
    clean_and_normalise_dataframe,
    load_historical_matches,
    normalise_team_name,
    resolve_odds_columns,
)
from model.model import OnlinePoissonModel
from model.run_daily import build_picks_payload, run_daily_pipeline, validate_fixtures_against_history
from model.providers.base import Fixture
from model.providers.the_odds_api import TheOddsApiProvider
from model.providers.teams import canonical_team
from model.providers import teams as team_provider


def test_team_name_normalisation() -> None:
    assert normalise_team_name("Man United") == "Man Utd"
    assert normalise_team_name("Spurs") == "Tottenham"
    assert normalise_team_name("Nott'm Forest") == "Nottingham Forest"
    assert normalise_team_name("Arsenal") == "Arsenal"
    assert normalise_team_name("Huesca") == "Huesca"
    assert normalise_team_name("Man United") == "Man Utd"


def test_unknown_fixture_names_are_collected_skipped_and_suggested(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(team_provider, "REVIEW_PATH", tmp_path / "team_names_review.json")
    history = pd.DataFrame({"Div": ["E0"], "HomeTeam": ["Arsenal"], "AwayTeam": ["Chelsea"]})
    kickoff = datetime.now(timezone.utc) + timedelta(days=2)
    fixtures = [Fixture("x1", "PL", kickoff, "Arsenal United", "Unknown FC")]

    accepted = validate_fixtures_against_history(fixtures, history, "football-data.org")

    assert accepted == []
    review = json.loads((tmp_path / "team_names_review.json").read_text(encoding="utf-8"))
    assert {entry["name"] for entry in review} == {"Arsenal United", "Unknown FC"}
    assert all(entry["suggestions"] for entry in review)
    arsenal_entry = next(entry for entry in review if entry["name"] == "Arsenal United")
    assert "Arsenal" in arsenal_entry["suggestions"]


def test_promoted_explicit_alias_is_low_confidence_and_never_featured() -> None:
    rows = []
    teams = ["Arsenal", "Liverpool", "Chelsea", "Tottenham", "Everton", "Aston Villa"]
    for i in range(20):
        home, away = teams[i % len(teams)], teams[(i + 1) % len(teams)]
        rows.append({"Div": "E0", "Date": pd.Timestamp("2024-01-01") + pd.Timedelta(days=i),
                     "HomeTeam": home, "AwayTeam": away, "FTHG": 1, "FTAG": 0, "FTR": "H",
                     "OddsH": 2.0, "OddsD": 3.2, "OddsA": 4.0, "OddsSource": "PSC", "HS": 10.0, "AS": 8.0})
    history = pd.DataFrame(rows)
    report, _ = run_walk_forward_backtest(history, test_fraction=0.4)
    fixture = Fixture("promoted", "PL", datetime.now(timezone.utc) + timedelta(days=3),
                      "Sunderland AFC", "Arsenal FC")

    payload = build_picks_payload(history, report, fixtures=[fixture])

    pick = payload["matches"][0]
    assert pick["home"] == "Sunderland"
    assert pick["low_confidence"] is True
    assert pick["featured"] is False
    assert "not a strong pick" in pick["ourTake"]


def test_odds_api_unmatched_team_marks_fixture_for_skipping(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(team_provider, "REVIEW_PATH", tmp_path / "team_names_review.json")
    provider = TheOddsApiProvider(api_key="test-key", sport_by_competition={"PL": "soccer_epl"})
    provider.cache_dir = tmp_path
    kickoff = datetime.now(timezone.utc) + timedelta(days=1)
    fixture = Fixture("odds-x", "PL", kickoff, "Arsenal", "Chelsea")
    cache_path = tmp_path / f"odds_soccer_epl_{datetime.now(timezone.utc).date().isoformat()}.json"
    cache_path.write_text(json.dumps({"payload": [{
        "home_team": "Arsenal", "away_team": "Mystery FC", "commence_time": kickoff.isoformat(),
        "bookmakers": [],
    }], "credits_remaining": 500}), encoding="utf-8")

    assert provider.get_h2h_odds([fixture]) == {}
    assert provider.unmatched_fixture_ids == {"odds-x"}
    review = json.loads((tmp_path / "team_names_review.json").read_text(encoding="utf-8"))
    assert any(item["provider"] == "The Odds API" and item["name"] == "Mystery FC" for item in review)


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

    payload = build_picks_payload(
        df, report, max_matches=6,
        leagues_skipped={"SP1": "requires 5 historical seasons; found 2: 2324, 2425"},
    )
    serialized = json.dumps(payload)
    assert len(serialized.encode("utf-8")) < config.MAX_PICKS_JSON_BYTES
    assert payload["schema_version"] == "2.0"
    for match in payload["matches"]:
        assert math.isclose(sum(match["p"]), 1.0, abs_tol=1e-3)
    assert payload["data_status"] == "no_fixtures"
    assert payload["leagues_skipped"]["SP1"].startswith("requires 5 historical seasons")
    assert payload["matches"] == []
    assert payload["recent_comparisons"] == []


def test_remove_bookmaker_margin() -> None:
    p_fair = remove_bookmaker_margin(2.0, 3.5, 4.0)
    assert math.isclose(sum(p_fair), 1.0, rel_tol=1e-9)


def _history_frame(league: str, season: str) -> pd.DataFrame:
    return pd.DataFrame({
        "Div": [league], "Date": [pd.Timestamp(f"20{season[:2]}-08-01")],
        "HomeTeam": ["Arsenal"], "AwayTeam": ["Chelsea"],
        "FTHG": [1], "FTAG": [0], "FTR": ["H"],
    })


def test_history_loader_skips_underfilled_leagues_and_keeps_eligible(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    seasons = ("1920", "2021", "2122", "2223", "2324")
    monkeypatch.setattr(config, "MIN_HISTORY_SEASONS_PER_LEAGUE", 5)
    for league, available in {"E0": seasons, "SP1": seasons[:2]}.items():
        for season in available:
            (tmp_path / f"{league}_{season}.csv").write_text("cached", encoding="utf-8")
    monkeypatch.setattr(
        "model.data.load_csv_file",
        lambda path: _history_frame(path.stem.split("_")[0], path.stem.split("_")[1]),
    )

    history = load_historical_matches(
        leagues=("E0", "SP1"), seasons=seasons, raw_dir=tmp_path, download_missing=False,
    )

    assert set(history["Div"]) == {"E0"}
    assert history.attrs["leagues_eligible"] == ["E0"]
    assert history.attrs["leagues_skipped"] == {
        "SP1": "requires 5 historical seasons; found 2: 1920, 2021"
    }


def test_history_loader_fails_clearly_when_no_league_meets_minimum(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "MIN_HISTORY_SEASONS_PER_LEAGUE", 5)
    for league in ("SP1", "I1", "D1"):
        (tmp_path / f"{league}_2425.csv").write_text("cached", encoding="utf-8")
    monkeypatch.setattr(
        "model.data.load_csv_file",
        lambda path: _history_frame(path.stem.split("_")[0], path.stem.split("_")[1]),
    )

    with pytest.raises(RuntimeError, match="No league meets the minimum of 5 historical seasons") as exc:
        load_historical_matches(
            leagues=("SP1", "I1", "D1"), seasons=("2425",), raw_dir=tmp_path, download_missing=False,
        )
    assert "SP1" in str(exc.value) and "I1" in str(exc.value) and "D1" in str(exc.value)
