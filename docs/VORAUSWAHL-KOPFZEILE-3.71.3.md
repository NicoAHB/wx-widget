# Vorauswahl-Kopfzeile 3.71.3

Aktueller Darstellungsstand vom 15.10.2026. Titel/Info, Sortierung, Raster/Liste und Bearbeiten liegen auf einer gemeinsamen Mittellinie. Auf schmalen Panels dient der beschriftete Stift zum Bearbeiten, das Häkchen beendet den Modus. Alle / Stark / Schwach bleiben darunter in einer Zeile.

Die öffentliche Browserprüfung von 3.71.2 deckte bei 320 px eine breitere Ersatzschrift auf: „Schwach ≤ −2“ passte nicht vollständig in seine gleich breite Filterspalte. Auf schmalen Panels berücksichtigen die drei Spalten deshalb jetzt die Textlängen und verteilen den freien Platz; die längere Beschriftung erhält mehr Breite. Schriftgröße und Zeilenhöhe bleiben gleich.

Die neue Regression in `tests/m112.js` erzwingt bei 320 px eine breite Monospace-Schrift: vor der Korrektur **37/38**, danach **38/38** Prüfungen bestanden. Zusätzlich wird der tatsächliche App-Stand im isolierten Browser mit denselben Schriften wie die öffentliche Prüfung getestet. Die öffentliche Prüfung nach Veröffentlichung vergleicht alle 82 PWA-Dateien und kontrolliert Kopfzeile/Filter bei 320/390 px, Ansichtswechsel, unveränderte Reihenfolge, Wiederherstellung nach Neuladen, seitlichen Seitenüberlauf und JavaScript-Fehler.

App/Service Worker 3.71.3 mit neuem unveränderlichem Bündel. Die vorherigen Bündel bleiben unverändert. Nur die schmale Filterspalten-Aufteilung wurde gegenüber 3.71.2 geändert; Datenlogik, Touch-Engine und Speicherung bleiben gleich.

Prüfumfang: gezielte serielle Nachprüfungen am endgültigen Stand. Der [181-Programme-Gesamtlauf](VORAUSWAHL-3.71.1-TESTNACHWEIS.md) gehört zu 3.71.1, die [218 gezielten Kopfzeilen-/Mobilprüfungen](VORAUSWAHL-KOPFZEILE-3.71.2.md) zu 3.71.2. Diese kleinen Darstellungsnachträge werden nicht als erneut ausgeführter Gesamtlauf ausgegeben. Der bekannte Fibonacci-Magnet-Altbefund bleibt dort dokumentiert. Echte iPhone-/Safari-Abnahme bleibt anhand der [Checkliste](VORAUSWAHL-LISTE-TOUCH.md#iphone-test-checkliste) offen.

Abschließende Nachprüfungen und Online-Nachweis stehen im zugehörigen PR.

Abschließende serielle Nachprüfung: **146/146 bestanden** (unit-wl 71/71, unit-release 6/6, m112 38/38, m111 23/23, m69 8/8). Lint: 0 Fehler, drei bekannte Warnungen. Vorabprüfung des endgültigen Release-Stands im isolierten Browser: 320/390 px vollständig lesbar und ausgerichtet, Umschalten/Persistenz erfolgreich, keine JavaScript-Fehler. [Einzelnachweis](VORAUSWAHL-KOPFZEILE-3.71.3-TESTS.json).
