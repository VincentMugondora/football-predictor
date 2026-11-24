"""Optional The Odds API v4 h2h market reference provider."""

from __future__ import annotations

import json
import os
import statistics
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

from model import config
from model.providers.base import Fixture, OddsProvider
from model.providers.teams import canonical_team, record_unmatched_team_names


# Low-margin "sharp" prices. In walk-forward tests (docs/experiments.md) anchoring to the
# Betfair Exchange or Pinnacle beat a single high-street bookmaker and the median of them.
SHARP_BOOKMAKERS = ("pinnacle", "betfair_ex_uk", "betfair_ex_eu", "smarkets", "matchbook")


def consensus_h2h(books: list[dict], home: str, away: str) -> tuple[list[float], str] | None:
    """Margin-free consensus 1X2 odds from one event's bookmakers.

    Averages the margin-free chances of the sharp books that priced all three outcomes;
    if none did, uses the median across every bookmaker. Returns fair (no-margin) decimal
    odds [home, draw, away] and a short source label, or None.
    """
    priced: list[tuple[str, str, tuple[float, float, float]]] = []
    for book in books:
        if not isinstance(book, dict):
            continue
        market = next((m for m in book.get("markets", []) if isinstance(m, dict) and m.get("key") == "h2h"), None)
        if not market:
            continue
        prices: dict[str, object] = {}
        draw_price = None
        for outcome in market.get("outcomes", []):
            if not isinstance(outcome, dict):
                continue
            name = str(outcome.get("name", ""))
            if name.casefold() == "draw":
                draw_price = outcome.get("price")
            else:
                prices[canonical_team(name, "The Odds API").casefold()] = outcome.get("price")
        values = (prices.get(home.casefold()), draw_price, prices.get(away.casefold()))
        if not all(isinstance(v, (int, float)) and v > 1 for v in values):
            continue
        inverse = [1.0 / float(v) for v in values]
        total = sum(inverse)
        chances = (inverse[0] / total, inverse[1] / total, inverse[2] / total)
        priced.append((str(book.get("key", "")).lower(), str(book.get("title", book.get("key", ""))), chances))
    if not priced:
        return None
    sharp = [row for row in priced if row[0] in SHARP_BOOKMAKERS]
    if sharp:
        chances = [sum(row[2][k] for row in sharp) / len(sharp) for k in range(3)]
        label = "Sharp average: " + ", ".join(sorted({row[1] for row in sharp}))
    else:
        chances = [statistics.median(row[2][k] for row in priced) for k in range(3)]
        label = f"Median of {len(priced)} bookmakers"
    total = sum(chances)
    return [round(total / c, 3) for c in chances], label


def needs_refresh(
    fetched_at: datetime | None,
    kickoffs: list[datetime],
    now: datetime,
    refresh_hours: float,
    conserve: bool = False,
) -> bool:
    """Decide whether one league's odds are worth a credit (1 credit per league per fetch).

    Fetch when there is no cache; when a match starts within 6 hours and prices are older
    than ``refresh_hours`` (team news is in the market by then; skipped when ``conserve``);
    when a match starts within 30 hours and prices are over 20 hours old; or when prices
    are over 4 days old. Simulated on real fixtures: about 300 of the free plan's 500
    monthly credits for 8 leagues.
    """
    upcoming = [k for k in kickoffs if k > now]
    if not upcoming:
        return fetched_at is None
    if fetched_at is None:
        return True
    age = now - fetched_at
    soonest = min(upcoming) - now
    if not conserve and soonest <= timedelta(hours=6) and age > timedelta(hours=refresh_hours):
        return True
    if soonest <= timedelta(hours=30) and age > timedelta(hours=20):
        return True
    return age > timedelta(hours=96)


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
        now = datetime.now(timezone.utc)
        refresh_hours = float(os.getenv("ODDS_REFRESH_HOURS", str(config.ODDS_REFRESH_HOURS)))
        for sport, sport_fixtures in by_sport.items():
            cache_path = self.cache_dir / f"odds_{sport}_latest.json"
            cached: dict | None = None
            fetched_at: datetime | None = None
            if cache_path.exists():
                try:
                    cached = json.loads(cache_path.read_text(encoding="utf-8"))
                    fetched_at = datetime.fromisoformat(str(cached.get("fetched_at")))
                except (ValueError, OSError, TypeError):
                    cached, fetched_at = None, None
                if cached is not None:
                    self.credits_remaining = cached.get("credits_remaining", self.credits_remaining)
            conserve = self.credits_remaining is not None and self.credits_remaining < config.ODDS_CONSERVE_BELOW
            refresh = needs_refresh(fetched_at, [f.kickoff for f in sport_fixtures], now, refresh_hours, conserve)
            low_credits = self.credits_remaining is not None and self.credits_remaining <= min_credits_remaining
            if refresh and low_credits:
                if cached is None:
                    break
                refresh = False  # keep the older prices rather than spend the last credits
            query = urllib.parse.urlencode({"apiKey": self.api_key, "regions": os.getenv("ODDS_REGION", "uk"),
                                            "markets": "h2h", "oddsFormat": "decimal"})
            url = f"{self.BASE_URL}/sports/{urllib.parse.quote(sport)}/odds?{query}"
            request = urllib.request.Request(url)
            if cached is not None and not refresh:
                payload = cached["payload"]
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
                    cache_path.write_text(json.dumps({"payload": payload, "credits_remaining": self.credits_remaining,
                                                      "fetched_at": now.isoformat()}), encoding="utf-8")
                except (urllib.error.URLError, ValueError, OSError) as exc:
                    if cached is not None:
                        print(f"The Odds API refresh failed for {sport}; using prices from {fetched_at}.", flush=True)
                        payload = cached["payload"]
                    else:
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
                consensus = consensus_h2h(books, match.home, match.away)
                if consensus is not None:
                    results[match.id] = {"odds": consensus[0], "source": consensus[1]}
        if unmatched_names:
            record_unmatched_team_names(sorted(unmatched_names), "The Odds API", known_names)
            for name in sorted(unmatched_names):
                print(f"WARNING: Skipping odds-linked fixture(s); The Odds API team {name!r} is unmatched.", flush=True)
        return results
