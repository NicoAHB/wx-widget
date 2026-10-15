# Vorauswahl: Liste, Touch-Sortierung und lesbare Zahlen

Version **3.71.1**, auf Basis des bestehenden Stands 3.71.0. Veröffentlichung und Tests wurden vom Nutzer beauftragt.

App: https://nicoahb.github.io/wx-widget/weather-widget-v2.html · Änderungen: https://github.com/NicoAHB/wx-widget/pull/125

## Änderungen

- Zwei kleine Raster-/Listenknöpfe neben „Bearbeiten“. Die Ansicht wird mit dem vorhandenen Speicher (IndexedDB und localStorage-Spiegel) je Gerät gesichert.
- Beide Ansichten verwenden dieselben DOM-Elemente, Coin-Daten, Filter und dieselbe Reihenfolge. Umschalten startet keine zusätzlichen Kursabfragen.
- Listenzeilen zeigen Kürzel, Score, die Richtungen von Trend/Kurs/MACD, Mini-Verlauf, Preis, RSI, die Veränderung des gewählten Zeitraums sowie eine Glocke bei einem noch aktiven Kursalarm. Der im Chart geöffnete Coin bleibt grün umrandet. „+ Coin hinzufügen“ steht am Ende.
- Die Leiste wählt 1m / 5m / 1h / 1d über den vorhandenen Zeitraumwechsel. 5m ergänzt dessen bestehende Berechnung um fünf 1m-Kerzen; Score-Regeln und Datenquellen bleiben gleich. Gespeicherte 30m-/4h-Einstellungen bleiben gültig und werden weiterhin angezeigt.
- Nach 350 ms hebt eine Kachel oder Zeile an. Bewegt sich der Finger vorher mehr als 8 px, bleibt die Geste normales Scrollen. Nachbarn gleiten animiert an ihren neuen Platz; am Bildschirmrand greift Auto-Scroll. Reduzierte Bewegung wird berücksichtigt.
- Verschieben unter „Score ↓“ übernimmt die sichtbare Reihenfolge und speichert „Manuell“. Ein Tipp wählt wieder „Score ↓“. Abbruch, zweiter Finger und Breitenänderung beenden die Geste ohne neue Speicherung. Tastatur und Bearbeiten-Griffe bleiben erhalten.
- Vier gleich breite Prozentspalten mit 4 px Abstand und Tabellenziffern. Bei Platzmangel erscheint eine Nachkommastelle; die Schrift wird anhand der tatsächlichen gerenderten Textbreite angepasst, einschließlich Tabellenziffern und Ersatzzeichen. Der vollständige Wert bleibt für Vorlesen/Tooltip erhalten. Auch Preise werden vollständig eingepasst; die Kachelzeilen und -höhe bleiben erhalten.

## Dateien

- `weather-widget-v2.html`: vollständige App, Änderungen auf die Vorauswahl begrenzt.
- `tests/m112.js`: neue native Oberflächen-/Touch-/Breitentests.
- `tests/m111.js`: bisherige Vorauswahl-Prüfungen mit dem neuen Namen „Manuell“ und erlaubtem Anheben bei Score-Sortierung.
- `tests/unit-wl.js`, `tests/m45.js`: zusätzliche 5-Minuten-Auswahl im vorhandenen Zeitraum-Prüfplan.
- `tests/run-all.sh`: neuer Test im seriellen Gesamtlauf.
- `tests/unit-fvg.js`: bestehende Python-Vergleichsfixture mit eindeutigem Millisekunden-Zeitstempel; OHLC-Werte und Erwartungen unverändert.
- `sw.js`, `bundles/3.71.1/`, `server/release-manifest.json`: gemeinsam erzeugter, versionierter Lieferstand; ältere Bündel unverändert.
- `HANDOVER.md`: Stand dieser Änderung.
- [VORAUSWAHL-3.71.1-TESTNACHWEIS.md](VORAUSWAHL-3.71.1-TESTNACHWEIS.md): Gesamtlauf, Nachprüfungen und bekannte Abweichung.

## Gezielte Prüfung

Mit den vorhandenen Node-/Playwright-Abhängigkeiten, Browserprüfungen nacheinander:

```sh
node tests/unit-wl.js
node tests/m111.js
node tests/m112.js
node tests/m53.js sort
node tests/m45.js
```

Prüfung am 15.10.2026: Der serielle Gesamtlauf `bash tests/run-all.sh` hat alle **181 Prüfprogramme** ausgeführt. Nach der abschließenden Korrektur der Textmessung wurden die betroffenen Vorauswahl- und Offline-Prüfungen erneut ausgeführt. Einzelresultate und die bereits auf dem bisherigen Stand reproduzierte Fibonacci-Magnetabweichung stehen im [Testnachweis](VORAUSWAHL-3.71.1-TESTNACHWEIS.md).

Browser: Chromium mit simulierten Touch-Ereignissen, Breiten 320, 390, 430 und 768 px. Der Testserver verwendet lokale Marktdaten-Attrappen. Die zusätzliche Schriftprüfung verwendet Inter mit Tabellenziffern und viele Einsen; alle 30 Zahlenfelder passen vollständig. Eine echte iPhone-/Safari-Abnahme bleibt anhand der folgenden Liste durchzuführen.

App und Service Worker tragen 3.71.1. Die neue Lieferliste umfasst 82 PWA-Dateien. Der öffentliche Pages-Lieferstand wird nach dem Merge einschließlich Dateigrößen, SHA-256-Hashes und JavaScript-MIME-Typen geprüft; der abschließende Veröffentlichungsnachweis steht in PR #125.

## iPhone-Test-Checkliste

- [ ] Safari und gegebenenfalls die installierte PWA öffnen. Raster/Liste mehrfach antippen; aktive Ansicht, dieselben Coins und dieselbe Reihenfolge prüfen. App schließen und neu öffnen: Ansicht bleibt erhalten.
- [ ] In der Liste 1m, 5m, 1h und 1d wählen. Prozentfeld, Hervorhebung und Zeitraum im Coin-Detail prüfen; Auswahl nach Neustart kontrollieren.
- [ ] Coin kurz antippen: Detail und Chart öffnen wie bisher. Aktiven Kursalarm anlegen: Glocke erscheint; nach Entfernen/Auslösen verschwindet sie.
- [ ] Im Raster etwa 0,35 Sekunden halten, dann vorwärts und rückwärts über mehrere Plätze ziehen. Anheben, Schatten und nachrückende Nachbarn prüfen. Loslassen öffnet kein Detail. Reihenfolge nach Neustart prüfen.
- [ ] Dasselbe in der Liste wiederholen. Zurück ins Raster: identische Reihenfolge.
- [ ] „Score ↓“ wählen und einen Coin verschieben: Anzeige wechselt auf „Manuell“, sichtbare Reihenfolge bleibt wie abgelegt. „Score ↓“ erneut antippen: Score-Sortierung ist wieder aktiv.
- [ ] Finger sofort auf einer Kachel/Zeile bewegen: normales Scrollen, kein Anheben. Während des Ziehens bleibt die Seite ruhig; am oberen/unteren Rand scrollt sie mit. Kein horizontales Mitziehen der Seite.
- [ ] Zweiten Finger aufsetzen, das iPhone drehen oder die App während des Ziehens verlassen: kein zurückgebliebener Schatten/Platzhalter, keine versehentlich gespeicherte Reihenfolge.
- [ ] Beim langen Drücken erscheinen keine Textauswahl, Lupe oder Kontextmenüs.
- [ ] Hochkant, quer und möglichst auf einem kleinen iPhone prüfen: Preis `81.245,67`, längerer Preis `1.234.567,89` und Werte `+0,40`, `−2,98`, `−5,75`, `+12,34` bleiben vollständig und getrennt. Bei wenig Platz ist eine Nachkommastelle erlaubt; Vorzeichen/Farben und „–“ für fehlende Werte bleiben erhalten.
