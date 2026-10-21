"""Daily model training, fixture prediction, post-match result comparison, and picks.json publisher."""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd

try:
    from dotenv import load_dotenv
except ImportError:  # Keys may also be injected directly by the scheduler.
    load_dotenv = None

from model import config
from model.backtest import (
    BacktestReport,
    multiclass_brier_score,
    multiclass_log_loss,
    run_walk_forward_backtest,
)
from model.data import load_historical_matches
from model.model import OnlinePoissonModel
from model.providers.base import Fixture
from model.providers.football_data_csv import FootballDataCsvProvider
from model.providers.football_data_org import FootballDataOrgProvider
from model.providers.the_odds_api import TheOddsApiProvider

SCHEMA_VERSION = "2.0"
MODEL_VERSION = "poisson-dc-v2.0"
OUTCOME_LABELS = ("Home", "Draw", "Away")


def _ftr_to_outcome_label(ftr: str) -> str:
    if ftr == "H":
        return "Home"
    if ftr == "D":
        return "Draw"
    return "Away"


def _top_outcome_label(probs: tuple[float, float, float] | list[float]) -> str:
    best_idx = int(max(range(3), key=lambda i: probs[i]))
    return OUTCOME_LABELS[best_idx]


def _load_predictions_history(history_path: Path) -> dict[str, dict[str, object]]:
    if not history_path.exists():
        return {}
    try:
        data = json.loads(history_path.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    return {}


def _save_predictions_history(
    history: dict[str, dict[str, object]], history_path: Path
) -> None:
    history_path.parent.mkdir(parents=True, exist_ok=True)
    # Keep most recent 400 predictions so history file stays compact
    items = list(history.items())[-400:]
    history_path.write_text(json.dumps(dict(items), indent=2), encoding="utf-8")


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
    max_matches: int = 100,
    max_comparisons: int = 16,
    history_path: Path = config.PREDICTIONS_HISTORY_PATH,
    fixtures: list[Fixture] | None = None,
    reference_odds: dict[str, dict[str, object]] | None = None,
    odds_credits_remaining: int | None = None,
) -> dict[str, object]:
    """
    1. Walks chronologically through historical matches, predicting each match strictly BEFORE
       observing its real result.
    2. Reconciles completed matches against stored pre-match predictions to produce
       `recent_comparisons` (Predicted Outcome & Probabilities vs. Real Scoreline & Result).
    3. Generates upcoming match predictions and stores them in `predictions_history.json`
       so when those matches finish, their real results are automatically compared next day.
    """
    pred_history = _load_predictions_history(history_path)
    fixtures = sorted(fixtures or [], key=lambda item: item.kickoff)[:max_matches]
    reference_odds = reference_odds or {}
    train_df = df_hist.sort_values(["Date", "Div", "HomeTeam", "AwayTeam"]).copy()

    # Walk-forward through train_df, recording pre-match predictions on the most recent completed matches
    trained_model = OnlinePoissonModel()
    completed_evaluations: list[dict[str, object]] = []
    eval_start_idx = max(0, len(train_df) - 60)

    for idx, row in enumerate(train_df.itertuples(index=False)):
        div = str(row.Div)
        home = str(row.HomeTeam)
        away = str(row.AwayTeam)
        dt_str = pd.Timestamp(row.Date).strftime("%Y-%m-%d")
        match_id = f"history-{idx}-{dt_str}"

        # 1. Predict strictly BEFORE observing real match result
        p_h, p_d, p_a = trained_model.predict_proba(div, home, away)

        if idx >= eval_start_idx:
            raw_odds = (getattr(row, "OddsH", None), getattr(row, "OddsD", None), getattr(row, "OddsA", None))
            if not all(pd.notna(value) and float(value) > 1 for value in raw_odds):
                # Keep learning from verified scores, but do not fabricate market comparisons.
                trained_model.observe_match(div, home, away, int(row.FTHG), int(row.FTAG))
                continue
            # If this match was previously saved in pred_history before kickoff, use that exact stored prediction
            stored = pred_history.get(match_id)
            if stored and isinstance(stored.get("p"), list) and len(stored["p"]) == 3:
                p_used = (
                    float(stored["p"][0]),
                    float(stored["p"][1]),
                    float(stored["p"][2]),
                )
            else:
                p_used = (p_h, p_d, p_a)

            p_list = [
                round(p_used[0], 4),
                round(p_used[1], 4),
                round(1.0 - round(p_used[0], 4) - round(p_used[1], 4), 4),
            ]
            pred_outcome = _top_outcome_label(p_list)
            fthg = int(row.FTHG)
            ftag = int(row.FTAG)
            ftr = str(row.FTR)
            actual_outcome = _ftr_to_outcome_label(ftr)
            is_correct = pred_outcome == actual_outcome

            # Also check if bookmaker favourite was right
            odds_tuple = (float(row.OddsH), float(row.OddsD), float(row.OddsA))
            book_fav_idx = int(min(range(3), key=lambda k: odds_tuple[k]))
            book_fav_outcome = OUTCOME_LABELS[book_fav_idx]

            completed_evaluations.append(
                {
                    "id": match_id,
                    "date": f"{dt_str}T15:00:00Z",
                    "league": config.LEAGUE_DISPLAY_NAMES.get(div, div),
                    "home": home,
                    "away": away,
                    "p": p_list,
                    "odds": [
                        round(odds_tuple[0], 2),
                        round(odds_tuple[1], 2),
                        round(odds_tuple[2], 2),
                    ],
                    "predicted_outcome": pred_outcome,
                    "actual_score": f"{fthg} - {ftag}",
                    "actual_outcome": actual_outcome,
                    "correct": is_correct,
                    "book_favourite": book_fav_outcome,
                    "book_correct": book_fav_outcome == actual_outcome,
                    "log_loss": round(multiclass_log_loss(p_used, ftr), 4),
                    "brier": round(multiclass_brier_score(p_used, ftr), 4),
                }
            )

        # 2. Observe real match result AFTER predicting
        hs = float(row.HS) if hasattr(row, "HS") and pd.notna(row.HS) else None
        as_ = float(row.AS) if hasattr(row, "AS") and pd.notna(row.AS) else None
        trained_model.observe_match(div, home, away, int(row.FTHG), int(row.FTAG), hs, as_)

    # Take the most recent completed evaluations across active leagues
    recent_comparisons = completed_evaluations[-max_comparisons:][::-1]
    if completed_evaluations:
        model_hits = sum(1 for item in completed_evaluations if item["correct"])
        book_hits = sum(1 for item in completed_evaluations if item["book_correct"])
        hit_rate_model = round(model_hits / len(completed_evaluations), 4)
        hit_rate_book = round(book_hits / len(completed_evaluations), 4)
    else:
        hit_rate_model = 0.0
        hit_rate_book = 0.0

    now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    matches_out: list[dict[str, object]] = []
    featured_idx = 0
    for idx_cand, fixture_cand in enumerate(fixtures):
        if fixture_cand.competition in {"PL", "E0"}:
            featured_idx = idx_cand
            break

    for i, fixture in enumerate(fixtures):
        if not fixture.id or fixture.kickoff.tzinfo is None or not fixture.home or not fixture.away:
            raise ValueError("A fixture lacks a real ID, timezone-aware kickoff, or mapped team")
        div = next((key for key, value in FootballDataOrgProvider.COMPETITIONS.items() if value == fixture.competition), fixture.competition)
        league_name = config.LEAGUE_DISPLAY_NAMES.get(div, fixture.competition)
        home, away = fixture.home, fixture.away
        kickoff_iso = fixture.kickoff.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        match_id = fixture.id

        p_h, p_d, p_a = trained_model.predict_proba(div, home, away)
        p_tuple = [round(p_h, 4), round(p_d, 4), round(1.0 - round(p_h, 4) - round(p_d, 4), 4)]
        fair_odds = [
            round(1.0 / max(0.01, p_tuple[0]), 2),
            round(1.0 / max(0.01, p_tuple[1]), 2),
            round(1.0 / max(0.01, p_tuple[2]), 2),
        ]
        reference = reference_odds.get(match_id)
        ref_odds = reference.get("odds") if reference else None
        ref_source = reference.get("source") if reference else None

        home_summary = trained_model.get_team_summary(home)
        away_summary = trained_model.get_team_summary(away)

        match_entry: dict[str, object] = {
            "id": match_id,
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
                (ref_odds[0], ref_odds[1], ref_odds[2]) if ref_odds else (0.0, 0.0, 0.0),
                home_summary,
                away_summary,
            ),
        }
        matches_out.append(match_entry)

        # Save pre-match prediction in history so it can be compared after the match finishes
        pred_history[match_id] = {
            "id": match_id,
            "date": kickoff_iso,
            "league": league_name,
            "home": home,
            "away": away,
            "p": p_tuple,
            "predicted_outcome": _top_outcome_label(p_tuple),
            "odds": ref_odds,
            "generated_at": now_utc,
        }

    _save_predictions_history(pred_history, history_path)

    payload: dict[str, object] = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": now_utc,
        "model_version": MODEL_VERSION,
        "data_status": "ok" if matches_out else "no_fixtures",
        "sources_used": ["football-data.org v4", "football-data.co.uk CSV cache"],
        "odds_credits_remaining": odds_credits_remaining,
        "backtest": {
            "test_matches": report.test_matches,
            "log_loss_model": report.log_loss_model,
            "log_loss_book": report.log_loss_book,
            "gap": report.gap,
            "verdict_code": report.verdict,
            "verdict": report.verdict_message,
            "clv_mean": report.clv_mean,
            "recent_evaluated": len(completed_evaluations),
            "recent_hit_rate_model": hit_rate_model,
            "recent_hit_rate_book": hit_rate_book,
        },
        "matches": matches_out,
        "recent_comparisons": recent_comparisons,
    }
    return payload


def write_status_file(
    status: str, message: str, status_path: Path = config.STATUS_JSON_PATH
) -> None:
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
    Runs the daily pipeline end-to-end:
    - Refreshes completed match results & upcoming fixtures
    - Compares completed matches against pre-match predictions
    - Generates new predictions and saves pre-match snapshot
    - On any failure, leaves the previous picks.json untouched and writes status.json
    """
    try:
        if load_dotenv is not None:
            load_dotenv(config.REPO_ROOT / ".env", override=False)
        df_hist = FootballDataCsvProvider().load()
        provider = FootballDataOrgProvider()
        now = datetime.now(timezone.utc)
        max_history = pd.to_datetime(df_hist["Date"], utc=True).max().to_pydatetime() if not df_hist.empty else now - timedelta(days=3650)
        recent_results = provider.get_finished(max_history, now)
        if not recent_results.empty:
            recent_results["Date"] = pd.to_datetime(recent_results["Date"], utc=True).dt.tz_localize(None)
            for col in ("OddsH", "OddsD", "OddsA", "HS", "AS"):
                recent_results[col] = float("nan")
            recent_results["OddsSource"] = ""
            df_hist = pd.concat([df_hist, recent_results], ignore_index=True)
            df_hist = df_hist.drop_duplicates(subset=["Div", "Date", "HomeTeam", "AwayTeam"], keep="last")
            df_hist = df_hist.sort_values(["Date", "Div", "HomeTeam", "AwayTeam"]).reset_index(drop=True)
        report, _ = run_walk_forward_backtest(df_hist)
        fixtures = provider.get_fixtures(now, now + timedelta(days=7))
        odds_by_fixture: dict[str, dict[str, object]] = {}
        credits_remaining = None
        if os.getenv("THE_ODDS_API_KEY"):
            odds_provider = TheOddsApiProvider(sport_by_competition={
                "PL": "soccer_epl", "ELC": "soccer_efl_champ", "BL1": "soccer_germany_bundesliga",
                "SA": "soccer_italy_serie_a", "PD": "soccer_spain_la_liga",
            })
            odds_by_fixture = odds_provider.get_h2h_odds(fixtures)
            credits_remaining = odds_provider.credits_remaining
        payload = build_picks_payload(df_hist, report, fixtures=fixtures,
                                      reference_odds=odds_by_fixture,
                                      odds_credits_remaining=credits_remaining)

        serialized = json.dumps(payload, indent=2, allow_nan=False)
        byte_len = len(serialized.encode("utf-8"))
        if byte_len > config.MAX_PICKS_JSON_BYTES:
            raise ValueError(
                f"Generated picks.json ({byte_len} bytes) exceeds 50 KB limit ({config.MAX_PICKS_JSON_BYTES} bytes)."
            )

        picks_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = picks_path.with_suffix(picks_path.suffix + ".tmp")
        tmp_path.write_text(serialized, encoding="utf-8")
        tmp_path.replace(picks_path)

        if app_picks_path is not None:
            app_picks_path.parent.mkdir(parents=True, exist_ok=True)
            app_tmp_path = app_picks_path.with_suffix(app_picks_path.suffix + ".tmp")
            app_tmp_path.write_text(serialized, encoding="utf-8")
            app_tmp_path.replace(app_picks_path)

        write_status_file(
            "ok",
            f"Published {len(payload['matches'])} predictions and {len(payload['recent_comparisons'])} post-match comparisons ({byte_len} bytes).",
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
    comparisons = result["recent_comparisons"]
    print(f"Successfully generated {config.PICKS_JSON_PATH}")
    print(f"Upcoming predictions : {len(matches)}")
    print(f"Post-match results   : {len(comparisons)} compared (Model Hit Rate: {bt['recent_hit_rate_model'] * 100:.1f}% vs Market Fav: {bt['recent_hit_rate_book'] * 100:.1f}%)")
    print(f"Backtest verdict     : {bt['verdict']} (Model {bt['log_loss_model']} vs Book {bt['log_loss_book']})")
