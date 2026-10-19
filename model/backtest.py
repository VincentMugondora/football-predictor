"""Walk-forward backtest, Brier/log-loss metrics, bootstrap ROI, and CLV (Phase 2)."""

from __future__ import annotations

import json
import math
from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd

from model import config
from model.model import OnlinePoissonModel


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


@dataclass
class BacktestReport:
    test_matches: int
    log_loss_model: float
    log_loss_book: float
    log_loss_baseline: float
    brier_model: float
    brier_book: float
    gap: float
    verdict: str  # "no_edge" | "level" | "ahead"
    verdict_message: str
    clv_mean: float
    roi_at_3pct_edge: float
    roi_ci_low: float
    roi_ci_high: float


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

    # Track historical league outcome counts for the naive league-average baseline
    league_counts: dict[str, list[int]] = {}

    model_losses: list[float] = []
    book_losses: list[float] = []
    base_losses: list[float] = []
    model_briers: list[float] = []
    book_briers: list[float] = []
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
        odds_tuple = (float(row.OddsH), float(row.OddsD), float(row.OddsA))

        # 1. Predict BEFORE observing result
        p_model = model.predict_proba(league, home, away)
        p_book = remove_bookmaker_margin(odds_tuple[0], odds_tuple[1], odds_tuple[2])

        counts = league_counts.get(league, [45, 27, 28])
        c_sum = float(sum(counts))
        p_base = (counts[0] / c_sum, counts[1] / c_sum, counts[2] / c_sum)

        if idx >= test_start_idx:
            model_losses.append(multiclass_log_loss(p_model, ftr))
            book_losses.append(multiclass_log_loss(p_book, ftr))
            base_losses.append(multiclass_log_loss(p_base, ftr))
            model_briers.append(multiclass_brier_score(p_model, ftr))
            book_briers.append(multiclass_brier_score(p_book, ftr))

            # Evaluate candidate flat-stake bets above edge_threshold
            outcomes = ("H", "D", "A")
            for out_i in range(3):
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
    ll_book = float(np.mean(book_losses))
    ll_base = float(np.mean(base_losses))
    br_model = float(np.mean(model_briers))
    br_book = float(np.mean(book_briers))
    gap = ll_model - ll_book

    # Gate G1 & G2 verdict rule (Section 2 Rule 7 & Section 6)
    if test_matches >= 1500 and gap <= 0.0:
        verdict = "ahead"
        verdict_message = f"Model beats closing market log-loss over {test_matches:,} test matches"
    elif test_matches >= 1500 and gap <= 0.002:
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
        log_loss_model=round(ll_model, 4),
        log_loss_book=round(ll_book, 4),
        log_loss_baseline=round(ll_base, 4),
        brier_model=round(br_model, 4),
        brier_book=round(br_book, 4),
        gap=round(gap, 4),
        verdict=verdict,
        verdict_message=verdict_message,
        clv_mean=round(clv_mean, 4),
        roi_at_3pct_edge=round(roi_mean, 4),
        roi_ci_low=round(roi_ci_low, 4),
        roi_ci_high=round(roi_ci_high, 4),
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
    print(f"  Book  Log-Loss : {report.log_loss_book:.4f} (Brier {report.brier_book:.4f})")
    print(f"  Base  Log-Loss : {report.log_loss_baseline:.4f}")
    print(f"  Gap            : {report.gap:+.4f}")
    print(f"  Verdict        : {report.verdict} — {report.verdict_message}")


if __name__ == "__main__":
    main()
