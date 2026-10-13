"""Modul 5 (Teil 1) – lokale, kostenlose Datenbank (SQLite aus der Python-Standardbibliothek) für alle erkannten FVGs.

Jedes erkannte FVG wird sofort gespeichert (Schlüssel: Kürzel | Intervall | Entstehungszeit | Richtung). Wird ein FVG
später entschieden (abgeprallt/durchbrochen), bekommt derselbe Eintrag sein Label – ein einmal gesetztes Label bleibt.
Für das SGD-Modell merkt sich die Datenbank, welche Fälle schon gelernt wurden (inkrementelles Lernen).
Optional: Export als CSV.
"""
from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from .features import FEATURES

SCHEMA = """
CREATE TABLE IF NOT EXISTS fvgs (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  interval TEXT NOT NULL,
  direction TEXT NOT NULL,
  created_time TEXT NOT NULL,
  top REAL NOT NULL,
  bottom REAL NOT NULL,
  size REAL NOT NULL,
  relative_size REAL,
  volume_spike REAL,
  trend_alignment INTEGER,
  label INTEGER,
  mitigated_time TEXT,
  quality REAL,
  trained_sgd INTEGER NOT NULL DEFAULT 0,
  first_seen TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS fvgs_label ON fvgs(label);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
"""


def _iso(v) -> str | None:
    """Zeitpunkt als ISO-Text (ohne Zeitindex: die Kerzennummer); fehlend → None."""
    if v is None:
        return None
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(v, (int, float, np.integer, np.floating)):
        return str(int(v)) if float(v).is_integer() else str(v)
    return pd.Timestamp(v).isoformat()


def fvg_id(symbol: str, interval: str, created_time, direction: str) -> str:
    return f"{symbol}|{interval}|{_iso(created_time)}|{direction}"


class FVGStore:
    def __init__(self, path: str):
        self.path = path
        if path != ":memory:":
            os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        self.db = sqlite3.connect(path, check_same_thread=False)
        if path != ":memory:":
            self.db.execute("PRAGMA journal_mode=WAL")  # Lesen während des Schreibens (Dash-Server, Neulernen)
        self.db.executescript(SCHEMA)
        self.db.commit()

    def close(self) -> None:
        self.db.close()

    def save_fvgs(self, rows: pd.DataFrame, symbol: str, interval: str) -> dict:
        """Erkannte FVGs (mit Merkmalen, optional label/quality) speichern bzw. aktualisieren. Gibt Zähler zurück."""
        if rows is None or not len(rows):
            return {"inserted": 0, "updated": 0}
        now = datetime.now(timezone.utc).isoformat()
        before = self.count()
        data = []
        for r in rows.itertuples(index=False):
            g = r._asdict()
            num = lambda k: None if g.get(k) is None or pd.isna(g.get(k)) else float(g[k])  # noqa: E731
            label = num("label")
            data.append((fvg_id(symbol, interval, g["created_time"], g["direction"]), symbol, interval, g["direction"],
                         _iso(g["created_time"]), float(g["top"]), float(g["bottom"]), float(g["size"]),
                         num("relative_size"), num("volume_spike"),
                         None if num("trend_alignment") is None else int(num("trend_alignment")),
                         None if label is None else int(label), _iso(g.get("mitigated_time")), num("quality"), now, now))
        self.db.executemany("""
          INSERT INTO fvgs (id, symbol, interval, direction, created_time, top, bottom, size, relative_size, volume_spike,
                            trend_alignment, label, mitigated_time, quality, first_seen, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            relative_size = COALESCE(excluded.relative_size, fvgs.relative_size),
            volume_spike = COALESCE(excluded.volume_spike, fvgs.volume_spike),
            trend_alignment = COALESCE(excluded.trend_alignment, fvgs.trend_alignment),
            label = COALESCE(fvgs.label, excluded.label),
            mitigated_time = COALESCE(fvgs.mitigated_time, excluded.mitigated_time),
            quality = COALESCE(excluded.quality, fvgs.quality),
            updated_at = excluded.updated_at""", data)
        self.db.commit()
        inserted = self.count() - before
        return {"inserted": inserted, "updated": len(data) - inserted}

    def save_fvg(self, row: dict, symbol: str, interval: str) -> dict:
        """Ein einzelnes FVG speichern (z. B. direkt nach der Erkennung im Live-Betrieb)."""
        return self.save_fvgs(pd.DataFrame([row]), symbol, interval)

    def count(self, labeled: bool = False) -> int:
        q = "SELECT COUNT(*) FROM fvgs" + (" WHERE label IS NOT NULL" if labeled else "")
        return int(self.db.execute(q).fetchone()[0])

    def load_training_data(self) -> pd.DataFrame:
        """Alle entschiedenen Fälle mit vollständigen Merkmalen (Größe braucht eine ATR, sonst nicht verwertbar)."""
        cols = ["id", *FEATURES, "label", "trained_sgd"]
        df = pd.read_sql_query(f"SELECT {', '.join(cols)} FROM fvgs WHERE label IS NOT NULL AND relative_size IS NOT NULL ORDER BY first_seen, id", self.db)
        return df.astype({"label": int, "trained_sgd": int}) if len(df) else pd.DataFrame(columns=cols)

    def load_all(self) -> pd.DataFrame:
        return pd.read_sql_query("SELECT * FROM fvgs ORDER BY created_time", self.db)

    def mark_trained(self, ids: list[str]) -> None:
        self.db.executemany("UPDATE fvgs SET trained_sgd = 1 WHERE id = ?", [(i,) for i in ids])
        self.db.commit()

    def set_meta(self, key: str, value) -> None:
        self.db.execute("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (key, json.dumps(value, default=str)))
        self.db.commit()

    def get_meta(self, key: str, default=None):
        row = self.db.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
        return json.loads(row[0]) if row else default

    def stats(self) -> dict:
        r = self.db.execute("SELECT COUNT(*), SUM(label = 1), SUM(label = 0), SUM(label IS NULL) FROM fvgs").fetchone()
        return {"total": r[0] or 0, "success": r[1] or 0, "failed": r[2] or 0, "open": r[3] or 0}

    def export_csv(self, path: str) -> int:
        df = self.load_all()
        df.to_csv(path, index=False)
        return len(df)
