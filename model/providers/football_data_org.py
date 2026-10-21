"""football-data.org v4 fixture and recent-result provider."""

from __future__ import annotations

import json
import hashlib
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

from model import config
from model.providers.base import Fixture, FixtureProvider
from model.providers.teams import canonical_team


class FootballDataOrgProvider(FixtureProvider):
    BASE_URL = "https://api.football-data.org/v4"
    COMPETITIONS = {"E0": "PL", "E1": "ELC", "D1": "BL1", "I1": "SA", "SP1": "PD"}

    def __init__(self, token: str | None = None, cache_dir: Path | None = None) -> None:
        self.token = token if token is not None else os.getenv("FOOTBALL_DATA_TOKEN", "")
        if not self.token:
            raise RuntimeError("FOOTBALL_DATA_TOKEN is required for football-data.org.")
        self.cache_dir = cache_dir or (config.MODEL_DIR / "data" / "provider_cache")
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._last_request = 0.0

    def _get(self, path: str, params: dict[str, str]) -> dict[str, Any]:
        query = urllib.parse.urlencode(params)
        url = f"{self.BASE_URL}{path}?{query}"
        cache_path = self.cache_dir / (hashlib.sha256(url.encode("utf-8")).hexdigest() + ".json")
        now = time.time()
        if cache_path.exists() and now - cache_path.stat().st_mtime < 6 * 60 * 60:
            return json.loads(cache_path.read_text(encoding="utf-8"))

        last_error: Exception | None = None
        for attempt in range(3):
            wait_for = max(0.0, 6.1 - (time.monotonic() - self._last_request))
            if wait_for:
                time.sleep(wait_for)
            request = urllib.request.Request(url, headers={"X-Auth-Token": self.token})
            try:
                self._last_request = time.monotonic()
                with urllib.request.urlopen(request, timeout=20) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                if not isinstance(payload, dict):
                    raise ValueError("football-data.org response must be a JSON object")
                cache_path.write_text(json.dumps(payload), encoding="utf-8")
                return payload
            except urllib.error.HTTPError as exc:
                last_error = exc
                if exc.code not in (429, 500, 502, 503, 504):
                    break
            except Exception as exc:  # network, decoding, or schema errors
                last_error = exc
            if attempt < 2:
                time.sleep(2**attempt)
        raise RuntimeError(f"football-data.org request failed: {last_error}") from last_error

    @staticmethod
    def _valid_datetime(value: object) -> datetime:
        if not isinstance(value, str):
            raise ValueError("Match utcDate is missing")
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError("Match utcDate must include a timezone")
        return parsed.astimezone(timezone.utc)

    def _matches(self, start: datetime, end: datetime, status: str | None = None) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        for competition in self.COMPETITIONS.values():
            params = {"dateFrom": start.date().isoformat(), "dateTo": end.date().isoformat(), "limit": "500"}
            if status:
                params["status"] = status
            payload = self._get(f"/competitions/{competition}/matches", params)
            matches = payload.get("matches")
            if not isinstance(matches, list):
                raise ValueError("football-data.org matches field must be a list")
            for match in matches:
                if not isinstance(match, dict):
                    raise ValueError("football-data.org match row must be an object")
                items.append(match)
        return items

    def get_fixtures(self, start: datetime, end: datetime) -> list[Fixture]:
        fixtures: list[Fixture] = []
        for row in self._matches(start, end):
            if row.get("status") not in {"SCHEDULED", "TIMED"}:
                continue
            match_id = row.get("id")
            competition = row.get("competition", {}).get("code")
            home = row.get("homeTeam", {}).get("name")
            away = row.get("awayTeam", {}).get("name")
            if not isinstance(match_id, int) or not competition or not home or not away:
                raise ValueError("Fixture is missing id, competition, or team")
            kickoff = self._valid_datetime(row.get("utcDate"))
            if not start <= kickoff <= end:
                continue
            fixtures.append(Fixture(str(match_id), str(competition), kickoff,
                                    canonical_team(str(home), "football-data.org"),
                                    canonical_team(str(away), "football-data.org"),
                                    str(row["status"])))
        return fixtures

    def get_finished(self, start: datetime, end: datetime) -> pd.DataFrame:
        rows: list[dict[str, object]] = []
        for row in self._matches(start, end, "FINISHED"):
            score = row.get("score", {}).get("fullTime", {})
            home_goals, away_goals = score.get("home"), score.get("away")
            if not isinstance(home_goals, int) or not isinstance(away_goals, int) or min(home_goals, away_goals) < 0:
                continue
            competition_code = row.get("competition", {}).get("code")
            div = next((key for key, value in self.COMPETITIONS.items() if value == competition_code), None)
            home, away = row.get("homeTeam", {}).get("name"), row.get("awayTeam", {}).get("name")
            if not div or not home or not away:
                continue
            kickoff = self._valid_datetime(row.get("utcDate"))
            rows.append({"ProviderId": str(row["id"]), "Div": div, "Date": kickoff,
                         "HomeTeam": canonical_team(str(home), "football-data.org"),
                         "AwayTeam": canonical_team(str(away), "football-data.org"),
                         "FTHG": home_goals, "FTAG": away_goals,
                         "FTR": "H" if home_goals > away_goals else "A" if home_goals < away_goals else "D"})
        return pd.DataFrame(rows)
