"""Download the football-data.co.uk history CSVs using only built-in Python.

Use this when pandas/numpy can't be loaded (for example, Windows Smart App
Control blocking numpy's DLLs). It writes the same files the pipeline expects:
model/data/raw/<LEAGUE>_<SEASON>.csv plus model/data/raw/fixtures.csv.

football-data.co.uk asks that files are downloaded at most about twice a week,
so finished seasons that are already on disk are skipped.

Run from the project folder:
    python scripts/download_history.py
"""

from __future__ import annotations

import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "model" / "data" / "raw"

SEASONS = ("1920", "2021", "2122", "2223", "2324", "2425", "2526", "2627")
LEAGUES = ("E0", "E1", "SP1", "I1", "D1")
URL = "https://www.football-data.co.uk/mmz4281/{season}/{league}.csv"
FIXTURES_URL = "https://www.football-data.co.uk/fixtures.csv"
USER_AGENT = "MatchSenseDataPipeline/1.0 (Offline-First Statistical Model)"
LATEST_REFRESH_SECONDS = 3.5 * 24 * 3600


def fetch(url: str, dest: Path, retries: int = 3) -> bool:
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=60) as response:
                content = response.read()
            if len(content) < 64:
                raise ValueError("file is empty or truncated")
            dest.write_bytes(content)
            print(f"  ok    {dest.name} ({len(content) // 1024} KB)")
            return True
        except Exception as exc:  # noqa: BLE001 - report and retry
            if attempt == retries:
                print(f"  FAIL  {dest.name}: {exc}")
                return False
            time.sleep(2 * attempt)
    return False


def needs_download(dest: Path, latest: bool) -> bool:
    if not dest.exists() or dest.stat().st_size <= 100:
        return True
    if not latest:
        return False
    return time.time() - dest.stat().st_mtime >= LATEST_REFRESH_SECONDS


def main() -> int:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Saving to {RAW_DIR}")
    failures = 0
    for league in LEAGUES:
        for season in SEASONS:
            dest = RAW_DIR / f"{league}_{season}.csv"
            if not needs_download(dest, latest=season == SEASONS[-1]):
                print(f"  skip  {dest.name} (already have it)")
                continue
            if not fetch(URL.format(season=season, league=league), dest):
                failures += 1
            time.sleep(1)  # be polite to the server
    fetch(FIXTURES_URL, RAW_DIR / "fixtures.csv")
    print("Done." if failures == 0 else f"Done with {failures} failed file(s).")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
