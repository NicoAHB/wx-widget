# Antippbare Prognose-Linien · App 3.76.1

Die vorhandenen gestrichelten Linien rechts der letzten Kerze erhalten unsichtbare Fingerziele von 26 CSS-Pixeln. Ein kurzer Tipp oder Mausklick zeigt genau ein kleines Label am gewählten Punkt: Kurs und Uhrzeit, obere und untere Grenze zur selben Uhrzeit sowie deren Abstand in Dollar. Die Akzentfarbe stammt aus der angetippten Linie. Ein Tipp auf die andere Linie versetzt das Label; ein Tipp an anderer Stelle im Chart schließt es. Dabei werden keine Linien ein- oder ausgeschaltet.

Es handelt sich um die bestehenden Linienprojektionen der Chartmuster aus `projectPatternLines`, wie im Screenshot mit den beiden „≈“-Preisen. ZigZag-/Elliott-Berechnung, Erkennung, Ziele, Stops und Handelssignale bleiben unverändert. Auch Preisachse, Heikin-Ashi, Live-Daten und explizite Ebenenschalter bleiben erhalten. In einem zurückgeblätterten historischen Ausschnitt gilt weiterhin die bisherige Sichtbarkeitsregel für Zukunftsprojektionen.

Die Anzeige liest ausschließlich die bereits gezeichneten Linien. „Oben/Unten“ bezeichnen die äußeren Grenzen der zu diesem Zeitpunkt vorhandenen Projektionen, auch wenn sie aus verschiedenen Chartmustern stammen. Eine einzelne Linie erhält keine erfundene Gegengrenze; dafür erscheint „–“. Werte außerhalb des vorhandenen Linienhorizonts werden nicht extrapoliert. Ein offenes Label bleibt an seinen absoluten Zeitpunkt gebunden und wird beim Neuzeichnen aus der aktuellen Liniengeometrie aktualisiert. Bei Coin-/Hauptzeitrahmen-/Marktwechsel wird die Auswahl verworfen. Verschwindet die betreffende Formation oder liegt der Punkt außerhalb des sichtbaren Charts, wird kein veralteter Wert eingeblendet.

Kurse ab 1.000 Dollar werden entsprechend dem Nutzerbeispiel ohne Nachkommastellen gekürzt: `82.468,78 → 82.468`. Kleinere Kurse behalten niveauabhängig zwei bis acht Nachkommastellen, etwa `8,0800`. Alle Trennzeichen sind deutsch. Die Berechnung und der gespeicherte Tippzeitpunkt bleiben ungerundet. Die Uhrzeit verwendet wie die vorhandene Chartachse UTC; das Datum steht im Label.

`shared/projection-inspector.mjs` enthält Formatierung, Trefferprüfung, Zeit-/Indexabbildung (einschließlich Kalendermonaten), Werteanzeige und Platzierung. Das HTML registriert beim bestehenden Zeichnen die unsichtbaren Ziele und übergibt ausschließlich erkannte kurze Chart-Tipps. Pointer-Capture, Zwei-Finger-Zoom, Pan/Schwung, Strg+Mausrad und Alarm-Magnet bleiben bei ihren bisherigen Handlern. Das Label fängt selbst keine Eingaben ab. SVG-Matrizen berücksichtigen Zoom und die vorhandene iPhone-Vollbilddrehung. Die Platzierung bleibt im sichtbaren Chart und bewertet Überschneidungen mit vorhandenen Kurs-/Ziel-/Stop-/Einstiegsbeschriftungen. Eine lückenlos freie Stelle kann in einem dicht beschrifteten Chart nicht immer existieren.

App/SW 3.76.1, Dienstquellstand 2.15.1 unverändert; 93 PWA-Dateien / 105 Dienstdateien. Ältere Versionsbündel bleiben unverändert. Die vorher veröffentlichte positive RSI-Momentum-Erweiterung ist enthalten, ohne zusätzliche Änderungen an ihren Regeln.

Zusätzlicher Nutzerwunsch aus dem letzten Screenshot: Die Zahlenwerte des 24h-Tiefs sind rot, die des 24h-Hochs grün. Der sichtbare Zusatz „Spot“ entfällt in dieser Zeile; Datenquelle und vorhandene Futures-Kennzeichnung bleiben unverändert.

## Prüfung

259/259 gezielte Prüfungen in 13 Läufen: neue Mathematik-/Darstellungsfälle, native Touch- und Desktop-Bedienung in Chromium und WebKit, bestehende Projektionen/Detailkerzen, echter Chromium-Zwei-Finger-Zoom mit CDP, Pan/Schwung, Kursachse und Vollbilddrehung, Zonen, RSI-Integration sowie PWA-Update/Offline und Releasegraph. Der bestehende 24h-Test prüft zusätzlich die tatsächlichen Farben, unveränderte Spot-/Futures-Datenquellen, Coinwechsel, Cache und Fehlerzustände. Beim WebKit-Desktop-Wheel wird der Ctrl-Wheel-Event explizit zugestellt; Chromium prüft zusätzlich den tatsächlichen Maus-/Tastaturpfad. Lint: keine Fehler, drei bekannte Warnungen.

Die isolierte Freigabeprüfung verwendet ausschließlich das erzeugte Versionsbündel. Der Release-PR dokumentiert anschließend GitHub-Pages-Build, öffentliche Hash-/MIME-Prüfung und einen öffentlichen Browser-Smoke mit deterministischen OHLCV-Antworten. Es werden keine Telegram-Nachrichten versendet. Ein physisches iPhone oder iPad ist in dieser Umgebung nicht verfügbar.

## Checkliste auf iPhone und iPad

- Chart mit zwei gestrichelten Projektionen öffnen; oben und unten auch leicht neben dem Strich antippen.
- Ein Label mit Kurs, Uhrzeit, beiden Grenzen und Dollar-Abstand; beim Wechsel zur anderen Linie bleibt genau eines sichtbar.
- Daneben tippen: Label weg, beide Linien weiter sichtbar. Auch bestehende Muster-/Zonenbeschriftungen bleiben bedienbar.
- Offenes Label bei Live-Neuberechnung beobachten; Wert und Position aktualisieren sich.
- BTC ohne Nachkommastellen, ETC mit vier Nachkommastellen prüfen; Tausenderpunkte und Dezimalkomma bleiben korrekt.
- Zoom mit zwei Fingern, Wischen, Seiten-Scrollen und Vollbild mit/ohne Rotationssperre prüfen; Label läuft an keinem Rand aus dem Bildschirm.
- Am Desktop obere/untere Linie anklicken und Strg + Mausrad verwenden.
