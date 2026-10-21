"""Football-Data.co.uk history provider (manual/local cache by default)."""

from __future__ import annotations

import os

import pandas as pd

from model import config
from model.data import load_historical_matches
from model.providers.base import HistoryProvider


class FootballDataCsvProvider(HistoryProvider):
    def load(self) -> pd.DataFrame:
        # A CSV is downloaded only when an explicit opt-in acknowledges the source's
        # twice-weekly automated download ceiling and training-use restriction.
        allow_downloads = os.getenv("ALLOW_FOOTBALL_DATA_DOWNLOADS", "false").lower() == "true"
        return load_historical_matches(download_missing=allow_downloads)
