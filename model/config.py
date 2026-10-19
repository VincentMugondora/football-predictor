"""Configuration for the MatchSense football model and daily pipeline."""

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR = REPO_ROOT / "model"
RAW_DATA_DIR = MODEL_DIR / "data" / "raw"
SITE_DIR = REPO_ROOT / "site"
PICKS_JSON_PATH = SITE_DIR / "picks.json"
STATUS_JSON_PATH = SITE_DIR / "status.json"

# Hard limit from Section 2 Rule 8: keep picks.json under 50 KB
MAX_PICKS_JSON_BYTES = 50 * 1024

# Leagues configured for football-data.co.uk CSV ingestion (start with E0 in Phase 1)
ACTIVE_LEAGUES: tuple[str, ...] = ("E0",)
ALL_SUPPORTED_LEAGUES: tuple[str, ...] = ("E0", "E1", "SP1", "D1", "I1")

# Required historical CSV columns (Section 5.2)
REQUIRED_MATCH_COLUMNS: tuple[str, ...] = (
    "Div",
    "Date",
    "HomeTeam",
    "AwayTeam",
    "FTHG",
    "FTAG",
    "FTR",
)

# Odds column priority order: Pinnacle Closing (PSC), Pinnacle (PS), Bet365 (B365), Average (Avg)
ODDS_SOURCE_PRIORITY: tuple[tuple[str, tuple[str, str, str]], ...] = (
    ("PSC", ("PSCH", "PSCD", "PSCA")),
    ("PS", ("PSH", "PSD", "PSA")),
    ("B365", ("B365H", "B365D", "B365A")),
    ("Avg", ("AvgH", "AvgD", "AvgA")),
)

# Default online Poisson hyperparameters (Section 6.1)
DEFAULT_LR = 0.01
DEFAULT_LR_GLOBAL = 0.003
DEFAULT_DECAY = 0.001

# Team name normalisation mapping (expanded in Phase 1)
TEAM_NAME_MAP: dict[str, str] = {
    "Man United": "Man Utd",
    "Manchester United": "Man Utd",
    "Manchester City": "Man City",
    "Spurs": "Tottenham",
    "Tottenham Hotspur": "Tottenham",
    "Wolverhampton Wanderers": "Wolves",
    "Nott'm Forest": "Nottingham Forest",
    "Brighton and Hove Albion": "Brighton",
    "West Ham United": "West Ham",
    "Newcastle United": "Newcastle",
}
