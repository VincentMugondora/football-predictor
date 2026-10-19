"""Online Poisson attack and defence rating model with Dixon-Coles correction (Phases 2 & 3)."""

from __future__ import annotations

import math
from collections import defaultdict, deque
from dataclasses import dataclass, field

import numpy as np

from model import config


@dataclass
class TeamHistoryStats:
    """Tracks strictly past results and per-game stats for a club."""

    recent_results: deque[str] = field(default_factory=lambda: deque(maxlen=5))
    goals_scored: deque[int] = field(default_factory=lambda: deque(maxlen=15))
    shots_taken: deque[float] = field(default_factory=lambda: deque(maxlen=15))


class OnlinePoissonModel:
    """
    Walk-forward online Poisson attack/defence model with per-league baselines
    and Dixon-Coles low-score dependency adjustment.
    Always predicts a match strictly BEFORE updating ratings from its result.
    """

    def __init__(
        self,
        lr: float = config.DEFAULT_LR,
        lr_global: float = config.DEFAULT_LR_GLOBAL,
        decay: float = config.DEFAULT_DECAY,
        rho: float = config.DEFAULT_DIXON_COLES_RHO,
        max_goals: int = 10,
    ) -> None:
        self.lr = lr
        self.lr_global = lr_global
        self.decay = decay
        self.rho = rho
        self.max_goals = max_goals

        # Per-league baseline average home and away goals
        self.league_home_mu: dict[str, float] = defaultdict(lambda: 1.50)
        self.league_away_mu: dict[str, float] = defaultdict(lambda: 1.20)

        # Per-team log-attack and log-defence ratings
        self.attack: dict[str, float] = defaultdict(float)
        self.defence: dict[str, float] = defaultdict(float)

        # Per-team strictly historical form and stats
        self.team_history: dict[str, TeamHistoryStats] = defaultdict(TeamHistoryStats)

        # Precompute log-factorials for fast Poisson PMF evaluation
        self._log_fact = np.array([math.lgamma(k + 1) for k in range(max_goals + 1)])

    def expected_goals(self, league: str, home: str, away: str) -> tuple[float, float]:
        """Returns (lambda_home, lambda_away) for a fixture prior to kickoff."""
        mu_h = self.league_home_mu[league]
        mu_a = self.league_away_mu[league]

        atk_h = self.attack[home]
        def_h = self.defence[home]
        atk_a = self.attack[away]
        def_a = self.defence[away]

        # Clamp exponents for numerical stability
        lam_h = mu_h * math.exp(max(-1.5, min(1.5, atk_h - def_a)))
        lam_a = mu_a * math.exp(max(-1.5, min(1.5, atk_a - def_h)))
        return max(0.15, lam_h), max(0.15, lam_a)

    def _poisson_pmf(self, lam: float) -> np.ndarray:
        k = np.arange(self.max_goals + 1)
        log_p = k * math.log(lam) - lam - self._log_fact
        p = np.exp(log_p)
        return p / np.sum(p)

    def predict_proba(self, league: str, home: str, away: str) -> tuple[float, float, float]:
        """
        Computes (p_home, p_draw, p_away) strictly from historical parameters.
        Applies Dixon-Coles low-score correlation adjustment on (0,0), (1,0), (0,1), (1,1).
        """
        lam_h, lam_a = self.expected_goals(league, home, away)
        p_h_goals = self._poisson_pmf(lam_h)
        p_a_goals = self._poisson_pmf(lam_a)

        grid = np.outer(p_h_goals, p_a_goals)

        # Dixon-Coles tau adjustment
        if self.rho != 0.0:
            grid[0, 0] *= max(0.0, 1.0 - lam_h * lam_a * self.rho)
            grid[0, 1] *= max(0.0, 1.0 + lam_h * self.rho)
            grid[1, 0] *= max(0.0, 1.0 + lam_a * self.rho)
            grid[1, 1] *= max(0.0, 1.0 - self.rho)

        total = float(np.sum(grid))
        if total <= 0.0:
            return (1.0 / 3.0, 1.0 / 3.0, 1.0 / 3.0)
        grid /= total

        p_draw = float(np.trace(grid))
        p_home = float(np.sum(np.tril(grid, k=-1)))
        p_away = float(np.sum(np.triu(grid, k=1)))

        # Ensure exact sum to 1.0
        norm = p_home + p_draw + p_away
        return (p_home / norm, p_draw / norm, p_away / norm)

    def observe_match(
        self,
        league: str,
        home: str,
        away: str,
        fthg: int,
        ftag: int,
        home_shots: float | None = None,
        away_shots: float | None = None,
    ) -> None:
        """Updates team attack/defence ratings and league baselines AFTER a match completes."""
        # Apply time decay to involved teams before gradient step
        self.attack[home] *= 1.0 - self.decay
        self.defence[home] *= 1.0 - self.decay
        self.attack[away] *= 1.0 - self.decay
        self.defence[away] *= 1.0 - self.decay

        lam_h, lam_a = self.expected_goals(league, home, away)
        err_h = float(fthg) - lam_h
        err_a = float(ftag) - lam_a

        self.attack[home] += self.lr * err_h
        self.defence[away] -= self.lr * err_h

        self.attack[away] += self.lr * err_a
        self.defence[home] -= self.lr * err_a

        # Update league-wide average goals
        mu_h = self.league_home_mu[league]
        mu_a = self.league_away_mu[league]
        self.league_home_mu[league] = max(0.8, mu_h + self.lr_global * (float(fthg) - mu_h))
        self.league_away_mu[league] = max(0.6, mu_a + self.lr_global * (float(ftag) - mu_a))

        # Update historical form and stats
        if fthg > ftag:
            h_res, a_res = "W", "L"
        elif fthg < ftag:
            h_res, a_res = "L", "W"
        else:
            h_res, a_res = "D", "D"

        self.team_history[home].recent_results.append(h_res)
        self.team_history[away].recent_results.append(a_res)
        self.team_history[home].goals_scored.append(int(fthg))
        self.team_history[away].goals_scored.append(int(ftag))

        if home_shots is not None and not math.isnan(home_shots):
            self.team_history[home].shots_taken.append(float(home_shots))
        if away_shots is not None and not math.isnan(away_shots):
            self.team_history[away].shots_taken.append(float(away_shots))

    def get_team_summary(self, team: str) -> dict[str, object]:
        """Returns rolling form and per-game averages from strictly prior matches."""
        hist = self.team_history[team]
        form = list(hist.recent_results)[-5:]
        while len(form) < 5:
            form.insert(0, "D")

        goals_pg = (
            float(np.mean(hist.goals_scored)) if len(hist.goals_scored) > 0 else 1.4
        )
        shots_pg = (
            int(round(float(np.mean(hist.shots_taken))))
            if len(hist.shots_taken) > 0
            else 12
        )
        # Estimate possession share from attack/defence balance and shot volume
        strength = self.attack[team] - self.defence[team]
        est_poss = int(round(max(38.0, min(65.0, 50.0 + strength * 14.0))))

        return {
            "form": form,
            "goals_per_game": round(goals_pg, 1),
            "shots": shots_pg,
            "possession": est_poss,
        }
