"""Module 2 und 3 sowie Controller: Boxen (Farben, Alpha 0,2, Ende an der schließenden Kerze), Knöpfe, Info, Neulernen."""
import threading
import time
import urllib.request

import pandas as pd
import pytest

from fvg_ki.controller.app_controller import FVGController, create_app
from fvg_ki.model.data import demo_data
from fvg_ki.view.chart import ALPHA, BEAR_FILL, BULL_FILL, build_figure, fvg_shapes
from fvg_ki.view.layout import INFO_TEXT


def test_shapes_colors_alpha_and_extent(make):
    df = make([(10, 11, 9, 10.5), (10.5, 14, 10.4, 13.8), (13.8, 15, 12, 14.5), (14, 14.2, 10.9, 11), (11, 12, 10, 11.5)])
    from fvg_ki.model.detection import detect_fvgs
    f = detect_fvgs(df)
    s = fvg_shapes(f)
    assert len(s) == 1 and s[0]["fillcolor"] == BULL_FILL and s[0]["y0"] == 11 and s[0]["y1"] == 12
    assert s[0]["x0"] == df.index[0].isoformat() and s[0]["x1"] == df.index[3].isoformat()  # endet an der schließenden Kerze
    assert ALPHA == 0.2 and BULL_FILL.endswith("0.2)") and BEAR_FILL.endswith("0.2)") and BEAR_FILL.startswith("rgba(213")
    assert len(build_figure(df, f, show_fvg=True).layout.shapes) == 1
    assert len(build_figure(df, f, show_fvg=False).layout.shapes) == 0


def test_max_boxes_keeps_open_ones():
    df = demo_data(5000, seed=6)
    from fvg_ki.model.detection import detect_fvgs
    f = detect_fvgs(df)
    s = fvg_shapes(f, max_boxes=50)
    n_open = int((~f.mitigated).sum())
    assert len(s) == 50 and sum("(offen)" in x["name"] for x in s) == min(50, n_open)


@pytest.fixture
def ctrl(tmp_path):
    c = FVGController(demo_data(3000, seed=12), "DEMO", "1h", str(tmp_path / "f.sqlite"), str(tmp_path / "m.joblib"))
    c.run_pipeline()
    return c


def test_pipeline_saves_every_fvg(ctrl):
    assert len(ctrl.fvgs) > 50 and ctrl.store.count() == len(ctrl.fvgs) and ctrl.last_save["inserted"] == len(ctrl.fvgs)
    assert len(ctrl.quality) == len(ctrl.fvgs) and set(ctrl.quality.round(3)) == {0.5}  # vor dem ersten Lernen neutral
    ctrl.run_pipeline()  # erneut: nichts doppelt
    assert ctrl.store.count() == len(ctrl.fvgs) and ctrl.last_save["inserted"] == 0


def test_toggle_info_and_retrain(ctrl):
    shapes, vis, label = ctrl.toggle(True)
    assert shapes == [] and vis is False and label == "FVG: aus"
    shapes, vis, label = ctrl.toggle(False)
    assert len(shapes) > 0 and vis is True and label == "FVG: an"
    assert ctrl.info("fvg-info-btn") is False and ctrl.info("fvg-info-close") is True
    msg = ctrl.retrain_message()
    assert msg.startswith("KI neu gelernt:") and ctrl.model.trained and "Trefferquote" in msg
    assert 0 < ctrl.quality.min() < ctrl.quality.max() < 1
    assert any("label" in s and s["label"]["text"].startswith("KI ") for s in ctrl.shapes())


def test_dash_app_layout_and_server(ctrl):
    app = create_app(ctrl)
    ids = set()

    def walk(c):
        if hasattr(c, "id") and c.id:
            ids.add(c.id)
        for ch in (getattr(c, "children", None) or []) if isinstance(getattr(c, "children", None), list) else [getattr(c, "children", None)]:
            if ch is not None and not isinstance(ch, str):
                walk(ch)
    walk(app.layout)
    assert {"fvg-toggle", "fvg-info-btn", "fvg-info-modal", "fvg-info-close", "fvg-retrain", "fvg-chart", "fvg-visible"} <= ids
    assert "Kerze 1" in INFO_TEXT and "Kerze 3" in INFO_TEXT and "Marktungleichgewicht" in INFO_TEXT
    port = 8791
    th = threading.Thread(target=lambda: app.run(host="127.0.0.1", port=port, debug=False), daemon=True)
    th.start()
    for _ in range(50):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=2) as r:
                assert r.status == 200 and "FVG-Chart" in r.read().decode()
                break
        except OSError:
            time.sleep(0.2)
    else:
        pytest.fail("Dash-Server startet nicht")
    with urllib.request.urlopen(f"http://127.0.0.1:{port}/_dash-layout", timeout=5) as r:
        assert "fvg-toggle" in r.read().decode()
