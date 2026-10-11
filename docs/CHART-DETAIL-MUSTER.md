# Detail-Kerzen und kompakte Muster-Leiste – 3.64.0

## Bedienung

1. Im Chart einen Haupt-Zeitrahmen ab **1h** wählen. Neben der Intervall-Leiste erscheint **Kerzen-Auflösung**. **Aus · normale Kerzen** ist die Voreinstellung.
2. Eine feinere Auflösung auswählen. Der sichtbare Haupt-Zeitraum wird mit diesen Kerzen dargestellt. Bei mehr als **1500** Kerzen zeigt der Chart die letzten 1500 und einen kurzen Hinweis. Nach links wischen oder den Zurück-Knopf verwenden lädt ältere Kerzen nach. Mit dem Vorwärts-Knopf geht es zurück; **⟲** setzt den Ausschnitt zurück.
3. Die Formationschips stehen neben **Alarm für diesen Kurs**, auf schmalen Displays darunter. Bei BTC bleiben beide BTC-Pfeile erreichbar. Die Liste lässt sich horizontal wischen. Ein Chip zeigt Richtung, Status und Regelgüte; die Prozentzahl ist **keine Trefferwahrscheinlichkeit**.
4. Antippen zeichnet Grenzen, Schlüsselpunkte, eine dezente Zone, Bezeichnung und verfügbare Ausbruch-/Zielwerte. Erneutes Antippen entfernt diese Zeichnung. Bis zu sechs verschiedene Formationen gleichzeitig; ungültige oder abgelaufene Muster werden gedimmt und abgewählt. Der vorhandene KI-Button mit Erklärung, Filtern und Regelgüte bleibt verfügbar.

| Haupt-Zeitrahmen | Detail-Auflösungen |
|---|---|
| 1h | 1m, 5m, 15m, 30m |
| 2h | 1m, 5m, 15m, 30m, 1h |
| 4h | 5m, 15m, 30m, 1h, 2h |
| 1d | 15m, 30m, 1h, 2h, 4h |
| 1w | 1h, 4h, 1d |
| 1M | 4h, 1d, 1w |

Die Auflösung wird auf diesem Gerät gespeichert (`scalpdesk.chart-detail.v1`). Eine im nächsten Haupt-Zeitrahmen nicht erlaubte Wahl fällt auf **Aus** zurück. Die Kerzen-Auswahl per Fadenkreuz funktioniert weiter; automatisches Zoomen beim Antippen einer Haupt-Kerze ist nicht Bestandteil dieser Variante.

## Daten- und Anzeigevertrag

- Die Hauptkerzen in `state.candles` und sämtliche vorhandenen Signal-, Alarm-, Trend-, KI- und Support-/Widerstandsberechnungen bleiben ihre ursprünglichen Eingaben. Detail-Kerzen besitzen eigenes Datenfeld, Zoom, Pan und Zeitanker.
- Detaildaten kommen von derselben Binance-Marktquelle wie der Chart: Spot bleibt Spot, Futures bleibt Futures. Kein Ersatzmarkt bei einem Abruffehler. OHLC, UTC-Abstände und Volumen werden vor Verwendung geprüft; eine Lücke wird gemeldet, nicht mit erfundenen Kerzen gefüllt.
- Binance-Klines werden in Seiten mit höchstens 1000 Kerzen abgefragt. Vier Coin/Markt/Auflösungsreihen mit jeweils höchstens 6000 Kerzen bleiben im Arbeitsspeicher. Ältere Seiten schieben diesen Cache weiter; neuere Seiten werden beim Zurückscrollen nach rechts wieder geladen. Verspätete Antworten nach Coinwechsel werden abgebrochen/verworfen. Rate-Limits nutzen den bestehenden Binance-Transport; Fehler haben einen eigenen Hinweis und einen Wiederholen-Knopf, der Hauptchart bleibt bedienbar.
- Echtzeit-Klines aktualisieren die letzte passende Detail-Kerze; weitere Auflösungen werden im bestehenden Stream ergänzt. Pause hält zusätzliche Abrufe an. Nachladen und Neuzeichnen laufen nur bei Bedarf. Detail-Körper und Volumen werden in einem Canvas statt tausender zusätzlicher SVG-Elemente gezeichnet; Linien/Level bleiben im vorhandenen SVG.
- Hauptlinien werden über ihre Zeitstempel auf die feine Zeitachse abgebildet. Haupt-Indikatorwerte stehen frühestens **nach** Abschluss ihrer Hauptkerze in Detail-Kerzen zur Verfügung. Projektionen beeinflussen die Preisachse weiterhin nicht; außerhalb liegende Ziele erhalten einen Randhinweis.
- Die bestehende `pat-1`-Engine läuft weiter im vorhandenen Worker. Die Leiste wertet nur Formationen desselben Haupt-Zeitrahmens aus, mit denselben Toleranzen, Pivotregeln, Mindestregelgüten und Filtern. Ein passiver Leistenlauf schaltet keine zusätzlichen Telegram-Meldungen oder Lern-/Archivschreibvorgänge ein. Maximal zehn Hauptkerzen alte Formationen gelten gemäß bestehender G09-Altersregel als aktuell.
- Ein Gegenbruch wird erst anhand **abgeschlossener** Folgekerzen gewertet. Ein laufender Gegenbruch macht kein bestätigtes Muster vorzeitig ungültig. Die bestehenden Schalter für Linienprojektion und Projektionslänge gelten auch für gewählte Chips.

## Betroffene Stellen

- `shared/market-intervals.mjs`: erlaubte Detail-Auflösungen in der gemeinsamen Intervallkonfiguration.
- `shared/chart-detail.mjs`: Paging, Cache, Validierung, Echtzeit und Koordinaten-/Indikatorabbildung.
- `shared/chart-pattern-chips.mjs`: Status/Alter und eindeutige Formationsliste; keine Erkennungsänderung.
- `weather-widget-v2.html`: kompakte Auswahl, Kurszeile, eigener Detail-Anzeigestand, bestehende Chart-Navigation/Streams gezielt erweitert, Worker-Ergebnisse und Mehrfachzeichnungen.
- `sw.js`, `server/release-manifest.json`, `bundles/3.64.0/`: zusammen erzeugte, unveränderliche PWA-Veröffentlichung. Der Oracle-Dienst bleibt 2.12.0 und muss für diese Chart-Erweiterung nicht aktualisiert werden.

## Kurzer Gerätetest

Auf iPhone/iPad BTC mit 1h öffnen, 1m-Details wählen, links und rechts wischen, Zoom bedienen und Auflösung ausschalten. Danach zwischen LTC/BTC und 1h/4h wechseln: Kurs und gespeicherte Auflösung müssen zum neuen Kontext passen. Muster antippen/abtippen und seitlich durch die Chips wischen. Alarm, Trend-Chips, KI-Infos, Support-/Widerstandslinien und hochkant/quer vergrößerten Chart weiterhin bedienen. Automatische Browserprüfungen verwenden Chromium; die tatsächliche Safari-Geräteabnahme bleibt beim Nutzer.
