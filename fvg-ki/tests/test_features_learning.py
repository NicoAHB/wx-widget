"""Modul 4 und 5: Merkmale, Label, lokales Modell (Random Forest und SGD mit partial_fit), SQLite, retrain_model()."""
import numpy as np
import pandas as pd

from fvg_ki.model.data import demo_data
from fvg_ki.model.detection import detect_fvgs
from fvg_ki.model.features import FEATURES, atr, ema, extract_features, label_outcomes
from fvg_ki.model.learner import FVGQualityModel, feature_matrix, retrain_model
from fvg_ki.model.store import FVGStore


def test_features_without_lookahead():
    df = demo_data(800, seed=2)
    f = detect_fvgs(df)
    x = extract_features(df, f)
    assert list(x.columns) == FEATURES and len(x) == len(f)
    r, i = f.iloc[-1], int(f.iloc[-1]["index"])
    a = atr(df).iloc[i]
    assert np.isclose(x.iloc[-1].relative_size, r["size"] / a)
    base = df["volume"].iloc[i - 21:i - 1].mean()  # 20 Kerzen vor der Ausbruchskerze
    assert np.isclose(x.iloc[-1].volume_spike, df["volume"].iloc[i - 1] / base)
    up = ema(df["close"], 50).iloc[i] > ema(df["close"], 200).iloc[i]
    assert x.iloc[-1].trend_alignment == int(up if r.direction == "bullish" else not up)
    # Zukunft darf nichts ändern: Merkmale mit abgeschnittenen Daten gleich
    cut = extract_features(df.iloc[: i + 1], detect_fvgs(df.iloc[: i + 1]))
    assert np.allclose(cut.iloc[-1].to_numpy(), x.iloc[-1].to_numpy(), equal_nan=True)


def test_trend_zero_before_ema200_and_neutral_volume(make):
    rows = [(10, 11, 9, 10.5), (10.5, 14, 10.4, 13.8), (13.8, 15, 12, 14.5)] * 3
    df = make(rows).assign(volume=np.nan)
    f = detect_fvgs(df)
    x = extract_features(df, f)
    assert (x.trend_alignment == 0).all() and (x.volume_spike == 1.0).all() and x.relative_size.isna().all()


def test_labels_bounce_break_open(make):
    gap = [(10, 11, 9, 10.5), (10.5, 14, 10.4, 13.8), (13.8, 15, 12, 14.5)]  # bullisch 11…12, Größe 1
    bounce = make(gap + [(14.5, 14.6, 11.5, 12.5), (12.5, 13.2, 12.4, 13.1)])  # berührt, dann ≥ 12 + 1 = 13
    brk = make(gap + [(14.5, 14.6, 11.5, 12.5), (12.5, 12.6, 10.5, 10.8)])  # berührt, dann durch 11
    same = make(gap + [(14.5, 14.6, 11.5, 12.5), (12.5, 13.5, 10.5, 11)])  # Ziel und Bruch in einer Kerze → 0
    never = make(gap + [(14.5, 16, 13, 15.5)])  # nie berührt → offen
    lab = lambda df: label_outcomes(df, detect_fvgs(df)).iloc[0]  # noqa: E731
    assert lab(bounce).label == 1 and lab(bounce).resolved_index == 4
    assert lab(brk).label == 0 and lab(brk).resolved_index == 4
    assert lab(same).label == 0
    assert np.isnan(lab(never).label) and lab(never).resolved_index == -1


def synthetic(n=400, seed=0):
    rng = np.random.default_rng(seed)
    X = pd.DataFrame({"relative_size": rng.uniform(0.1, 3, n), "volume_spike": rng.uniform(0.3, 4, n), "trend_alignment": rng.integers(0, 2, n)})
    y = ((X.trend_alignment == 1) & (X.volume_spike > 1.5) | (X.relative_size > 2.4)).astype(int).to_numpy()
    return X, y


def test_random_forest_learns_and_untrained_is_neutral():
    m = FVGQualityModel()
    assert np.all(m.predict_quality(np.zeros((3, 3))) == 0.5) and not m.trained
    X, y = synthetic()
    m.fit(feature_matrix(X), y)
    assert m.trained
    Xt, yt = synthetic(200, seed=9)
    acc = ((m.predict_quality(feature_matrix(Xt)) >= 0.5).astype(int) == yt).mean()
    assert acc > 0.9
    # zu wenige Fälle oder nur eine Klasse → untrainiert
    assert not FVGQualityModel().fit(feature_matrix(X.head(10)), y[:10]).trained
    assert not FVGQualityModel().fit(feature_matrix(X), np.ones(len(X), int)).trained


def test_sgd_partial_fit_incremental():
    X, y = synthetic(600, seed=4)
    m = FVGQualityModel(backend="sgd")
    for k in range(0, 600, 100):  # in sechs Schritten dazulernen
        m.partial_fit(feature_matrix(X.iloc[k:k + 100]), y[k:k + 100])
    assert m.trained and m.n_samples == 600
    Xt, yt = synthetic(300, seed=8)
    acc = ((m.predict_quality(feature_matrix(Xt)) >= 0.5).astype(int) == yt).mean()
    assert acc > 0.75


def test_store_upsert_keeps_label_and_retrain(tmp_path):
    df = demo_data(4000, seed=21)
    f = detect_fvgs(df)
    rows = pd.concat([f, extract_features(df, f), label_outcomes(df, f)], axis=1)
    st = FVGStore(str(tmp_path / "fvg.sqlite"))
    first = st.save_fvgs(rows.assign(label=np.nan), "DEMO", "1h")  # zuerst ohne Entscheidung
    assert first["inserted"] == len(rows) and st.count(labeled=True) == 0
    again = st.save_fvgs(rows, "DEMO", "1h")  # jetzt entschieden – gleiche Einträge, Label kommt dazu
    assert again == {"inserted": 0, "updated": len(rows)} and st.count() == len(rows)
    assert st.count(labeled=True) == int(rows.label.notna().sum()) > 60
    flipped = rows.assign(label=1 - rows.label)
    st.save_fvgs(flipped, "DEMO", "1h")  # ein gesetztes Label bleibt
    assert st.load_training_data().label.sum() == rows.label.dropna().sum()
    single = st.save_fvg(rows.iloc[0].to_dict(), "DEMO", "15m")  # einzelnes FVG, anderes Intervall
    assert single["inserted"] == 1

    model_path = str(tmp_path / "m.joblib")
    m = retrain_model(st, model_path, "random_forest")
    usable = len(st.load_training_data())  # entschieden und mit ATR (die ersten Kerzen haben noch keine)
    assert m["trained"] and m["samples"] == usable and 0 < st.count(labeled=True) - usable < 10 and m["cv_accuracy"] is not None
    assert FVGQualityModel.load(model_path).trained
    assert st.get_meta("last_training")["samples"] == m["samples"]

    s1 = retrain_model(st, str(tmp_path / "s.joblib"), "sgd")
    s2 = retrain_model(st, str(tmp_path / "s.joblib"), "sgd")  # nichts Neues → nichts gelernt
    assert s1["learned"] == m["samples"] and s2["learned"] == 0 and s2["model_samples"] == s1["model_samples"]
    csv = tmp_path / "fvg.csv"
    assert st.export_csv(str(csv)) == st.count() and csv.read_text().startswith("id,")
    st.close()
