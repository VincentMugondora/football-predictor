"""Small provider contracts shared by replaceable data sources."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime

import pandas as pd


@dataclass(frozen=True)
class Fixture:
    id: str
    competition: str
    kickoff: datetime
    home: str
    away: str
    status: str = "SCHEDULED"


class FixtureProvider(ABC):
    @abstractmethod
    def get_fixtures(self, start: datetime, end: datetime) -> list[Fixture]:
        """Return validated real fixtures in the requested time window."""

    @abstractmethod
    def get_finished(self, start: datetime, end: datetime) -> pd.DataFrame:
        """Return validated final results in the requested time window."""


class OddsProvider(ABC):
    @abstractmethod
    def get_h2h_odds(self, fixtures: list[Fixture]) -> dict[str, dict[str, object]]:
        """Return optional validated decimal home/draw/away odds keyed by fixture id."""


class HistoryProvider(ABC):
    @abstractmethod
    def load(self) -> pd.DataFrame:
        """Return validated historical match rows."""
