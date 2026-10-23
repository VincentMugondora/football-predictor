"""Walk-forward first/second-half goal-share estimates from validated HT scores."""

from __future__ import annotations

import math
from collections import defaultdict

import pandas as pd


class HalfTimeGoalTimingModel:
    """Estimate team first-half goal shares, shrunk toward each league's rate."""

    PRIOR_GOALS = 20.0
    MIN_TEAM_GOALS = 30
    DEFAULT_LEAGUE_SHARE = 0.45

    def __init__(self) -> None:
        self.league_goals: dict[str, list[int]] = defaultdict(lambda: [0, 0])
        self.team_goals: dict[tuple[str, str], list[int]] = defaultdict(lambda: [0, 0])

    @staticmethod
    def valid_halftime(home_ft: object, away_ft: object, home_ht: object, away_ht: object) -> bool:
        values = (home_ft, away_ft, home_ht, away_ht)
        if any(pd.isna(value) for value in values):
            return False
        return (
            all(float(value).is_integer() and float(value) >= 0 for value in values)
            and float(home_ht) <= float(home_ft)
            and float(away_ht) <= float(away_ft)
        )

    def league_share(self, league: str) -> float | None:
        first, total = self.league_goals[league]
        if total == 0:
            return None
        return (first + self.PRIOR_GOALS * self.DEFAULT_LEAGUE_SHARE) / (total + self.PRIOR_GOALS)

    def team_share(self, league: str, team: str) -> tuple[float | None, bool]:
        league_share = self.league_share(league)
        if league_share is None:
            return None, False
        first, total = self.team_goals[(league, team)]
        if total < self.MIN_TEAM_GOALS:
            return league_share, False
        return (first + self.PRIOR_GOALS * league_share) / (total + self.PRIOR_GOALS), True

    def shares(self, league: str, home: str, away: str) -> tuple[float, float, float, bool] | None:
        league_share = self.league_share(league)
        if league_share is None:
            return None
        home_share, home_signal = self.team_share(league, home)
        away_share, away_signal = self.team_share(league, away)
        assert home_share is not None and away_share is not None
        if not (home_signal and away_signal):
            return league_share, league_share, league_share, False
        return home_share, away_share, league_share, True

    def observe(
        self,
        league: str,
        home: str,
        away: str,
        home_ft: object,
        away_ft: object,
        home_ht: object,
        away_ht: object,
    ) -> None:
        if not self.valid_halftime(home_ft, away_ft, home_ht, away_ht):
            return
        home_total, away_total = int(home_ft), int(away_ft)
        home_first, away_first = int(home_ht), int(away_ht)
        self.league_goals[league][0] += home_first + away_first
        self.league_goals[league][1] += home_total + away_total
        self.team_goals[(league, home)][0] += home_first
        self.team_goals[(league, home)][1] += home_total
        self.team_goals[(league, away)][0] += away_first
        self.team_goals[(league, away)][1] += away_total

    def predict(
        self, league: str, home: str, away: str, expected_home: float, expected_away: float
    ) -> dict[str, object] | None:
        estimated = self.shares(league, home, away)
        if estimated is None:
            return None
        home_share, away_share, league_share, team_signal = estimated
        home_first = expected_home * home_share
        away_first = expected_away * away_share
        return {
            "home": {"first": home_first, "second": expected_home - home_first},
            "away": {"first": away_first, "second": expected_away - away_first},
            "p_first_half_goal": 1.0 - math.exp(-(home_first + away_first)),
            "league_first_share": league_share,
            "team_specific_signal": team_signal,
        }

