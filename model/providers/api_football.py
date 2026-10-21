"""API-Football v3 fallback for real fixtures and finished match results."""

from __future__ import annotations

import hashlib
import json
import os
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

from model import config
from model.providers.base import Fixture, FixtureProvider
from model.providers.teams import canonical_team


class ApiFootballProvider(FixtureProvider):
    BASE_URL = "https://v3.football.api-sports.io"
    LEAGUES = {"E0": 39, "E1": 40, "D1": 78, "I1": 135, "SP1": 140}

    def __init__(self, api_key: str | None = None, cache_dir: Path | None = None) -> None:
        self.api_key = api_key if api_key is not None else os.getenv("API_FOOTBALL_KEY", "")
        if not self.api_key:
            raise RuntimeError("API_FOOTBALL_KEY is required for API-Football.")
        self.cache_dir = cache_dir or (config.MODEL_DIR / "data" / "provider_cache")
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._last_request = 0.0

    def _get(self, params: dict[str, str]) -> list[dict[str, Any]]:
        query = urllib.parse.urlencode(params)
        cache_path = self.cache_dir / ("api_football_" + hashlib.sha256(query.encode("utf-8")).hexdigest() + ".json")
        if cache_path.exists() and time.time() - cache_path.stat().st_mtime < 900:
            return json.loads(cache_path.read_text(encoding="utf-8"))
        request = urllib.request.Request(
            f"{self.BASE_URL}/fixtures?{query}",
            headers={"x-apisports-key": self.api_key},
        )
        last_error: Exception | None = None
        for attempt in range(3):
            pause = max(0.0, 6.1 - (time.monotonic() - self._last_request))
            if pause:
                time.sleep(pause)
            try:
                self._last_request = time.monotonic()
                with urllib.request.urlopen(request, timeout=20) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                if not isinstance(payload, dict) or payload.get("errors"):
                    raise ValueError("API-Football returned an error response")
                items = payload.get("response")
                if not isinstance(items, list):
                    raise ValueError("API-Football response field must be a list")
                cache_path.write_text(json.dumps(items), encoding="utf-8")
                return items
            except Exception as exc:
                last_error = exc
                if attempt < 2:
                    time.sleep(2**attempt)
        raise RuntimeError(f"API-Football request failed: {last_error}") from last_error

    @staticmethod
    def _row(item: dict[str, Any], div: str) -> dict[str, object]:
        fixture = item.get("fixture", {})
        teams = item.get("teams", {})
        goals = item.get("goals", {})
        kickoff = fixture.get("date")
        if not isinstance(fixture.get("id"), int) or not isinstance(kickoff, str):
            raise ValueError("API-Football fixture is missing id or UTC kickoff")
        parsed = datetime.fromisoformat(kickoff.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError("API-Football kickoff must include timezone")
        home, away = teams.get("home", {}).get("name"), teams.get("away", {}).get("name")
        if not home or not away:
            raise ValueError("API-Football fixture is missing team names")
        return {
            "id": str(fixture["id"]), "competition": div,
            "kickoff": parsed.astimezone(timezone.utc),
            "home": canonical_team(str(home), "api-football"),
            "away": canonical_team(str(away), "api-football"),
            "status": str(fixture.get("status", {}).get("short", "")),
            "home_goals": goals.get("home"), "away_goals": goals.get("away"),
        }

    def _fetch(self, start: datetime, end: datetime, finished: bool) -> list[dict[str, object]]:
        rows: list[dict[str, object]] = []
        for div, league_id in self.LEAGUES.items():
            # API-Football seasons are identified by their start year.
            first_season = start.year if start.month >= 7 else start.year - 1
            last_season = end.year if end.month >= 7 else end.year - 1
            for season in range(first_season, last_season + 1):
                for item in self._get({
                    "league": str(league_id), "season": str(season),
                    "from": start.date().isoformat(), "to": end.date().isoformat(),
                }):
                    row = self._row(item, div)
                    if not start <= row["kickoff"] <= end:
                        continue
                    if finished and row["status"] not in {"FT", "AET", "PEN"}:
                        continue
                    rows.append(row)
        return rows

    def get_fixtures(self, start: datetime, end: datetime) -> list[Fixture]:
        return [Fixture(str(row["id"]), str(row["competition"]), row["kickoff"],
                        str(row["home"]), str(row["away"]), "SCHEDULED")
                for row in self._fetch(start, end, finished=False)
                if row["status"] in {"NS", "TBD"}]

    def get_finished(self, start: datetime, end: datetime) -> pd.DataFrame:
        rows: list[dict[str, object]] = []
        for item in self._fetch(start, end, finished=True):
            home_goals, away_goals = item["home_goals"], item["away_goals"]
            if not isinstance(home_goals, int) or not isinstance(away_goals, int) or min(home_goals, away_goals) < 0:
                continue
            rows.append({"ProviderId": item["id"], "Div": item["competition"], "Date": item["kickoff"],
                         "HomeTeam": item["home"], "AwayTeam": item["away"], "FTHG": home_goals,
                         "FTAG": away_goals, "FTR": "H" if home_goals > away_goals else "A" if home_goals < away_goals else "D"})
        return pd.DataFrame(rows)
