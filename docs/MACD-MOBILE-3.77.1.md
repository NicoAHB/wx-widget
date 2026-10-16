# MACD auf dem iPhone · 3.77.1

## Änderungen

- **Neu:** gemeinsamer Höhenplan für Preis / MACD / Volumen, ungefähr **60 / 25 / 15**
  der nutzbaren Zeichenfläche. Die Zwischenräume sind jeweils nur 8 CSS-Pixel hoch.
  Die feste MACD-Kappe von 146 px und das feste 32-px-Volumen entfallen bei
  eingeschaltetem MACD. In der normalen Ansicht hat der Chart dann mindestens
  480 px Höhe; im Vollbild nutzt er wie bisher den verfügbaren Bildschirm.
- **Neu:** feste MACD-Achse rechts außerhalb der Datenfläche. Die deutlichere
  Nulllinie und ihr eingerahmtes „0“-Label überdecken keine Kurven.
- **Neu:** vier Histogrammfarben: positiv steigend hellgrün, positiv fallend
  dunkelgrün, negativ fallend hellrot, negativ steigend dunkelrot. Bei Gleichstand
  bleibt der Balken dunkel. Der erste sichtbare Balken verwendet den tatsächlichen
  Vorgänger außerhalb des Ausschnitts.
- **Neu:** kleine grüne/rote Marker am interpolierten Schnittpunkt von MACD und
  Signallinie. Ausgefüllt bei geschlossener Kerze, hohl bei einer vorläufigen
  Kreuzung auf der laufenden Kerze.
- **Neu:** drei feste Wertfelder für MACD, Signal und Histogramm. Antippen wählt
  dieselbe Kerze wie das senkrechte Fadenkreuz. Im MACD-Bereich mit einem Finger
  ziehen tastet die Kerzen ab. Dabei ändern sich nur Text und Fadenkreuz;
  der Chart wird nicht neu aufgebaut. Ohne Auswahl stehen die jüngsten Werte dort.
- **Optional umgesetzt:** Doppeltippen im MACD wechselt vorübergehend zu
  **40 / 45 / 15**; nochmaliges Doppeltippen stellt zurück. Coin-/Zeitrahmenwechsel
  und Ausschalten setzen die Vergrößerung zurück. Zoom und Zeitposition bleiben
  erhalten. Ein frei verschiebbarer Trennstrich wurde nicht ergänzt.

Die automatische MACD-Skala berücksichtigt genau den sichtbaren Ausschnitt:
Maximum der absoluten MACD-, Signal- und Histogrammwerte plus 8 % Rand, symmetrisch
um null. Für sehr kleine Coins wird kein künstlicher Mindestbetrag angesetzt.
Nur eine komplett flache/leere Reihe verwendet eine neutrale Ersatzspanne, damit
die Darstellung nicht durch null teilt. Historische Extremwerte außerhalb des
Ausschnitts beeinflussen diese Skala nicht.

Kurschart und MACD behalten dieselbe Zeitachse. Wischen im Preisbereich blättert
weiterhin, zwei Finger zoomen auch im MACD. Live-Kurse, normale/HA-Kerzen,
Detail-Kerzen, Volumen, Zonen, Prognose-Linien/-Labels/-Punkte und Zeitachse bleiben
verbunden. Die MACD-Berechnung und die Regeln für bestätigte Strategie-Erklärungen,
Vorauswahl, Backtest und Alarme ändern sich nicht. Keine neuen Datenabrufe.

## Vollständiger Code

Die folgenden Links enthalten vollständige Dateien, keine gekürzten Ausschnitte.
Neue Darstellungsfunktionen sind im Quelltext mit **NEU / 3.77.1** kommentiert.

- [shared/macd-chart.mjs](../shared/macd-chart.mjs): `macdPaneLayout`,
  `macdHistogramTone`, `macdScale`, `macdCrossings`, `macdValue`,
  `drawMacdPane` und die aktualisierte Erklärung. Vorhandene Bestätigungslogik
  bleibt enthalten.
- [weather-widget-v2.html](../weather-widget-v2.html): vollständige App mit CSS,
  Importen und Chart-Anbindung. Geändert sind `renderChartContent`,
  `detailBodies`, `setMarket` und die vorhandene Chart-Gestenfunktion.
- [bundles/3.77.1](../bundles/3.77.1): vollständiger versionierter Modulgraph.
- [sw.js](../sw.js): passender Service Worker für 3.77.1.
- [server/release-manifest.json](../server/release-manifest.json): reproduzierbare
  Dienst-Lieferliste; Dienstquellstand bleibt 2.15.1.
- [tests/unit-macd-chart.js](../tests/unit-macd-chart.js),
  [tests/m124.js](../tests/m124.js) und [tests/m125.js](../tests/m125.js):
  vollständige Prüfungen.

## Einbau

Die veröffentlichte App enthält die Änderungen bereits. Neu laden bzw. das
angebotene App-Update übernehmen und **Version 3.77.1** kontrollieren. Danach
**Chart-Ebenen, Whales & Werkzeuge → MACD** einschalten.

Bei eigener Installation den vollständigen Repository-Stand dieser Version
übernehmen. HTML, `sw.js` und `bundles/3.77.1/` müssen zusammen ausgeliefert
werden; die bestehenden Icons, Manifest- und übrigen App-Dateien bleiben erhalten.
Die HTML-Datei importiert absichtlich das eigene Versionsbündel. Nur eine Datei
in `shared/` auszutauschen aktualisiert daher keine bereits gebaute App.

Bei weiteren Quellcode-Anpassungen im Repository:

```sh
node tools/build-release.mjs
node tools/build-release.mjs --check
```

Ältere veröffentlichte Bündel bleiben unverändert. Den gesamten Stand über HTTP(S)
bereitstellen. Persönliche Handelsdaten und Einstellungen bleiben im bestehenden
Browser-Speicher; für diese Darstellung ist kein Reset erforderlich. Der private
24/7-Dienst benötigt für diese reine Chart-Änderung keine Installation.

## iPhone-/iPad-Test

1. BTC im Tageschart öffnen, MACD einschalten und Hochformat-Vollbild wählen.
   Die drei Flächen müssen ungefähr 60/25/15 einnehmen; zwischen MACD und Volumen
   bleibt nur der schmale Trennraum. „0“ steht rechts neben den Kurven.
2. Eine Kerze antippen, dann im MACD nach links/rechts ziehen. Fadenkreuz und
   alle drei Werte müssen zur selben Kerze gehören. Im Preisbereich wischen
   muss weiterhin blättern.
3. Mit zwei Fingern zoomen. Die Skala muss sich an die dann sichtbaren Werte
   anpassen; sie bleibt unverändert, wenn derselbe größte Wert noch sichtbar ist.
4. In einem passenden Ausschnitt vier Histogrammfarben sowie grüne/rote Marker
   prüfen. Hohle Marker dürfen sich während der laufenden Kerze noch ändern.
5. Im MACD doppeltippen und zurückschalten. Zeitposition und Zoom dürfen dabei
   nicht zurückspringen. Beide Vollbildausrichtungen prüfen.
6. Eine Prognose-Linie antippen: Kurs-Label und Punkt müssen weiter funktionieren.
   ETC und Detail-Kerzen prüfen; bei Live-Updates folgt die ausgewählte laufende
   Kerze mit ihren MACD-Werten.

Automatische Prüfungen verwenden Chromium und WebKit mit simulierten Größen von
320 bis 1440 px. Physische iOS-Geräte stehen nicht zur Verfügung. Der fertige
Release-Stand wird außerdem isoliert und anschließend auf GitHub Pages geprüft.
