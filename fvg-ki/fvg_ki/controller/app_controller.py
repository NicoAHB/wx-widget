"""Controller – verbindet Model (Erkennung, Merkmale, Modell, Datenbank) und View (Chart, Knöpfe).

Ablauf je Datensatz (run_pipeline):
  1. detect_fvgs          alle FVGs mit Zustand „mitigiert“
  2. extract_features     relative_size, volume_spike, trend_alignment (ohne Blick in die Zukunft)
  3. label_outcomes       abgeprallt (1) / durchbrochen (0) / offen (NaN)
  4. Modell               Qualität 0…1 je FVG (lokal, scikit-learn)
  5. FVGStore.save_fvgs   jedes erkannte FVG sofort in SQLite (Label folgt, sobald entschieden)
„KI neu lernen“ ruft retrain_model() auf und bewertet danach alle FVGs neu.
"""
from __future__ import annotations

import os

import numpy as np
import pandas as pd
from dash import Dash, Input, Output, Patch, State, ctx, no_update

from ..model.detection import detect_fvgs, normalize_ohlcv
from ..model.features import extract_features, label_outcomes
from ..model.learner import FVGQualityModel, feature_matrix, retrain_model
from ..model.store import FVGStore
from ..view.chart import build_figure, fvg_shapes
from ..view.layout import build_layout


class FVGController:
    def __init__(self, df: pd.DataFrame, symbol: str = "DEMO", interval: str = "1h", db_path: str = "daten/fvg.sqlite",
                 model_path: str = "daten/fvg_modell.joblib", backend: str = "random_forest", horizon: int = 50, max_boxes: int = 400):
        self.df = normalize_ohlcv(df)
        self.symbol, self.interval, self.backend, self.horizon, self.max_boxes = symbol, interval, backend, horizon, max_boxes
        self.model_path = model_path
        self.store = FVGStore(db_path)
        self.model = FVGQualityModel.load(model_path, backend)
        self.fvgs = pd.DataFrame()
        self.quality = np.zeros(0)
        self.last_save = {"inserted": 0, "updated": 0}

    # ---- Model-Seite ----
    def run_pipeline(self) -> pd.DataFrame:
        fvgs = detect_fvgs(self.df)
        if len(fvgs):
            fvgs = pd.concat([fvgs, extract_features(self.df, fvgs), label_outcomes(self.df, fvgs, self.horizon)], axis=1)
        self.fvgs = fvgs
        self.rescore()
        self.last_save = self.store.save_fvgs(fvgs.assign(quality=self.quality) if len(fvgs) else fvgs, self.symbol, self.interval)
        return fvgs

    def rescore(self) -> None:
        self.quality = self.model.predict_quality(feature_matrix(self.fvgs)) if len(self.fvgs) else np.zeros(0)

    def retrain(self) -> dict:
        metrics = retrain_model(self.store, self.model_path, self.backend)
        self.model = FVGQualityModel.load(self.model_path, self.backend)
        self.rescore()
        if len(self.fvgs):
            self.store.save_fvgs(self.fvgs.assign(quality=self.quality), self.symbol, self.interval)
        return metrics

    # ---- View-Seite ----
    def shapes(self) -> list[dict]:
        return fvg_shapes(self.fvgs, self.quality, self.max_boxes)

    def figure(self, show: bool = True):
        return build_figure(self.df, self.fvgs, show, self.quality, f"{self.symbol} · {self.interval}", self.max_boxes)

    def status(self) -> str:
        f = self.fvgs
        if not len(f):
            return "Keine FVGs im Datensatz."
        st, open_ = self.store.stats(), int((~f["mitigated"].astype(bool)).sum())
        ki = f"KI trainiert ({self.model.n_samples} Fälle, {self.backend})" if self.model.trained else f"KI lernt noch ({st['success'] + st['failed']} entschiedene Fälle, ab {self.model.min_samples})"
        return f"{len(f)} FVGs, davon {open_} offen · Datenbank: {st['total']} gespeichert · {ki}"

    # ---- Aktionen der Knöpfe (ohne Dash testbar) ----
    def toggle(self, visible: bool) -> tuple[list[dict], bool, str]:
        now = not visible
        return (self.shapes() if now else []), now, "FVG: an" if now else "FVG: aus"

    @staticmethod
    def info(triggered: str | None) -> bool:
        """True = Fenster versteckt. Öffnen mit „?“, Schließen mit „Schließen“."""
        return triggered != "fvg-info-btn"

    def retrain_message(self) -> str:
        m = self.retrain()
        acc = f", Trefferquote (Kreuzvalidierung) {round(m['cv_accuracy'] * 100)} % bei Basis {round(m['baseline'] * 100)} %" if m.get("cv_accuracy") is not None else ""
        state = "trainiert" if m["trained"] else "noch zu wenige entschiedene Fälle"
        return f"KI neu gelernt: {m.get('samples', 0)} Fälle ({m.get('positives', 0)} abgeprallt, {m.get('negatives', 0)} durchbrochen) – {state}{acc}. " + self.status()


def create_app(ctrl: FVGController) -> Dash:
    """Dash-App mit den drei Knöpfen; die Boxen werden per Patch umgeschaltet (kein Neuzeichnen der Kerzen)."""
    app = Dash(__name__, assets_folder=os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets"), title="FVG-Chart · lokale KI")
    app.layout = build_layout(ctrl.figure(True), ctrl.status())

    @app.callback(Output("fvg-chart", "figure"), Output("fvg-visible", "data"), Output("fvg-toggle", "children"),
                  Output("fvg-toggle", "aria-pressed"), Output("fvg-toggle", "className"),
                  Input("fvg-toggle", "n_clicks"), State("fvg-visible", "data"), prevent_initial_call=True)
    def _toggle(_n, visible):
        shapes, now, label = ctrl.toggle(bool(visible))
        p = Patch()
        p["layout"]["shapes"] = shapes
        return p, now, label, "true" if now else "false", "fvg-btn on" if now else "fvg-btn"

    @app.callback(Output("fvg-info-modal", "hidden"), Input("fvg-info-btn", "n_clicks"), Input("fvg-info-close", "n_clicks"), prevent_initial_call=True)
    def _info(_a, _b):
        return ctrl.info(ctx.triggered_id)

    @app.callback(Output("fvg-status", "children"), Output("fvg-chart", "figure", allow_duplicate=True),
                  Input("fvg-retrain", "n_clicks"), State("fvg-visible", "data"), prevent_initial_call=True)
    def _retrain(_n, visible):
        msg = ctrl.retrain_message()
        if not visible:
            return msg, no_update
        p = Patch()
        p["layout"]["shapes"] = ctrl.shapes()
        return msg, p

    return app
