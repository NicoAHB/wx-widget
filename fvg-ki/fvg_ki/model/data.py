"""Datenquellen für OHLCV: CSV-Datei, kostenlose öffentliche Binance-Kerzen (ohne Konto/Schlüssel) oder Demo-Daten."""
from __future__ import annotations

import json
import urllib.parse
import urllib.request

import numpy as np
import pandas as pd

from .detection import normalize_ohlcv

BINANCE_PUBLIC = "https://data-api.binance.vision/api/v3/klines"  # öffentliche Marktdaten, kostenlos


def load_csv(path: str) -> pd.DataFrame:
    """CSV mit Spalten time/open/high/low/close/volume (Zeit als Datum, Sekunden oder Millisekunden)."""
    return normalize_ohlcv(pd.read_csv(path))


def fetch_binance(symbol: str = "BTCUSDT", interval: str = "1h", limit: int = 1000, timeout: float = 15) -> pd.DataFrame:
    """Die letzten Kerzen von Binance Spot laden (ganzzahlige Parameter, keine Anmeldung nötig)."""
    q = urllib.parse.urlencode({"symbol": symbol.upper().replace("/", ""), "interval": interval, "limit": int(min(limit, 1000))})
    with urllib.request.urlopen(f"{BINANCE_PUBLIC}?{q}", timeout=timeout) as r:  # noqa: S310 – feste https-Adresse
        rows = json.loads(r.read().decode())
    df = pd.DataFrame(rows, columns=["time", "open", "high", "low", "close", "volume", "close_time", "q", "n", "tb", "tq", "x"])
    return normalize_ohlcv(df[["time", "open", "high", "low", "close", "volume"]].astype(float))


def demo_data(n: int = 1500, seed: int = 7, freq: str = "1h", start: str = "2026-01-01") -> pd.DataFrame:
    """Reproduzierbare Kunstreihe mit Trendphasen, Volumenspitzen und echten Lücken – zum Ausprobieren ohne Internet."""
    rng = np.random.default_rng(seed)
    drift = np.repeat(rng.normal(0, 0.0012, n // 60 + 1), 60)[:n]  # Trendphasen von je 60 Kerzen
    shock = rng.random(n) < 0.04
    ret = drift + rng.normal(0, 0.004, n) + np.where(shock, rng.normal(0, 0.018, n), 0)
    close = 100 * np.exp(np.cumsum(ret))
    open_ = np.concatenate([[100.0], close[:-1]]) * (1 + np.where(shock, rng.normal(0, 0.004, n), 0))
    wick = np.abs(rng.normal(0, 0.0025, (2, n)))
    high = np.maximum(open_, close) * (1 + wick[0])
    low = np.minimum(open_, close) * (1 - wick[1])
    volume = rng.gamma(4, 250, n) * np.where(shock, 3.5, 1.0)
    idx = pd.date_range(start, periods=n, freq=freq.replace("m", "min") if freq.endswith("m") else freq, tz="UTC")
    return pd.DataFrame({"open": open_, "high": high, "low": low, "close": close, "volume": volume}, index=idx)
