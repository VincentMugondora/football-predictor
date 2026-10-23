"""Opt-in, quota-bounded API-Football minute-event backfill.

This module is invoked only after the daily predictions have been published.
The cache intentionally keeps only regulation/event minute, added time, team,
and event type. Fixture IDs live in the filename so completed 0-0 games can be
cached without persisting any other API response fields.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

from model import config
from model.providers.api_football import ApiFootballProvider
from model.providers.api_football_events import ApiFootballEventsProvider
from model.timing_windows import (
    MinuteWindowTimingModel,
    cached_fixture_path,
    load_cached_goal_events,
    parse_fixture_goal_events,
    write_fixture_event_cache,
)

STATE_PATH = config.MODEL_DIR / "data" / "timing_backfill_state.json"
FINISHED_STATUSES = {"FT", "AET", "PEN"}


def _read_state(path: Path, *, league: str, start_season: int) -> dict[str, int]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        if value.get("league") == league:
            season, page, index = value.get("season"), value.get("page"), value.get("index")
            if isinstance(season, int) and all(isinstance(item, int) and item >= 0 for item in (page, index)):
                return {"season": season, "page": page, "index": index}
    except (OSError, ValueError, AttributeError):
        pass
    return {"season": start_season, "page": 0, "index": 0}


def _write_state(path: Path, league: str, state: dict[str, int]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps({"league": league, **state}), encoding="utf-8")
    temporary.replace(path)


def _cache_inventory(league: str) -> tuple[int, list[dict[str, object]]]:
    root = config.MODEL_DIR / "data" / "timing_events" / league
    fixture_count = sum(1 for _ in root.glob("*/*.json")) if root.exists() else 0
    return fixture_count, load_cached_goal_events(league)


def _real_goals_per_match(league: str) -> float | None:
    """Use already-cached CSV history for a rough progress estimate; never download."""
    try:
        from model.data import load_historical_matches

        history = load_historical_matches(download_missing=False)
        rows = history[history["Div"] == league]
        if rows.empty:
            return None
        average = float((rows["FTHG"] + rows["FTAG"]).mean())
        return average if math.isfinite(average) and average > 0 else None
    except Exception:
        return None


def _print_progress(
    league: str,
    settings: dict[str, object],
    *,
    provider: ApiFootballEventsProvider | None,
    stop_reason: str,
) -> dict[str, object]:
    fixture_count, events = _cache_inventory(league)
    model = MinuteWindowTimingModel(
        events,
        min_league_goals=int(settings["min_goals_per_league"]),
        min_team_goals=int(settings["min_team_goals"]),
    )
    rate = (model.training_goal_count / fixture_count) if fixture_count else _real_goals_per_match(league)
    daily_event_slots = max(0, int(settings["max_requests"]) - 4)
    days: int | None = None
    if model.ready:
        days = 0
    elif rate and daily_event_slots:
        days = math.ceil((int(settings["min_goals_per_league"]) - model.training_goal_count) / (rate * daily_event_slots))
    remaining_text = "unknown" if provider is None or provider.requests_remaining is None else str(provider.requests_remaining)
    estimate = "not estimable yet" if days is None else ("0 days (threshold reached)" if days == 0 else f"about {days} daily run(s)")
    print(
        f"Minute timing backfill [{league}]: fixtures cached={fixture_count}; "
        f"goals collected={len(events)} (90-minute training goals={model.training_goal_count}/"
        f"{settings['min_goals_per_league']}); estimated days to threshold={estimate}; "
        f"API requests used={provider.requests_made if provider else 0}/"
        f"{settings['max_requests']}, remaining={remaining_text}; {stop_reason}.",
        flush=True,
    )
    return {
        "league": league,
        "fixtures_cached": fixture_count,
        "goals_collected": len(events),
        "training_goals": model.training_goal_count,
        "threshold": int(settings["min_goals_per_league"]),
        "estimated_days": days,
        "requests_made": provider.requests_made if provider else 0,
        "requests_remaining": provider.requests_remaining if provider else None,
        "stop_reason": stop_reason,
    }


def run_timing_backfill(
    settings: dict[str, object] | None = None,
    *,
    provider: ApiFootballEventsProvider | None = None,
    initial_requests_remaining: int | None = None,
    state_path: Path = STATE_PATH,
) -> dict[str, object]:
    """Backfill finished fixture events, respecting both quota reserve and run cap."""
    options = settings or config.timing_backfill_settings()
    league = str(options["league"])
    if not bool(options["enabled"]):
        return _print_progress(league, options, provider=None, stop_reason="disabled (default)")

    current_events = load_cached_goal_events(league)
    current_model = MinuteWindowTimingModel(
        current_events,
        min_league_goals=int(options["min_goals_per_league"]),
        min_team_goals=int(options["min_team_goals"]),
    )
    if current_model.ready:
        return _print_progress(league, options, provider=None, stop_reason="training threshold already reached")

    reserve = int(options["reserve"])
    cap = int(options["max_requests"])
    provider = provider or ApiFootballEventsProvider(reserve_requests=reserve)
    provider.reserve_requests = reserve
    if initial_requests_remaining is not None:
        provider.requests_remaining = initial_requests_remaining
    if provider.requests_remaining is not None and provider.requests_remaining <= reserve:
        return _print_progress(league, options, provider=provider, stop_reason="daily quota is at reserve")

    league_id = ApiFootballProvider.LEAGUES[league]
    state = _read_state(state_path, league=league, start_season=int(options["start_season"]))
    season = min(state["season"], int(options["start_season"]))
    if int(options["start_season"]) > state["season"]:
        # A newly exposed season is always scanned before resuming older history.
        season = int(options["start_season"])
    page = state["page"]
    fixture_index = state["index"]
    stop_reason = "season range exhausted"

    while season >= int(options["min_season"]):
        if provider.requests_made >= cap:
            stop_reason = "per-run request cap reached"
            break
        try:
            coverage = provider.get_event_coverage(league_id, season, max_requests=cap)
        except Exception as exc:
            stop_reason = str(exc)
            break

        # Missing headers are fail-closed after the mandatory coverage check.
        if provider.requests_remaining is None:
            stop_reason = "API response omitted x-ratelimit-requests-remaining; stopped safely"
            break
        if provider.requests_remaining <= reserve:
            stop_reason = "API quota reached configured reserve"
            break
        if coverage.get("errors"):
            print(f"Minute backfill: league coverage unavailable for {league} {season}: {coverage['errors']}", flush=True)
        if not coverage.get("available") or not coverage.get("events"):
            season -= 1
            page, fixture_index = 0, 0
            _write_state(state_path, league, {"season": season, "page": page, "index": fixture_index})
            continue

        # Page 1 is queried once to discover the current page count. The cursor
        # then resumes across pages without reprocessing fixtures on later runs.
        first_page_rows: list[dict[str, Any]] | None = None
        if page == 0:
            try:
                first_page_rows, page_count = provider.get_fixture_page(league_id, season, 1, max_requests=cap)
            except Exception as exc:
                stop_reason = str(exc)
                break
            page = page_count
            fixture_index = 0
            _write_state(state_path, league, {"season": season, "page": page, "index": fixture_index})
            if provider.requests_remaining is None or provider.requests_remaining <= reserve:
                stop_reason = "API quota reached reserve or response omitted quota header"
                break

        while page >= 1:
            try:
                if first_page_rows is not None and page == 1:
                    fixtures, page_count = first_page_rows, 1
                    first_page_rows = None
                else:
                    if provider.requests_made >= cap:
                        stop_reason = "per-run request cap reached"
                        break
                    fixtures, page_count = provider.get_fixture_page(league_id, season, page, max_requests=cap)
            except Exception as exc:
                stop_reason = str(exc)
                break
            page = min(page, page_count)
            fixtures.sort(
                key=lambda row: str(row.get("fixture", {}).get("date", ""))
                if isinstance(row.get("fixture"), dict) else "",
                reverse=True,
            )
            if provider.requests_remaining is None or provider.requests_remaining <= reserve:
                stop_reason = "API quota reached reserve or response omitted quota header"
                break

            while fixture_index < len(fixtures):
                row = fixtures[fixture_index]
                fixture = row.get("fixture", {})
                fixture_id = fixture.get("id") if isinstance(fixture, dict) else None
                status = fixture.get("status", {}) if isinstance(fixture, dict) else {}
                status_short = status.get("short") if isinstance(status, dict) else None
                if not isinstance(fixture_id, int) or fixture_id < 1 or status_short not in FINISHED_STATUSES:
                    fixture_index += 1
                    _write_state(state_path, league, {"season": season, "page": page, "index": fixture_index})
                    continue
                if cached_fixture_path(league, season, str(fixture_id)).exists():
                    fixture_index += 1
                    _write_state(state_path, league, {"season": season, "page": page, "index": fixture_index})
                    continue
                if provider.requests_made >= cap:
                    stop_reason = "per-run request cap reached"
                    break
                if provider.requests_remaining is None or provider.requests_remaining <= reserve:
                    stop_reason = "API quota reached configured reserve before the next event request"
                    break
                try:
                    events = provider.get_fixture_events(fixture_id, max_requests=cap)
                except Exception as exc:
                    stop_reason = str(exc)
                    break
                fixture_cached = False
                try:
                    normalized_events = parse_fixture_goal_events(row, events)
                except ValueError as exc:
                    print(f"Minute backfill: skipped fixture {fixture_id} ({league} {season}): {exc}", flush=True)
                else:
                    write_fixture_event_cache(league, season, str(fixture_id), normalized_events)
                    fixture_cached = True
                fixture_index += 1
                _write_state(state_path, league, {"season": season, "page": page, "index": fixture_index})
                if fixture_cached and MinuteWindowTimingModel(
                    load_cached_goal_events(league),
                    min_league_goals=int(options["min_goals_per_league"]),
                    min_team_goals=int(options["min_team_goals"]),
                ).ready:
                    stop_reason = "training threshold reached"
                    break
                if provider.requests_remaining is None or provider.requests_remaining <= reserve:
                    stop_reason = "API quota reached configured reserve after event request"
                    break

            if fixture_index < len(fixtures) or stop_reason in {
                "per-run request cap reached",
                "API quota reached configured reserve before the next event request",
                "API quota reached configured reserve after event request",
                "training threshold reached",
            } or stop_reason.startswith("API quota") or "request failed" in stop_reason:
                break
            page -= 1
            fixture_index = 0
            _write_state(state_path, league, {"season": season, "page": page, "index": fixture_index})

        if stop_reason != "season range exhausted" and (
            page >= 1 or provider.requests_made >= cap or provider.requests_remaining is None
            or provider.requests_remaining <= reserve
        ):
            break
        season -= 1
        page, fixture_index = 0, 0
        _write_state(state_path, league, {"season": season, "page": page, "index": fixture_index})

    _write_state(state_path, league, {"season": season, "page": page, "index": fixture_index})
    return _print_progress(league, options, provider=provider, stop_reason=stop_reason)

