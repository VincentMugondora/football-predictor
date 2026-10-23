from __future__ import annotations

import json
from pathlib import Path

import pytest

from model.timing_windows import (
    MinuteWindowTimingModel,
    cached_fixture_path,
    load_cached_goal_events,
    parse_fixture_goal_events,
    write_fixture_event_cache,
)


def fixture_row(
    home_goals: int,
    away_goals: int,
    *,
    status: str = "FT",
) -> dict[str, object]:
    return {
        "fixture": {"id": 9981, "status": {"short": status}},
        "teams": {
            "home": {"id": 39, "name": "Arsenal FC"},
            "away": {"id": 40, "name": "Chelsea FC"},
        },
        "goals": {"home": home_goals, "away": away_goals},
    }


def event(minute: int, team_id: int, detail: str, *, extra: int | None = None, comments: str | None = None) -> dict[str, object]:
    return {
        "time": {"elapsed": minute, "extra": extra},
        "team": {"id": team_id, "name": "unneeded in compact cache"},
        "type": "Goal",
        "detail": detail,
        "comments": comments,
        "player": {"name": "must not be cached"},
    }


def test_scored_penalty_counts_missed_penalty_does_not_and_cancelled_goal_is_removed() -> None:
    row = fixture_row(2, 0)
    events = [
        event(12, 39, "Normal Goal"),
        event(31, 39, "Penalty"),
        event(60, 40, "Missed Penalty"),
        event(70, 39, "Normal Goal"),
        {"time": {"elapsed": 70, "extra": None}, "team": {"id": 39}, "type": "Var", "detail": "Goal cancelled"},
    ]

    parsed = parse_fixture_goal_events(row, events)

    assert [(item["minute"], item["type"], item["team"]) for item in parsed] == [
        (12, "goal", "Arsenal"), (31, "penalty", "Arsenal")
    ]


def test_own_goal_is_assigned_to_beneficiary_only_when_scoreline_uniquely_resolves_it() -> None:
    parsed = parse_fixture_goal_events(
        fixture_row(1, 1),
        [event(8, 39, "Normal Goal"), event(44, 39, "Own Goal")],
    )

    assert [(item["type"], item["team"]) for item in parsed] == [
        ("goal", "Arsenal"), ("own_goal", "Chelsea")
    ]

    with pytest.raises(ValueError, match="uniquely reconcile"):
        parse_fixture_goal_events(
            fixture_row(1, 1),
            [event(10, 39, "Own Goal"), event(70, 39, "Own Goal")],
        )


def test_shootout_penalties_are_not_match_goals_and_extra_time_is_retained() -> None:
    row = fixture_row(1, 1, status="PEN")
    parsed = parse_fixture_goal_events(row, [
        event(90, 39, "Normal Goal", extra=4),
        event(105, 40, "Penalty"),
        event(120, 39, "Penalty", comments="Penalty Shootout"),
    ])

    assert [(item["minute"], item["extra_time"], item["type"]) for item in parsed] == [
        (90, 4, "goal"), (105, None, "penalty")
    ]
    model = MinuteWindowTimingModel(parsed, min_league_goals=1, min_team_goals=1)
    assert model.training_goal_count == 1  # Minute 105 is cached, not part of 90-minute windows.
    with pytest.raises(ValueError, match="ambiguous"):
        parse_fixture_goal_events(
            row,
            [event(90, 39, "Normal Goal", extra=4), event(105, 40, "Penalty"), event(120, 39, "Penalty")],
        )


def test_cache_only_persists_allowed_goal_fields_and_skips_cached_fixture(tmp_path: Path) -> None:
    path = write_fixture_event_cache(
        "E0", 2024, "9981", [{"minute": 45, "extra_time": 2, "team": "Arsenal", "type": "goal"}], tmp_path,
    )
    payload = json.loads(path.read_text(encoding="utf-8"))

    assert path == cached_fixture_path("E0", 2024, "9981", tmp_path)
    assert set(payload) == {"events"}
    assert set(payload["events"][0]) == {"minute", "extra_time", "team", "type"}
    assert len(load_cached_goal_events("E0", tmp_path)) == 1
    with pytest.raises(ValueError, match="only minute"):
        write_fixture_event_cache("E0", 2024, "9982", [{
            "minute": 1, "extra_time": None, "team": "Arsenal", "type": "goal", "player": "unexpected"
        }], tmp_path)


def test_windows_show_league_average_below_threshold_and_gate_team_signal() -> None:
    small_sample = [
        {"minute": 5, "extra_time": None, "team": "Arsenal", "type": "goal"},
        {"minute": 40, "extra_time": None, "team": "Chelsea", "type": "goal"},
    ]
    league_only = MinuteWindowTimingModel(small_sample, min_league_goals=3, min_team_goals=1)
    prediction = league_only.predict("Arsenal", "Chelsea", 1.2, 0.8)

    assert prediction is not None
    assert prediction["team_specific_signal"] is False
    assert prediction["league_goal_sample"] == 2
    assert sum(item["expected_goals"] for item in prediction["home"].values()) == pytest.approx(1.2)
    assert 0 <= prediction["p_first_goal_before_30"] <= 1

    enough = small_sample * 3
    gated = MinuteWindowTimingModel(enough, min_league_goals=6, min_team_goals=3)
    team_prediction = gated.predict("Arsenal", "Chelsea", 1.2, 0.8)
    assert team_prediction is not None
    assert team_prediction["team_specific_signal"] is True


def test_no_timing_output_without_any_real_event_sample() -> None:
    assert MinuteWindowTimingModel([]).predict("Arsenal", "Chelsea", 1, 1) is None
