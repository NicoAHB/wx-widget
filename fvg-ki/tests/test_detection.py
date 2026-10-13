"""Modul 1: 3-Kerzen-Logik, Mitigation, Boxenende, Abgleich mit einer einfachen Schleife, Tempo."""
import time

import numpy as np
import pandas as pd
import pytest

from fvg_ki.model.data import demo_data
from fvg_ki.model.detection import detect_fvgs, normalize_ohlcv


def test_bullish_fvg_and_mitigation(make):
    df = make([
        (10, 11, 9, 10.5),     # 0  Kerze 1: Hoch 11
        (10.5, 14, 10.4, 13.8),  # 1  grüne Ausbruchskerze
        (13.8, 15, 12, 14.5),  # 2  Kerze 3: Tief 12 > 11 → bullisches FVG 11…12
        (14.5, 15, 11.6, 14),  # 3  läuft hinein (Tief 11,6), schließt nicht
        (14, 14.2, 10.9, 11),  # 4  Tief 10,9 ≤ 11 → komplett geschlossen
        (11, 12, 10, 11.5),
    ])
    f = detect_fvgs(df)
    assert len(f) == 1
    r = f.iloc[0]
    assert r.direction == "bullish" and r["index"] == 2 and (r.bottom, r.top) == (11, 12) and r["size"] == 1
    assert r.touched and r.touched_index == 3 and r.mitigated and r.mitigated_index == 4
    assert r.start_time == df.index[0] and r.end_time == df.index[4] and r.mitigated_time == df.index[4]


def test_bearish_fvg_open_until_last_candle(make):
    df = make([
        (20, 21, 19, 19.5),    # Kerze 1: Tief 19
        (19.5, 19.6, 16, 16.2),  # rote Ausbruchskerze
        (16.2, 17.5, 15, 15.5),  # Kerze 3: Hoch 17,5 < 19 → bärisches FVG 17,5…19
        (15.5, 18.9, 15, 18),  # Hoch 18,9 – fast, aber nicht ganz geschlossen
        (18, 18.5, 16, 16.5),
    ])
    f = detect_fvgs(df)
    assert len(f) == 1
    r = f.iloc[0]
    assert r.direction == "bearish" and (r.bottom, r.top) == (17.5, 19)
    assert r.touched and r.touched_index == 3 and not r.mitigated and r.mitigated_index == -1 and pd.isna(r.mitigated_time)
    assert r.end_time == df.index[-1]  # offene Box reicht bis zur letzten Kerze


def test_middle_candle_must_have_direction(make):
    # Lücke vorhanden, aber Ausbruchskerze rot statt grün → kein bullisches FVG
    df = make([(10, 11, 9, 10.5), (13.8, 14, 10.4, 10.6), (13.8, 15, 12, 14.5)])
    assert detect_fvgs(df).empty
    # exakt anstoßende Kerzen (Low[i] == High[i-2]) sind keine Lücke
    df = make([(10, 11, 9, 10.5), (10.5, 14, 10.4, 13.8), (13.8, 15, 11, 14.5)])
    assert detect_fvgs(df).empty


def test_shadow_must_close_completely(make):
    # Schatten erreicht genau die Unterkante → zählt als geschlossen (≤); knapp darüber nicht
    base = [(10, 11, 9, 10.5), (10.5, 14, 10.4, 13.8), (13.8, 15, 12, 14.5)]
    assert detect_fvgs(make(base + [(14, 14.5, 11.0, 12)])).iloc[0].mitigated
    assert not detect_fvgs(make(base + [(14, 14.5, 11.01, 12)])).iloc[0].mitigated


def naive(df):
    d = normalize_ohlcv(df)
    o, h, l, c = (d[k].to_numpy() for k in ("open", "high", "low", "close"))
    out = []
    for i in range(2, len(d)):
        for bull in (True, False):
            if bull and l[i] > h[i - 2] and c[i - 1] > o[i - 1]:
                top, bot = l[i], h[i - 2]
            elif not bull and h[i] < l[i - 2] and c[i - 1] < o[i - 1]:
                top, bot = l[i - 2], h[i]
            else:
                continue
            m = next((j for j in range(i + 1, len(d)) if (l[j] <= bot if bull else h[j] >= top)), -1)
            t = next((j for j in range(i + 1, len(d)) if (l[j] <= top if bull else h[j] >= bot)), -1)
            out.append((i, "bullish" if bull else "bearish", top, bot, t, m))
    return out


def test_matches_simple_loop_on_random_data():
    df = demo_data(3000, seed=3)
    f = detect_fvgs(df)
    got = list(zip(f["index"], f["direction"], f["top"], f["bottom"], f["touched_index"], f["mitigated_index"]))
    assert len(got) > 50
    assert got == naive(df)


def test_accepts_lowercase_uppercase_and_time_column():
    df = demo_data(300, seed=5)
    raw = df.reset_index().rename(columns={"index": "time"})
    raw["time"] = raw["time"].astype("int64") // 10**6  # Millisekunden
    raw.columns = [c.upper() if c != "time" else c for c in raw.columns]
    a, b = detect_fvgs(df), detect_fvgs(raw)
    assert a[["index", "direction", "top", "bottom", "mitigated_index"]].equals(b[["index", "direction", "top", "bottom", "mitigated_index"]])
    assert (a["created_time"] == b["created_time"]).all()


def test_missing_columns_and_short_data():
    with pytest.raises(ValueError, match="Spalten fehlen"):
        detect_fvgs(pd.DataFrame({"open": [1], "high": [1]}))
    assert detect_fvgs(demo_data(2)).empty


def test_performance_100k_candles():
    df = demo_data(100_000, seed=11)
    t0 = time.perf_counter()
    f = detect_fvgs(df)
    dt = time.perf_counter() - t0
    assert len(f) > 1000
    assert dt < 3.0, f"zu langsam: {dt:.2f} s"
    # Stichprobe gegen die Schleife: Mitigation einzelner Lücken
    h, l = df["high"].to_numpy(), df["low"].to_numpy()
    for r in f.sample(50, random_state=1).itertuples():
        j = r.index + 1
        hit = np.nonzero((l[j:] <= r.bottom) if r.direction == "bullish" else (h[j:] >= r.top))[0]
        assert r.mitigated_index == (j + hit[0] if len(hit) else -1)
