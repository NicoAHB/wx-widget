import os
import sys

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def candles(rows, start="2026-01-01", freq="1h"):
    """Kerzen aus (open, high, low, close[, volume]) – Volumen standardmäßig 100."""
    rows = [r if len(r) == 5 else (*r, 100.0) for r in rows]
    return pd.DataFrame(rows, columns=["open", "high", "low", "close", "volume"], index=pd.date_range(start, periods=len(rows), freq=freq, tz="UTC"))


@pytest.fixture
def make():
    return candles


@pytest.fixture
def rng():
    return np.random.default_rng(1)
