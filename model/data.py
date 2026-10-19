"""Historical CSV ingestion, schema validation, and team normalisation (Phase 1)."""

from __future__ import annotations

import time
import urllib.request
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd

from model import config

USER_AGENT = "MatchSenseDataPipeline/1.0 (Offline-First Statistical Model)"


def normalise_team_name(name: str) -> str:
    """Normalises club names using config.TEAM_NAME_MAP."""
    cleaned = str(name).strip()
    return config.TEAM_NAME_MAP.get(cleaned, cleaned)


def _download_file(url: str, dest: Path, timeout: int = 30) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        content = response.read()
    if not content or len(content) < 64:
        raise ValueError(f"Downloaded file from {url} is empty or truncated.")
    dest.write_bytes(content)
    return dest


def download_season_csv(
    league: str,
    season: str,
    raw_dir: Path = config.RAW_DATA_DIR,
    force_refresh: bool = False,
) -> Path:
    """Downloads a single league-season CSV from football-data.co.uk with local caching."""
    dest = raw_dir / f"{league}_{season}.csv"
    is_latest_season = season == config.SEASONS[-1]

    if dest.exists() and dest.stat().st_size > 100 and not force_refresh:
        if not is_latest_season:
            return dest
        age_seconds = time.time() - dest.stat().st_mtime
        if age_seconds < 24 * 3600:
            return dest

    url = config.HISTORICAL_CSV_URL_TEMPLATE.format(season=season, league=league)
    return _download_file(url, dest)


def resolve_odds_columns(df: pd.DataFrame) -> tuple[pd.Series, pd.Series, pd.Series, pd.Series]:
    """Resolves (OddsH, OddsD, OddsA, OddsSource) per row in priority order: PSC -> PS -> B365 -> Avg."""
    n = len(df)
    odds_h = pd.Series(np.nan, index=df.index, dtype=float)
    odds_d = pd.Series(np.nan, index=df.index, dtype=float)
    odds_a = pd.Series(np.nan, index=df.index, dtype=float)
    source = pd.Series("", index=df.index, dtype=object)

    for source_name, (col_h, col_d, col_a) in config.ODDS_SOURCE_PRIORITY:
        if col_h not in df.columns or col_d not in df.columns or col_a not in df.columns:
            continue

        cand_h = pd.to_numeric(df[col_h], errors="coerce")
        cand_d = pd.to_numeric(df[col_d], errors="coerce")
        cand_a = pd.to_numeric(df[col_a], errors="coerce")

        valid_mask = (
            odds_h.isna()
            & cand_h.notna()
            & cand_d.notna()
            & cand_a.notna()
            & (cand_h > 1.0)
            & (cand_d > 1.0)
            & (cand_a > 1.0)
        )
        if valid_mask.any():
            odds_h = odds_h.where(~valid_mask, cand_h)
            odds_d = odds_d.where(~valid_mask, cand_d)
            odds_a = odds_a.where(~valid_mask, cand_a)
            source = source.where(~valid_mask, source_name)

    return odds_h, odds_d, odds_a, source


def clean_and_normalise_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Validates schema, parses day-first dates, filters missing results/odds, and normalises names."""
    missing_cols = [c for c in config.REQUIRED_MATCH_COLUMNS if c not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing required columns: {missing_cols}")

    work = df.copy()

    # Drop completely empty spacer rows common in football-data.co.uk CSVs
    work = work.dropna(subset=["Div", "Date", "HomeTeam", "AwayTeam", "FTHG", "FTAG", "FTR"])

    # Parse dates day-first (handles DD/MM/YYYY and DD/MM/YY)
    work["Date"] = pd.to_datetime(work["Date"], dayfirst=True, format="mixed", errors="coerce")
    work["FTHG"] = pd.to_numeric(work["FTHG"], errors="coerce")
    work["FTAG"] = pd.to_numeric(work["FTAG"], errors="coerce")
    work["FTR"] = work["FTR"].astype(str).str.strip()

    odds_h, odds_d, odds_a, odds_src = resolve_odds_columns(work)
    work["OddsH"] = odds_h
    work["OddsD"] = odds_d
    work["OddsA"] = odds_a
    work["OddsSource"] = odds_src

    # Optional match stats columns (shots) if present in CSV
    if "HS" in work.columns and "AS" in work.columns:
        work["HS"] = pd.to_numeric(work["HS"], errors="coerce")
        work["AS"] = pd.to_numeric(work["AS"], errors="coerce")
    else:
        work["HS"] = np.nan
        work["AS"] = np.nan

    valid_rows = (
        work["Date"].notna()
        & work["FTHG"].notna()
        & work["FTAG"].notna()
        & (work["FTHG"] >= 0)
        & (work["FTAG"] >= 0)
        & work["FTR"].isin(["H", "D", "A"])
        & work["OddsH"].notna()
        & work["OddsD"].notna()
        & work["OddsA"].notna()
    )
    work = work.loc[valid_rows].copy()

    work["Div"] = work["Div"].astype(str).str.strip()
    work["HomeTeam"] = work["HomeTeam"].map(normalise_team_name)
    work["AwayTeam"] = work["AwayTeam"].map(normalise_team_name)
    work["FTHG"] = work["FTHG"].astype(int)
    work["FTAG"] = work["FTAG"].astype(int)

    work = work.sort_values(["Date", "Div", "HomeTeam", "AwayTeam"]).reset_index(drop=True)

    keep_cols = [
        "Div",
        "Date",
        "HomeTeam",
        "AwayTeam",
        "FTHG",
        "FTAG",
        "FTR",
        "OddsH",
        "OddsD",
        "OddsA",
        "OddsSource",
        "HS",
        "AS",
    ]
    return work[keep_cols]


def load_csv_file(path: Path) -> pd.DataFrame:
    """Reads a football-data.co.uk CSV handling UTF-8/Latin-1 encodings."""
    try:
        raw = pd.read_csv(path, encoding="utf-8", on_bad_lines="skip", low_memory=False)
    except UnicodeDecodeError:
        raw = pd.read_csv(path, encoding="latin-1", on_bad_lines="skip", low_memory=False)
    return clean_and_normalise_dataframe(raw)


def load_historical_matches(
    leagues: Iterable[str] = config.ACTIVE_LEAGUES,
    seasons: Iterable[str] = config.SEASONS,
    raw_dir: Path = config.RAW_DATA_DIR,
    download_missing: bool = True,
) -> pd.DataFrame:
    """Loads and combines all league/season CSVs into a single chronological DataFrame."""
    frames: list[pd.DataFrame] = []
    for league in leagues:
        for season in seasons:
            csv_path = raw_dir / f"{league}_{season}.csv"
            if not csv_path.exists() and download_missing:
                download_season_csv(league, season, raw_dir=raw_dir)
            if csv_path.exists():
                frames.append(load_csv_file(csv_path))

    if not frames:
        raise RuntimeError("No historical match files found or downloaded.")

    combined = pd.concat(frames, ignore_index=True)
    combined = combined.drop_duplicates(
        subset=["Div", "Date", "HomeTeam", "AwayTeam"]
    ).sort_values(["Date", "Div", "HomeTeam", "AwayTeam"]).reset_index(drop=True)
    return combined


def fetch_upcoming_fixtures(
    leagues: Iterable[str] = config.ACTIVE_LEAGUES,
    raw_dir: Path = config.RAW_DATA_DIR,
) -> pd.DataFrame:
    """Fetches upcoming fixtures from football-data.co.uk/fixtures.csv if available."""
    dest = raw_dir / "fixtures.csv"
    try:
        _download_file(config.FIXTURES_CSV_URL, dest, timeout=20)
    except Exception:
        if not dest.exists():
            return pd.DataFrame()

    try:
        raw = pd.read_csv(dest, encoding="utf-8", on_bad_lines="skip", low_memory=False)
    except UnicodeDecodeError:
        raw = pd.read_csv(dest, encoding="latin-1", on_bad_lines="skip", low_memory=False)

    required = ["Div", "Date", "HomeTeam", "AwayTeam"]
    if any(c not in raw.columns for c in required):
        return pd.DataFrame()

    work = raw.dropna(subset=required).copy()
    work["Div"] = work["Div"].astype(str).str.strip()
    work = work[work["Div"].isin(set(leagues))].copy()
    if work.empty:
        return pd.DataFrame()

    work["Date"] = pd.to_datetime(work["Date"], dayfirst=True, format="mixed", errors="coerce")
    odds_h, odds_d, odds_a, odds_src = resolve_odds_columns(work)
    work["OddsH"] = odds_h
    work["OddsD"] = odds_d
    work["OddsA"] = odds_a
    work["OddsSource"] = odds_src

    valid = work["Date"].notna() & work["OddsH"].notna() & work["OddsD"].notna() & work["OddsA"].notna()
    work = work.loc[valid].copy()
    work["HomeTeam"] = work["HomeTeam"].map(normalise_team_name)
    work["AwayTeam"] = work["AwayTeam"].map(normalise_team_name)
    return work[
        ["Div", "Date", "HomeTeam", "AwayTeam", "OddsH", "OddsD", "OddsA", "OddsSource"]
    ].sort_values(["Date", "Div", "HomeTeam"]).reset_index(drop=True)
