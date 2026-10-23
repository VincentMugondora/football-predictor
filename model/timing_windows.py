"""Minute-window event parsing, compact local cache, and timing model."""

from __future__ import annotations

import json
import itertools
import math
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable

from model import config

WINDOW_LABELS = ("0-15", "16-30", "31-45+", "46-60", "61-75", "76-90+")
EVENT_TYPES = {"goal", "penalty", "own_goal"}


def _valid_integer(value: object, *, minimum: int = 0) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value >= minimum


def parse_fixture_goal_events(
    fixture_row: dict[str, Any], raw_events: Iterable[dict[str, Any]]
) -> list[dict[str, object]]:
    """Validate and normalize scored goals, resolving own-goal attribution by scoreline."""
    fixture = fixture_row.get("fixture", {})
    teams = fixture_row.get("teams", {})
    goals = fixture_row.get("goals", {})
    if not isinstance(fixture, dict) or not _valid_integer(fixture.get("id"), minimum=1):
        raise ValueError("Fixture row is missing a valid ID.")
    if not isinstance(teams, dict) or not isinstance(goals, dict):
        raise ValueError("Fixture row is missing teams or final scores.")
    home = teams.get("home", {})
    away = teams.get("away", {})
    home_id = home.get("id") if isinstance(home, dict) else None
    away_id = away.get("id") if isinstance(away, dict) else None
    home_name = home.get("name") if isinstance(home, dict) else None
    away_name = away.get("name") if isinstance(away, dict) else None
    if not _valid_integer(home_id, minimum=1) or not _valid_integer(away_id, minimum=1) or home_id == away_id:
        raise ValueError("Fixture row has invalid participant IDs.")
    if not isinstance(home_name, str) or not home_name.strip() or not isinstance(away_name, str) or not away_name.strip():
        raise ValueError("Fixture row is missing participant names.")
    target_home, target_away = goals.get("home"), goals.get("away")
    if not _valid_integer(target_home) or not _valid_integer(target_away):
        raise ValueError("Fixture row has invalid final goal values.")

    raw_goal_events: list[dict[str, Any]] = []
    cancelled: set[tuple[int, int | None, int | None]] = set()
    status = str(fixture.get("status", {}).get("short", "")) if isinstance(fixture.get("status"), dict) else ""
    for event in raw_events:
        event_type = str(event.get("type", "")).strip().casefold()
        detail = str(event.get("detail", "")).strip().casefold()
        event_time = event.get("time", {})
        if not isinstance(event_time, dict):
            continue
        minute = event_time.get("elapsed")
        extra = event_time.get("extra")
        if not _valid_integer(minute) or (extra is not None and not _valid_integer(extra)):
            continue
        team = event.get("team", {})
        team_id = team.get("id") if isinstance(team, dict) else None
        if event_type in {"var", "goal cancelled"} and "cancel" in detail:
            cancelled.add((minute, extra, team_id if _valid_integer(team_id, minimum=1) else None))
            continue
        if event_type != "goal" or detail == "missed penalty":
            continue
        if detail in {"own goal", "own-goal"}:
            normalized_type = "own_goal"
        elif detail == "penalty":
            normalized_type = "penalty"
        elif detail in {"normal goal", "goal"}:
            normalized_type = "goal"
        else:
            raise ValueError(f"Unsupported scored-goal detail: {detail!r}.")
        if not _valid_integer(team_id, minimum=1) or team_id not in {home_id, away_id}:
            raise ValueError("Goal event has no valid fixture team ID.")
        comments = str(event.get("comments") or "").casefold()
        # Penalty shootout kicks are not match goals. If the feed marks a shootout
        # explicitly, exclude it; minute 120 penalties without such a marker are
        # ambiguous and will fail score reconciliation rather than be guessed.
        if "shootout" in comments or "shoot-out" in comments:
            continue
        if status == "PEN" and detail == "penalty" and minute >= 120 and extra is None:
            raise ValueError("Penalty at minute 120 in a shootout decision is ambiguous without a shootout marker.")
        raw_goal_events.append({
            "minute": minute,
            "extra_time": extra,
            "type": normalized_type,
            "source_team_id": team_id,
        })

    if cancelled:
        retained: list[dict[str, Any]] = []
        for event in raw_goal_events:
            key = (event["minute"], event["extra_time"], event["source_team_id"])
            if key in cancelled:
                cancelled.remove(key)
            else:
                retained.append(event)
        raw_goal_events = retained

    own_goal_indices = [index for index, event in enumerate(raw_goal_events) if event["type"] == "own_goal"]
    if len(own_goal_indices) > 12:
        raise ValueError("Too many own-goal events to reconcile safely.")
    matching_assignments: list[tuple[int, ...]] = []
    for assignment in itertools.product((0, 1), repeat=len(own_goal_indices)):
        assignment_by_index = dict(zip(own_goal_indices, assignment))
        counts: Counter[str] = Counter()
        for index, event in enumerate(raw_goal_events):
            team_id = event["source_team_id"]
            if index in assignment_by_index and assignment_by_index[index]:
                team_id = away_id if team_id == home_id else home_id
            if team_id == home_id:
                counts["home"] += 1
            elif team_id == away_id:
                counts["away"] += 1
        if counts["home"] == target_home and counts["away"] == target_away:
            matching_assignments.append(assignment)
            if len(matching_assignments) > 1:
                break
    if len(matching_assignments) != 1:
        raise ValueError("Goal events do not uniquely reconcile to the API final score.")
    assignment_by_index = dict(zip(own_goal_indices, matching_assignments[0]))

    home_canonical = config.TEAM_ALIASES.get(home_name.strip(), home_name.strip())
    away_canonical = config.TEAM_ALIASES.get(away_name.strip(), away_name.strip())
    normalized: list[dict[str, object]] = []
    for index, event in enumerate(raw_goal_events):
        team_id = event["source_team_id"]
        if index in assignment_by_index and assignment_by_index[index]:
            team_id = away_id if team_id == home_id else home_id
        normalized.append({
            "minute": event["minute"],
            "extra_time": event["extra_time"],
            "team": home_canonical if team_id == home_id else away_canonical,
            "type": event["type"],
        })
    return sorted(normalized, key=lambda item: (int(item["minute"]), int(item["extra_time"] or 0), str(item["team"])))


def _window_index(minute: int) -> int | None:
    if minute <= 15:
        return 0
    if minute <= 30:
        return 1
    if minute <= 45:
        return 2
    if minute <= 60:
        return 3
    if minute <= 75:
        return 4
    if minute <= 90:
        return 5
    # Post-90 extra time is retained in the cache but is not regular-time timing data.
    return None


def timing_event_cache_dir(league: str, root: Path | None = None) -> Path:
    base = root or (config.MODEL_DIR / "data" / "timing_events")
    return base / league


def cached_fixture_path(league: str, season: int, fixture_id: str, root: Path | None = None) -> Path:
    return timing_event_cache_dir(league, root) / str(season) / f"{fixture_id}.json"


def write_fixture_event_cache(
    league: str,
    season: int,
    fixture_id: str,
    events: list[dict[str, object]],
    root: Path | None = None,
) -> Path:
    allowed_keys = {"minute", "extra_time", "team", "type"}
    for event in events:
        if set(event) != allowed_keys:
            raise ValueError("Event cache rows may contain only minute, extra_time, team, and type.")
        if not _valid_integer(event["minute"]) or (event["extra_time"] is not None and not _valid_integer(event["extra_time"])):
            raise ValueError("Event cache has an invalid minute.")
        if not isinstance(event["team"], str) or not event["team"].strip() or event["type"] not in EVENT_TYPES:
            raise ValueError("Event cache has an invalid team or event type.")
    path = cached_fixture_path(league, season, fixture_id, root)
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps({"events": events}, separators=(",", ":"), allow_nan=False)
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(content, encoding="utf-8")
    temporary.replace(path)
    return path


def load_cached_goal_events(league: str, root: Path | None = None) -> list[dict[str, object]]:
    folder = timing_event_cache_dir(league, root)
    if not folder.exists():
        return []
    all_events: list[dict[str, object]] = []
    for path in folder.glob("*/*.json"):
        try:
            cached = json.loads(path.read_text(encoding="utf-8"))
            rows = cached.get("events")
            if not isinstance(rows, list):
                continue
            for event in rows:
                if (
                    isinstance(event, dict)
                    and set(event) == {"minute", "extra_time", "team", "type"}
                    and _valid_integer(event.get("minute"))
                    and (event.get("extra_time") is None or _valid_integer(event.get("extra_time")))
                    and isinstance(event.get("team"), str)
                    and event.get("type") in EVENT_TYPES
                ):
                    all_events.append(event)
        except (OSError, ValueError, json.JSONDecodeError):
            continue
    return all_events


class MinuteWindowTimingModel:
    """League goal-window shares with conservative, sample-gated team rates."""

    PRIOR_GOALS_PER_WINDOW = 0.5

    def __init__(
        self,
        events: Iterable[dict[str, object]],
        *,
        min_league_goals: int = 3000,
        min_team_goals: int = 120,
    ) -> None:
        self.min_league_goals = min_league_goals
        self.min_team_goals = min_team_goals
        self.league_counts: Counter[int] = Counter()
        self.team_counts: dict[str, Counter[int]] = defaultdict(Counter)
        for event in events:
            minute = event.get("minute")
            team = event.get("team")
            if not _valid_integer(minute) or not isinstance(team, str):
                continue
            window = _window_index(minute)
            if window is None:
                continue
            self.league_counts[window] += 1
            self.team_counts[team][window] += 1

    @property
    def training_goal_count(self) -> int:
        return sum(self.league_counts.values())

    @property
    def ready(self) -> bool:
        return self.training_goal_count >= self.min_league_goals

    def _shares(self, team: str) -> tuple[list[float], bool]:
        league_n = self.training_goal_count
        league_denominator = league_n + self.PRIOR_GOALS_PER_WINDOW * len(WINDOW_LABELS)
        league_shares = [
            (self.league_counts[index] + self.PRIOR_GOALS_PER_WINDOW) / league_denominator
            for index in range(len(WINDOW_LABELS))
        ]
        team_counts = self.team_counts[team]
        team_n = sum(team_counts.values())
        if not self.ready or team_n < self.min_team_goals:
            return league_shares, False
        shrinkage_goals = float(self.min_team_goals)
        denominator = team_n + shrinkage_goals
        shares = [
            (team_counts[index] + shrinkage_goals * league_shares[index]) / denominator
            for index in range(len(WINDOW_LABELS))
        ]
        return shares, True

    def predict(
        self, home: str, away: str, expected_home: float, expected_away: float
    ) -> dict[str, object] | None:
        # A real league-wide event pattern is useful before the threshold, but
        # team-specific windows stay gated until both league and team samples qualify.
        if self.training_goal_count == 0:
            return None
        home_shares, home_signal = self._shares(home)
        away_shares, away_signal = self._shares(away)
        team_signal = home_signal and away_signal
        home_windows: dict[str, dict[str, float]] = {}
        away_windows: dict[str, dict[str, float]] = {}
        before_30_rate = 0.0
        for index, label in enumerate(WINDOW_LABELS):
            home_rate = max(0.0, expected_home) * home_shares[index]
            away_rate = max(0.0, expected_away) * away_shares[index]
            home_windows[label] = {"expected_goals": home_rate, "p_at_least_one": 1.0 - math.exp(-home_rate)}
            away_windows[label] = {"expected_goals": away_rate, "p_at_least_one": 1.0 - math.exp(-away_rate)}
            if index < 2:
                before_30_rate += home_rate + away_rate
        return {
            "home": home_windows,
            "away": away_windows,
            "p_first_goal_before_30": 1.0 - math.exp(-before_30_rate),
            "team_specific_signal": team_signal,
            "league_goal_sample": self.training_goal_count,
        }
