# Tests für Scalp Desk

Automatische Tests für die App (`weather-widget-v2.html`) und den 24/7-Dienst (`server/`). Sie laufen vollständig lokal gegen einen Test-Server: Binance, Telegram, Discord und GitHub werden nachgebildet (`mock-binance.js`). Es werden keine echten Kurse abgefragt und keine echten Nachrichten gesendet.

## Voraussetzungen
- Node.js 22 und Playwright mit Chromium (in den Cloud-Sitzungen von Claude Code vorinstalliert unter `/opt/node22` bzw. `/opt/pw-browsers`).
- `openssl`: Das Test-Zertifikat (`key.pem`, `cert.pem`) wird beim ersten Start erzeugt und nicht eingecheckt.
- Einmalig im Ordner `tests/`: `npm install`.

## Aufruf
| Befehl | Was er tut | Dauer |
|---|---|---|
| `bash run-all.sh` | alle Tests nacheinander (Einheitentests, Installer, m3–m61, ui, functional, Statusseite, Rauchtest, Sichtprüfung) | etwa 2,5 Stunden |
| `node m51.js` | ein einzelner Test, hier G02 (Lose, Nachkauf, Teilabschluss) | wenige Minuten |
| `node m51.js svc` | nur ein Abschnitt eines Tests | |
| `bash lint.sh` | ESLint über App und G10-Fachmodule (0 Fehler, 3 bekannte App-Warnungen) | Sekunden |
| `node unit-confluence.js` | G10(a): 130 feste Fachprüfungen ohne Browser | Sekunden |
| `node m61.js` | G10(a): Node/Browser/Worker, Versionsgleichheit, echter Offline-Import | Sekunden |

Ausgabe je Test: `✓`/`✗` je Prüfung und am Ende `n/m bestanden`.

## Regeln
- **Nicht parallel:** Browser-Tests nicht gleichzeitig starten. Sie teilen sich den Test-Server (Ports 8765 und 8790).
- **Neuer Test je Gruppe:** Jede Gruppe der Übergabe bekommt einen eigenen Test (G01: `m50.js`, G02: `m51.js` und `unit-lots.js`, G03: `m52.js` und `unit-acct.js`, G04: `m53.js`, G05: `m54.js` und `unit-247c.js`, G06: `m55.js`, G07: `m56.js`, G08: `m57.js`, G09: `m58.js`, `unit-247d.js`, `unit-pub.js`; Optimierung 4: `m59.js`). Ihn in `run-all.sh` vorne in die Liste aufnehmen.
- **Ältere Tests anpassen:** Ändert eine Gruppe bewusst einen Text oder eine Regel, den alten Test anpassen und das in der Doku unter „Angepasste ältere Tests“ festhalten.

## Dateien
- **Gemeinsame Teile:** `harness.js` (statischer Server für das Projekt, Start des Test-Servers, Browser) und `mock-binance.js` (Test-Server).
- **Einheitentests:** `unit-*.js`, ohne Browser.
- **Programmteile in `js/`:** Einige Einheitentests prüfen Teile, die als Kopie hier liegen (`js/*.js`: 24/7-Übergabe, Countdown, Coin-News, Kalender, Hoch/Tief, Volatilität, Vorauswahl, BTC-Puls). Ändert eine Gruppe einen dieser Programmteile in der App, auch die Kopie anpassen.
  - **Direkt aus der App:** Die übrigen Einheitentests lesen ihren Teil direkt aus `weather-widget-v2.html` bzw. `server/`.
- **Installer:** `inst-247.sh` testet `server/install.sh` mit nachgebautem systemd.
- **G09 C6b:** `unit-247e.js` prüft Engine-Gleichheit, alle 19 Formationen, Dienstversand ohne App, Fall-ID, Revision, Epoche, Prozessabbruch und Neustart. `m60.js` prüft bewusste HTTPS-Übernahme, Konflikt/Retry, geheimnisfreie Metadaten und keinen Ersatzversand. Beide stehen vorn in `run-all.sh`.
- **G10(a):** `unit-confluence.js` importiert direkt die drei Module in `shared/` (keine Rechenkopie): MACD/Fortsetzung, Pivot-Kenntniszeit, Divergenz-Alter ab Bestätigung, 69,999/70, Sperren, Mustergewicht, Risiko/Kosten/Cross, 29/30 Fälle und Timeouts. `m61.js` vergleicht denselben Kern in Node, Browser und Browser-Worker und prüft frischen Offline-Import. `fixtures/confluence*.mjs` sind ausschließlich Testdaten. Beide Tests stehen vorn im Gesamtlauf.
- **Oberfläche:** `m*.js`, `ui.js`, `functional.js`, `smoke.js`, `visual.js`, `statuscheck.js` laufen im Browser.
- **Erzeugte Dateien:** Zwischenstände (`*.json`) und Bilder (`*.png`) entstehen beim Lauf und sind von git ausgenommen (`.gitignore`).

### Angepasste ältere Tests (3.42.0)
- `unit-247d.js`: erwartete Dienstversion von 2.3.0 auf 2.4.0 erhöht; fachliche Schlussalarm-Prüfungen unverändert.
- `inst-247.sh`: Installation und Importierbarkeit der beiden neuen Muster-Module zusätzlich geprüft. Benutzer-ID wie die vorhandenen Systemaufrufe nachgebaut, damit der isolierte Test auch als Nicht-root läuft; echte Ablehnung ohne Rootrecht zusätzlich geprüft.
- `m53.js`: Nach dem Griffziehen wartet der Entfernen-Klick 550 ms auf das Ende der vorhandenen 450-ms-Klicksperre statt nur 400 ms. Die Watchlist-Funktion bleibt unverändert.

### Ergänzungen (3.43.0, G10a)
- Bestehende Fachtests unverändert; neue Tests im Gesamtlauf.
- `lint.sh` prüft zusätzlich die gemeinsamen Module. Die Server-Konfiguration kennt die tatsächlich verwendeten Node-Globals `Buffer`/`performance`. Vollständiger Server-Lint: 0 Fehler, zwei bestehende Warnungen in der erzeugten Muster-Engine. Neue G10-Module: 0 Fehler/0 Warnungen.
