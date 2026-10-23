"""Quota-aware API-Football requests for the opt-in goal-minute backfill."""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


class ApiFootballEventsProvider:
    BASE_URL = "https://v3.football.api-sports.io"
    MIN_REQUEST_INTERVAL_SECONDS = 6.1  # Free plan: at most 10 requests/minute.

    def __init__(self, api_key: str | None = None, *, reserve_requests: int = 40) -> None:
        self.api_key = api_key if api_key is not None else os.getenv("API_FOOTBALL_KEY", "")
        if not self.api_key:
            raise RuntimeError("API_FOOTBALL_KEY is required for minute-window backfill.")
        self.last_request_at = 0.0
        self.requests_made = 0
        self.requests_remaining: int | None = None
        self.requests_limit: int | None = None
        self.reserve_requests = reserve_requests

    @staticmethod
    def _read_quota_header(headers: Any, name: str) -> int | None:
        value = headers.get(name)
        try:
            return int(value) if value is not None else None
        except (TypeError, ValueError):
            return None

    def _get_json(
        self,
        path: str,
        params: dict[str, str],
        *,
        max_requests: int,
        retries: int = 2,
    ) -> dict[str, Any]:
        if self.requests_made >= max_requests:
            raise RuntimeError("Minute backfill reached its per-run request cap.")
        query = urllib.parse.urlencode(params)
        request = urllib.request.Request(
            f"{self.BASE_URL}{path}?{query}",
            headers={"x-apisports-key": self.api_key},
        )
        last_error: Exception | None = None
        for attempt in range(retries + 1):
            if self.requests_made >= max_requests:
                raise RuntimeError("Minute backfill reached its per-run request cap.")
            if self.requests_remaining is not None and self.requests_remaining <= self.reserve_requests:
                raise RuntimeError("Minute backfill stopped at the configured API-Football request reserve.")
            wait_seconds = self.MIN_REQUEST_INTERVAL_SECONDS - (time.monotonic() - self.last_request_at)
            if wait_seconds > 0:
                time.sleep(wait_seconds)
            self.last_request_at = time.monotonic()
            self.requests_made += 1
            try:
                with urllib.request.urlopen(request, timeout=25) as response:
                    self.requests_remaining = self._read_quota_header(
                        response.headers, "x-ratelimit-requests-remaining"
                    )
                    self.requests_limit = self._read_quota_header(
                        response.headers, "x-ratelimit-requests-limit"
                    )
                    payload = json.loads(response.read().decode("utf-8"))
                if not isinstance(payload, dict):
                    raise ValueError("API-Football response must be a JSON object.")
                return payload
            except urllib.error.HTTPError as exc:
                self.requests_remaining = self._read_quota_header(
                    exc.headers, "x-ratelimit-requests-remaining"
                )
                self.requests_limit = self._read_quota_header(
                    exc.headers, "x-ratelimit-requests-limit"
                )
                last_error = exc
                if (
                    exc.code == 429
                    or exc.code < 500
                    or attempt == retries
                    or self.requests_remaining is None
                    or (self.requests_remaining is not None and self.requests_remaining <= self.reserve_requests)
                ):
                    break
            except (OSError, ValueError, json.JSONDecodeError) as exc:
                last_error = exc
                if attempt == retries or self.requests_remaining is None or self.requests_remaining <= self.reserve_requests:
                    break
            if attempt < retries:
                time.sleep(2**attempt)
        # Do not include request headers or API key in the raised message.
        raise RuntimeError(f"API-Football {path} request failed: {last_error}") from last_error

    def get_event_coverage(self, league_id: int, season: int, *, max_requests: int) -> dict[str, Any]:
        payload = self._get_json(
            "/leagues", {"id": str(league_id), "season": str(season)}, max_requests=max_requests
        )
        response_rows = payload.get("response", [])
        if not isinstance(response_rows, list):
            raise ValueError("API-Football leagues response must be a list.")
        for row in response_rows:
            if not isinstance(row, dict):
                continue
            league = row.get("league", {})
            if not isinstance(league, dict) or league.get("id") != league_id:
                continue
            seasons = row.get("seasons", [])
            if not isinstance(seasons, list):
                continue
            season_row = next(
                (item for item in seasons if isinstance(item, dict) and item.get("year") == season),
                None,
            )
            coverage = season_row.get("coverage", {}) if isinstance(season_row, dict) else {}
            fixtures = coverage.get("fixtures", {}) if isinstance(coverage, dict) else {}
            return {
                "available": season_row is not None,
                "events": fixtures.get("events") is True if isinstance(fixtures, dict) else False,
                "errors": payload.get("errors", {}),
            }
        return {"available": False, "events": False, "errors": payload.get("errors", {})}

    def get_fixture_page(
        self, league_id: int, season: int, page: int, *, max_requests: int
    ) -> tuple[list[dict[str, Any]], int]:
        payload = self._get_json(
            "/fixtures",
            {"league": str(league_id), "season": str(season), "page": str(page)},
            max_requests=max_requests,
        )
        if payload.get("errors"):
            raise RuntimeError(f"API-Football fixtures response reported errors: {payload['errors']}")
        items = payload.get("response")
        paging = payload.get("paging", {})
        if not isinstance(items, list) or not isinstance(paging, dict):
            raise ValueError("API-Football fixtures response is missing response or paging.")
        total_pages = paging.get("total", 1)
        if not isinstance(total_pages, int) or total_pages < 1:
            raise ValueError("API-Football fixtures paging.total is invalid.")
        if any(not isinstance(item, dict) for item in items):
            raise ValueError("API-Football fixture rows must be JSON objects.")
        return items, total_pages

    def get_fixture_events(self, fixture_id: int, *, max_requests: int) -> list[dict[str, Any]]:
        payload = self._get_json(
            "/fixtures/events", {"fixture": str(fixture_id)}, max_requests=max_requests
        )
        if payload.get("errors"):
            raise RuntimeError(f"API-Football events response reported errors: {payload['errors']}")
        items = payload.get("response")
        if not isinstance(items, list) or any(not isinstance(item, dict) for item in items):
            raise ValueError("API-Football events response must be a list of event objects.")
        return items
