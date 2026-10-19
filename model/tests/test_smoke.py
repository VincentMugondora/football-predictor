"""Phase 0 smoke tests verifying environment, dependencies, and config."""

import sys

import numpy as np
import pandas as pd

from model import config


def test_python_version_and_dependencies() -> None:
    assert sys.version_info >= (3, 11), "Python 3.11+ is required"
    df = pd.DataFrame({"odds": [2.0, 3.5, 4.0]})
    implied = 1.0 / np.asarray(df["odds"], dtype=float)
    assert len(implied) == 3
    assert np.all(implied > 0.0)


def test_config_constants_and_paths() -> None:
    assert config.MAX_PICKS_JSON_BYTES == 50 * 1024
    assert "E0" in config.ACTIVE_LEAGUES
    assert config.RAW_DATA_DIR.exists()
    assert config.SITE_DIR.exists()
    assert len(config.ODDS_SOURCE_PRIORITY) == 4
