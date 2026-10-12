# Scalp Desk 3.66.0 – online geprüft

**Live:** https://nicoahb.github.io/wx-widget/weather-widget-v2.html

[PR #109](https://github.com/NicoAHB/wx-widget/pull/109) wurde als `bc1ba36dd094f9d8c10acfe65e5c68c037e56098` zusammengeführt. Die App enthält Geräteansichten, Positionierungs-Score, eingeklappte Erklärungen, Tagesvorauswahl/2h und kostenfreie Krypto-Termine. App/SW 3.66.0, Dienst weiterhin 2.12.0.

Technische Abnahme: **5576/5576**, alle 171 Ziele und vollständige relevante Nachläufe, Lint **0 Fehler / 3 bekannte Warnungen**, Releasegraph 6/6. [Testnachweis](UEBERSICHT-KALENDER-TESTNACHWEIS.md).

## Öffentliche Dateien

App, Service Worker, Lieferliste und **alle 75 PWA-Dateien** wurden über kanonische HTTPS-URLs byte-/hashgleich mit dem final geprüften Stand kontrolliert. Prüfung nach beiden Veröffentlichungen; Worker/Offline-Module enthalten. [Pages-Lauf nach PR #110](https://github.com/NicoAHB/wx-widget/actions/runs/38260400893) erfolgreich. [Datei-Hashes und Kalendernachweis](UEBERSICHT-KALENDER-LIEFERUNG.json).

## Kalender-Abruf ebenfalls betriebsfähig

Der erste Job `38259210536` war nominell erfolgreich, übersprang jedoch die Veröffentlichung: CoinMarketCal gab GitHub HTTP 403, die öffentliche Datei war noch 404. Dieser Zustand wurde nicht als fertige Datenanbindung ausgegeben.

[PR #110](https://github.com/NicoAHB/wx-widget/pull/110) ergänzt ausschließlich im Workflow einen kostenfreien öffentlichen Reader für dieselbe HTML-Seite. Strikter Collector unverändert, 31/31 erneut bestanden, Bashblöcke geprüft; keine Nutzerdaten oder Schlüssel an den Reader. App, Module, Dienst und Versionen bleiben bytegleich.

Der [echte GitHub-Lauf 38260401684](https://github.com/NicoAHB/wx-widget/actions/runs/38260401684) führte **auch den Veröffentlichungsschritt erfolgreich** aus. Die öffentliche JSON-Datei wurde separat heruntergeladen und mit dem App-Parser validiert: **16 laufende/kommende Termine**, Datenstand `2026-10-12T14:05:52.140Z`, Datenzweig `krypto-kalender`, Commit `0e5eee31d8da8213dab91eec18923798377b8b1a`. Weiterhin Auszug, keine vollständige Kalender-API und keine automatischen Termin-Alarme ohne bestätigte Uhrzeit.

## Noch vom Nutzer zu prüfen

- Reales iPhone/iPad/Safari sowie persönliche Chat-/Oracle-Abnahme separat.
- Gespeicherte manuelle Stundenwahl bei Bedarf einmal auf **1 Tag** ändern. Frische Vorauswahl startet bereits auf 1 Tag/2h.
- Bestehenden Oracle-Musterzeitraum bei Bedarf bewusst erneut übernehmen; die private VM wurde hier nicht bedient. [Genauer Klickweg](UEBERSICHT-KALENDER-VORAUSWAHL.md).

Vollständiges PWA-Paket: `/workspace/ScalpDesk-3.66.0-PWA.zip`. Für die Nutzung den Live-Link öffnen; beim eigenen Bereitstellen alle relativen Dateien erhalten.
