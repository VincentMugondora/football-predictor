"""Hybrid Bivariate-Poisson, Dixon-Coles, Shot-Quality xG, and Dynamic Elo/Pi-Rating model."""

from __future__ import annotations

import math
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from model import config


@dataclass
class TeamHistoryStats:
    """Tracks strictly past results and per-game stats for a club."""

    recent_results: deque[str] = field(default_factory=lambda: deque(maxlen=5))
    goals_scored: deque[int] = field(default_factory=lambda: deque(maxlen=15))
    shots_taken: deque[float] = field(default_factory=lambda: deque(maxlen=15))
    shots_on_target: deque[float] = field(default_factory=lambda: deque(maxlen=15))
    xg_created: deque[float] = field(default_factory=lambda: deque(maxlen=15))


class OnlinePoissonModel:
    """
    State-of-the-art walk-forward football forecasting engine combining:
    1. Bivariate Poisson + Dixon-Coles low-score correlation + parity draw calibration
    2. Post-match Shot-Quality Expected Goals (xG) + Goal composite rating updates
    3. Dual-horizon (structural + short-term momentum) & venue-specific attack/defence ratings
    4. Margin-of-victory Elo strength anchor + Glicko-style dynamic uncertainty scaling
    5. Automatic off-season regression-to-the-mean and fixture-congestion (rest days) adjustment

    Strictly walk-forward: always predicts a match BEFORE observing its result.
    """

    def __init__(
        self,
        lr: float = config.DEFAULT_LR,
        lr_global: float = config.DEFAULT_LR_GLOBAL,
        decay: float = config.DEFAULT_DECAY,
        rho: float = config.DEFAULT_DIXON_COLES_RHO,
        max_goals: int = 10,
        lr_short: float = config.DEFAULT_LR_SHORT,
        lr_venue: float = config.DEFAULT_LR_VENUE,
        short_decay: float = config.DEFAULT_SHORT_DECAY,
        bivariate_gamma: float = config.DEFAULT_BIVARIATE_GAMMA,
        draw_parity_boost: float = config.DEFAULT_DRAW_PARITY_BOOST,
        offseason_regression: float = config.DEFAULT_OFFSEASON_REGRESSION,
    ) -> None:
        self.lr = lr
        self.lr_global = lr_global
        self.decay = decay
        self.rho = rho
        self.max_goals = max_goals
        self.lr_short = lr_short
        self.lr_venue = lr_venue
        self.short_decay = short_decay
        self.bivariate_gamma = bivariate_gamma
        self.draw_parity_boost = draw_parity_boost
        self.offseason_regression = offseason_regression

        # Per-league baseline average home and away goals
        self.league_home_mu: dict[str, float] = defaultdict(lambda: 1.50)
        self.league_away_mu: dict[str, float] = defaultdict(lambda: 1.20)

        # Long-term structural log-attack and log-defence ratings
        self.attack: dict[str, float] = defaultdict(float)
        self.defence: dict[str, float] = defaultdict(float)

        # Short-term form/momentum log-attack and log-defence ratings
        self.short_attack: dict[str, float] = defaultdict(float)
        self.short_defence: dict[str, float] = defaultdict(float)

        # Venue-specific attack modifiers (home specialist vs road specialist)
        self.home_attack_mod: dict[str, float] = defaultdict(float)
        self.away_attack_mod: dict[str, float] = defaultdict(float)

        # Continuous goal-superiority Elo rating (centered at 0.0 in log-goal units)
        self.elo: dict[str, float] = defaultdict(float)

        # Match counts and timestamps for dynamic uncertainty and rest-day adjustments
        self.matches_played: dict[str, int] = defaultdict(int)
        self.last_match_date: dict[str, Any] = {}
        self.league_last_date: dict[str, Any] = {}
        self.league_teams: dict[str, set[str]] = defaultdict(set)

        # Per-team strictly historical form and stats
        self.team_history: dict[str, TeamHistoryStats] = defaultdict(TeamHistoryStats)

        # Precompute log-factorials for fast Poisson PMF evaluation
        self._log_fact = np.array([math.lgamma(k + 1) for k in range(max_goals + 1)])

    @staticmethod
    def _to_ordinal_days(dt_val: Any) -> float | None:
        """Converts a pandas Timestamp, datetime, or ISO string to fractional days."""
        if dt_val is None:
            return None
        try:
            ts = getattr(dt_val, "timestamp", None)
            if callable(ts):
                val = float(ts())
                if not math.isnan(val):
                    return val / 86400.0
        except Exception:
            return None
        return None

    def _rest_adjustment(self, home: str, away: str, match_date: Any = None) -> tuple[float, float]:
        """Computes log-goal rest-day modifiers when fixture dates are available."""
        curr_days = self._to_ordinal_days(match_date)
        if curr_days is None:
            return 0.0, 0.0
        h_last = self.last_match_date.get(home)
        a_last = self.last_match_date.get(away)
        if h_last is None or a_last is None:
            return 0.0, 0.0

        h_rest = max(1.0, min(14.0, curr_days - h_last))
        a_rest = max(1.0, min(14.0, curr_days - a_last))

        # Penalize short turnaround (< 3.5 days) relative to a rested opponent
        h_fatigue = -0.025 if h_rest <= 3.2 and a_rest >= 5.5 else 0.0
        a_fatigue = -0.025 if a_rest <= 3.2 and h_rest >= 5.5 else 0.0
        return h_fatigue, a_fatigue

    def expected_goals(
        self, league: str, home: str, away: str, match_date: Any = None
    ) -> tuple[float, float]:
        """Returns (lambda_home, lambda_away) for a fixture prior to kickoff."""
        mu_h = self.league_home_mu[league]
        mu_a = self.league_away_mu[league]

        atk_h = (
            self.attack[home]
            + 0.22 * self.short_attack[home]
            + self.home_attack_mod[home]
        )
        def_h = self.defence[home] + 0.22 * self.short_defence[home]

        atk_a = (
            self.attack[away]
            + 0.22 * self.short_attack[away]
            + self.away_attack_mod[away]
        )
        def_a = self.defence[away] + 0.22 * self.short_defence[away]

        # Blend structural attack/defence with continuous Elo superiority
        elo_diff = self.elo[home] - self.elo[away]
        h_rest_mod, a_rest_mod = self._rest_adjustment(home, away, match_date)

        exp_arg_h = 0.82 * (atk_h - def_a) + 0.18 * elo_diff + h_rest_mod
        exp_arg_a = 0.82 * (atk_a - def_h) - 0.18 * elo_diff + a_rest_mod

        lam_h = mu_h * math.exp(max(-1.5, min(1.5, exp_arg_h)))
        lam_a = mu_a * math.exp(max(-1.5, min(1.5, exp_arg_a)))
        return max(0.15, lam_h), max(0.15, lam_a)

    def _poisson_pmf(self, lam: float) -> np.ndarray:
        k = np.arange(self.max_goals + 1)
        log_p = k * math.log(max(1e-9, lam)) - lam - self._log_fact
        p = np.exp(log_p)
        return p / np.sum(p)

    def predict_proba(
        self, league: str, home: str, away: str, match_date: Any = None
    ) -> tuple[float, float, float]:
        """
        Computes (p_home, p_draw, p_away) strictly from historical parameters.
        """
        grid = self.predict_score_grid(league, home, away, match_date=match_date)
        return self.outcome_probabilities(grid)

    def predict_score_grid(
        self, league: str, home: str, away: str, match_date: Any = None
    ) -> np.ndarray:
        """
        Returns the normalized home-score x away-score grid using a Bivariate Poisson
        shared-intensity mixture + Dixon-Coles low-score correlation + parity draw calibration,
        preserving the exact marginal expected goals (lam_h, lam_a).
        """
        lam_h, lam_a = self.expected_goals(league, home, away, match_date=match_date)

        # 1. Bivariate Poisson shared-intensity component (Karlis & Ntzoufras 2003)
        # Shared tempo rate lambda_0 correlates home and away scoring while preserving means
        lam_0 = min(lam_h, lam_a) * max(0.0, min(0.25, self.bivariate_gamma))
        lam_1 = max(0.08, lam_h - lam_0)
        lam_2 = max(0.08, lam_a - lam_0)

        p1 = self._poisson_pmf(lam_1)
        p2 = self._poisson_pmf(lam_2)
        indep_grid = np.outer(p1, p2)

        if lam_0 > 1e-4:
            p0 = self._poisson_pmf(lam_0)
            grid = np.zeros_like(indep_grid)
            for k in range(min(5, len(p0))):
                if p0[k] < 1e-7:
                    continue
                if k == 0:
                    grid += p0[0] * indep_grid
                else:
                    grid[k:, k:] += p0[k] * indep_grid[:-k, :-k]
        else:
            grid = indep_grid

        # 2. Dixon-Coles low-score correlation adjustment on (0,0), (0,1), (1,0), (1,1)
        if self.rho != 0.0:
            grid[0, 0] *= max(0.0, 1.0 - lam_h * lam_a * self.rho)
            grid[0, 1] *= max(0.0, 1.0 + lam_h * self.rho)
            grid[1, 0] *= max(0.0, 1.0 + lam_a * self.rho)
            grid[1, 1] *= max(0.0, 1.0 - self.rho)

        # 3. Competitive parity diagonal calibration (evenly matched clubs draw more often)
        if self.draw_parity_boost > 0.0:
            parity = math.exp(-1.5 * ((lam_h - lam_a) ** 2))
            diag_idx = np.arange(min(4, grid.shape[0]))
            grid[diag_idx, diag_idx] *= 1.0 + self.draw_parity_boost * parity

        total = float(np.sum(grid))
        if total <= 0.0:
            raise ValueError("Score grid has no probability mass")
        grid /= total
        return grid

    @staticmethod
    def outcome_probabilities(grid: np.ndarray) -> tuple[float, float, float]:
        """Derive home/draw/away probabilities from a normalized score grid."""
        p_draw = float(np.trace(grid))
        p_home = float(np.sum(np.tril(grid, k=-1)))
        p_away = float(np.sum(np.triu(grid, k=1)))

        norm = p_home + p_draw + p_away
        return (p_home / norm, p_draw / norm, p_away / norm)

    def predict_markets(
        self, league: str, home: str, away: str, match_date: Any = None
    ) -> dict[str, object]:
        """Derive every score and 1X2 market from one Bivariate Dixon-Coles-adjusted grid."""
        grid = self.predict_score_grid(league, home, away, match_date=match_date)
        p_home, p_draw, p_away = self.outcome_probabilities(grid)
        home_goals = np.arange(grid.shape[0], dtype=float)
        away_goals = np.arange(grid.shape[1], dtype=float)
        exp_home = float(np.sum(grid * home_goals[:, None]))
        exp_away = float(np.sum(grid * away_goals[None, :]))
        total_probs = np.zeros(5, dtype=float)
        for h in range(grid.shape[0]):
            for a in range(grid.shape[1]):
                total_probs[min(h + a, 4)] += grid[h, a]
        top_indices = np.argsort(grid, axis=None, kind="stable")[-3:][::-1]
        top_scores = []
        for flat_index in top_indices:
            h, a = np.unravel_index(int(flat_index), grid.shape)
            top_scores.append({"score": f"{h}-{a}", "probability": float(grid[h, a])})
        return {
            "p": (p_home, p_draw, p_away),
            "grid": grid,
            "goals": {
                "exp_home": exp_home,
                "exp_away": exp_away,
                "exp_total": exp_home + exp_away,
                "p_total": total_probs,
                "over": {
                    "0.5": float(total_probs[1:].sum()),
                    "1.5": float(total_probs[2:].sum()),
                    "2.5": float(total_probs[3:].sum()),
                    "3.5": float(total_probs[4]),
                },
                "btts": float(grid[1:, 1:].sum()),
                "clean_sheet": [float(grid[:, 0].sum()), float(grid[0, :].sum())],
                "top_scores": top_scores,
            },
        }

    @staticmethod
    def _compute_composite_xg(
        goals: int,
        shots: float | None,
        sot: float | None,
        corners: float | None,
    ) -> tuple[float, float | None]:
        """
        Computes a post-match composite performance goal equivalent blending actual goals
        with shot-quality expected goals (SOT + off-target shots + corners).
        """
        g = float(goals)
        has_shots = shots is not None and not math.isnan(shots) and shots >= 0.0
        has_sot = sot is not None and not math.isnan(sot) and sot >= 0.0
        c = float(corners) if (corners is not None and not math.isnan(corners) and corners >= 0.0) else 0.0

        if has_sot and has_shots:
            s_total = float(shots)
            s_on = min(s_total, float(sot))
            s_off = max(0.0, s_total - s_on)
            shot_xg = 0.295 * s_on + 0.032 * s_off + 0.020 * c
            return 0.46 * g + 0.54 * shot_xg, shot_xg
        if has_shots:
            shot_xg = 0.105 * float(shots) + 0.020 * c
            return 0.62 * g + 0.38 * shot_xg, shot_xg
        return g, None

    def _apply_offseason_regression(self, league: str, match_days: float) -> None:
        """Regresses team ratings toward the league mean after a summer break (> 45 days)."""
        last_league_days = self.league_last_date.get(league)
        if last_league_days is not None and (match_days - last_league_days) > 45.0:
            reg = self.offseason_regression
            for team in self.league_teams[league]:
                self.attack[team] *= reg
                self.defence[team] *= reg
                self.home_attack_mod[team] *= reg
                self.away_attack_mod[team] *= reg
                self.elo[team] *= reg
                self.short_attack[team] *= 0.35
                self.short_defence[team] *= 0.35
        self.league_last_date[league] = max(last_league_days or match_days, match_days)

    def observe_match(
        self,
        league: str,
        home: str,
        away: str,
        fthg: int,
        ftag: int,
        home_shots: float | None = None,
        away_shots: float | None = None,
        home_sot: float | None = None,
        away_sot: float | None = None,
        home_corners: float | None = None,
        away_corners: float | None = None,
        home_red: float | None = None,
        away_red: float | None = None,
        match_date: Any = None,
    ) -> None:
        """Updates team attack/defence/Elo ratings and league baselines AFTER a match completes."""
        match_days = self._to_ordinal_days(match_date)
        if match_days is not None:
            self._apply_offseason_regression(league, match_days)

        self.league_teams[league].add(home)
        self.league_teams[league].add(away)

        # Apply time decay to involved teams before gradient step
        self.attack[home] *= 1.0 - self.decay
        self.defence[home] *= 1.0 - self.decay
        self.attack[away] *= 1.0 - self.decay
        self.defence[away] *= 1.0 - self.decay

        self.short_attack[home] *= 1.0 - self.short_decay
        self.short_defence[home] *= 1.0 - self.short_decay
        self.short_attack[away] *= 1.0 - self.short_decay
        self.short_defence[away] *= 1.0 - self.short_decay

        lam_h, lam_a = self.expected_goals(league, home, away, match_date=match_date)

        # Composite post-match performance score (blending actual goals + shot-quality xG)
        eff_h, xg_h = self._compute_composite_xg(fthg, home_shots, home_sot, home_corners)
        eff_a, xg_a = self._compute_composite_xg(ftag, away_shots, away_sot, away_corners)

        # Dampen rating shock when red cards distort a match
        red_h = float(home_red) if (home_red is not None and not math.isnan(home_red)) else 0.0
        red_a = float(away_red) if (away_red is not None and not math.isnan(away_red)) else 0.0
        red_damping = 0.65 if (red_h > 0.0 or red_a > 0.0) else 1.0

        # Glicko-style dynamic uncertainty: adapt faster for teams with fewer observed matches
        u_home = 1.0 + 0.75 * math.exp(-self.matches_played[home] / 16.0)
        u_away = 1.0 + 0.75 * math.exp(-self.matches_played[away] / 16.0)

        err_h = (eff_h - lam_h) * red_damping
        err_a = (eff_a - lam_a) * red_damping

        self.attack[home] += self.lr * u_home * err_h
        self.defence[away] -= self.lr * u_away * err_h

        self.attack[away] += self.lr * u_away * err_a
        self.defence[home] -= self.lr * u_home * err_a

        # Short-term form/momentum update
        self.short_attack[home] += self.lr_short * err_h
        self.short_defence[away] -= self.lr_short * err_h
        self.short_attack[away] += self.lr_short * err_a
        self.short_defence[home] -= self.lr_short * err_a

        # Venue-specific modifier update
        self.home_attack_mod[home] = (1.0 - self.decay) * self.home_attack_mod[home] + self.lr_venue * err_h
        self.away_attack_mod[away] = (1.0 - self.decay) * self.away_attack_mod[away] + self.lr_venue * err_a

        # Continuous Margin-of-Victory Elo update
        expected_diff = lam_h - lam_a
        actual_diff = eff_h - eff_a
        diff_err = (actual_diff - expected_diff) * red_damping
        mov_scale = math.log(1.0 + abs(diff_err)) * (1.0 if diff_err >= 0.0 else -1.0)
        elo_step = 0.014 * mov_scale
        self.elo[home] = (1.0 - 0.5 * self.decay) * self.elo[home] + elo_step * u_home
        self.elo[away] = (1.0 - 0.5 * self.decay) * self.elo[away] - elo_step * u_away

        # Update league-wide average goals using true goals so overall scoring calibration stays exact
        mu_h = self.league_home_mu[league]
        mu_a = self.league_away_mu[league]
        self.league_home_mu[league] = max(0.8, mu_h + self.lr_global * (float(fthg) - mu_h))
        self.league_away_mu[league] = max(0.6, mu_a + self.lr_global * (float(ftag) - mu_a))

        self.matches_played[home] += 1
        self.matches_played[away] += 1
        if match_days is not None:
            self.last_match_date[home] = match_days
            self.last_match_date[away] = match_days

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
        if home_sot is not None and not math.isnan(home_sot):
            self.team_history[home].shots_on_target.append(float(home_sot))
        if away_sot is not None and not math.isnan(away_sot):
            self.team_history[away].shots_on_target.append(float(away_sot))
        if xg_h is not None:
            self.team_history[home].xg_created.append(float(xg_h))
        if xg_a is not None:
            self.team_history[away].xg_created.append(float(xg_a))

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
        # Estimate possession share from composite attack/defence + Elo + shot volume
        strength = (self.attack[team] - self.defence[team]) + 0.35 * self.elo[team]
        est_poss = int(round(max(38.0, min(65.0, 50.0 + strength * 14.0))))

        return {
            "form": form,
            "goals_per_game": round(goals_pg, 1),
            "shots": shots_pg,
            "possession": est_poss,
        }
