"""Daily real-data training, fixture prediction, backtest, and picks publisher."""

from __future__ import annotations

import json
import os
from dataclasses import replace
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
    run_walk_forward_backtest,
)
from model.model import OnlinePoissonModel
from model.providers.base import Fixture
from model.providers.api_football import ApiFootballProvider
from model.providers.football_data_csv import FootballDataCsvProvider
from model.providers.football_data_org import FootballDataOrgProvider
from model.providers.the_odds_api import TheOddsApiProvider
from model.providers.teams import canonical_team, clean_team_name, record_unmatched_team_names
from model.timing import HalfTimeGoalTimingModel
from model.timing_windows import MinuteWindowTimingModel, load_cached_goal_events
from model.timing_backfill import run_timing_backfill

SCHEMA_VERSION = "2.0"
MODEL_VERSION = "poisson-dc-v2.0"
LAST_API_FOOTBALL_REMAINING: int | None = None
COMPETITION_TO_LEAGUE = {"PL": "E0", "BL1": "D1", "SA": "I1", "PD": "SP1",
                         "E0": "E0", "D1": "D1", "I1": "I1", "SP1": "SP1"}


def _load_environment_file(path: Path = config.REPO_ROOT / ".env") -> None:
    """Load simple KEY=VALUE entries without requiring python-dotenv at runtime."""
    if load_dotenv is not None:
        load_dotenv(path, override=False)
        return
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip()
        if value[:1] in {"'", '"'} and value[-1:] == value[:1]:
            value = value[1:-1]
        if key:
            os.environ.setdefault(key, value)


def validate_fixtures_against_history(
    fixtures: list[Fixture], df_hist: pd.DataFrame, provider_name: str,
) -> list[Fixture]:
    """Keep fixtures whose names resolve exactly or through an explicit alias; log all others."""
    history_by_league = {
        league: set(group["HomeTeam"].astype(str)) | set(group["AwayTeam"].astype(str))
        for league, group in df_hist.groupby("Div")
    }
    known_all = set().union(*history_by_league.values()) if history_by_league else set()
    known_all |= set(config.TEAM_ALIASES.values())
    unmatched: list[str] = []
    valid: list[Fixture] = []
    for fixture in fixtures:
        league = COMPETITION_TO_LEAGUE.get(fixture.competition, fixture.competition)
        league_teams = history_by_league.get(league, set())
        normalized = [canonical_team(fixture.home, provider_name), canonical_team(fixture.away, provider_name)]
        original = [clean_team_name(fixture.home), clean_team_name(fixture.away)]
        resolved: list[str | None] = []
        for raw, name in zip(original, normalized):
            if name in league_teams:
                resolved.append(name)
            elif raw in config.TEAM_ALIASES:
                # Explicit aliases identify promoted/recently renamed teams even without match history.
                resolved.append(name)
            else:
                unmatched.append(raw)
                resolved.append(None)
        if all(resolved):
            valid.append(replace(fixture, home=str(resolved[0]), away=str(resolved[1])))
    if unmatched:
        record_unmatched_team_names(unmatched, provider_name, known_all)
        for name in sorted(set(unmatched)):
            print(f"WARNING: Skipping {provider_name} fixture(s) with unmatched team {name!r}.", flush=True)
    return valid


def validate_results_against_history(
    results: pd.DataFrame, df_hist: pd.DataFrame, provider_name: str,
) -> pd.DataFrame:
    if results.empty:
        return results
    history_by_league = {
        league: set(group["HomeTeam"].astype(str)) | set(group["AwayTeam"].astype(str))
        for league, group in df_hist.groupby("Div")
    }
    known_all = set().union(*history_by_league.values()) if history_by_league else set()
    known_all |= set(config.TEAM_ALIASES.values())
    keep: list[int] = []
    unmatched: list[str] = []
    normalized_rows: dict[int, tuple[str, str]] = {}
    for index, row in results.iterrows():
        league_teams = history_by_league.get(str(row["Div"]), set())
        names = [clean_team_name(row["HomeTeam"]), clean_team_name(row["AwayTeam"])]
        canonical = [canonical_team(name, provider_name) for name in names]
        if all(name in league_teams or raw in config.TEAM_ALIASES
               for raw, name in zip(names, canonical)):
            keep.append(index)
            normalized_rows[index] = (canonical[0], canonical[1])
        else:
            unmatched.extend(raw for raw, name in zip(names, canonical)
                             if name not in league_teams and raw not in config.TEAM_ALIASES)
    if unmatched:
        record_unmatched_team_names(unmatched, provider_name, known_all)
        for name in sorted(set(unmatched)):
            print(f"WARNING: Skipping {provider_name} result(s) with unmatched team {name!r}.", flush=True)
    filtered = results.loc[keep].copy()
    for index, (home, away) in normalized_rows.items():
        if index in filtered.index:
            filtered.loc[index, "HomeTeam"] = home
            filtered.loc[index, "AwayTeam"] = away
    return filtered


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
    fixtures: list[Fixture] | None = None,
    reference_odds: dict[str, dict[str, object]] | None = None,
    odds_credits_remaining: int | None = None,
    odds_credits_used: int = 0,
    sources_used: list[str] | None = None,
    leagues_skipped: dict[str, str] | None = None,
    minute_timing_model: MinuteWindowTimingModel | None = None,
    minute_timing_league: str | None = None,
) -> dict[str, object]:
    """
    1. Walks chronologically through verified historical matches, predicting before each result.
    2. Emits predictions only for real provider fixtures with IDs and UTC kickoff times.
    """
    fixtures = validate_fixtures_against_history(fixtures or [], df_hist, "fixture provider")
    fixtures = sorted(fixtures, key=lambda item: item.kickoff)[:max_matches]
    reference_odds = reference_odds or {}
    train_df = df_hist.sort_values(["Date", "Div", "HomeTeam", "AwayTeam"]).copy()

    # Train chronologically, predicting each real historical result before observing it.
    trained_model = OnlinePoissonModel()
    timing_model = HalfTimeGoalTimingModel()

    for row in train_df.itertuples(index=False):
        div = str(row.Div)
        home = str(row.HomeTeam)
        away = str(row.AwayTeam)
        trained_model.predict_proba(div, home, away)
        hs = float(row.HS) if hasattr(row, "HS") and pd.notna(row.HS) else None
        as_ = float(row.AS) if hasattr(row, "AS") and pd.notna(row.AS) else None
        trained_model.observe_match(div, home, away, int(row.FTHG), int(row.FTAG), hs, as_)
        timing_model.observe(
            div, home, away, row.FTHG, row.FTAG,
            getattr(row, "HTHG", float("nan")), getattr(row, "HTAG", float("nan")),
        )

    now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    matches_out: list[dict[str, object]] = []
    featured_idx = 0
    for idx_cand, fixture_cand in enumerate(fixtures):
        if fixture_cand.competition in {"PL", "E0"}:
            featured_idx = idx_cand
            break

    historical_teams_by_league = {
        league: set(group["HomeTeam"].astype(str)) | set(group["AwayTeam"].astype(str))
        for league, group in train_df.groupby("Div")
    }
    preferred_feature = next((idx for idx, fixture in enumerate(fixtures)
                              if fixture.home in historical_teams_by_league.get(
                                  COMPETITION_TO_LEAGUE.get(fixture.competition, fixture.competition), set())
                              and fixture.away in historical_teams_by_league.get(
                                  COMPETITION_TO_LEAGUE.get(fixture.competition, fixture.competition), set())), None)
    if preferred_feature is not None:
        featured_idx = preferred_feature

    for i, fixture in enumerate(fixtures):
        if not fixture.id or fixture.kickoff.tzinfo is None or not fixture.home or not fixture.away:
            raise ValueError("A fixture lacks a real ID, timezone-aware kickoff, or mapped team")
        div = next((key for key, value in FootballDataOrgProvider.COMPETITIONS.items() if value == fixture.competition), fixture.competition)
        historical_teams = historical_teams_by_league.get(div, set())
        league_name = config.LEAGUE_DISPLAY_NAMES.get(div, fixture.competition)
        home, away = fixture.home, fixture.away
        kickoff_iso = fixture.kickoff.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        match_id = fixture.id

        market_prediction = trained_model.predict_markets(div, home, away)
        p_h, p_d, p_a = market_prediction["p"]
        goals_raw = market_prediction["goals"]
        grid = market_prediction["grid"]
        winner_probs = [p_h, p_d, p_a]
        ordered_outcomes = sorted(enumerate(winner_probs), key=lambda item: item[1], reverse=True)
        winner_index, winning_probability = ordered_outcomes[0]
        winning_gap = winning_probability - ordered_outcomes[1][1]
        winner_names = ("home", "draw", "away")
        winner_pick = "too close to call" if winning_gap < 0.05 else winner_names[winner_index]
        low_confidence = home not in historical_teams or away not in historical_teams
        confidence = (
            "low" if low_confidence or winning_gap < 0.05 else
            "high" if winning_gap >= 0.15 and winning_probability >= 0.60 else
            "medium" if winning_gap >= 0.08 and winning_probability >= 0.45 else
            "low"
        )
        goals_payload = {
            "exp_home": round(float(goals_raw["exp_home"]), 3),
            "exp_away": round(float(goals_raw["exp_away"]), 3),
            "exp_total": round(float(goals_raw["exp_total"]), 3),
            "p_total": [round(float(value), 3) for value in goals_raw["p_total"]],
            "over": {line: round(float(value), 3) for line, value in goals_raw["over"].items()},
            "btts": round(float(goals_raw["btts"]), 3),
            "clean_sheet": [round(float(value), 3) for value in goals_raw["clean_sheet"]],
            "top_scores": [
                {"score": item["score"], "probability": round(float(item["probability"]), 3)}
                for item in goals_raw["top_scores"]
            ],
        }
        timing_raw = timing_model.predict(
            div, home, away, float(goals_raw["exp_home"]), float(goals_raw["exp_away"])
        )
        if timing_raw is None:
            timing_payload = {
                "level": "none", "halves": None, "windows": None,
                "note": "No validated halftime scores are available; no timing estimate is shown.",
            }
        else:
            team_signal = bool(timing_raw["team_specific_signal"])
            timing_payload = {
                "level": "half",
                "halves": {
                    "home": {key: round(float(value), 3) for key, value in timing_raw["home"].items()},
                    "away": {key: round(float(value), 3) for key, value in timing_raw["away"].items()},
                    "p_first_half_goal": round(float(timing_raw["p_first_half_goal"]), 3),
                    "league_first_share": round(float(timing_raw["league_first_share"]), 3),
                    "team_specific_signal": team_signal,
                },
                "windows": None,
                "note": (
                    "Half splits use team estimates shrunk toward the league average; no exact-minute prediction."
                    if team_signal else
                    "league average, no team-specific signal yet; no exact-minute prediction."
                ),
            }
        if minute_timing_model is not None and minute_timing_league == div:
            windows_raw = minute_timing_model.predict(
                home, away, float(goals_raw["exp_home"]), float(goals_raw["exp_away"])
            )
            if windows_raw is not None:
                windows = {
                    "home": {
                        label: {key: round(float(value), 3) for key, value in row.items()}
                        for label, row in windows_raw["home"].items()
                    },
                    "away": {
                        label: {key: round(float(value), 3) for key, value in row.items()}
                        for label, row in windows_raw["away"].items()
                    },
                    "p_first_goal_before_30": round(float(windows_raw["p_first_goal_before_30"]), 3),
                    "team_specific_signal": bool(windows_raw["team_specific_signal"]),
                    "league_goal_sample": int(windows_raw["league_goal_sample"]),
                }
                timing_payload = {
                    **timing_payload,
                    "level": "minute",
                    "windows": windows,
                    "note": (
                        "league average, no team-specific signal yet. "
                        "Own goals are assigned to the beneficiary after score reconciliation; "
                        "scored penalties count, missed and shootout penalties do not. Extra-time "
                        "goals are cached but excluded from 90-minute windows. No exact-minute prediction."
                        if not windows["team_specific_signal"] else
                        "Team windows pass the configured league and team sample thresholds. Own goals "
                        "are assigned to the beneficiary after score reconciliation; scored penalties "
                        "count, missed and shootout penalties do not. Extra-time goals are cached but "
                        "excluded from 90-minute windows. No exact-minute prediction."
                    ),
                }
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
            "featured": i == featured_idx and not low_confidence,
            "low_confidence": low_confidence,
            "goals": goals_payload,
            "winner": {
                "pick": winner_pick,
                "p": [round(float(value), 3) for value in winner_probs],
                "confidence": confidence,
            },
            "timing": timing_payload,
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
            "ourTake": (
                f"Low confidence: {home if home not in historical_teams else away} has no historical results in this model. "
                "Treat this as a baseline estimate, not a strong pick."
                if low_confidence else _build_our_take(
                home,
                away,
                (p_h, p_d, p_a),
                (ref_odds[0], ref_odds[1], ref_odds[2]) if ref_odds else (0.0, 0.0, 0.0),
                home_summary,
                away_summary,
                ) if ref_odds else "Model-only estimate; no validated reference odds are available."
            ),
        }
        matches_out.append(match_entry)

    payload: dict[str, object] = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": now_utc,
        "model_version": MODEL_VERSION,
        "data_status": "ok" if matches_out else "no_fixtures",
        "sources_used": sources_used or ["football-data.org v4", "football-data.co.uk CSV cache"],
        "leagues_skipped": leagues_skipped or {},
        "odds_credits_remaining": odds_credits_remaining,
        "odds_credits_used": odds_credits_used,
        "backtest": {
            "test_matches": report.test_matches,
            "bookmaker_test_matches": report.bookmaker_test_matches,
            "log_loss_model": report.log_loss_model,
            "log_loss_book": report.log_loss_book,
            "gap": report.gap,
            "verdict_code": report.verdict,
            "verdict": report.verdict_message,
            "clv_mean": report.clv_mean,
            "winner": report.winner_metrics,
            "goals": report.goals_metrics,
            "timing": report.timing_metrics,
        },
        "matches": matches_out,
        "model_notes": {
            "goals": "Score markets are derived from one normalized Dixon-Coles Poisson grid.",
            "winner": "Confidence reflects the gap between the two most likely outcomes; close outcomes are not called.",
            "timing": "Halves use validated halftime scores with league shrinkage; optional 15-minute windows stay league-wide until the 3,000-goal threshold and never predict an exact minute.",
        },
        "recent_comparisons": [],
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
    app_picks_path: Path | None = None,
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
        _load_environment_file()
        df_hist = FootballDataCsvProvider().load()
        leagues_skipped = dict(df_hist.attrs.get("leagues_skipped", {}))
        eligible_leagues = set(df_hist.attrs.get("leagues_eligible", df_hist["Div"].unique()))
        try:
            provider: FootballDataOrgProvider | ApiFootballProvider = FootballDataOrgProvider()
            fixtures_source = "football-data.org v4"
        except RuntimeError:
            if not os.getenv("API_FOOTBALL_KEY"):
                raise
            provider = ApiFootballProvider()
            fixtures_source = "API-Football"
        now = datetime.now(timezone.utc)
        max_history = pd.to_datetime(df_hist["Date"], utc=True).max().to_pydatetime() if not df_hist.empty else now - timedelta(days=3650)
        try:
            recent_results = provider.get_finished(max_history, now)
        except Exception:
            if isinstance(provider, FootballDataOrgProvider) and os.getenv("API_FOOTBALL_KEY"):
                provider = ApiFootballProvider()
                fixtures_source = "API-Football"
                recent_results = provider.get_finished(max_history, now)
            else:
                raise
        if not recent_results.empty:
            recent_results["Date"] = pd.to_datetime(recent_results["Date"], utc=True).dt.tz_localize(None)
            recent_results = recent_results[recent_results["Div"].isin(eligible_leagues)]
            recent_results = validate_results_against_history(recent_results, df_hist, fixtures_source)
            for col in (
                "OddsH", "OddsD", "OddsA", "OddsCloseH", "OddsCloseD", "OddsCloseA",
                "OddsOver25", "OddsUnder25", "HS", "AS",
            ):
                recent_results[col] = float("nan")
            recent_results["OddsSource"] = ""
            df_hist = pd.concat([df_hist, recent_results], ignore_index=True)
            df_hist = df_hist.drop_duplicates(subset=["Div", "Date", "HomeTeam", "AwayTeam"], keep="last")
            df_hist = df_hist.sort_values(["Date", "Div", "HomeTeam", "AwayTeam"]).reset_index(drop=True)
        report, _ = run_walk_forward_backtest(df_hist)
        try:
            fixtures = provider.get_fixtures(now, now + timedelta(days=7))
        except Exception:
            if isinstance(provider, FootballDataOrgProvider) and os.getenv("API_FOOTBALL_KEY"):
                provider = ApiFootballProvider()
                fixtures_source = "API-Football"
                fixtures = provider.get_fixtures(now, now + timedelta(days=7))
            else:
                raise
        fixtures = [f for f in fixtures if COMPETITION_TO_LEAGUE.get(f.competition) in eligible_leagues]
        fixtures = validate_fixtures_against_history(fixtures, df_hist, fixtures_source)
        timing_settings = config.timing_backfill_settings()
        timing_league = str(timing_settings["league"])
        minute_events = load_cached_goal_events(timing_league)
        minute_timing_model = MinuteWindowTimingModel(
            minute_events,
            min_league_goals=int(timing_settings["min_goals_per_league"]),
            min_team_goals=int(timing_settings["min_team_goals"]),
        ) if minute_events else None
        odds_by_fixture: dict[str, dict[str, object]] = {}
        credits_remaining = None
        credits_used = 0
        if os.getenv("THE_ODDS_API_KEY"):
            odds_provider = TheOddsApiProvider(sport_by_competition={
                "PL": "soccer_epl", "BL1": "soccer_germany_bundesliga",
                "SA": "soccer_italy_serie_a", "PD": "soccer_spain_la_liga",
            })
            try:
                min_credits = int(os.getenv("ODDS_MIN_CREDITS_REMAINING", "10"))
                if len(fixtures) and len(fixtures) > 0:
                    odds_by_fixture = odds_provider.get_h2h_odds(fixtures, min_credits_remaining=min_credits)
                    if odds_provider.unmatched_fixture_ids:
                        fixtures = [fixture for fixture in fixtures if fixture.id not in odds_provider.unmatched_fixture_ids]
                        odds_by_fixture = {fixture_id: odds for fixture_id, odds in odds_by_fixture.items()
                                           if fixture_id not in odds_provider.unmatched_fixture_ids}
                credits_remaining = odds_provider.credits_remaining
                credits_used = odds_provider.credits_used
            except Exception as odds_error:
                # Odds are auxiliary; preserve verified fixtures and predictions if quota or odds service fails.
                print(f"Reference odds unavailable: {odds_error}", flush=True)
        global LAST_API_FOOTBALL_REMAINING
        LAST_API_FOOTBALL_REMAINING = (
            provider.requests_remaining if isinstance(provider, ApiFootballProvider) else None
        )
        sources = [fixtures_source, "football-data.co.uk CSV cache"]
        if minute_events:
            sources.append("API-Football cached goal events")
        payload = build_picks_payload(df_hist, report, fixtures=fixtures,
                                      reference_odds=odds_by_fixture,
                                      odds_credits_remaining=credits_remaining,
                                      odds_credits_used=credits_used,
                                      sources_used=sources,
                                      leagues_skipped=leagues_skipped,
                                      minute_timing_model=minute_timing_model,
                                      minute_timing_league=timing_league)

        # Compact UTF-8 JSON keeps downloads economical on mobile data.
        serialized = json.dumps(payload, separators=(",", ":"), allow_nan=False)
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
            f"Published {len(payload['matches'])} verified upcoming predictions ({byte_len} bytes).",
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
    print(f"Successfully generated {config.PICKS_JSON_PATH}")
    print(f"Upcoming predictions : {len(matches)}")
    print(f"Backtest verdict     : {bt['verdict']} (Model {bt['log_loss_model']} vs Book {bt['log_loss_book']})")
    print(f"Winner verdict       : {bt['winner']['verdict']}")
    print(f"Goals verdict        : {bt['goals']['verdict']}")
    print(f"Timing verdict       : {bt['timing']['verdict']}")
    try:
        run_timing_backfill(initial_requests_remaining=LAST_API_FOOTBALL_REMAINING)
    except Exception as timing_error:
        # Optional backfill must never invalidate the already-published daily picks.
        print(f"Minute timing backfill unavailable: {timing_error}", flush=True)
