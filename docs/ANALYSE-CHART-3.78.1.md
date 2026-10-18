# Top-Down im Chart · 3.78.1

Unter **Chart-Ebenen, Whales & Werkzeuge → Analyse** aktivieren Name und Haken jetzt dieselbe exklusive Analyseansicht. Die bisherige additive Bedeutung des Hakens entfällt. Erneut ausschalten oder „Vorherige Ansicht wiederherstellen“ bringt die zuvor gewählten Indikatoren zurück, auch nach einem Neustart. Gespeicherte allgemeine Zonen-/Muster-Schalter werden lediglich beim Zeichnen übergangen.

**Coin-Namen** in der aufgeklappten Vorauswahl-Liste sind jetzt Schaltflächen: Antippen öffnet den Chart dieses Coins mit der zugehörigen Analyse. Der gewählte Chart-Zeitrahmen und die gemerkte vorherige Indikator-Auswahl bleiben erhalten. Telegram-Schalter, globale Coin-Freigaben und deren gespeicherte Werte werden dadurch nicht geändert.

## Sichtbare Ebenen

- EMA 200 aus den bereits geschlossenen **4h-Kerzen** des Analysekontexts, statt einer zusätzlichen EMA des geöffneten Zeitrahmens; Berechnung und Cache nutzen bestehende Kerzen/EMA-Funktion.
- MACD im vorhandenen Unterbereich des gewählten Chart-Zeitrahmens, gemeinsame Zeitachse und Fadenkreuz unverändert.
- Höchstens zwei unterschiedliche **1h-Konfluenzzonen**, als Kauf-/Verkaufszone beschriftet. Die Erklärung nennt Preisgrenzen und tatsächlich beteiligte Bausteine, etwa FVG, Order Block, POC oder Sweep. Keine zusätzlichen allgemeinen Heatmaps, Volumenprofile, Prognosekorridore, Muster- oder fremden Signaldreiecke.
- Erst bei vorhandener Stufe-3-Bestätigung: tatsächlicher Einstieg, Stop, Ziel 1 und Ziel 2, mit Markierung an der abgeschlossenen Bestätigungskerze. Beobachtete Stop-/Zielberührungen erhalten eigene Markierungen; sie sind Hinweise, keine Ausführungen.
- Frühere Bestätigungen heißen ausdrücklich **Hist.**; beendete Beobachtungen enden am festgestellten Ausstieg. Eine Datenlücke erzeugt keinen erfundenen Stop-/Zielmarker. Ab 3.78.1 speichern Ereignisse dafür einen kompakten Darstellungssnapshot. Alte abgeschlossene Ereignisse ohne Snapshot werden nicht rückwirkend ergänzt.
- Bei neutralem Bias, fehlenden Daten oder ausstehender 15m-Bestätigung erscheint der tatsächliche Status über die Info-Schaltfläche. Eine Zone allein wird nicht als bestätigter Einstieg dargestellt.

Persönliche Positionen, Stops, Ziele und Kursalarme bleiben sichtbar. Heikin-Ashi betrifft weiterhin ausschließlich die Kerzendarstellung; die Analyse rechnet unverändert auf normalen OHLCV-Schlusskerzen. Analyse-Regeln, Telegram-Sendelogik und 24/7-Dienst bleiben unverändert.

## Erklärung und Touch

Status, Zonen und Marken öffnen ein lesbares Dialogfenster mit Begründung und konkreten Preisen. Touch-Ziele sind 44 px hoch. Wischen oder ein zweiter Finger verwirft den Tipp. Für Safari wird zusätzlich das echte Touch-Ende berücksichtigt, wenn ein Live-SVG-Austausch den Pointer-Tipp abbricht; Scrollen und Pinch werden nicht verhindert. Escape schließt nur die Erklärung und erhält den Vollbild-Chart.

## Geänderte Stellen

- `shared/analysis-view.mjs`, `shared/analysis-config.mjs`: einheitliche Aktivierung, gespeicherte Basis, Migration alter Haken, Coin-Navigation.
- `shared/analysis-chart.mjs` (neu): Darstellung vorhandener Ergebnisse, verständliche Beschriftungen, Historie und Touch-Erklärungen.
- `shared/analysis-notices.mjs`: kompakter Darstellungssnapshot bestehender Ereignisse; Beobachtungsregeln unverändert.
- `weather-widget-v2.html`: gezieltes Ausblenden allgemeiner Zeichnungen im Analysefokus, 4h-EMA und Integration der neuen Markierungen/Navigation.
- `tests/unit-analysis-chart.js`, `tests/m129.js`, `tests/run-all.sh`: fachliche und native Browser-Prüfungen; Release-Bündel/Service Worker aktualisiert.

## Gerätetest

1. Eigene Indikatoren wählen; Top-Down einmal über den Haken und einmal über den Namen aktivieren. Keine allgemeinen Heatmaps/Prognosen erwarten; ausschalten und die ursprüngliche Auswahl vergleichen.
2. Mit aktivierter Analyse neu starten, dann ausschalten: dieselbe ursprüngliche Auswahl muss zurückkommen.
3. In der Analyse-Coinliste ETC oder einen anderen Coin antippen: Chart und Analyse wechseln gemeinsam, Telegram bleibt unverändert. Auch bei zuvor ausgeschalteter Analyse prüfen.
4. Kauf-/Verkaufszone bzw. Info antippen: Begründung und Werte lesen. Ohne vollständige Bestätigung keinen Einstieg erwarten.
5. Bei bestätigt vorhandenem Signal Einstieg/Stop/Ziele und spätere Berührungen prüfen. „Hist.“ bedeutet frühere Bestätigung, keinen neuen Trade.
6. iPhone/iPad hochkant und Vollbild: wischen, zoomen, Fadenkreuz/HA testen. Ziehen auf einer Infofläche darf keinen Dialog öffnen.
