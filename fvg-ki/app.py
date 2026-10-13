#!/usr/bin/env python3
"""FVG-Chart mit lokaler KI starten.

Beispiele:
  python app.py                                  Demo-Daten (offline), Browser: http://127.0.0.1:8050
  python app.py --csv kerzen.csv --symbol BTCUSDT --interval 1h
  python app.py --binance BTCUSDT --interval 15m  letzte 1000 Kerzen von Binance (öffentlich, kostenlos)
  python app.py --retrain-only                   nur erkennen, speichern und neu lernen (ohne Oberfläche)
"""
from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fvg_ki.controller.app_controller import FVGController, create_app  # noqa: E402
from fvg_ki.model.data import demo_data, fetch_binance, load_csv  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Fair Value Gaps im Chart mit lokaler, kostenloser KI")
    src = ap.add_mutually_exclusive_group()
    src.add_argument("--csv", help="OHLCV-CSV (time, open, high, low, close, volume)")
    src.add_argument("--binance", metavar="SYMBOL", help="Kerzen von Binance Spot laden, z. B. BTCUSDT")
    ap.add_argument("--symbol", default=None, help="Name im Chart und in der Datenbank")
    ap.add_argument("--interval", default="1h")
    ap.add_argument("--db", default=os.path.join(HERE, "daten", "fvg.sqlite"))
    ap.add_argument("--model", default=os.path.join(HERE, "daten", "fvg_modell.joblib"))
    ap.add_argument("--backend", choices=["random_forest", "sgd"], default="random_forest")
    ap.add_argument("--horizon", type=int, default=50, help="Kerzen bis zur Entscheidung abgeprallt/durchbrochen")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8050)
    ap.add_argument("--retrain-only", action="store_true")
    a = ap.parse_args(argv)

    if a.csv:
        df, symbol = load_csv(a.csv), a.symbol or os.path.splitext(os.path.basename(a.csv))[0]
    elif a.binance:
        df, symbol = fetch_binance(a.binance, a.interval), a.symbol or a.binance.upper()
    else:
        df, symbol = demo_data(freq=a.interval), a.symbol or "DEMO"

    ctrl = FVGController(df, symbol, a.interval, a.db, a.model, a.backend, a.horizon)
    ctrl.run_pipeline()
    if a.retrain_only:
        print(json.dumps(ctrl.retrain(), ensure_ascii=False, indent=2, default=str))
        return 0
    if not ctrl.model.trained:
        ctrl.retrain()  # erster Start: aus den eben gespeicherten Fällen lernen, sofern genug entschieden sind
    print(ctrl.status())
    create_app(ctrl).run(host=a.host, port=a.port, debug=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
