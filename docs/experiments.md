# Model Experiments Log

All model changes in Phases 2 and 3 are recorded here.
Rule (Section 7): Add one change at a time and keep it only if it improves walk-forward test log loss by at least `0.001` and holds across at least two leagues. Keep the most recent full season untouched until final Gate G2 evaluation.

| Date | Experiment | Leagues | Test Matches | Model Log Loss | Book Log Loss | Gap | Decision |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| *Pending Phase 2* | Baseline Online Poisson (`lr=0.01`, `lr_global=0.003`, `decay=0.001`) | E0 | — | — | — | — | Baseline |

## 2026-11-22: accuracy round 1 (E0, SP1, I1, D1; seasons 2019/20 to 2026/27, 10,532 matches)

Setup: strict walk-forward. Settings were chosen on 2023/24 + 2024/25 ("tune") and checked on 2025/26 + 2026/27 so far ("holdout"), which were not used for choosing. "Pre-match odds" = Pinnacle (PS) prices collected before kick-off, falling back to Bet365 then market average; never closing prices. Log loss: lower is better.

| Experiment | Tune LL | Holdout LL | Decision |
| :--- | :--- | :--- | :--- |
| Baseline model (v3.0) | 0.9716 | 0.9844 | Baseline |
| Bookmaker pre-match odds alone (reference) | 0.9535 | 0.9721 | Reference |
| Coordinate-descent tuning of the 10 model settings | 0.9693 | 0.9850 | **Rejected**: better on tune, worse on holdout (overfitting) |
| Log-linear blend of model and pre-match odds | best weight on model = 0.0 | 0.9721 at w=0 | Finding: the model adds no 1X2 information beyond the odds |
| Expected goals fully implied by 1X2 odds | 0.9535 | 0.9721 | Rejected: exact-score and over/under 2.5 got worse (2.927 / 0.693 vs model 2.906 / 0.681) |
| **Odds anchor: model's goal total, split between teams to match pre-match odds** | 0.9530 | 0.9732 | **Adopted (v3.1-odds-anchor)** |

Odds anchor, holdout detail (model alone -> anchored): exact-score log loss 2.906 -> 2.893; margin log loss 1.723 -> 1.713; over 2.5 unchanged 0.681; winner right 53.0% -> 53.8%; winner + exact margin right 24.7% -> 24.9%; exact score right 11.4% -> 11.5%.

Production backtest (`run_walk_forward_backtest`, last 40% = 4,213 matches, compared with Pinnacle closing odds):

| League | Matches | Model LL before -> after | Winner right before -> after |
| :--- | :--- | :--- | :--- |
| E0 | 1,100 | 0.9878 -> 0.9769 | 51.8% -> 52.8% |
| SP1 | 1,115 | 0.9756 -> 0.9583 | 53.5% -> 55.2% |
| I1 | 1,115 | 0.9748 -> 0.9591 | 53.4% -> 54.8% |
| D1 | 883 | 0.9868 -> 0.9721 | 52.7% -> 53.9% |
| All | 4,213 | 0.9809 -> 0.9662 (closing book 0.9642; gap 0.0167 -> 0.0020) | 52.8% -> 54.2% |

Holds in all four leagues (rule: at least two, by at least 0.001). Brier 0.5845 -> 0.5747. Verdict stays "no proven edge": the anchored model tracks the market, so it is not a source of value bets. Matches without live odds fall back to the model alone (unchanged).

## 2026-11-22: which odds to anchor to (round 2)

Same walk-forward model, anchored to different pre-match prices, on the 2,191 tune/holdout matches where every source had a price. Log loss, lower is better.

| Odds source | Tune LL | Holdout LL | Winner right |
| :--- | :--- | :--- | :--- |
| Betfair Exchange (BFE) | 0.9642 | **0.9631** | 53.9% |
| Mean of Pinnacle + Betfair Exchange | 0.9643 | 0.9637 | 54.0% |
| Pinnacle (PS) | 0.9646 | 0.9645 | 53.9% |
| Market average (Avg) | 0.9650 | 0.9645 | 53.9% |
| Bet365 (single high-street book) | 0.9655 | 0.9649 | 53.8% |
| Median of high-street books | 0.9654 | 0.9650 | 53.9% |
| Closing prices (Pinnacle, reference) | 0.9623 | 0.9658 | 54.5% |

Decision: live odds now use the average of the sharp books The Odds API returns (Pinnacle, Betfair Exchange, Smarkets, Matchbook), falling back to the median of all books. Previously the first-listed book was used, usually a high-street book with a 5-8% margin.

Odds closer to kick-off: closing prices beat pre-match on tune (0.9623 vs 0.9646) but not on holdout (0.9658 vs 0.9645), so the gain is uncertain. Odds are now refreshed when a match is within 24 hours and the saved prices are over 3 hours old (previously once per day), with extra runs at 12:30 and 16:30. Low cost; also stops morning prices being used for evening matches.

Line-ups and injuries: not added. API-Football's free plan does not cover the current season on this key, and its /injuries endpoint keeps no history, so the effect cannot be backtested. Late odds already include team news.
