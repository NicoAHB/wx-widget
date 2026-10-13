"""Modul 4 (Teil 1) – Merkmale und Ergebnis-Label je FVG, ohne Blick in die Zukunft.

Merkmale (nur Daten bis zur Kerze i, an der das FVG feststeht):
  relative_size    Größe der Lücke ÷ ATR(14) an Kerze i
  volume_spike     Volumen der Ausbruchskerze i-1 ÷ SMA(Volumen, 20) der 20 Kerzen davor (ohne sie selbst,
                   damit die Spitze nicht sich selbst verdünnt); ohne Volumendaten neutral 1,0
  trend_alignment  1, wenn das FVG in Trendrichtung liegt (bullisch und EMA 50 > EMA 200 bzw. bärisch und
                   EMA 50 < EMA 200), sonst 0 (auch solange EMA 200 noch nicht berechenbar ist)

Label (Ziel für das Modell, braucht spätere Kerzen):
  1  erfolgreich: Der Kurs lief in die Lücke (Schatten berührt sie) und prallte ab – er erreicht danach das
     Abprallziel (bullisch Oberkante + bounce_mult × Größe, bärisch Unterkante − …), bevor die Lücke schließt.
  0  fehlgeschlagen: Die Lücke wird nach der Berührung komplett geschlossen (durchbrochen), bevor das Ziel kommt;
     fällt beides in dieselbe Kerze, zählt es vorsichtig als fehlgeschlagen.
  NaN offen: keine Berührung bzw. keine Entscheidung innerhalb von horizon Kerzen oder die Daten enden vorher.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .detection import _first_reach, normalize_ohlcv

FEATURES = ["relative_size", "volume_spike", "trend_alignment"]


def atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """Average True Range nach Wilder (gleitender Mittelwert mit 1/period), erste True Range = Hoch − Tief."""
    h, l, c = df["high"], df["low"], df["close"]
    prev = c.shift(1)
    tr = pd.concat([h - l, (h - prev).abs(), (l - prev).abs()], axis=1).max(axis=1)
    tr.iloc[0] = h.iloc[0] - l.iloc[0]
    return tr.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()


def ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False, min_periods=span).mean()


def extract_features(df: pd.DataFrame, fvgs: pd.DataFrame, atr_period: int = 14, vol_period: int = 20) -> pd.DataFrame:
    """Die drei Merkmale je FVG (Zeilen in derselben Reihenfolge wie fvgs)."""
    d = normalize_ohlcv(df)
    if not len(fvgs):
        return pd.DataFrame(columns=FEATURES, dtype=float)
    i = fvgs["index"].to_numpy(dtype=np.int64)
    a = atr(d, atr_period).to_numpy()
    vol = d["volume"].to_numpy(dtype=float)
    base = d["volume"].rolling(vol_period, min_periods=vol_period).mean().shift(1).to_numpy()
    e50, e200 = ema(d["close"], 50).to_numpy(), ema(d["close"], 200).to_numpy()
    size = fvgs["size"].to_numpy(dtype=float)
    with np.errstate(divide="ignore", invalid="ignore"):
        rel = np.where(a[i] > 0, size / a[i], np.nan)
        spike = np.where(base[i - 1] > 0, vol[i - 1] / base[i - 1], np.nan)
    spike = np.where(np.isnan(spike) & np.all(np.isnan(vol)), 1.0, spike)  # gar kein Volumen: neutral
    bull = fvgs["direction"].to_numpy() == "bullish"
    up, down = e50[i] > e200[i], e50[i] < e200[i]  # NaN-Vergleiche sind False → 0
    trend = np.where(bull, up, down).astype(int)
    return pd.DataFrame({"relative_size": rel, "volume_spike": spike, "trend_alignment": trend}, index=fvgs.index)


def label_outcomes(df: pd.DataFrame, fvgs: pd.DataFrame, horizon: int = 50, bounce_mult: float = 1.0) -> pd.DataFrame:
    """Ergebnis je FVG: label (1/0/NaN) und resolved_index (Kerze der Entscheidung, sonst -1)."""
    d = normalize_ohlcv(df)
    n = len(d)
    if not len(fvgs):
        return pd.DataFrame({"label": pd.Series(dtype=float), "resolved_index": pd.Series(dtype="int64")})
    h, l = d["high"].to_numpy(dtype=float), d["low"].to_numpy(dtype=float)
    i = fvgs["index"].to_numpy(dtype=np.int64)
    t = fvgs["touched_index"].to_numpy(dtype=np.int64)
    m = fvgs["mitigated_index"].to_numpy(dtype=np.int64)
    m = np.where(m < 0, n, m)
    bull = fvgs["direction"].to_numpy() == "bullish"
    top, bottom, size = (fvgs[k].to_numpy(dtype=float) for k in ("top", "bottom", "size"))
    touched = (t >= 0) & (t <= i + horizon)
    target = np.full(len(i), n, dtype=np.int64)
    start = np.where(touched, t + 1, n)  # Abprall erst nach der Berührungskerze (Reihenfolge darin unbekannt)
    if bull.any():
        target[bull] = _first_reach(h, start[bull], top[bull] + bounce_mult * size[bull], below=False)
    if (~bull).any():
        target[~bull] = _first_reach(l, start[~bull], bottom[~bull] - bounce_mult * size[~bull], below=True)
    limit = t + horizon
    win = touched & (target < m) & (target <= limit) & (target < n)
    lose = touched & (m <= target) & (m <= limit) & (m < n)
    label = np.where(win, 1.0, np.where(lose, 0.0, np.nan))
    resolved = np.where(win, target, np.where(lose, m, -1))
    return pd.DataFrame({"label": label, "resolved_index": resolved.astype(np.int64)}, index=fvgs.index)
