"""Optional The Odds API v4 h2h market reference provider."""

from __future__ import annotations

import json
import os
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from model import config
from model.providers.base import Fixture, OddsProvider
from model.providers.teams import canonical_team, record_unmatched_team_names


class TheOddsApiProvider(OddsProvider):
    BASE_URL = "https://api.the-odds-api.com/v4"

    def __init__(self, api_key: str | None = None, sport_by_competition: dict[str, str] | None = None) -> None:
        self.api_key = api_key if api_key is not None else os.getenv("THE_ODDS_API_KEY", "")
        if not self.api_key:
            raise RuntimeError("THE_ODDS_API_KEY is required for The Odds API.")
        self.sport_by_competition = sport_by_competition or {}
        self.credits_remaining: int | None = None
        self.credits_used: int = 0
        self.unmatched_fixture_ids: set[str] = set()
        self.cache_dir = Path(__file__).resolve().parents[1] / "data" / "provider_cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def get_h2h_odds(self, fixtures: list[Fixture], min_credits_remaining: int = 10) -> dict[str, dict[str, object]]:
        results: dict[str, dict[str, object]] = {}
        self.unmatched_fixture_ids.clear()
        unmatched_names: set[str] = set()
        known_names: set[str] = set()
        by_sport: dict[str, list[Fixture]] = {}
        for fixture in fixtures:
            sport = self.sport_by_competition.get(fixture.competition)
            if sport:
                by_sport.setdefault(sport, []).append(fixture)
                known_names.update((fixture.home, fixture.away))
        for sport, sport_fixtures in by_sport.items():
            cache_path = self.cache_dir / f"odds_{sport}_{datetime.now(timezone.utc).date().isoformat()}.json"
            if (
                self.credits_remaining is not None
                and self.credits_remaining <= min_credits_remaining
                and not cache_path.exists()
            ):
                break
            query = urllib.parse.urlencode({"apiKey": self.api_key, "regions": os.getenv("ODDS_REGION", "uk"),
                                            "markets": "h2h", "oddsFormat": "decimal"})
            url = f"{self.BASE_URL}/sports/{urllib.parse.quote(sport)}/odds?{query}"
            request = urllib.request.Request(url)
            if cache_path.exists():
                cached = json.loads(cache_path.read_text(encoding="utf-8"))
                payload = cached["payload"]
                self.credits_remaining = cached.get("credits_remaining")
            else:
                try:
                    with urllib.request.urlopen(request, timeout=20) as response:
                        remaining = response.headers.get("x-requests-remaining")
                        if remaining is not None:
                            self.credits_remaining = int(remaining)
                        last_cost = response.headers.get("x-requests-last")
                        if last_cost is not None:
                            self.credits_used += int(last_cost)
                        payload = json.loads(response.read().decode("utf-8"))
                    cache_path.write_text(json.dumps({"payload": payload, "credits_remaining": self.credits_remaining}), encoding="utf-8")
                except (urllib.error.URLError, ValueError, OSError) as exc:
                    safe_error = str(exc).replace(self.api_key, "[redacted]")
                    raise RuntimeError(f"The Odds API request failed: {safe_error}") from exc
            if not isinstance(payload, list):
                raise ValueError("The Odds API response must be a list")
            for item in payload:
                if not isinstance(item, dict):
                    continue
                odds_home = canonical_team(str(item.get("home_team", "")), "The Odds API")
                odds_away = canonical_team(str(item.get("away_team", "")), "The Odds API")
                try:
                    commence = datetime.fromisoformat(str(item.get("commence_time", "")).replace("Z", "+00:00"))
                except ValueError:
                    continue
                nearby = [f for f in sport_fixtures if abs((commence - f.kickoff).total_seconds()) < 21600]
                match = next((f for f in nearby if f.home.casefold() == odds_home.casefold() and
                              f.away.casefold() == odds_away.casefold()), None)
                if not match:
                    for candidate in nearby:
                        fixture_teams = {candidate.home.casefold(), candidate.away.casefold()}
                        matched_one_side = odds_home.casefold() in fixture_teams or odds_away.casefold() in fixture_teams
                        unknown = [name for name, canonical in ((str(item.get("home_team", "")), odds_home),
                                    (str(item.get("away_team", "")), odds_away))
                                   if canonical.casefold() not in fixture_teams and
                                   name not in config.TEAM_ALIASES and canonical not in config.TEAM_ALIASES.values()]
                        if matched_one_side and unknown:
                            self.unmatched_fixture_ids.add(candidate.id)
                            unmatched_names.update(unknown)
                    continue
                bookmaker_rows = item.get("bookmakers", [])
                books = [book for book in bookmaker_rows if isinstance(book, dict)]
                if not books:
                    continue
                chosen = next((b for b in books if str(b.get("key", "")).lower() == "pinnacle"), books[0])
                market = next((m for m in chosen.get("markets", []) if isinstance(m, dict) and m.get("key") == "h2h"), None)
                if not market:
                    continue
                prices = {canonical_team(str(o.get("name", "")), "The Odds API"): o.get("price")
                          for o in market.get("outcomes", []) if isinstance(o, dict) and str(o.get("name", "")).casefold() != "draw"}
                draw_price = next((o.get("price") for o in market.get("outcomes", [])
                                   if isinstance(o, dict) and str(o.get("name", "")).casefold() == "draw"), None)
                values = (prices.get(match.home), draw_price, prices.get(match.away))
                if all(isinstance(v, (int, float)) and v > 1 for v in values):
                    results[match.id] = {"odds": [float(v) for v in values], "source": str(chosen.get("title", "The Odds API"))}
        if unmatched_names:
            record_unmatched_team_names(sorted(unmatched_names), "The Odds API", known_names)
            for name in sorted(unmatched_names):
                print(f"WARNING: Skipping odds-linked fixture(s); The Odds API team {name!r} is unmatched.", flush=True)
        return results
