# G14 – Darstellung und Hintergrund

Technisch abgeschlossener Stand App/Service Worker **3.51.0**, Dienst unverändert **2.8.0**. Öffentlich weiterhin 3.50.0, bis zur Gruppenfreigabe. G13 ist technisch abgeschlossen und vom Nutzer als Voraussetzung für diesen getrennten Schritt akzeptiert. Echte Geräte-/CORS-/VM-Abnahmen aus G13 bleiben offen.

## Änderungen

- **Ansicht → Layout:** Standard (Voreinstellung) und Dashboard. Desktop-Dashboard zeigt Kontostand/Positionen links und den breiteren Chart samt Vorauswahl rechts; Seitenkarten scrollen mit der Seite. Am Handy stehen Alarme vor der Signalübersicht, Kontostand zuerst im Positionsreiter; am Tablet ergänzt ein Kartenraster die vorhandenen Tabs. Inhalte bleiben identisch.
- **Ansicht → Hintergrund:** Hell, Dunkel und Eigene Farbe in beiden Layouts. Klassische helle Farben und AMOLED bleiben erhalten.
- **Eigene Farbe:** acht Vorschläge, Farbwähler und Hexcode `#RRGGBB`. Erst „Übernehmen“ prüft und speichert eine frei gewählte Farbe. Die letzte eigene Farbe bleibt auch beim zwischenzeitlichen Wechsel zu Hell/Dunkel erhalten.
- Text passt sich an. Eigene Hintergründe müssen mit einer der bestehenden Hauptschriftfarben mindestens **4,5:1** erreichen. Neben-, Status-/Warntexte und Chartfarben werden zusätzlich gegen Hintergrund, Karten und farbige Statusflächen angepasst; Buttonbeschriftungen erhalten passenden Kontrast. Eigene Rahmen erreichen mindestens **3:1** auf den geprüften Flächen. Klassische Modi werden nicht umgestaltet.
- Bei zu geringem Kontrast bleiben Darstellung und Speicherung unverändert. Ein kurzer Hinweis nennt den Kontrast; die nächstliegende lesbare hellere/dunklere Variante auf derselben RGB-Farbstrecke wird **vorgeschlagen**. Übernahme erst mit eigenem Klick.
- Layout und Hintergrund haben getrennte Präferenzen (`scalpdesk.presentation.v1`, `scalpdesk.background.v1`). Gespeicherte Auswahl wird beim Öffnen vor dem ersten Zeichnen und nach der IndexedDB-Ladung angewandt, zwischen Tabs abgeglichen und im bestehenden Anzeige-Backup mitgeführt. Fehlende/ungültige Layoutwahl fällt auf Standard zurück; ungültige eigene Farbe auf das klassische Farbschema.

Alte Hell-/Dunkelsicherungen lassen sich auch nach eigener Farbe ausdrücklich übernehmen. Ohne diese Auswahl bleibt die eigene Farbe aktiv; sie bleibt für später gemerkt. Originaldatei und Handelsdaten werden hierfür nicht verändert.

## Technische Grenze

Die fehlende Beilage `code/frontend/DashboardView.js` samt fremder Chartbibliothek wurde für diesen aktuellen Auftrag nicht benötigt. Die Alternative wurde mit CSS im vorhandenen Dateistil neu ergänzt. Beide Ansichten verwenden dieselben Elemente, denselben SVG-Chart, denselben Store und bestehende Ereignisbehandler. Kein Kopieren/Neumounten, kein eigener Kursfeed, Worker, Timer, Alarm oder Berechnungspfad. Darstellung verändert keine Handels-/Modell-/Kontodaten. Bildschirmformat „Automatisch/Desktop/iPad“ bleibt eine eigene vorhandene Einstellung.

Das veröffentlichte Bündel 3.50.0 bleibt unverändert; 3.51.0 erhält ein eigenes hashgeprüftes Bündel. Die alte Originalarchiv-Testdatei mit Herkunft 3.50.0 bleibt erhalten. Der G13-Updatetest bindet seine aktuelle Version jetzt direkt an `APP_VERSION` und simuliert die nächste Patchversion; Hashabbruch, bewusster Reload, Offline und Rückfall werden weiterhin vollständig geprüft.

## Kurze Testanleitung

1. **Ansicht → Layout:** Standard/Dashboard mehrfach wechseln. Am Desktop Kontospalte/Chart vergleichen; am Handy Chart-, Rechner-, Positions- und Indikatorenreiter öffnen. Ein nicht gespeichertes Eingabefeld soll unverändert bleiben. App neu öffnen: gewählte Ansicht wieder da.
2. In **beiden** Layouts unter **Hintergrund** Hell, Dunkel, Eigene Farbe durchgehen. Alle acht Vorschläge antippen, Text, Karten, Rahmen, Gewinn/Verlust und Warnungen prüfen. Layout wechseln: Farbe bleibt. Hell/Dunkel und danach Eigene Farbe: letzte eigene Farbe wieder da.
3. Freie Farben **`#ffffff`** (sehr hell) und **`#000000`** (sehr dunkel) jeweils übernehmen. Beide sind mit dunkler bzw. heller Schrift gültig; Helligkeit allein ist kein Fehler.
4. Für den tatsächlichen Kontrastfehler **`#777777`** eingeben und „Übernehmen“ drücken. Farbe darf sich nicht ändern; Hinweis und lesbarer Vorschlag erscheinen. Erst Klick auf den Vorschlag übernimmt ihn. Ungültiger Hexcode `#gggggg` zeigt einen Format-Hinweis ohne Änderung.
5. Eigene Farbe wählen, App schließen/öffnen; Layout und Farbe wiederhergestellt. Zweiten Tab öffnen und eine Auswahl ändern: beide zeigen denselben Stand. Gesicherte Handelsdaten dürfen sich dabei nicht ändern.

## Automatisierte Prüfung

- `node tests/unit-appearance.js`: 23 feste Prüfungen direkt am tatsächlichen Farbcode (sRGB/WCAG, CSS-Kurzform, acht Farben, Status-/Rahmen-/Buttonkontraste, Vorschlag und Formatfehler).
- `node tests/m70.js`: 61 Browserprüfungen der tatsächlichen App (DOM/Daten/Fokus/Entwurf, keine zusätzlichen Intervalle/Worker/Kurs-Abos, Auswahl/ARIA/48px, alle Farben in beiden Ansichten, Ablehnung/Bestätigung, Speicherung/Backup/Zweittab, alte Dateiimporte mit/ohne ausdrückliche Anzeigeübernahme, 320/390/768/1440 und alle Handyreiter).
- Beide stehen im seriellen Gesamtlauf. `tests/lint.sh` prüft zusätzlich den Vorab-Code im HTML-Kopf. Lint abschließend 0 Fehler; drei bestehende App-Warnungen.
- `node tests/m69.js`: 19/19 mit aktuellem Release, einschließlich vollständigem Update/Hashabbruch/Retry, Archive und frischem Offline-Appstart.
- Alle 112 Gesamtlaufziele vollständig seriell ausgeführt. Mit vollständigen Befundnachläufen und gezielter Abschlussprüfung der Anzeigeimport-Ergänzung 3555/3555 zählbare Prüfungen; komplette Sicherungsregression m50 116/116. [Vollständiger Nachweis](G14-TESTNACHWEIS.md) mit Erstläufen/Nachläufen/Abschlussprüfung und geprüften Produktständen. Browserprüfungen mit lokalen öffentlichen Testantworten sind keine reale Safari-/CORS-/VM-Abnahme.
- Erstbefunde offen dokumentiert: m39 49/50 → unverändert 50/50, m6 57/58 → unverändert 58/58 (55-ms-Aufgabe bei 50-ms-Grenze); konkrete Ursachen nicht gesichert. m3 66/68 → vollständig 68/68 nach genauer Ereignisbindung statt Mitzählen unabhängiger BTC-Puls-Meldungen. m70-Abschlusswartebedingung nach Import um tatsächlich geladenen App-Kern ergänzt → vollständig 61/61. Keine Prüfgrenze gelockert.

## Lieferung und nächster Schritt

[PR #78](https://github.com/NicoAHB/wx-widget/pull/78) ist zur Prüfung vorbereitet. App/SW 3.51.0 wurde noch nicht nach main übernommen; online bleibt 3.50.0. Vor Veröffentlichung wie vom Nutzer verlangt auf die Gruppenfreigabe warten. Programm-ZIP wird getrennt aus den getrackten Lieferdateien erstellt. Reale Geräte-/CORS-/VM-Abnahme bleibt gesondert offen.
