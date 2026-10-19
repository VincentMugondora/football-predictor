# Model Experiments Log

All model changes in Phases 2 and 3 are recorded here.
Rule (Section 7): Add one change at a time and keep it only if it improves walk-forward test log loss by at least `0.001` and holds across at least two leagues. Keep the most recent full season untouched until final Gate G2 evaluation.

| Date | Experiment | Leagues | Test Matches | Model Log Loss | Book Log Loss | Gap | Decision |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| *Pending Phase 2* | Baseline Online Poisson (`lr=0.01`, `lr_global=0.003`, `decay=0.001`) | E0 | — | — | — | — | Baseline |
