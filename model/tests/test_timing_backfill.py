from __future__ import annotations

from pathlib import Path
from typing import Any

from model import config
from model.providers.api_football_events import ApiFootballEventsProvider
from model.timing_backfill import run_timing_backfill
from model.timing_windows import write_fixture_event_cache


def _row(fixture_id: int, status: str = "FT") -> dict[str, Any]:
    return {
        "fixture": {"id": fixture_id, "status": {"short": status}, "date": f"2024-08-{105 - fixture_id:02d}T15:00:00+00:00"},
        "teams": {"home": {"id": 39, "name": "Arsenal FC"}, "away": {"id": 40, "name": "Chelsea FC"}},
        "goals": {"home": 1, "away": 0},
    }


class StubEventsProvider(ApiFootballEventsProvider):
    def __init__(self, remaining: int, rows: list[dict[str, Any]]) -> None:
        super().__init__(api_key="test-key")
        self.requests_remaining = remaining
        self.rows = rows
        self.coverage_calls: list[tuple[int, int]] = []
        self.event_calls: list[int] = []
        self.pages: list[tuple[int, int]] = []

    def _consume(self) -> None:
        self.requests_made += 1
        self.requests_remaining -= 1

    def get_event_coverage(self, league_id: int, season: int, *, max_requests: int) -> dict[str, Any]:
        self._consume()
        self.coverage_calls.append((league_id, season))
        return {"available": True, "events": True, "errors": {}}

    def get_fixture_page(self, league_id: int, season: int, page: int, *, max_requests: int):
        self._consume()
        self.pages.append((season, page))
        return self.rows, 1

    def get_fixture_events(self, fixture_id: int, *, max_requests: int):
        self._consume()
        self.event_calls.append(fixture_id)
        return [{
            "time": {"elapsed": 10, "extra": None},
            "team": {"id": 39, "name": "Arsenal FC"},
            "type": "Goal", "detail": "Normal Goal", "comments": None,
        }]


def _settings(**overrides: object) -> dict[str, object]:
    return {
        "enabled": True,
        "league": "E0",
        "reserve": 40,
        "max_requests": 30,
        "min_goals_per_league": 3000,
        "min_team_goals": 120,
        "start_season": 2024,
        "min_season": 2024,
        **overrides,
    }


def test_backfill_stops_at_reserve_and_does_not_spend_reserved_requests(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(config, "MODEL_DIR", tmp_path)
    provider = StubEventsProvider(42, [_row(101)])

    result = run_timing_backfill(
        _settings(), provider=provider, state_path=tmp_path / "state.json",
    )

    assert provider.coverage_calls == [(39, 2024)]
    assert provider.requests_made == 2  # Coverage plus fixture listing; now exactly at reserve.
    assert provider.event_calls == []
    assert provider.requests_remaining == 40
    assert result["requests_made"] <= 30


def test_backfill_skips_cached_and_unfinished_fixtures_and_honors_hard_cap(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(config, "MODEL_DIR", tmp_path)
    write_fixture_event_cache("E0", 2024, "101", [], tmp_path / "data" / "timing_events")
    provider = StubEventsProvider(100, [_row(101), _row(102, "NS"), _row(103), _row(104)])

    result = run_timing_backfill(
        _settings(max_requests=3), provider=provider, state_path=tmp_path / "state.json",
    )

    assert provider.coverage_calls == [(39, 2024)]
    assert provider.event_calls == [103]
    assert provider.requests_made == 3  # Coverage, fixture listing, and one event request.
    assert result["fixtures_cached"] == 2  # The prior zero-goal cache plus the newly fetched fixture.


def test_disabled_backfill_makes_no_provider_requests(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(config, "MODEL_DIR", tmp_path)
    provider = StubEventsProvider(100, [])

    result = run_timing_backfill(
        _settings(enabled=False), provider=provider, state_path=tmp_path / "state.json",
    )

    assert provider.requests_made == 0
    assert result["stop_reason"] == "disabled (default)"


def test_backfill_season_cursor_moves_backwards_after_current_season(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(config, "MODEL_DIR", tmp_path)
    provider = StubEventsProvider(100, [])
    provider.get_event_coverage = lambda league_id, season, *, max_requests: (
        provider._consume() or provider.coverage_calls.append((league_id, season)) or
        {"available": season == 2024, "events": season == 2024, "errors": {}}
    )

    run_timing_backfill(
        _settings(max_requests=10, min_season=2023), provider=provider, state_path=tmp_path / "state.json",
    )

    assert provider.coverage_calls == [(39, 2024), (39, 2023)]


def test_backfill_stops_fetching_after_league_training_threshold(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(config, "MODEL_DIR", tmp_path)
    provider = StubEventsProvider(100, [_row(101), _row(102)])

    result = run_timing_backfill(
        _settings(min_goals_per_league=1, max_requests=20),
        provider=provider,
        state_path=tmp_path / "state.json",
    )

    assert provider.event_calls == [101]  # Latest fixture satisfies threshold; older one is not requested.
    assert result["training_goals"] == 1
    assert result["stop_reason"] == "training threshold reached"
