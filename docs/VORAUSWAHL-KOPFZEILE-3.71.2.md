# Vorauswahl-Kopfzeile 3.71.2

Nachtrag vom 15.10.2026 zum bereits veröffentlichten Release 3.71.1: Der Nutzer wünscht eine übersichtlichere Ausrichtung ohne versetzte Zeilenumbrüche, wie im nachgereichten iPhone-Screenshot.

- Titel und Info bilden eine feste Gruppe. Sortierung, Raster/Liste und Bearbeiten bleiben daneben auf einer gemeinsamen Mittellinie.
- Auf schmalen Panels erscheint Bearbeiten als Stift, Fertig als Häkchen; beschriftet für Vorlesen und Tooltip. Auf breiteren Panels bleibt der Text sichtbar.
- Alle / Stark ≥ +2 / Schwach ≤ −2 haben drei gleich breite Spalten und bleiben vollständig in einer Zeile. Die Zeitraumleiste liegt geordnet darunter.
- Der nur beim Bearbeiten abweichender Reihenfolgen sichtbare Standard-Knopf hat eine eigene Zeile und verschiebt die reguläre Kopfbedienung nicht.

Änderung an Darstellung und Gruppierung; Kursdaten, Signale, Filter, Sortierung, Speicherung und Touch-Engine bleiben gleich. Vollständige App: `weather-widget-v2.html`. Die vier zusätzlichen Geometrieprüfungen liegen im vorhandenen Test `tests/m112.js` und prüfen 320/390/430/768 px, vollständige Filtertexte und eine gemeinsame Mittellinie.

App und Service Worker tragen 3.71.2. Das neue Bündel `bundles/3.71.2/` wird erzeugt, vorherige Bündel bleiben unverändert. Der zugehörige PR enthält die abschließenden Testresultate und den öffentlichen Nachweis mit Pages-Build, 82 Datei-Hashes und Live-Touchtest.

Für diesen kleinen Darstellungsnachtrag werden die betroffenen Vorauswahl-, Sortier-, Mobil- und Offline-Prüfungen am endgültigen Release-Build seriell wiederholt. Der vollständige 181-Programme-Lauf gehört zum unmittelbaren Ausgangsrelease 3.71.1 und wird hier nicht als neuer Gesamtlauf ausgegeben; [dessen Testnachweis und bekannter Fibonacci-Altbefund](VORAUSWAHL-3.71.1-TESTNACHWEIS.md). So bleibt klar, welcher Stand wie geprüft wurde.

Auf dem echten iPhone prüfen: Kopfzeile und drei Filter hochkant ohne Versatz, Stift/Fertig bedienen, Raster/Liste umschalten, Coins in beiden Ansichten verschieben und Ansicht/Reihenfolge nach Neustart kontrollieren. Die vollständige [iPhone-Checkliste](VORAUSWAHL-LISTE-TOUCH.md#iphone-test-checkliste) gilt weiterhin.

Abschließende serielle Nachprüfung: **218/218 bestanden**. unit-wl 71/71, unit-release 6/6, m112 37/37, m111 23/23, m53-sort 26/26, m7 47/47, m69 8/8. Lint: 0 Fehler, drei bekannte Warnungen; reproduzierbarer Release-Abgleich erfolgreich. [Einzelnachweis](VORAUSWAHL-KOPFZEILE-3.71.2-TESTS.json).
