# MACD-Feinschliff 3.77.2

Drei Änderungen im bestehenden Chart, ohne Änderung der Indikatorberechnung, Handelsmodelle, Farben oder Flächenaufteilung.

- `shared/macd-chart.mjs`: sichtbares Minimum und Maximum aus MACD, Signal und Histogramm; null wird eingeschlossen, danach je 8 % der Spannweite als Rand ergänzt. Bei jedem Zeichnen, also auch nach Live-Update, Zoom und Verschieben, neu berechnet. Kleine Werte behalten ihre Größenordnung.
- Oben in derselben Datei: `MACD_CROSS_MIN_FRACTION = .02`, `MACD_CROSS_MIN_BARS = 2`, `MACD_CROSS_RADIUS = 2.3`. Zwei Schlusskerzen in derselben Richtung sind nötig, die Kreuzungskerze zählt als erste. Zusätzlich muss der Abstand mindestens 2 % des größten sichtbaren absoluten Histogramm-Wertes erreichen. Wird diese Schwelle später erreicht, erscheint der Punkt erst dann. Eine offene Kerze bestätigt keinen Punkt; eine Gegenrichtung, Berührung oder Datenlücke unterbricht die Bestätigung. Der Punkt bleibt am interpolierten ursprünglichen Schnittpunkt beider Linien. Historische, bereits bekannte Bestätigungskerzen dürfen rechts außerhalb des sichtbaren Ausschnitts liegen. Das ist ein Darstellungsfilter, keine Änderung der Handels- oder Info-Befundregeln.
- `shared/chart-time-axis.mjs` und der Zeitachsenblock in `weather-widget-v2.html`: ab 1h immer `15.10. 19:00`; auf kürzeren Zeitrahmen Uhrzeit und beim Tageswechsel zusätzlich Datum. Zeitbezug bleibt UTC. Tageswechsel haben Vorrang; konservative Breitenabstände und weniger Labels verhindern Überlappungen. Keine zusätzliche DOM-Messung in jedem Live-Frame.

App und Service Worker wurden gemeinsam auf 3.77.2 gebunden; der Dienst bleibt auf 2.15.1. Das Release-Werkzeug erzeugt die PWA-/Dienst-Lieferlisten und das neue unveränderliche Bündel. Bestehende Bündel bleiben unverändert. Keine zusätzliche Einstellung oder Installation nötig.

## Prüfen am iPhone, iPad oder Desktop

1. Nach dem App-Update in den Chart-Werkzeugen MACD aktivieren. In einen Abschnitt mit stark einseitigen Ausschlägen zoomen und verschieben: Skala folgt den sichtbaren Extremen, null bleibt sichtbar. Den Live-Kurs weiterlaufen lassen.
2. Bei kurzen Gegenkreuzungen erscheinen keine neuen Punkte. Eine deutliche Kreuzung muss mindestens zwei Schlusskerzen auf derselben Seite halten und die Abstandsschwelle erreichen. Erst danach erscheint der kleinere grüne/rote Punkt am ursprünglichen Schnitt.
3. Zwischen 5m/15m und 1h/4h wechseln. Bei 5m über Mitternacht verschieben: das Datum steht am Tageswechsel. Ab 1h enthält jedes Label Datum und Uhrzeit. Auf schmaler Fläche werden weniger Labels gezeigt.
4. Fadenkreuz ziehen, Prognoselinien antippen und beide Vollbildansichten öffnen. Kurs, Signale, Prognosewerte und die bestehende Flächenaufteilung müssen weiterhin funktionieren.

Automatisch geprüft werden Rechenfälle, kleine Coin-Werte, echte MACD-Reihen aus kontrollierten OHLCV-Daten, Chromium und WebKit, 320–1440 px, Live-/Detail-Kerzen, Touch und Gesten sowie der veröffentlichte PWA-Lieferstand. Physische iOS-Geräte stehen in der Testumgebung nicht zur Verfügung.
