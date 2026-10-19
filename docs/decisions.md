# Architectural & Data Decisions Log

## 2026-10-19 — Phase 0: Repository Layout & Expo SDK 57 Pinning
- **Decision**: Keep the Expo project configuration (`package.json`, `app.json`, `src/`) at the repository root while placing the Python pipeline in `model/`, static output in `site/`, and documentation in `docs/`.
- **Rationale**: Allows `npx expo start` and `npx expo-doctor` to run directly from the workspace root without nested `node_modules` changes, while cleanly isolating Python model code (`model/`) and static artifacts (`site/picks.json`).
- **Expo SDK Pin**: Pinned `expo` to `~57.0.30` and `react-native` to `0.86.3` so the Google Play Store version of Expo Go on Android loads the project without SDK mismatch errors.
- **Bookmaker Odds Policy**: Never scrape MWOS or any bookmaker. `picks.json` provides model probabilities and sharp reference odds; the user enters MWOS odds manually in the app to compute edge ($p \times \text{odds} - 1$).
