"""Configuration for the MatchSense football model and daily pipeline."""

from pathlib import Path
import os

REPO_ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR = REPO_ROOT / "model"
RAW_DATA_DIR = MODEL_DIR / "data" / "raw"
SITE_DIR = REPO_ROOT / "site"
PICKS_JSON_PATH = SITE_DIR / "picks.json"
PREDICTIONS_HISTORY_PATH = SITE_DIR / "predictions_history.json"
STATUS_JSON_PATH = SITE_DIR / "status.json"
BACKTEST_REPORT_PATH = SITE_DIR / "backtest_report.json"

# Hard limit from Section 2 Rule 8: keep picks.json under 50 KB
MAX_PICKS_JSON_BYTES = 50 * 1024

# Seasons to download from football-data.co.uk (6 full seasons)
SEASONS: tuple[str, ...] = ("1920", "2021", "2122", "2223", "2324", "2425", "2526")
MIN_HISTORY_SEASONS_PER_LEAGUE = 5

# Leagues configured for football-data.co.uk CSV ingestion
ACTIVE_LEAGUES: tuple[str, ...] = ("E0", "SP1", "I1", "D1")
ALL_SUPPORTED_LEAGUES: tuple[str, ...] = ("E0", "E1", "SP1", "D1", "I1")

LEAGUE_DISPLAY_NAMES: dict[str, str] = {
    "E0": "Premier League",
    "E1": "Championship",
    "SP1": "La Liga",
    "I1": "Serie A",
    "D1": "Bundesliga",
}

HISTORICAL_CSV_URL_TEMPLATE = (
    "https://www.football-data.co.uk/mmz4281/{season}/{league}.csv"
)
FIXTURES_CSV_URL = "https://www.football-data.co.uk/fixtures.csv"

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
DEFAULT_LR = 0.012
DEFAULT_LR_GLOBAL = 0.003
DEFAULT_DECAY = 0.0015
DEFAULT_DIXON_COLES_RHO = -0.06

# Team name normalisation mapping (Section 5.3)
TEAM_NAME_MAP: dict[str, str] = {
    "Man United": "Man Utd",
    "Manchester United": "Man Utd",
    "Manchester City": "Man City",
    "Spurs": "Tottenham",
    "Tottenham Hotspur": "Tottenham",
    "Nott'm Forest": "Nottingham Forest",
    "Brighton and Hove Albion": "Brighton",
    "West Ham United": "West Ham",
    "Newcastle United": "Newcastle",
    "Sheffield United": "Sheffield Utd",
    "Wolverhampton Wanderers": "Wolves",
    "Ath Madrid": "Atlético Madrid",
    "Ath Bilbao": "Athletic Club",
    "Betis": "Real Betis",
    "Sociedad": "Real Sociedad",
    "Espanol": "Espanyol",
    "Vallecano": "Rayo Vallecano",
    "Alaves": "Alavés",
    "Leganes": "Leganés",
    "Inter": "Inter",
    "Internazionale": "Inter",
    "Verona": "Hellas Verona",
    "Bayern Munich": "Bayern Munich",
    "Dortmund": "Dortmund",
    "Leverkusen": "Bayer Leverkusen",
    "M'gladbach": "Gladbach",
    "Ein Frankfurt": "Eintracht Frankfurt",
    "FC Koln": "Köln",
    "Mainz": "Mainz 05",
}

# Provider names resolve only through this explicit alias table. Expand it after
# reviewing model/data/team_names_review.json; do not add fuzzy fallbacks.
TEAM_ALIASES = dict(TEAM_NAME_MAP)
TEAM_ALIASES.update({
    "Manchester United FC": "Man Utd", "Man Utd": "Man Utd",
    "Manchester City FC": "Man City", "Man City": "Man City",
    "Tottenham Hotspur FC": "Tottenham", "Tottenham": "Tottenham",
    "Wolverhampton Wanderers FC": "Wolves", "Wolves": "Wolves",
    "Brighton & Hove Albion FC": "Brighton", "Brighton": "Brighton",
    "Newcastle United FC": "Newcastle", "Newcastle": "Newcastle",
    "West Ham United FC": "West Ham", "West Ham": "West Ham",
    "Arsenal FC": "Arsenal", "Arsenal": "Arsenal", "Liverpool FC": "Liverpool", "Liverpool": "Liverpool",
    "Chelsea FC": "Chelsea", "Chelsea": "Chelsea", "Everton FC": "Everton", "Everton": "Everton",
    "Aston Villa FC": "Aston Villa", "Aston Villa": "Aston Villa",
    "Nottingham Forest FC": "Nottingham Forest", "Nottingham Forest": "Nottingham Forest",
    "Fulham FC": "Fulham", "Fulham": "Fulham", "Brentford FC": "Brentford", "Brentford": "Brentford",
    "Crystal Palace FC": "Crystal Palace", "Crystal Palace": "Crystal Palace",
    "AFC Bournemouth": "Bournemouth", "Bournemouth": "Bournemouth",
    "Leicester City FC": "Leicester", "Leicester": "Leicester", "Ipswich Town FC": "Ipswich", "Ipswich": "Ipswich",
    "Southampton FC": "Southampton", "Southampton": "Southampton", "Leeds United FC": "Leeds", "Leeds": "Leeds",
    "Burnley FC": "Burnley", "Burnley": "Burnley", "Sunderland AFC": "Sunderland", "Sunderland": "Sunderland",
    "Real Madrid CF": "Real Madrid", "Real Madrid": "Real Madrid", "FC Barcelona": "Barcelona", "Barcelona": "Barcelona",
    "Atlético de Madrid": "Atlético Madrid", "Atlético Madrid": "Atlético Madrid",
    "Real Sociedad de Fútbol": "Real Sociedad", "Real Sociedad": "Real Sociedad",
    "Real Betis Balompié": "Real Betis", "Real Betis": "Real Betis",
    "FC Bayern München": "Bayern Munich", "Bayern Munich": "Bayern Munich",
    "Borussia Dortmund": "Dortmund", "Dortmund": "Dortmund", "Bayer 04 Leverkusen": "Bayer Leverkusen",
    "Bayer Leverkusen": "Bayer Leverkusen", "Eintracht Frankfurt": "Eintracht Frankfurt",
    "RB Leipzig": "RB Leipzig", "VfB Stuttgart": "Stuttgart", "VfL Wolfsburg": "Wolfsburg", "SC Freiburg": "Freiburg",
    "FC Internazionale Milano": "Inter", "Inter": "Inter", "AC Milan": "Milan", "Milan": "Milan",
    "Juventus FC": "Juventus", "Juventus": "Juventus", "AS Roma": "Roma", "Roma": "Roma",
    "SSC Napoli": "Napoli", "Napoli": "Napoli", "Atalanta BC": "Atalanta", "Atalanta": "Atalanta",
    "AFC Ajax": "Ajax", "Ajax": "Ajax", "PSV": "PSV", "Feyenoord": "Feyenoord",
})

ALLOW_FOOTBALL_DATA_DOWNLOADS = os.getenv("ALLOW_FOOTBALL_DATA_DOWNLOADS", "false").lower() == "true"
