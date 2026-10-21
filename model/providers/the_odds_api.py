"""Optional The Odds API v4 h2h market reference provider."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from model.providers.base import Fixture, OddsProvider


class TheOddsApiProvider(OddsProvider):
    BASE_URL = "https://api.the-odds-api.com/v4"

    def __init__(self, api_key: str | None = None, sport_by_competition: dict[str, str] | None = None) -> None:
        self.api_key = api_key if api_key is not None else os.getenv("THE_ODDS_API_KEY", "")
        if not self.api_key:
            raise RuntimeError("THE_ODDS_API_KEY is required for The Odds API.")
        self.sport_by_competition = sport_by_competition or {}
        self.credits_remaining: int | None = None

    def get_h2h_odds(self, fixtures: list[Fixture]) -> dict[str, dict[str, object]]:
        results: dict[str, dict[str, object]] = {}
        by_sport: dict[str, list[Fixture]] = {}
        for fixture in fixtures:
            sport = self.sport_by_competition.get(fixture.competition)
            if sport:
                by_sport.setdefault(sport, []).append(fixture)
        for sport, sport_fixtures in by_sport.items():
            query = urllib.parse.urlencode({"apiKey": self.api_key, "regions": os.getenv("ODDS_REGION", "uk"),
                                            "markets": "h2h", "oddsFormat": "decimal"})
            url = f"{self.BASE_URL}/sports/{urllib.parse.quote(sport)}/odds?{query}"
            request = urllib.request.Request(url)
            try:
                with urllib.request.urlopen(request, timeout=20) as response:
                    remaining = response.headers.get("x-requests-remaining")
                    if remaining is not None:
                        self.credits_remaining = int(remaining)
                    payload = json.loads(response.read().decode("utf-8"))
            except (urllib.error.URLError, ValueError, OSError) as exc:
                raise RuntimeError(f"The Odds API request failed: {exc}") from exc
            if not isinstance(payload, list):
                raise ValueError("The Odds API response must be a list")
            for item in payload:
                if not isinstance(item, dict):
                    continue
                match = next((f for f in sport_fixtures if
                              f.home.casefold() == str(item.get("home_team", "")).casefold() and
                              f.away.casefold() == str(item.get("away_team", "")).casefold() and
                              abs((datetime.fromisoformat(str(item.get("commence_time", "")).replace("Z", "+00:00")) - f.kickoff).total_seconds()) < 21600), None)
                if not match:
                    continue
                bookmaker_rows = item.get("bookmakers", [])
                books = [book for book in bookmaker_rows if isinstance(book, dict)]
                if not books:
                    continue
                chosen = next((b for b in books if str(b.get("key", "")).lower() == "pinnacle"), books[0])
                market = next((m for m in chosen.get("markets", []) if isinstance(m, dict) and m.get("key") == "h2h"), None)
                if not market:
                    continue
                prices = {str(o.get("name", "")): o.get("price") for o in market.get("outcomes", []) if isinstance(o, dict)}
                values = (prices.get(match.home), prices.get("Draw"), prices.get(match.away))
                if all(isinstance(v, (int, float)) and v > 1 for v in values):
                    results[match.id] = {"odds": [float(v) for v in values], "source": str(chosen.get("title", "The Odds API"))}
        return results
