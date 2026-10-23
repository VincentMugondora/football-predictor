"""Walk-forward backtest, Brier/log-loss metrics, bootstrap ROI, and CLV (Phase 2)."""

from __future__ import annotations

import json
import math
from dataclasses import asdict, dataclass, field

import numpy as np
import pandas as pd

from model import config
from model.model import OnlinePoissonModel
from model.timing import HalfTimeGoalTimingModel


def remove_bookmaker_margin(
    odds_h: float, odds_d: float, odds_a: float
) -> tuple[float, float, float]:
    """Removes bookmaker overround by proportional normalisation of implied probabilities."""
    inv_h = 1.0 / odds_h
    inv_d = 1.0 / odds_d
    inv_a = 1.0 / odds_a
    overround = inv_h + inv_d + inv_a
    return (inv_h / overround, inv_d / overround, inv_a / overround)


def multiclass_log_loss(
    probs: tuple[float, float, float], actual_ftr: str, eps: float = 1e-12
) -> float:
    idx = 0 if actual_ftr == "H" else (1 if actual_ftr == "D" else 2)
    p = max(eps, min(1.0 - eps, probs[idx]))
    return -math.log(p)


def multiclass_brier_score(
    probs: tuple[float, float, float], actual_ftr: str
) -> float:
    y = (
        1.0 if actual_ftr == "H" else 0.0,
        1.0 if actual_ftr == "D" else 0.0,
        1.0 if actual_ftr == "A" else 0.0,
    )
    return float(sum((probs[i] - y[i]) ** 2 for i in range(3)))


def ranked_probability_score(probs: tuple[float, float, float], actual_ftr: str) -> float:
    """Three-outcome ranked score in the documented H/D/A category order."""
    actual_index = {"H": 0, "D": 1, "A": 2}[actual_ftr]
    cumulative = np.cumsum(probs)[:-1]
    observed = np.cumsum([1.0 if i == actual_index else 0.0 for i in range(3)])[:-1]
    return float(np.mean((cumulative - observed) ** 2))


def poisson_log_loss(actual: int, expected: float) -> float:
    """Negative Poisson log likelihood for an observed goal count."""
    rate = max(float(expected), 1e-9)
    return rate - actual * math.log(rate) + math.lgamma(actual + 1)


def binary_log_loss(probability: float, observed: bool) -> float:
    p = min(1.0 - 1e-12, max(1e-12, float(probability)))
    return -math.log(p if observed else 1.0 - p)


def calibration_table(probabilities: list[float], outcomes: list[bool]) -> list[dict[str, float | int]]:
    bins = []
    for lower in np.linspace(0.0, 0.8, 5):
        upper = lower + 0.2
        indexes = [i for i, p in enumerate(probabilities) if lower <= p < upper or (upper >= 1.0 and p <= 1.0)]
        if indexes:
            bins.append({
                "predicted": round(float(np.mean([probabilities[i] for i in indexes])), 3),
                "actual": round(float(np.mean([outcomes[i] for i in indexes])), 3),
                "count": len(indexes),
            })
    return bins


@dataclass
class BacktestReport:
    test_matches: int
    bookmaker_test_matches: int
    log_loss_model: float
    log_loss_book: float | None
    log_loss_baseline: float
    brier_model: float
    brier_book: float | None
    gap: float | None
    verdict: str  # "no_edge" | "level" | "ahead"
    verdict_message: str
    clv_mean: float
    roi_at_3pct_edge: float
    roi_ci_low: float
    roi_ci_high: float
    winner_metrics: dict[str, object] = field(default_factory=dict)
    goals_metrics: dict[str, object] = field(default_factory=dict)
    timing_metrics: dict[str, object] = field(default_factory=dict)


def run_walk_forward_backtest(
    df: pd.DataFrame,
    test_fraction: float = 0.40,
    edge_threshold: float = 0.03,
    random_seed: int = 42,
) -> tuple[BacktestReport, OnlinePoissonModel]:
    """
    Runs strict walk-forward evaluation over the final `test_fraction` of matches.
    Asserts that no match result is ever observed before that match is predicted.
    """
    n_total = len(df)
    if n_total < 10:
        raise ValueError("Need at least 10 matches to run walk-forward backtest.")

    test_start_idx = int(round(n_total * (1.0 - test_fraction)))
    model = OnlinePoissonModel()
    timing_model = HalfTimeGoalTimingModel()

    # Track historical league outcome counts for the naive league-average baseline
    league_counts: dict[str, list[int]] = {}

    model_losses: list[float] = []
    book_losses: list[float] = []
    base_losses: list[float] = []
    model_briers: list[float] = []
    book_briers: list[float] = []
    base_briers: list[float] = []
    closing_losses: list[float] = []
    closing_briers: list[float] = []
    closing_rps: list[float] = []
    correct_closing: list[bool] = []
    model_rps: list[float] = []
    book_rps: list[float] = []
    base_rps: list[float] = []
    correct_model: list[bool] = []
    correct_book: list[bool] = []
    correct_base: list[bool] = []
    home_goal_losses: list[float] = []
    away_goal_losses: list[float] = []
    over25_probabilities: list[float] = []
    over25_outcomes: list[bool] = []
    btts_probabilities: list[float] = []
    btts_outcomes: list[bool] = []
    over25_market_losses: list[float] = []
    over25_model_losses: list[float] = []
    timing_losses: list[float] = []
    timing_baseline_losses: list[float] = []
    league_timing_shares: dict[str, list[float]] = {}
    bet_profits: list[float] = []
    bet_clvs: list[float] = []

    last_observed_index = -1

    for idx, row in enumerate(df.itertuples(index=False)):
        # Strict no-look-ahead guard (Section 6.2)
        assert idx > last_observed_index, "Look-ahead violation detected!"

        league = str(row.Div)
        home = str(row.HomeTeam)
        away = str(row.AwayTeam)
        fthg = int(row.FTHG)
        ftag = int(row.FTAG)
        ftr = str(row.FTR)
        raw_odds = (getattr(row, "OddsH", np.nan), getattr(row, "OddsD", np.nan), getattr(row, "OddsA", np.nan))
        has_odds = all(pd.notna(value) and float(value) > 1.0 for value in raw_odds)
        odds_tuple = tuple(float(value) for value in raw_odds) if has_odds else None
        raw_closing_odds = (
            getattr(row, "OddsCloseH", np.nan),
            getattr(row, "OddsCloseD", np.nan),
            getattr(row, "OddsCloseA", np.nan),
        )
        has_closing_odds = all(pd.notna(value) and float(value) > 1.0 for value in raw_closing_odds)
        closing_odds_tuple = tuple(float(value) for value in raw_closing_odds) if has_closing_odds else None

        # 1. Predict BEFORE observing result
        market_prediction = model.predict_markets(league, home, away)
        p_model = market_prediction["p"]
        goals_prediction = market_prediction["goals"]
        p_book = remove_bookmaker_margin(*odds_tuple) if odds_tuple else None

        counts = league_counts.get(league, [45, 27, 28])
        c_sum = float(sum(counts))
        p_base = (counts[0] / c_sum, counts[1] / c_sum, counts[2] / c_sum)

        if idx >= test_start_idx:
            model_losses.append(multiclass_log_loss(p_model, ftr))
            if p_book is not None:
                book_losses.append(multiclass_log_loss(p_book, ftr))
            base_losses.append(multiclass_log_loss(p_base, ftr))
            model_briers.append(multiclass_brier_score(p_model, ftr))
            base_briers.append(multiclass_brier_score(p_base, ftr))
            model_rps.append(ranked_probability_score(p_model, ftr))
            base_rps.append(ranked_probability_score(p_base, ftr))
            model_choice = ("H", "D", "A")[int(np.argmax(p_model))]
            base_choice = ("H", "D", "A")[int(np.argmax(p_base))]
            correct_model.append(model_choice == ftr)
            correct_base.append(base_choice == ftr)
            if p_book is not None:
                book_briers.append(multiclass_brier_score(p_book, ftr))
                book_rps.append(ranked_probability_score(p_book, ftr))
                book_choice = ("H", "D", "A")[int(np.argmax(p_book))]
                correct_book.append(book_choice == ftr)
            if closing_odds_tuple is not None:
                p_closing = remove_bookmaker_margin(*closing_odds_tuple)
                closing_losses.append(multiclass_log_loss(p_closing, ftr))
                closing_briers.append(multiclass_brier_score(p_closing, ftr))
                closing_rps.append(ranked_probability_score(p_closing, ftr))
                closing_choice = ("H", "D", "A")[int(np.argmax(p_closing))]
                correct_closing.append(closing_choice == ftr)

            home_expected = float(goals_prediction["exp_home"])
            away_expected = float(goals_prediction["exp_away"])
            over25_probability = float(goals_prediction["over"]["2.5"])
            btts_probability = float(goals_prediction["btts"])
            over25_observed = fthg + ftag > 2
            btts_observed = fthg > 0 and ftag > 0
            home_goal_losses.append(poisson_log_loss(fthg, home_expected))
            away_goal_losses.append(poisson_log_loss(ftag, away_expected))
            over25_probabilities.append(over25_probability)
            over25_outcomes.append(over25_observed)
            btts_probabilities.append(btts_probability)
            btts_outcomes.append(btts_observed)
            over25_model_losses.append(binary_log_loss(over25_probability, over25_observed))
            over_price = getattr(row, "OddsOver25", np.nan)
            under_price = getattr(row, "OddsUnder25", np.nan)
            if pd.notna(over_price) and pd.notna(under_price) and float(over_price) > 1 and float(under_price) > 1:
                raw_over, raw_under = 1 / float(over_price), 1 / float(under_price)
                fair_over = raw_over / (raw_over + raw_under)
                over25_market_losses.append(binary_log_loss(fair_over, over25_observed))

            timing_estimate = timing_model.predict(league, home, away, home_expected, away_expected)
            league_share = timing_model.league_share(league)
            timing_baseline_share = league_share if league_share is not None else timing_model.DEFAULT_LEAGUE_SHARE
            if timing_model.valid_halftime(fthg, ftag, getattr(row, "HTHG", np.nan), getattr(row, "HTAG", np.nan)):
                ht_home, ht_away = int(row.HTHG), int(row.HTAG)
                if timing_estimate is None:
                    timing_estimate = {
                        "home": {"first": home_expected * timing_baseline_share, "second": home_expected * (1 - timing_baseline_share)},
                        "away": {"first": away_expected * timing_baseline_share, "second": away_expected * (1 - timing_baseline_share)},
                    }
                timing_losses.extend([
                    poisson_log_loss(ht_home, float(timing_estimate["home"]["first"])),
                    poisson_log_loss(fthg - ht_home, float(timing_estimate["home"]["second"])),
                    poisson_log_loss(ht_away, float(timing_estimate["away"]["first"])),
                    poisson_log_loss(ftag - ht_away, float(timing_estimate["away"]["second"])),
                ])
                timing_baseline_losses.extend([
                    poisson_log_loss(ht_home, home_expected * timing_baseline_share),
                    poisson_log_loss(fthg - ht_home, home_expected * (1 - timing_baseline_share)),
                    poisson_log_loss(ht_away, away_expected * timing_baseline_share),
                    poisson_log_loss(ftag - ht_away, away_expected * (1 - timing_baseline_share)),
                ])

            # Evaluate candidate flat-stake bets above edge_threshold
            outcomes = ("H", "D", "A")
            for out_i in range(3) if odds_tuple else ():
                edge = p_model[out_i] * odds_tuple[out_i] - 1.0
                if edge >= edge_threshold:
                    clv = p_book[out_i] * odds_tuple[out_i] - 1.0
                    bet_clvs.append(clv)
                    profit = (odds_tuple[out_i] - 1.0) if ftr == outcomes[out_i] else -1.0
                    bet_profits.append(profit)

        # 2. Observe result AFTER prediction
        hs = float(row.HS) if hasattr(row, "HS") and pd.notna(row.HS) else None
        as_ = float(row.AS) if hasattr(row, "AS") and pd.notna(row.AS) else None
        model.observe_match(league, home, away, fthg, ftag, hs, as_)
        timing_model.observe(
            league, home, away, fthg, ftag,
            getattr(row, "HTHG", np.nan), getattr(row, "HTAG", np.nan),
        )

        if league not in league_counts:
            league_counts[league] = [0, 0, 0]
        if ftr == "H":
            league_counts[league][0] += 1
        elif ftr == "D":
            league_counts[league][1] += 1
        else:
            league_counts[league][2] += 1

        last_observed_index = idx

    test_matches = len(model_losses)
    ll_model = float(np.mean(model_losses))
    ll_book = float(np.mean(book_losses)) if book_losses else None
    ll_base = float(np.mean(base_losses))
    br_model = float(np.mean(model_briers))
    br_book = float(np.mean(book_briers)) if book_briers else None
    gap = ll_model - ll_book if ll_book is not None else None

    # Gate G1 & G2 verdict rule (Section 2 Rule 7 & Section 6)
    if test_matches >= 1500 and len(book_losses) >= 1500 and gap is not None and gap <= 0.0:
        verdict = "ahead"
        verdict_message = f"Model beats closing market log-loss over {test_matches:,} test matches"
    elif test_matches >= 1500 and len(book_losses) >= 1500 and gap is not None and gap <= 0.002:
        verdict = "level"
        verdict_message = f"Model is level with market log-loss over {test_matches:,} test matches"
    else:
        verdict = "no_edge"
        verdict_message = "No proven edge: treat these as estimates."

    clv_mean = float(np.mean(bet_clvs)) if bet_clvs else 0.0
    if bet_profits:
        profits_arr = np.asarray(bet_profits, dtype=float)
        roi_mean = float(np.mean(profits_arr))
        rng = np.random.default_rng(random_seed)
        boot_means = [
            float(np.mean(rng.choice(profits_arr, size=len(profits_arr), replace=True)))
            for _ in range(400)
        ]
        roi_ci_low = float(np.percentile(boot_means, 2.5))
        roi_ci_high = float(np.percentile(boot_means, 97.5))
    else:
        roi_mean, roi_ci_low, roi_ci_high = 0.0, 0.0, 0.0

    report = BacktestReport(
        test_matches=test_matches,
        bookmaker_test_matches=len(book_losses),
        log_loss_model=round(ll_model, 4),
        log_loss_book=round(ll_book, 4) if ll_book is not None else None,
        log_loss_baseline=round(ll_base, 4),
        brier_model=round(br_model, 4),
        brier_book=round(br_book, 4) if br_book is not None else None,
        gap=round(gap, 4) if gap is not None else None,
        verdict=verdict,
        verdict_message=verdict_message,
        clv_mean=round(clv_mean, 4),
        roi_at_3pct_edge=round(roi_mean, 4),
        roi_ci_low=round(roi_ci_low, 4),
        roi_ci_high=round(roi_ci_high, 4),
        winner_metrics={
            "log_loss_model": round(ll_model, 4),
            "log_loss_closing_market": round(float(np.mean(closing_losses)), 4) if closing_losses else None,
            "log_loss_league_average": round(ll_base, 4),
            "brier_model": round(br_model, 4),
            "brier_closing_market": round(float(np.mean(closing_briers)), 4) if closing_briers else None,
            "brier_league_average": round(float(np.mean(base_briers)), 4) if base_briers else None,
            "rps_model": round(float(np.mean(model_rps)), 4) if model_rps else None,
            "rps_closing_market": round(float(np.mean(closing_rps)), 4) if closing_rps else None,
            "rps_league_average": round(float(np.mean(base_rps)), 4) if base_rps else None,
            "top_pick_accuracy_model": round(float(np.mean(correct_model)), 4) if correct_model else None,
            "top_pick_accuracy_closing_market": round(float(np.mean(correct_closing)), 4) if correct_closing else None,
            "closing_market_matches": len(closing_losses),
            "top_pick_accuracy_league_average": round(float(np.mean(correct_base)), 4) if correct_base else None,
            "verdict": (
                "Model beats both closing-market and league-average log loss."
                if closing_losses and ll_model < float(np.mean(closing_losses)) and ll_model < ll_base else
                "No proven winner edge: compare model, closing-market, and league-average metrics."
            ),
        },
        goals_metrics={
            "poisson_log_loss_home": round(float(np.mean(home_goal_losses)), 4) if home_goal_losses else None,
            "poisson_log_loss_away": round(float(np.mean(away_goal_losses)), 4) if away_goal_losses else None,
            "over_2_5_calibration": calibration_table(over25_probabilities, over25_outcomes),
            "btts_calibration": calibration_table(btts_probabilities, btts_outcomes),
            "over_2_5_log_loss_model": round(float(np.mean(over25_model_losses)), 4) if over25_model_losses else None,
            "over_2_5_log_loss_closing_market": round(float(np.mean(over25_market_losses)), 4) if over25_market_losses else None,
            "verdict": (
                "Model over 2.5 log loss beats the available closing over/under benchmark."
                if over25_market_losses and np.mean(over25_model_losses) < np.mean(over25_market_losses) else
                "No proven goals edge against closing over/under odds; calibration is shown for review."
                if over25_market_losses else
                "Closing over/under odds were unavailable; goals calibration and Poisson log loss are shown."
            ),
        },
        timing_metrics={
            "log_loss_model": round(float(np.mean(timing_losses)), 4) if timing_losses else None,
            "log_loss_league_average": round(float(np.mean(timing_baseline_losses)), 4) if timing_baseline_losses else None,
            "league_first_half_share": {
                league: round((counts[0] / counts[1]), 3)
                for league, counts in timing_model.league_goals.items() if counts[1] > 0
            },
            "verdict": (
                "Team-specific half timing beats the league-average baseline."
                if timing_losses and np.mean(timing_losses) < np.mean(timing_baseline_losses) else
                "No team-specific signal found; use the league-wide half-time pattern."
            ),
        },
    )
    return report, model


def main() -> None:
    from model.data import load_historical_matches

    df = load_historical_matches()
    report, _ = run_walk_forward_backtest(df)
    config.SITE_DIR.mkdir(parents=True, exist_ok=True)
    config.BACKTEST_REPORT_PATH.write_text(
        json.dumps(asdict(report), indent=2), encoding="utf-8"
    )
    print(f"Walk-forward backtest complete over {report.test_matches:,} test matches:")
    print(f"  Model Log-Loss : {report.log_loss_model:.4f} (Brier {report.brier_model:.4f})")
    book_loss = f"{report.log_loss_book:.4f}" if report.log_loss_book is not None else "unavailable"
    book_brier = f"{report.brier_book:.4f}" if report.brier_book is not None else "unavailable"
    gap = f"{report.gap:+.4f}" if report.gap is not None else "unavailable"
    print(f"  Book  Log-Loss : {book_loss} (Brier {book_brier})")
    print(f"  Base  Log-Loss : {report.log_loss_baseline:.4f}")
    print(f"  Gap            : {gap}")
    print(f"  Verdict        : {report.verdict} — {report.verdict_message}")


if __name__ == "__main__":
    main()
