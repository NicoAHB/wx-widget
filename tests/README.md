# Tests für Scalp Desk

Automatische Tests für die App (`weather-widget-v2.html`) und den 24/7-Dienst (`server/`). Sie laufen vollständig lokal gegen einen Test-Server: Binance, Telegram, Discord und GitHub werden nachgebildet (`mock-binance.js`). Es werden keine echten Kurse abgefragt und keine echten Nachrichten gesendet.

## Voraussetzungen
- Node.js 22 und Playwright mit Chromium (in den Cloud-Sitzungen von Claude Code vorinstalliert unter `/opt/node22` bzw. `/opt/pw-browsers`).
- `openssl`: Das Test-Zertifikat (`key.pem`, `cert.pem`) wird beim ersten Start erzeugt und nicht eingecheckt.
- Einmalig im Ordner `tests/`: `npm install`.

## Aufruf
| Befehl | Was er tut | Dauer |
|---|---|---|
| `bash run-all.sh` | alle Tests nacheinander (Einheitentests, Installer, m3–m51, ui, functional, Statusseite, Rauchtest, Sichtprüfung) | etwa 2,5 Stunden |
| `node m51.js` | ein einzelner Test, hier G02 (Lose, Nachkauf, Teilabschluss) | wenige Minuten |
| `node m51.js svc` | nur ein Abschnitt eines Tests | |
| `bash lint.sh` | ESLint über das App-Modul (Erwartung: 0 Fehler, 4 bekannte Warnungen) | Sekunden |

Ausgabe je Test: `✓`/`✗` je Prüfung und am Ende `n/m bestanden`.

## Regeln
- **Nicht parallel:** Browser-Tests nicht gleichzeitig starten. Sie teilen sich den Test-Server (Ports 8765 und 8790).
- **Neuer Test je Gruppe:** Jede Gruppe der Übergabe bekommt einen eigenen Test (G01: `m50.js`, G02: `m51.js` und `unit-lots.js`, G03: `m52.js` und `unit-acct.js`). Ihn in `run-all.sh` vorne in die Liste aufnehmen.
- **Ältere Tests anpassen:** Ändert eine Gruppe bewusst einen Text oder eine Regel, den alten Test anpassen und das in der Doku unter „Angepasste ältere Tests“ festhalten.

## Dateien
- **Gemeinsame Teile:** `harness.js` (statischer Server für das Projekt, Start des Test-Servers, Browser) und `mock-binance.js` (Test-Server).
- **Einheitentests:** `unit-*.js`, ohne Browser.
- **Programmteile in `js/`:** Einige Einheitentests prüfen Teile, die als Kopie hier liegen (`js/*.js`: 24/7-Übergabe, Countdown, Coin-News, Kalender, Hoch/Tief, Volatilität, Vorauswahl, BTC-Puls). Ändert eine Gruppe einen dieser Programmteile in der App, auch die Kopie anpassen.
  - **Direkt aus der App:** Die übrigen Einheitentests lesen ihren Teil direkt aus `weather-widget-v2.html` bzw. `server/`.
- **Installer:** `inst-247.sh` testet `server/install.sh` mit nachgebautem systemd.
- **Oberfläche:** `m*.js`, `ui.js`, `functional.js`, `smoke.js`, `visual.js`, `statuscheck.js` laufen im Browser.
- **Erzeugte Dateien:** Zwischenstände (`*.json`) und Bilder (`*.png`) entstehen beim Lauf und sind von git ausgenommen (`.gitignore`).
