"""Modul 1 – Erkennung von Fair Value Gaps (FVG) im 3-Kerzen-Muster.

Bullisch:  Low[i]  > High[i-2]  und Kerze i-1 grün (Close > Open)  → Lücke von High[i-2] (unten) bis Low[i] (oben)
Bärisch:   High[i] < Low[i-2]   und Kerze i-1 rot  (Close < Open)  → Lücke von High[i] (unten) bis Low[i-2] (oben)

„Mitigiert“ (geschlossen) ist ein FVG ab der ersten späteren Kerze, deren Schatten die Lücke komplett schließt:
bullisch Low[j] <= Unterkante, bärisch High[j] >= Oberkante. Bis dahin wird die Box gezeichnet, danach nicht mehr.

Alles ist vektorisiert: die Erkennung mit NumPy-Masken, die Suche nach der schließenden Kerze für alle Lücken
gleichzeitig über eine Sparse-Table (Bereichs-Minimum/-Maximum) mit binärem Vorrücken – O((n + k) · log n) statt
einer Python-Schleife über alle Kerzen je Lücke.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

OHLCV = ("open", "high", "low", "close", "volume")
FVG_COLUMNS = [
    "index", "direction", "top", "bottom", "size", "start_time", "mid_time", "created_time",
    "touched", "touched_index", "touched_time", "mitigated", "mitigated_index", "mitigated_time", "end_time",
]
_ALIASES = {"o": "open", "h": "high", "l": "low", "c": "close", "v": "volume", "vol": "volume"}
_TIME_COLUMNS = ("time", "timestamp", "date", "datetime", "open_time", "opentime")


def normalize_ohlcv(df: pd.DataFrame) -> pd.DataFrame:
    """OHLCV vereinheitlichen: Spalten open/high/low/close/volume (Groß-/Kleinschreibung egal), Zeitindex, aufsteigend.

    Zeit kommt aus einem DatetimeIndex oder einer Spalte time/timestamp/date/… (Zahlen als Sekunden oder Millisekunden).
    Ohne Volumen wird es als NaN geführt (Merkmal volume_spike gilt dann als neutral).
    """
    if not isinstance(df, pd.DataFrame):
        raise TypeError("detect_fvgs erwartet ein pandas.DataFrame mit OHLCV-Spalten")
    out = df.rename(columns={c: str(c).strip().lower() for c in df.columns})
    out = out.rename(columns={k: v for k, v in _ALIASES.items() if k in out.columns and v not in out.columns})
    missing = [c for c in OHLCV[:4] if c not in out.columns]
    if missing:
        raise ValueError(f"Spalten fehlen: {', '.join(missing)}")
    if not isinstance(out.index, pd.DatetimeIndex):
        col = next((c for c in _TIME_COLUMNS if c in out.columns), None)
        if col is not None:
            t = out[col]
            if pd.api.types.is_numeric_dtype(t):
                unit = "ms" if float(np.nanmax(t.to_numpy(dtype=float))) > 1e11 else "s"
                out.index = pd.to_datetime(t.to_numpy(dtype="int64"), unit=unit, utc=True)
            else:
                out.index = pd.to_datetime(t, utc=True)
        else:
            out.index = pd.RangeIndex(len(out))
    if "volume" not in out.columns:
        out["volume"] = np.nan
    out = out[list(OHLCV)].astype(float)
    if not out.index.is_monotonic_increasing:
        out = out.sort_index(kind="stable")
    return out


def _first_reach(values: np.ndarray, starts: np.ndarray, thresholds: np.ndarray, below: bool) -> np.ndarray:
    """Je Abfrage den ersten Index j >= start mit values[j] <= threshold (below) bzw. >= threshold; sonst len(values).

    Sparse-Table: Ebene l enthält das Minimum der Fenster der Länge 2**l. Von start aus wird in absteigenden
    Zweierpotenzen gesprungen, solange das ganze Fenster die Schwelle nicht erreicht – danach steht pos auf dem Treffer.
    """
    n, k = len(values), len(starts)
    res = np.full(k, n, dtype=np.int64)
    if n == 0 or k == 0:
        return res
    v = values.astype(float) if below else -values.astype(float)  # Maximum-Suche über das Minimum der Negation
    thr = thresholds.astype(float) if below else -thresholds.astype(float)
    v = np.where(np.isnan(v), np.inf, v)  # fehlende Kurse erreichen nie eine Schwelle
    levels = [v]
    while (1 << len(levels)) <= n:
        prev, half = levels[-1], 1 << (len(levels) - 1)
        levels.append(np.minimum(prev[:-half], prev[half:]))
    pos = starts.astype(np.int64).copy()
    for lvl in range(len(levels) - 1, -1, -1):
        span, tab = 1 << lvl, levels[lvl]
        fits = pos + span <= n
        safe = np.where(fits, pos, 0)
        jump = fits & (tab[np.minimum(safe, len(tab) - 1)] > thr)
        pos = np.where(jump, pos + span, pos)
    inside = pos < n
    hit = inside & (v[np.minimum(pos, n - 1)] <= thr)
    res[hit] = pos[hit]
    return res


def _empty() -> pd.DataFrame:
    return pd.DataFrame({c: pd.Series(dtype="float64") for c in FVG_COLUMNS})


def detect_fvgs(df: pd.DataFrame) -> pd.DataFrame:
    """Alle Fair Value Gaps eines OHLCV-DataFrames finden, inklusive Zustand „mitigiert“.

    Rückgabe – eine Zeile je FVG, sortiert nach Entstehung:
      index           Position der dritten Kerze i (FVG steht ab ihrem Schluss fest)
      direction       "bullish" | "bearish"
      top, bottom     Ober- und Unterkante der Lücke, size = top - bottom
      start_time      Zeit der ersten Kerze (i-2) – linker Rand der Box
      mid_time        Zeit der Ausbruchskerze (i-1); created_time Zeit der Kerze i
      touched*        erste spätere Kerze, deren Schatten in die Lücke läuft
      mitigated*      erste spätere Kerze, deren Schatten die Lücke komplett schließt
      end_time        rechter Rand der Box: schließende Kerze, sonst die letzte Kerze (offenes FVG)
    """
    d = normalize_ohlcv(df)
    n = len(d)
    if n < 3:
        return _empty()
    o, h, l, c = (d[k].to_numpy(dtype=float) for k in OHLCV[:4])
    i = np.arange(2, n)
    bull = (l[2:] > h[:-2]) & (c[1:-1] > o[1:-1])
    bear = (h[2:] < l[:-2]) & (c[1:-1] < o[1:-1])
    ib, isr = i[bull], i[bear]
    idx = np.concatenate([ib, isr])
    if not len(idx):
        return _empty()
    is_bull = np.concatenate([np.ones(len(ib), bool), np.zeros(len(isr), bool)])
    top = np.concatenate([l[ib], l[isr - 2]])
    bottom = np.concatenate([h[ib - 2], h[isr]])
    order = np.argsort(idx, kind="stable")
    idx, is_bull, top, bottom = idx[order], is_bull[order], top[order], bottom[order]

    mitigated = np.full(len(idx), n, dtype=np.int64)
    touched = np.full(len(idx), n, dtype=np.int64)
    if is_bull.any():
        s = idx[is_bull] + 1
        mitigated[is_bull] = _first_reach(l, s, bottom[is_bull], below=True)
        touched[is_bull] = _first_reach(l, s, top[is_bull], below=True)
    if (~is_bull).any():
        s = idx[~is_bull] + 1
        mitigated[~is_bull] = _first_reach(h, s, top[~is_bull], below=False)
        touched[~is_bull] = _first_reach(h, s, bottom[~is_bull], below=False)

    t = d.index

    def pick(pos):  # Zeit der Kerze pos, ohne Treffer NaT (bzw. NaN ohne Zeitindex) – vektorisiert
        return pd.Series(t[np.minimum(pos, n - 1)]).where(pos < n).to_numpy()
    out = pd.DataFrame({
        "index": idx,
        "direction": np.where(is_bull, "bullish", "bearish"),
        "top": top,
        "bottom": bottom,
        "size": top - bottom,
        "start_time": t[idx - 2],
        "mid_time": t[idx - 1],
        "created_time": t[idx],
        "touched": touched < n,
        "touched_index": np.where(touched < n, touched, -1),
        "touched_time": pick(touched),
        "mitigated": mitigated < n,
        "mitigated_index": np.where(mitigated < n, mitigated, -1),
        "mitigated_time": pick(mitigated),
        "end_time": t[np.minimum(mitigated, n - 1)],
    })
    return out.reset_index(drop=True)


def active_fvgs(fvgs: pd.DataFrame) -> pd.DataFrame:
    """Nur offene (noch nicht mitigierte) FVGs."""
    return fvgs[~fvgs["mitigated"].astype(bool)] if len(fvgs) else fvgs
