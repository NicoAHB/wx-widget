"""Modul 2 (View) – interaktiver Candlestick-Chart mit FVG-Boxen (Plotly).

Boxen als Shapes: grün für bullisch, rot für bärisch, Deckkraft 0,2. Jede Box reicht von der ersten Kerze des
Musters bis zur Kerze, die die Lücke schließt – offene FVGs bis zur letzten Kerze. Die jüngsten offenen Boxen
(label_last) tragen die KI-Qualität als kleine Beschriftung – mehr würde sich am Handy überlagern. Für flüssiges
Zoomen werden höchstens max_boxes Boxen gezeichnet (alle offenen, dazu die jüngsten geschlossenen). Der Chart
öffnet auf den letzten window Kerzen; Zoomen und Verschieben zeigen den Rest.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import plotly.graph_objects as go

BULL_FILL = "rgba(0, 200, 83, 0.2)"
BEAR_FILL = "rgba(213, 0, 0, 0.2)"
ALPHA = 0.2


def fvg_shapes(fvgs: pd.DataFrame, quality: np.ndarray | None = None, max_boxes: int = 400, label_last: int = 12) -> list[dict]:
    """FVG-Boxen als Plotly-Shapes (Dicts, damit Dash sie direkt per Patch setzen kann)."""
    if fvgs is None or not len(fvgs):
        return []
    f = fvgs.copy()
    f["qscore"] = np.asarray(quality, float) if quality is not None and len(quality) == len(f) else np.nan
    open_ = f[~f["mitigated"].astype(bool)]
    labelled = set(open_["index"].tail(label_last).tolist())
    done = f[f["mitigated"].astype(bool)].tail(max(0, max_boxes - len(open_)))
    shapes = []
    for r in pd.concat([done, open_]).sort_values("index").itertuples(index=False):
        bull = r.direction == "bullish"
        s = {"type": "rect", "xref": "x", "yref": "y", "x0": _x(r.start_time), "x1": _x(r.end_time), "y0": float(r.bottom), "y1": float(r.top),
             "fillcolor": BULL_FILL if bull else BEAR_FILL, "line": {"width": 0}, "layer": "below",
             "name": f"FVG {'bullisch' if bull else 'bärisch'}{' (offen)' if not r.mitigated else ''}"}
        if not r.mitigated and r.index in labelled and not np.isnan(r.qscore):
            s["label"] = {"text": f"KI {round(r.qscore * 100)} %", "textposition": "top left", "font": {"size": 10, "color": "#1b5e20" if bull else "#b71c1c"}}
        shapes.append(s)
    return shapes[-max_boxes:]


def _x(v):
    return v.isoformat() if isinstance(v, pd.Timestamp) else (int(v) if isinstance(v, (np.integer, int)) else v)


def build_figure(df: pd.DataFrame, fvgs: pd.DataFrame, show_fvg: bool = True, quality: np.ndarray | None = None,
                 title: str = "", max_boxes: int = 400, window: int = 300) -> go.Figure:
    """Candlestick-Chart; die FVG-Boxen nur, wenn show_fvg wahr ist."""
    xr, yr = _window(df, window)
    fig = go.Figure(go.Candlestick(x=df.index, open=df["open"], high=df["high"], low=df["low"], close=df["close"], name="Kurs",
                                   increasing_line_color="#26a69a", decreasing_line_color="#ef5350"))
    fig.update_layout(title=title or None, template="plotly_white", height=640, margin={"l": 50, "r": 30, "t": 50 if title else 20, "b": 40},
                      xaxis={"rangeslider": {"visible": False}, **xr}, yaxis={"fixedrange": False, **yr}, dragmode="pan", uirevision="fvg",
                      shapes=fvg_shapes(fvgs, quality, max_boxes) if show_fvg else [], showlegend=False)
    return fig


def _window(df: pd.DataFrame, window: int) -> tuple[dict, dict]:
    """Anfangsausschnitt: die letzten window Kerzen (rechts etwas Rand für offene Boxen), Kursachse passend dazu.
    Doppelklick in den Chart zeigt wieder alles."""
    if not window or len(df) <= window:
        return {}, {}
    idx, tail = df.index, df.iloc[-window:]
    pad = (idx[-1] - idx[-2]) * 3
    lo, hi = float(tail["low"].min()), float(tail["high"].max())
    m = (hi - lo) * 0.05 or hi * 0.01
    return {"range": [_x(idx[-window]), _x(idx[-1] + pad)]}, {"range": [lo - m, hi + m]}
