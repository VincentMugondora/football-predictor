"""Configuration for the MatchSense football model and daily pipeline."""

from pathlib import Path
import os
import sys

REPO_ROOT = Path(__file__).resolve().parent.parent


def _load_dotenv_early(path: Path) -> None:
    """Read .env before the settings below are evaluated, so values such as
    ALLOW_FOOTBALL_DATA_DOWNLOADS work from .env (e.g. in the Windows scheduled task),
    not only when set in the shell. Real environment variables always win.
    Skipped under pytest so a developer's .env can't change test behaviour."""
    if "pytest" in sys.modules:
        return
    try:
        lines = path.read_text(encoding="utf-8-sig").splitlines()
    except OSError:
        return
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key, value = key.strip(), value.strip()
        if value[:1] in {"'", '"'} and value[-1:] == value[:1]:
            value = value[1:-1]
        if key:
            os.environ.setdefault(key, value)


_load_dotenv_early(REPO_ROOT / ".env")
MODEL_DIR = REPO_ROOT / "model"
RAW_DATA_DIR = MODEL_DIR / "data" / "raw"
SITE_DIR = REPO_ROOT / "site"
PUBLIC_DIR = REPO_ROOT / "public"
PICKS_JSON_PATH = SITE_DIR / "picks.json"
PUBLIC_PICKS_JSON_PATH = PUBLIC_DIR / "picks.json"
PREDICTIONS_HISTORY_PATH = SITE_DIR / "predictions_history.json"
STATUS_JSON_PATH = SITE_DIR / "status.json"
BACKTEST_REPORT_PATH = SITE_DIR / "backtest_report.json"

# Size cap for picks.json (was 50 KB for 4 leagues; 8 leagues need more). GitHub serves
# it compressed, so the download is roughly a fifth of this. The app checks the same cap.
MAX_PICKS_JSON_BYTES = 160 * 1024

# Seasons to load from football-data.co.uk; the last entry is the current season
SEASONS: tuple[str, ...] = ("1920", "2021", "2122", "2223", "2324", "2425", "2526", "2627")
MIN_HISTORY_SEASONS_PER_LEAGUE = int(os.getenv("MIN_HISTORY_SEASONS_PER_LEAGUE", "5"))

# Leagues configured for football-data.co.uk CSV ingestion
ACTIVE_LEAGUES: tuple[str, ...] = ("E0", "SP1", "I1", "D1", "E1", "F1", "N1", "P1")
ALL_SUPPORTED_LEAGUES: tuple[str, ...] = ACTIVE_LEAGUES

LEAGUE_DISPLAY_NAMES: dict[str, str] = {
    "E0": "Premier League",
    "E1": "Championship",
    "SP1": "La Liga",
    "I1": "Serie A",
    "D1": "Bundesliga",
    "F1": "Ligue 1",
    "N1": "Eredivisie",
    "P1": "Primeira Liga",
}

# football-data.org v4 competition codes (all on the free tier) per football-data.co.uk Div.
LEAGUE_FD_ORG_CODES: dict[str, str] = {
    "E0": "PL", "SP1": "PD", "I1": "SA", "D1": "BL1",
    "E1": "ELC", "F1": "FL1", "N1": "DED", "P1": "PPL",
}

# The Odds API sport keys per football-data.org competition code.
ODDS_SPORT_BY_COMPETITION: dict[str, str] = {
    "PL": "soccer_epl",
    "PD": "soccer_spain_la_liga",
    "SA": "soccer_italy_serie_a",
    "BL1": "soccer_germany_bundesliga",
    "ELC": "soccer_efl_champ",
    "FL1": "soccer_france_ligue_one",
    "DED": "soccer_netherlands_eredivisie",
    "PPL": "soccer_portugal_primeira_liga",
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

# Default hybrid Bivariate-Poisson + Dixon-Coles + xG/Elo hyperparameters (Section 6.1)
DEFAULT_LR = 0.035
DEFAULT_LR_SHORT = 0.008
DEFAULT_LR_VENUE = 0.003
DEFAULT_LR_GLOBAL = 0.004
DEFAULT_DECAY = 0.0004
DEFAULT_SHORT_DECAY = 0.060
DEFAULT_DIXON_COLES_RHO = -0.13
DEFAULT_BIVARIATE_GAMMA = 0.08
DEFAULT_DRAW_PARITY_BOOST = 0.05
DEFAULT_OFFSEASON_REGRESSION = 0.96

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
    # Exact names from the locally cached football-data.co.uk seasons and
    # corresponding official football-data.org club names.
    "Watford": "Watford", "Watford FC": "Watford",
    "Norwich": "Norwich", "Norwich City FC": "Norwich",
    "West Brom": "West Brom", "West Bromwich Albion FC": "West Brom",
    "Luton": "Luton", "Luton Town FC": "Luton",
    "Augsburg": "Augsburg", "FC Augsburg": "Augsburg",
    "Bochum": "Bochum", "VfL Bochum": "Bochum", "VfL Bochum 1848": "Bochum",
    "Heidenheim": "Heidenheim", "1. FC Heidenheim 1846": "Heidenheim",
    "Hoffenheim": "Hoffenheim", "TSG Hoffenheim": "Hoffenheim",
    "Holstein Kiel": "Holstein Kiel", "FC St. Pauli": "St Pauli", "St Pauli": "St Pauli",
    "1. FC Union Berlin": "Union Berlin", "Union Berlin": "Union Berlin",
    "SV Werder Bremen": "Werder Bremen", "Werder Bremen": "Werder Bremen",
    "Bologna": "Bologna", "Bologna FC 1909": "Bologna",
    "Cagliari": "Cagliari", "Cagliari Calcio": "Cagliari",
    "Como": "Como", "Como 1907": "Como",
    "Empoli": "Empoli", "Empoli FC": "Empoli",
    "Fiorentina": "Fiorentina", "ACF Fiorentina": "Fiorentina",
    "Frosinone": "Frosinone", "Frosinone Calcio": "Frosinone",
    "Genoa": "Genoa", "Genoa CFC": "Genoa",
    "Lazio": "Lazio", "SS Lazio": "Lazio",
    "Lecce": "Lecce", "US Lecce": "Lecce",
    "Monza": "Monza", "AC Monza": "Monza",
    "Salernitana": "Salernitana", "US Salernitana 1919": "Salernitana",
    "Sassuolo": "Sassuolo", "US Sassuolo Calcio": "Sassuolo",
    "Torino": "Torino", "Torino FC": "Torino",
    "Udinese": "Udinese", "Udinese Calcio": "Udinese",
    "Parma": "Parma", "Parma Calcio 1913": "Parma",
    "Venezia": "Venezia", "Venezia FC": "Venezia",
    "Almeria": "Almería", "UD Almería": "Almería",
    "Cadiz": "Cádiz", "Cádiz CF": "Cádiz",
    "Celta": "Celta", "RC Celta de Vigo": "Celta",
    "Getafe": "Getafe", "Getafe CF": "Getafe",
    "Girona": "Girona", "Girona FC": "Girona",
    "Granada": "Granada", "Granada CF": "Granada",
    "Las Palmas": "Las Palmas", "UD Las Palmas": "Las Palmas",
    "Mallorca": "Mallorca", "RCD Mallorca": "Mallorca",
    "Osasuna": "Osasuna", "CA Osasuna": "Osasuna",
    "Sevilla": "Sevilla", "Sevilla FC": "Sevilla",
    "Valencia": "Valencia", "Valencia CF": "Valencia",
    "Villarreal": "Villarreal", "Villarreal CF": "Villarreal",
    "Valladolid": "Valladolid", "Real Valladolid CF": "Valladolid",
    "Levante": "Levante", "Levante UD": "Levante",
    "Eibar": "Eibar", "SD Eibar": "Eibar",
    # Added 2026-11-22 from team_names_review.json: football-data.org v4 and
    # The Odds API spellings for clubs in the current E0/SP1/I1/D1 seasons.
    # Premier League
    "Coventry": "Coventry", "Coventry City": "Coventry", "Coventry City FC": "Coventry",
    "Hull": "Hull", "Hull City": "Hull", "Hull City AFC": "Hull",
    "Ipswich Town": "Ipswich", "Leeds United": "Leeds",
    "Nottingham Forest": "Nottingham Forest", "Sunderland AFC": "Sunderland",
    # La Liga
    "Club Atlético de Madrid": "Atlético Madrid", "Atletico Madrid": "Atlético Madrid",
    "Athletic Club": "Athletic Club", "Athletic Bilbao": "Athletic Club",
    "Deportivo Alavés": "Alavés", "Alavés": "Alavés",
    "Elche": "Elche", "Elche CF": "Elche",
    "Espanyol": "Espanyol", "RCD Espanyol de Barcelona": "Espanyol",
    "Malaga": "Malaga", "Málaga": "Malaga", "Málaga CF": "Malaga",
    "Rayo Vallecano": "Rayo Vallecano", "Rayo Vallecano de Madrid": "Rayo Vallecano",
    "Santander": "Santander", "Racing Santander": "Santander",
    "Real Racing Club de Santander": "Santander", "Racing de Santander": "Santander",
    "La Coruna": "La Coruna", "RC Deportivo La Coruña": "La Coruna",
    "Deportivo La Coruña": "La Coruna", "Deportivo La Coruna": "La Coruna",
    "Oviedo": "Oviedo", "Real Oviedo": "Oviedo", "Huesca": "Huesca", "SD Huesca": "Huesca",
    "Celta Vigo": "Celta", "CA Osasuna": "Osasuna", "Levante UD": "Levante",
    # Serie A
    "Inter Milan": "Inter", "Hellas Verona": "Hellas Verona", "Hellas Verona FC": "Hellas Verona",
    "Cremonese": "Cremonese", "US Cremonese": "Cremonese",
    "Pisa": "Pisa", "AC Pisa 1909": "Pisa", "Pisa SC": "Pisa",
    # Bundesliga
    "TSG 1899 Hoffenheim": "Hoffenheim", "Köln": "Köln", "1. FC Köln": "Köln", "FC Köln": "Köln",
    "Mainz 05": "Mainz 05", "1. FSV Mainz 05": "Mainz 05", "FSV Mainz 05": "Mainz 05",
    "Gladbach": "Gladbach", "Borussia Mönchengladbach": "Gladbach", "Borussia Monchengladbach": "Gladbach",
    "Schalke 04": "Schalke 04", "FC Schalke 04": "Schalke 04",
    "Hamburg": "Hamburg", "Hamburger SV": "Hamburg", "Hamburg SV": "Hamburg",
    "Paderborn": "Paderborn", "SC Paderborn 07": "Paderborn", "SC Paderborn": "Paderborn",
    "Elversberg": "Elversberg", "SV 07 Elversberg": "Elversberg", "SV Elversberg": "Elversberg",
    "1. FC Heidenheim": "Heidenheim", "Freiburg": "Freiburg", "Stuttgart": "Stuttgart", "Wolfsburg": "Wolfsburg",
    # Added 2026-11-24 for the Championship, Ligue 1, Eredivisie and Primeira Liga.
    # Targets are football-data.co.uk CSV names. Championship names checked against the CSVs;
    # the others are a first pass and get checked once their CSVs are downloaded.
    # Championship
    "Birmingham City": "Birmingham", "Birmingham City FC": "Birmingham",
    "Blackburn Rovers": "Blackburn", "Blackburn Rovers FC": "Blackburn",
    "Bolton Wanderers": "Bolton", "Bolton Wanderers FC": "Bolton",
    "Bristol City FC": "Bristol City", "Burnley FC": "Burnley",
    "Cardiff City": "Cardiff", "Cardiff City FC": "Cardiff",
    "Charlton Athletic": "Charlton", "Charlton Athletic FC": "Charlton",
    "Derby County": "Derby", "Derby County FC": "Derby",
    "Ipswich Town FC": "Ipswich", "Leicester City": "Leicester", "Leicester City FC": "Leicester",
    "Lincoln City": "Lincoln", "Lincoln City FC": "Lincoln",
    "Middlesbrough FC": "Middlesbrough", "Millwall FC": "Millwall",
    "Norwich City": "Norwich", "Norwich City FC": "Norwich",
    "Oxford United": "Oxford", "Oxford United FC": "Oxford",
    "Portsmouth FC": "Portsmouth",
    "Preston North End": "Preston", "Preston North End FC": "Preston",
    "Queens Park Rangers": "QPR", "Queens Park Rangers FC": "QPR",
    "Sheffield United FC": "Sheffield United",
    "Sheffield Wednesday": "Sheffield Weds", "Sheffield Wednesday FC": "Sheffield Weds",
    "Southampton FC": "Southampton", "Stoke City": "Stoke", "Stoke City FC": "Stoke",
    "Swansea City": "Swansea", "Swansea City AFC": "Swansea",
    "Watford FC": "Watford", "West Bromwich Albion": "West Brom", "West Bromwich Albion FC": "West Brom",
    "Wrexham AFC": "Wrexham", "Wrexham": "Wrexham",
    # Ligue 1
    "Paris Saint-Germain FC": "Paris SG", "Paris Saint Germain": "Paris SG", "Paris Saint-Germain": "Paris SG",
    "Olympique de Marseille": "Marseille", "Olympique Lyonnais": "Lyon",
    "AS Monaco FC": "Monaco", "AS Monaco": "Monaco", "Lille OSC": "Lille", "OGC Nice": "Nice",
    "Stade Rennais FC 1901": "Rennes", "Racing Club de Lens": "Lens", "RC Lens": "Lens",
    "FC Nantes": "Nantes", "RC Strasbourg Alsace": "Strasbourg", "Montpellier HSC": "Montpellier",
    "Stade de Reims": "Reims", "Toulouse FC": "Toulouse", "Stade Brestois 29": "Brest",
    "Le Havre AC": "Le Havre", "FC Lorient": "Lorient", "FC Metz": "Metz", "AJ Auxerre": "Auxerre",
    "Angers SCO": "Angers", "AS Saint-Étienne": "St Etienne", "Saint Etienne": "St Etienne",
    "Paris FC": "Paris FC",
    # Eredivisie
    "AFC Ajax": "Ajax", "PSV": "PSV Eindhoven", "Feyenoord Rotterdam": "Feyenoord",
    "AZ": "AZ Alkmaar", "FC Twente '65": "Twente", "FC Twente": "Twente", "FC Utrecht": "Utrecht",
    "SC Heerenveen": "Heerenveen", "FC Groningen": "Groningen", "Go Ahead Eagles": "Go Ahead Eagles",
    "GA Eagles": "Go Ahead Eagles", "NEC": "Nijmegen", "NEC Nijmegen": "Nijmegen",
    "Fortuna Sittard": "For Sittard", "Heracles Almelo": "Heracles", "PEC Zwolle": "Zwolle",
    "Willem II Tilburg": "Willem II", "RKC Waalwijk": "Waalwijk", "Almere City FC": "Almere City",
    "SBV Excelsior": "Excelsior", "FC Volendam": "Volendam", "SC Telstar": "Telstar",
    # Primeira Liga
    "Sport Lisboa e Benfica": "Benfica", "FC Porto": "Porto",
    "Sporting Clube de Portugal": "Sp Lisbon", "Sporting Lisbon": "Sp Lisbon", "Sporting CP": "Sp Lisbon",
    "Sporting Clube de Braga": "Sp Braga", "Braga": "Sp Braga", "SC Braga": "Sp Braga",
    "Vitória SC": "Guimaraes", "Vitoria Guimaraes": "Guimaraes", "FC Famalicão": "Famalicao",
    "Famalicao": "Famalicao", "Gil Vicente FC": "Gil Vicente", "Moreirense FC": "Moreirense",
    "GD Estoril Praia": "Estoril", "Estoril": "Estoril", "FC Arouca": "Arouca", "Casa Pia AC": "Casa Pia",
    "Rio Ave FC": "Rio Ave", "CD Santa Clara": "Santa Clara", "CD Nacional": "Nacional",
    "CF Estrela da Amadora": "Estrela", "Estrela": "Estrela", "AVS Futebol SAD": "AVS",
    "CD Tondela": "Tondela", "FC Alverca": "Alverca", "Boavista FC": "Boavista", "SC Farense": "Farense",
    # Added after the first 8-league run (team_names_review.json, 2026-11-24).
    "ADO Den Haag": "Den Haag", "Den Haag": "Den Haag",
    "SC Cambuur-Leeuwarden": "Cambuur", "SC Cambuur": "Cambuur", "Cambuur": "Cambuur",
    "Telstar 1963": "Telstar", "Telstar": "Telstar",
    "FC Twente Enschede": "Twente", "FC Zwolle": "Zwolle",
    "ES Troyes AC": "Troyes", "Troyes": "Troyes", "Le Mans FC": "Le Mans", "Le Mans": "Le Mans",
    "Académico de Viseu FC": "Academico Viseu", "Academico de Viseu": "Academico Viseu",
    "Académico de Viseu": "Academico Viseu", "CS Marítimo": "Maritimo", "Maritimo": "Maritimo",
    "Marítimo": "Maritimo", "CF Estrela": "Estrela", "Famalicão": "Famalicao",
})

# Re-fetch odds when a match is within 24 hours and the saved prices are older than this.
ODDS_REFRESH_HOURS = float(os.getenv("ODDS_REFRESH_HOURS", "3"))
# Below this many credits left, skip the extra just-before-kick-off refreshes.
ODDS_CONSERVE_BELOW = int(os.getenv("ODDS_CONSERVE_BELOW", "120"))

ALLOW_FOOTBALL_DATA_DOWNLOADS = os.getenv("ALLOW_FOOTBALL_DATA_DOWNLOADS", "false").lower() == "true"


def timing_backfill_settings() -> dict[str, object]:
    """Read opt-in timing settings after .env has been loaded by run_daily."""
    def integer(name: str, default: int, minimum: int = 1) -> int:
        try:
            value = int(os.getenv(name, str(default)))
        except ValueError as exc:
            raise ValueError(f"{name} must be an integer.") from exc
        if value < minimum:
            raise ValueError(f"{name} must be at least {minimum}.")
        return value

    enabled = os.getenv("TIMING_BACKFILL_ENABLED", "false").strip().lower()
    if enabled not in {"true", "false"}:
        raise ValueError("TIMING_BACKFILL_ENABLED must be true or false.")
    league = os.getenv("TIMING_BACKFILL_LEAGUE", "E0").strip().upper()
    if league not in TIMING_BACKFILL_LEAGUES:
        raise ValueError("TIMING_BACKFILL_LEAGUE must be one of E0, D1, I1, SP1.")
    start_season = integer("TIMING_BACKFILL_START_SEASON", 2024)
    min_season = integer("TIMING_BACKFILL_MIN_SEASON", 2022)
    if min_season > start_season:
        raise ValueError("TIMING_BACKFILL_MIN_SEASON cannot exceed TIMING_BACKFILL_START_SEASON.")
    return {
        "enabled": enabled == "true",
        "league": league,
        "reserve": integer("TIMING_BACKFILL_RESERVE", 40, minimum=0),
        "max_requests": integer("TIMING_BACKFILL_MAX_REQUESTS_PER_RUN", 30),
        "min_goals_per_league": integer("TIMING_MIN_GOALS_PER_LEAGUE", 3000),
        "min_team_goals": integer("TIMING_MIN_TEAM_GOALS", 120),
        "start_season": start_season,
        "min_season": min_season,
    }


# Keep config independent of the provider module (which imports config).
TIMING_BACKFILL_LEAGUES = ("E0", "D1", "I1", "SP1")
