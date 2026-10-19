# Football Prediction App: Implementation Plan

Prepared October 19, 2026.

## 1. What we are building
A mobile app (React Native with Expo) that shows football match predictions from a statistical model next to market odds, and lets the user log their own bets and track their bankroll. A daily Python job trains the model and publishes a small file, `picks.json`. The app downloads it, caches it, and works offline.
The user is in Zimbabwe, on a cheap Android phone with patchy, expensive data. Everything below is designed around that.
Out of scope: placing bets, logging in to any bookmaker, scraping any bookmaker, payments, and selling tips.

## 2. Hard rules (apply to every phase)
1. Never automate betting or scrape odds from MWOS or any other bookmaker. The user types MWOS odds into the app by hand.
2. The app never places bets. It shows predictions and records bets the user placed themselves.
3. Use Expo SDK 57 exactly. Pin `expo` to `~57.0.30`, install packages with `npx expo install`, and never upgrade to SDK 58.
4. Use only libraries that work in Expo Go (no custom native modules, so no MMKV; use AsyncStorage).
5. Never invent fixtures, odds, or results. If data is missing, fail with a clear message and keep the last good file.
6. No language about guaranteed profit or tips. Footer on every screen: `'Estimates, not advice. Only bet money you can afford to lose.'`
7. Do not claim the model has an edge until the gates in this plan are passed. Until then the app shows `'No proven edge: treat these as estimates.'`
8. Keep payloads small (`picks.json` under 50 KB) and the app light. No heavy UI kits, no web fonts, no large images.

## 3. Phases Summary
- **Phase 0**: Environment & repository scaffolding (`model/`, `site/`, `docs/`, Expo SDK 57 app, Python `.venv` with `pandas`, `numpy`, `pytest`).
- **Phase 1**: Historical CSV ingestion (`football-data.co.uk`), schema validation, team-name normalisation, and upcoming fixtures/odds evaluation.
- **Phase 2**: Online Poisson attack/defence baseline model and walk-forward backtest (Gate G1).
- **Phase 3**: Model improvements (time decay CV, Dixon-Coles, Elo, calibration; Gate G2).
- **Phase 4**: Daily job (`run_daily.py`) generating `site/picks.json` (< 50 KB) with atomic fallback and `status.json`.
- **Phase 5**: Mobile app alignment with manual MWOS odds input, `picks.json` offline caching, bet log JSON export/import, and Gate-aware verdict banner.
- **Phase 6**: Paper trading (Gate G3: >= 500 settled paper bets, positive mean CLV).
- **Phase 7**: Small real stakes within strict bankroll and drawdown limits.
