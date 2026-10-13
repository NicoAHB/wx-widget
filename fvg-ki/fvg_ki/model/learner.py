"""Modul 4 (Teil 2) und Modul 5 (Teil 2) – lokales, kostenloses ML-Modell für die FVG-Qualität.

Nur scikit-learn, läuft komplett auf dem eigenen Rechner – keine Cloud, kein API-Schlüssel, keine Kosten.

Zwei Varianten:
  random_forest  RandomForestClassifier, bei jedem Lernen schnell komplett neu auf allen gesammelten Fällen trainiert
                 (Standard; robust, braucht keine Skalierung).
  sgd            SGDClassifier (logistische Regression) mit StandardScaler, lernt per partial_fit nur die neuen Fälle
                 dazu – echtes inkrementelles Lernen, auch bei sehr vielen Fällen.

Ausgabe: Qualität 0…1 = geschätzte Wahrscheinlichkeit, dass der Kurs am FVG abprallt (Label 1). Solange zu wenige
Fälle oder nur eine Klasse vorliegen, bleibt das Modell „untrainiert“ und liefert neutral 0,5.
"""
from __future__ import annotations

import os
import tempfile
from dataclasses import dataclass, field

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import SGDClassifier
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler

from .features import FEATURES

BACKENDS = ("random_forest", "sgd")
NEUTRAL = {"relative_size": 1.0, "volume_spike": 1.0, "trend_alignment": 0.0}


def feature_matrix(frame: pd.DataFrame) -> np.ndarray:
    """Merkmale als Matrix; fehlende Werte neutral (Größe 1 ATR, Volumen wie üblich, kein Trend)."""
    X = frame.reindex(columns=FEATURES).astype(float)
    return X.fillna(NEUTRAL).to_numpy()


@dataclass
class FVGQualityModel:
    backend: str = "random_forest"
    min_samples: int = 30
    random_state: int = 42
    estimator: object = None
    scaler: object = None
    n_samples: int = 0
    classes: tuple = ()
    info: dict = field(default_factory=dict)

    def __post_init__(self):
        if self.backend not in BACKENDS:
            raise ValueError(f"unbekanntes Modell „{self.backend}“ – erlaubt: {', '.join(BACKENDS)}")

    @property
    def trained(self) -> bool:
        return self.estimator is not None and len(self.classes) == 2 and self.n_samples >= self.min_samples

    def _new(self):
        if self.backend == "random_forest":
            return RandomForestClassifier(n_estimators=200, max_depth=6, min_samples_leaf=3, class_weight="balanced",
                                          random_state=self.random_state, n_jobs=1)
        return SGDClassifier(loss="log_loss", alpha=1e-3, random_state=self.random_state)

    def fit(self, X: np.ndarray, y: np.ndarray) -> "FVGQualityModel":
        """Komplett neu lernen (beide Varianten)."""
        X, y = np.asarray(X, float), np.asarray(y, int)
        self.n_samples, self.classes = len(y), tuple(sorted(set(y.tolist())))
        if len(y) < self.min_samples or len(self.classes) < 2:
            self.estimator, self.scaler = None, None
            return self
        if self.backend == "random_forest":
            self.estimator = self._new().fit(X, y)
        else:
            self.scaler = StandardScaler().fit(X)
            self.estimator = self._new().fit(self.scaler.transform(X), y)
        return self

    def partial_fit(self, X: np.ndarray, y: np.ndarray) -> "FVGQualityModel":
        """Nur neue Fälle dazulernen (SGD). Beim Random Forest wird stattdessen komplett neu gelernt."""
        if self.backend != "sgd":
            raise ValueError("partial_fit gibt es nur für das SGD-Modell – Random Forest lernt mit fit() neu")
        X, y = np.asarray(X, float), np.asarray(y, int)
        if not len(y):
            return self
        self.scaler = self.scaler or StandardScaler()
        self.scaler.partial_fit(X)
        self.estimator = self.estimator or self._new()
        self.estimator.partial_fit(self.scaler.transform(X), y, classes=np.array([0, 1]))
        self.n_samples += len(y)
        self.classes = tuple(sorted(set(self.classes) | set(y.tolist())))
        return self

    def predict_quality(self, X: np.ndarray) -> np.ndarray:
        """Wahrscheinlichkeit für „prallt ab“ je Zeile; untrainiert 0,5."""
        X = np.asarray(X, float)
        if not len(X):
            return np.zeros(0)
        if not self.trained:
            return np.full(len(X), 0.5)
        Z = self.scaler.transform(X) if self.scaler is not None else X
        proba = self.estimator.predict_proba(Z)
        col = list(self.estimator.classes_).index(1)
        return proba[:, col]

    def save(self, path: str) -> None:
        """Atomar speichern (erst Temp-Datei, dann umbenennen) – ein Absturz hinterlässt nie ein halbes Modell."""
        folder = os.path.dirname(os.path.abspath(path))
        os.makedirs(folder, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=folder, suffix=".tmp")
        os.close(fd)
        joblib.dump(self, tmp)
        os.replace(tmp, path)

    @staticmethod
    def load(path: str, backend: str = "random_forest") -> "FVGQualityModel":
        if path and os.path.exists(path):
            m = joblib.load(path)
            if isinstance(m, FVGQualityModel) and m.backend == backend:
                return m
        return FVGQualityModel(backend=backend)


def evaluate(X: np.ndarray, y: np.ndarray, backend: str = "random_forest", random_state: int = 42) -> dict:
    """Kreuzvalidierte Trefferquote (5 Teile, geschichtet) neben der Quote „immer die häufigere Klasse“."""
    y = np.asarray(y, int)
    n1 = int(y.sum())
    out = {"samples": int(len(y)), "positives": n1, "negatives": int(len(y) - n1),
           "baseline": round(max(n1, len(y) - n1) / len(y), 4) if len(y) else None, "cv_accuracy": None}
    folds = min(5, n1, len(y) - n1)
    if folds >= 2 and len(y) >= 20:
        est = FVGQualityModel(backend=backend, min_samples=0, random_state=random_state)._new()
        if backend == "sgd":
            from sklearn.pipeline import make_pipeline
            est = make_pipeline(StandardScaler(), est)
        cv = StratifiedKFold(n_splits=folds, shuffle=True, random_state=random_state)
        out["cv_accuracy"] = round(float(cross_val_score(est, np.asarray(X, float), y, cv=cv).mean()), 4)
    return out


def retrain_model(store, model_path: str, backend: str = "random_forest", min_samples: int = 30) -> dict:
    """Gesammelte Fälle aus der lokalen Datenbank laden und das Modell aktualisieren.

    random_forest: schnelles, komplettes Neulernen auf allen entschiedenen Fällen.
    sgd:           partial_fit nur mit den Fällen, die das Modell noch nicht gesehen hat (in der Datenbank markiert).
    Ergebnis mit Kennzahlen; das Modell liegt danach unter model_path.
    """
    model = FVGQualityModel.load(model_path, backend)
    model.min_samples = min_samples
    data = store.load_training_data()
    if backend == "sgd":
        new = data[data["trained_sgd"] == 0] if len(data) else data
        model.partial_fit(feature_matrix(new), new["label"].to_numpy(dtype=int))
        if len(new):
            store.mark_trained(new["id"].tolist())
        learned = int(len(new))
    else:
        model.fit(feature_matrix(data), data["label"].to_numpy(dtype=int) if len(data) else np.zeros(0, int))
        learned = int(len(data))
    if model.trained or backend == "sgd":
        model.save(model_path)
    metrics = evaluate(feature_matrix(data), data["label"].to_numpy(dtype=int), backend) if len(data) else {"samples": 0}
    metrics.update({"backend": backend, "learned": learned, "trained": model.trained, "model_path": model_path,
                    "model_samples": model.n_samples})
    store.set_meta("last_training", metrics)
    return metrics
