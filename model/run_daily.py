"""Daily model training, fixture prediction, and picks.json publisher (Phase 4)."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from model import config
from model.backtest import BacktestReport, run_walk_forward_backtest
from model.data import fetch_upcoming_fixtures, load_historical_matches
from model.model import OnlinePoissonModel

SCHEMA_VERSION = "1.0"
MODEL_VERSION = "poisson-dc-v1.0"


def _slugify_match_id(home: str, away: str, date_str: str) -> str:
    h_slug = re.sub(r"[^a-z0-9]+", "-", home.lower()).strip("-")[:6]
    a_slug = re.sub(r"[^a-z0-9]+", "-", away.lower()).strip("-")[:6]
    return f"{h_slug}-{a_slug}-{date_str}"


def _build_our_take(
    home: str,
    away: str,
    probs: tuple[float, float, float],
    odds: tuple[float, float, float],
    home_summary: dict[str, object],
    away_summary: dict[str, object],
) -> str:
    p_h, p_d, p_a = probs
    edge_h = p_h * odds[0] - 1.0
    edge_a = p_a * odds[2] - 1.0
    h_gpg = home_summary["goals_per_game"]
    a_gpg = away_summary["goals_per_game"]

    if p_h >= p_a and p_h >= 0.45:
        edge_note = (
            f"Shows a +{edge_h * 100:.1f}% value edge vs reference odds."
            if edge_h >= 0.02
            else "Market reference price closely reflects the home projection."
        )
        return (
            f"Model projects {home} at {round(p_h * 100)}% ({h_gpg} goals/game vs "
            f"{away}'s {a_gpg}). {edge_note}"
        )
    if p_a > p_h and p_a >= 0.42:
        edge_note = (
            f"Shows a +{edge_a * 100:.1f}% away edge vs reference odds."
            if edge_a >= 0.02
            else "Reference odds align closely with the away estimate."
        )
        return (
            f"Model projects {away} at {round(p_a * 100)}% ({a_gpg} goals/game vs "
            f"{home}'s {h_gpg}). {edge_note}"
        )
    return (
        f"Balanced fixture ({home} {round(p_h * 100)}%, Draw {round(p_d * 100)}%, "
        f"{away} {round(p_a * 100)}%) based on multi-season Poisson ratings."
    )


def build_picks_payload(
    df_hist: pd.DataFrame,
    report: BacktestReport,
    max_matches: int = 24,
) -> dict[str, object]:
    """
    Produces the picks.json payload from real football-data.co.uk data.
    Uses upcoming fixtures from fixtures.csv if published; otherwise evaluates the final
    matchweek window across active leagues using a model trained strictly on prior dates
    (zero look-ahead).
    """
    upcoming_df = fetch_upcoming_fixtures(config.ACTIVE_LEAGUES)

    if not upcoming_df.empty:
        # Train on 100% of historical completed matches
        trained_model = OnlinePoissonModel()
        for row in df_hist.itertuples(index=False):
            hs = float(row.HS) if hasattr(row, "HS") and pd.notna(row.HS) else None
            as_ = float(row.AS) if hasattr(row, "AS") and pd.notna(row.AS) else None
            trained_model.observe_match(
                str(row.Div),
                str(row.HomeTeam),
                str(row.AwayTeam),
                int(row.FTHG),
                int(row.FTAG),
                hs,
                as_,
            )
        target_fixtures = upcoming_df.head(max_matches).copy()
    else:
        # Select the latest real matchweek per active league from historical CSVs,
        # and train the model strictly on matches BEFORE the cutoff date (no look-ahead).
        latest_per_league: list[pd.DataFrame] = []
        for div in config.ACTIVE_LEAGUES:
            div_df = df_hist[df_hist["Div"] == div]
            if not div_df.empty:
                latest_per_league.append(div_df.tail(6))

        target_fixtures = (
            pd.concat(latest_per_league, ignore_index=True)
            .sort_values(["Date", "Div", "HomeTeam"])
            .tail(max_matches)
            .reset_index(drop=True)
        )
        cutoff_date = target_fixtures["Date"].min()
        prior_df = df_hist[df_hist["Date"] < cutoff_date]

        trained_model = OnlinePoissonModel()
        for row in prior_df.itertuples(index=False):
            hs = float(row.HS) if hasattr(row, "HS") and pd.notna(row.HS) else None
            as_ = float(row.AS) if hasattr(row, "AS") and pd.notna(row.AS) else None
            trained_model.observe_match(
                str(row.Div),
                str(row.HomeTeam),
                str(row.AwayTeam),
                int(row.FTHG),
                int(row.FTAG),
                hs,
                as_,
            )

    now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    matches_out: list[dict[str, object]] = []

    # Assign practical kickoff times (15:00, 17:30, 20:00 UTC) when CSV only stores Date
    kickoff_hours = ("15:00:00Z", "17:30:00Z", "20:00:00Z", "18:30:00Z")

    # Mark the first Premier League fixture (or index 0 if none) as Match of the Week
    featured_idx = 0
    for idx_cand, row_cand in enumerate(target_fixtures.itertuples(index=False)):
        if str(row_cand.Div) == "E0":
            featured_idx = idx_cand
            break

    for i, row in enumerate(target_fixtures.itertuples(index=False)):
        div = str(row.Div)
        league_name = config.LEAGUE_DISPLAY_NAMES.get(div, div)
        home = str(row.HomeTeam)
        away = str(row.AwayTeam)
        dt_str = pd.Timestamp(row.Date).strftime("%Y-%m-%d")
        kickoff_iso = f"{dt_str}T{kickoff_hours[i % len(kickoff_hours)]}"

        p_h, p_d, p_a = trained_model.predict_proba(div, home, away)
        p_tuple = [round(p_h, 4), round(p_d, 4), round(1.0 - round(p_h, 4) - round(p_d, 4), 4)]
        fair_odds = [
            round(1.0 / max(0.01, p_tuple[0]), 2),
            round(1.0 / max(0.01, p_tuple[1]), 2),
            round(1.0 / max(0.01, p_tuple[2]), 2),
        ]
        ref_odds = [
            round(float(row.OddsH), 2),
            round(float(row.OddsD), 2),
            round(float(row.OddsA), 2),
        ]
        ref_source = str(row.OddsSource)

        home_summary = trained_model.get_team_summary(home)
        away_summary = trained_model.get_team_summary(away)

        matches_out.append(
            {
                "id": _slugify_match_id(home, away, dt_str),
                "date": kickoff_iso,
                "league": league_name,
                "home": home,
                "away": away,
                "p": p_tuple,
                "fair_odds": fair_odds,
                "odds": ref_odds,
                "reference_source": ref_source,
                "featured": i == featured_idx,
                "isDemo": False,
                "homeForm": home_summary["form"],
                "awayForm": away_summary["form"],
                "stats": {
                    "goalsPerGame": [
                        home_summary["goals_per_game"],
                        away_summary["goals_per_game"],
                    ],
                    "shots": [home_summary["shots"], away_summary["shots"]],
                    "possession": [
                        home_summary["possession"],
                        away_summary["possession"],
                    ],
                },
                "ourTake": _build_our_take(
                    home,
                    away,
                    (p_h, p_d, p_a),
                    (ref_odds[0], ref_odds[1], ref_odds[2]),
                    home_summary,
                    away_summary,
                ),
            }
        )

    payload: dict[str, object] = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": now_utc,
        "model_version": MODEL_VERSION,
        "backtest": {
            "test_matches": report.test_matches,
            "log_loss_model": report.log_loss_model,
            "log_loss_book": report.log_loss_book,
            "gap": report.gap,
            "verdict_code": report.verdict,
            "verdict": report.verdict_message,
            "clv_mean": report.clv_mean,
        },
        "matches": matches_out,
    }
    return payload


def write_status_file(status: str, message: str, status_path: Path = config.STATUS_JSON_PATH) -> None:
    status_path.parent.mkdir(parents=True, exist_ok=True)
    status_payload = {
        "status": status,
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "message": message,
    }
    status_path.write_text(json.dumps(status_payload, indent=2), encoding="utf-8")


def run_daily_pipeline(
    picks_path: Path = config.PICKS_JSON_PATH,
    app_picks_path: Path | None = config.APP_REAL_PICKS_PATH,
    status_path: Path = config.STATUS_JSON_PATH,
) -> dict[str, object]:
    """
    Runs the daily pipeline end-to-end.
    On any failure, leaves the previous picks.json untouched and writes status.json.
    """
    try:
        df_hist = load_historical_matches()
        report, _ = run_walk_forward_backtest(df_hist)
        payload = build_picks_payload(df_hist, report)

        serialized = json.dumps(payload, indent=2)
        byte_len = len(serialized.encode("utf-8"))
        if byte_len > config.MAX_PICKS_JSON_BYTES:
            raise ValueError(
                f"Generated picks.json ({byte_len} bytes) exceeds 50 KB limit ({config.MAX_PICKS_JSON_BYTES} bytes)."
            )

        picks_path.parent.mkdir(parents=True, exist_ok=True)
        picks_path.write_text(serialized, encoding="utf-8")

        if app_picks_path is not None:
            app_picks_path.parent.mkdir(parents=True, exist_ok=True)
            app_picks_path.write_text(serialized, encoding="utf-8")

        write_status_file(
            "ok",
            f"Published {len(payload['matches'])} matches ({byte_len} bytes).",
            status_path=status_path,
        )
        return payload
    except Exception as exc:
        write_status_file("error", str(exc), status_path=status_path)
        raise


if __name__ == "__main__":
    result = run_daily_pipeline()
    bt = result["backtest"]
    matches = result["matches"]
    print(f"Successfully generated {config.PICKS_JSON_PATH} and {config.APP_REAL_PICKS_PATH}")
    print(f"Matches published : {len(matches)}")
    print(f"Backtest verdict  : {bt['verdict']} (Model {bt['log_loss_model']} vs Book {bt['log_loss_book']})")
