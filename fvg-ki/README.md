# FVG-Chart mit lokaler KI

Fair Value Gaps (FVG) automatisch erkennen, im interaktiven Chart zeichnen und von einer **lokalen, kostenlosen KI** bewerten lassen. Das Modell lernt mit jedem entschiedenen FVG dazu.

- Keine Cloud-KI, kein API-Schlüssel, keine Kosten.
- Alles läuft auf dem eigenen Rechner mit Pandas, Plotly/Dash, scikit-learn und SQLite.
- Steht neben der Scalp-Desk-App im selben Repository und ist von ihr unabhängig.

## Schnellstart

```bash
cd fvg-ki
python3 -m venv .venv && . .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py                                      # Demo-Daten, offline → http://127.0.0.1:8050
```

Weitere Aufrufe:

| Befehl | Wirkung |
|---|---|
| `python app.py --csv kerzen.csv --symbol BTCUSDT --interval 1h` | eigene OHLCV-Datei mit den Spalten `time, open, high, low, close, volume`. `time` als Datum, Sekunden oder Millisekunden. |
| `python app.py --binance BTCUSDT --interval 15m` | die letzten 1.000 Kerzen von Binance Spot (öffentlich, ohne Konto) |
| `python app.py --backend sgd` | inkrementelles Modell (`partial_fit`) statt Random Forest |
| `python app.py --retrain-only` | nur erkennen, speichern und neu lernen, Kennzahlen als JSON |
| `python -m pytest -q` | Tests |

Datenbank und Modell liegen in `daten/` (`fvg.sqlite`, `fvg_modell.joblib`). Der Ordner ist nicht im Git.

## Aufbau (Model – View – Controller)

```
fvg-ki/
├─ app.py                         Start (Kommandozeile)
├─ fvg_ki/
│  ├─ model/
│  │  ├─ detection.py             Modul 1  detect_fvgs(df): 3-Kerzen-Logik, „mitigiert“, Boxenende
│  │  ├─ features.py              Modul 4  Merkmale relative_size / volume_spike / trend_alignment, Label
│  │  ├─ learner.py               Modul 4+5 lokales Modell (Random Forest oder SGD), retrain_model()
│  │  ├─ store.py                 Modul 5  SQLite: jedes FVG speichern, Label nachtragen, CSV-Export
│  │  └─ data.py                  CSV, Binance (öffentlich), Demo-Daten
│  ├─ view/
│  │  ├─ chart.py                 Modul 2  Candlestick + FVG-Boxen (grün/rot, Deckkraft 0,2)
│  │  └─ layout.py                Module 2+3 Knöpfe „FVG: an/aus“, „?“ mit Erklärfenster, „KI neu lernen“
│  ├─ controller/app_controller.py Ablauf + Dash-Callbacks
│  └─ assets/style.css
└─ tests/                         pytest
```

## Die fünf Module

### 1. Erkennung: `detect_fvgs(df)`

- Bullisch: `Low[i] > High[i-2]`, wenn Kerze `i-1` grün ist (`Close > Open`). Die Lücke reicht von `High[i-2]` bis `Low[i]`.
- Bärisch: `High[i] < Low[i-2]`, wenn Kerze `i-1` rot ist. Die Lücke reicht von `High[i]` bis `Low[i-2]`.
- Mitigiert: Die erste spätere Kerze, deren Schatten die Lücke komplett schließt, beendet das FVG. Bullisch gilt das ab `Low ≤ Unterkante`, bärisch ab `High ≥ Oberkante`.
  - Die Box wird nur bis zu dieser Kerze gezeichnet.
  - Offene FVGs reichen bis zur letzten Kerze.
- Leistung:
  - Die Erkennung arbeitet vollständig mit NumPy-Masken.
  - Die schließende Kerze wird für alle Lücken gleichzeitig gesucht, über eine Sparse-Table mit binärem Vorrücken. Das ist O((n + k) · log n).
  - 100.000 Kerzen brauchen etwa 0,1 Sekunden.
  - Das Ergebnis ist gegen eine einfache Schleife geprüft.

### 2. Chart mit Knopf „FVG: an/aus“

- Plotly-Candlestick in einer schlanken Dash-App.
- Die Boxen sind Shapes: grün für bullisch, rot für bärisch, Deckkraft 0,2.
- Der Knopf blendet die Boxen per `Patch` ein und aus. Die Kerzen werden dabei nicht neu übertragen.
- Für flüssiges Zoomen zeichnet der Chart höchstens 400 Boxen: alle offenen, dazu die jüngsten geschlossenen.
- Die 12 jüngsten offenen Boxen zeigen die KI-Qualität („KI 72 %“).

### 3. Info-Knopf „?“

- Steht direkt neben dem Umschalter.
- Hover zeigt eine Kurzfassung, ein Klick öffnet ein Erklärfenster. Es erklärt die Lücke zwischen Kerze 1 und 3 als Marktungleichgewicht, die Farben, „mitigiert“ und die KI-Qualität.
- Das Fenster schließt mit „Schließen“.

### 4. Lokales ML-Modell

Merkmale je FVG. Sie nutzen nur Daten bis zur Kerze `i`, also ohne Blick in die Zukunft:

| Merkmal | Bedeutung |
|---|---|
| `relative_size` | Größe der Lücke ÷ ATR(14) |
| `volume_spike` | Volumen der Ausbruchskerze `i-1` ÷ SMA(Volumen, 20) der 20 Kerzen davor (ohne Volumendaten neutral 1,0) |
| `trend_alignment` | 1, wenn das FVG in Richtung EMA 50/200 liegt (bullisch und EMA 50 > EMA 200 bzw. bärisch und EMA 50 < EMA 200), sonst 0 |

Label:

- **1 (abgeprallt):** Der Kurs läuft in die Lücke und erreicht danach das Abprallziel, bevor die Lücke schließt. Das Ziel liegt bullisch bei Oberkante + 1 × Größe, bärisch bei Unterkante − 1 × Größe.
- **0 (durchbrochen):** Die Lücke schließt zuerst. Fallen Ziel und Bruch in dieselbe Kerze, zählt das vorsichtig als 0.
- **offen:** Innerhalb von 50 Kerzen fällt keine Entscheidung. Solche FVGs werden nicht zum Lernen benutzt.

Modell (`learner.py`, nur scikit-learn):

- `random_forest` (Standard) lernt bei jedem Aufruf schnell komplett neu.
- `sgd` (logistische Regression mit `StandardScaler`) lernt per `partial_fit` nur die neuen Fälle dazu.
- Mit weniger als 30 entschiedenen Fällen oder nur einer Klasse bleibt das Modell untrainiert und liefert neutral 50 %.

### 5. Inkrementelles Lernen und lokale Datenbank

- `FVGStore.save_fvgs()` speichert jedes erkannte FVG sofort in SQLite (`save_fvg()` für ein einzelnes FVG).
  - Der Schlüssel besteht aus Kürzel, Intervall, Entstehungszeit und Richtung. Ein erneuter Lauf legt nichts doppelt an.
  - Ein später entschiedenes FVG bekommt sein Label nachgetragen. Ein einmal gesetztes Label bleibt.
- `retrain_model(store, model_path, backend)` lädt die entschiedenen Fälle und aktualisiert das Modell.
  - Random Forest lernt komplett neu, SGD per `partial_fit` nur noch nicht gelernte Fälle. Das merkt sich die Datenbank.
  - Das Modell wird atomar gespeichert. Ergebnis sind Kennzahlen: Fälle, Verteilung, kreuzvalidierte Trefferquote neben der Basisquote „immer die häufigere Klasse“.
- In der Oberfläche: Der erste Start lernt automatisch. Danach lernt „KI neu lernen“ jederzeit mit allen gesammelten Fällen.
- `export_csv()` schreibt alles zusätzlich als CSV.

## Hinweise

- Die KI-Qualität ist eine statistische Schätzung aus deinen bisherigen Daten, keine Garantie und keine Anlageberatung.
- Vergleiche die Trefferquote immer mit der Basisquote. Erst ein deutlicher Abstand zeigt, dass die Merkmale etwas taugen.
- Der eingebaute Dash-Server ist für den eigenen Rechner gedacht. Für einen Server im Netz einen WSGI-Server (z. B. gunicorn) davorschalten; `create_app(ctrl).server` ist die zugehörige Flask-App.
