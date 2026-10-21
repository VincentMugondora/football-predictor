# MatchSense — Offline Football Prediction & Bet-Tracking App

A fast, lightweight, offline-first Expo / React Native mobile app designed for football fans in Zimbabwe on budget Android devices with patchy or expensive mobile data.

MatchSense compares statistical model match probabilities against bookmaker decimal odds, highlights positive-edge outcomes, and lets users log and evaluate their own bets locally on their device.

> **Important Compliance Notice:**
> MatchSense **never places bets**, never connects to any bookmaker or payment provider, and contains no tipster language.
> *"Estimates, not advice. Only bet money you can afford to lose."*

---

## Tech Stack

- **Framework:** Expo (SDK 58) + React Native 0.88 + TypeScript (`strict: true`, zero `any`)
- **Navigation:** Expo Router (`src/app/(tabs)` bottom tabs for **Picks**, **Bet log**, **Summary**, plus `src/app/match/[id]` and `src/app/settings`)
- **Styling:** Plain React Native `StyleSheet.create` powered by a central design-token system (`src/theme/tokens.ts` & `src/theme/useAppTheme.ts`) supporting system Light and Dark modes
- **Offline State & Persistence:** `zustand` persisted to `@react-native-async-storage/async-storage` (`src/data/store.ts`)
- **Testing & Quality:** Jest (`jest-expo`), React Native Testing Library (`@testing-library/react-native`), ESLint (`expo lint`), and Prettier

---

## Setup & Run Steps

1. **Install dependencies** (always use `npx expo install` when adding SDK packages):
   ```bash
   npm install
   ```

2. **Start the Expo development server:**
   ```bash
   npx expo start
   ```
   - Press `a` to launch on an Android emulator or connected Android phone via Expo Go.
   - Press `w` to preview in a web browser.

3. **Run unit & screen tests:**
   ```bash
   npm test
   ```

4. **Run TypeScript strict check & linter:**
   ```bash
   npm run typecheck
   npm run lint
   ```

---

## Project Architecture

```text
src/
├── app/                              # Expo Router file-based navigation
│   ├── _layout.tsx                   # Root Stack (tabs + match/[id] detail + settings modal)
│   ├── (tabs)/
│   │   ├── _layout.tsx               # Bottom Tabs (Picks, Bet log, Summary) with capsule indicator
│   │   ├── index.tsx                 # Picks tab entry
│   │   ├── bet-log.tsx               # Bet Log tab entry
│   │   └── summary.tsx               # Summary tab entry
│   ├── match/[id].tsx                # Match Detail screen (Image 1 breakdown)
│   └── settings.tsx                  # User Settings modal screen
├── components/                       # Reusable presentational components
├── features/
│   ├── picks/                        # Picks list, Featured Match hero card, Match Detail view
│   ├── betLog/                       # Bet logging form, validation, result switcher & history
│   └── summary/                      # Bankroll, ROI, Win Rate vs Break-Even, Drawdown & Settings
├── data/                             # Repository interface, mock fixtures, and persisted Zustand store
├── lib/                              # Pure, unit-tested domain math, validation, and date helpers
└── theme/                            # Design tokens (dark/light palettes, typography, spacing, radii)
```

---

## Assumptions Made Where Design Images Were Ambiguous

1. **Bottom Navigation Tabs vs. Design Mock Labels:**
   - *Context:* Images 2 & 3 show 4 bottom tabs (`Matches`, `Predictions`, `Favourites`, `Results`), whereas Step 2 & Step 4 specify 3 functional bottom tabs (`Picks`, `Bet log`, `Summary`).
   - *Resolution:* Implemented the required 3 bottom tabs (`Picks`, `Bet log`, `Summary`) using the exact Material-3 dark-emerald pill indicator (`#0E3A2A` capsule + `#10B981` active icon/text) from Images 2 & 3. The `Favourites` feature from Image 3 (`☆ / ★` icon on fixture rows) is preserved via a `★ Favourites` filter chip inside the `Picks` tab.

2. **Match Detail View (`Arsenal vs Liverpool` in Image 1):**
   - *Context:* Image 1 shows a dedicated match breakdown screen (`Recent form`, `Match probabilities`, `Key stats (per game)`, `Our take`), while Step 4 requires showing model probability, break-even probability, edge, and a `Log` button for Home/Draw/Away.
   - *Resolution:* Both are supported seamlessly. Each match card on the `Picks` screen shows the H/D/A model probability, bookmaker odds, break-even probability, signed edge, value highlight, and `+ Log` button, and tapping the fixture header opens the full `Match Detail` screen from Image 1.

3. **Settings Access Point:**
   - *Context:* Step 4 requires configurable Settings (`starting bankroll`, `usual stake %`, `max stake %`, `drawdown alert %`, `edge threshold`), and all 3 images display a `⋮` (more options) button in the top-right header.
   - *Resolution:* Tapping the top-right `⋮` button in `AppHeader` (or the `Settings` button on the `Summary` tab) opens the `Settings` modal screen.

4. **Offline Club Crests on Low-End Android:**
   - *Context:* Remote crest images fail offline and large bundled PNG sheets increase APK size and memory pressure on budget devices.
   - *Resolution:* `TeamCrest` renders zero-network, deterministic club shields using each team's authentic primary/border/text colours and 3-letter club code.
## Real data pipeline

The daily job uses football-data.org v4 for verified fixtures and recent final results, with API-Football as a fallback when `API_FOOTBALL_KEY` is configured. Add keys in a local ignored `.env` or CI secret. Historical football-data.co.uk CSVs are read from `model/data/raw/`; automated downloads stay disabled unless the source's current fair-use/data-training terms have been resolved and `ALLOW_FOOTBALL_DATA_DOWNLOADS=true` is set. See [docs/data-sources.md](docs/data-sources.md).

The Odds API is optional. Set `THE_ODDS_API_KEY` to add h2h reference prices. The job uses one region and h2h only, caches at most one request per competition per UTC day, records quota use in `picks.json`, and skips further calls when remaining credits are at or below `ODDS_MIN_CREDITS_REMAINING`. Without a configured key or available odds, real model predictions still publish with no reference price.

Set `EXPO_PUBLIC_PICKS_URL` to the published static `picks.json` URL when building the Expo app. The app validates the response and stores the last valid payload in AsyncStorage; a fresh install with no network/cache shows no matches. Copy `.env.example` as a variable-name template; never commit real keys.

