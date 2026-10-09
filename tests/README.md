# Tests für Scalp Desk

Automatische Tests für die App (`weather-widget-v2.html`) und den 24/7-Dienst (`server/`). Sie laufen vollständig lokal gegen einen Test-Server: Binance, Telegram, Discord und GitHub werden nachgebildet (`mock-binance.js`). Es werden keine echten Kurse abgefragt und keine echten Nachrichten gesendet.

## Voraussetzungen
- Node.js 22 und Playwright mit Chromium (in den Cloud-Sitzungen von Claude Code vorinstalliert unter `/opt/node22` bzw. `/opt/pw-browsers`).
- `openssl`: Das Test-Zertifikat (`key.pem`, `cert.pem`) wird beim ersten Start erzeugt und nicht eingecheckt.
- Einmalig im Ordner `tests/`: `npm install`.

## Aufruf

### Orderflow-Karten (3.55.0)

- `m79.js`: je fünf gerundete Karten, gespeicherte Klappzustände/Einheit/Backup, tatsächlicher Vorauswahlpreis trotz abweichender Futures-Quelle, echte Demo-Klicks, kein gemischter Spot-ATR, Frische ohne Ersatzquelle, stabile Signalhöhe/Scrollposition, optisch enge O/T- und H/S-Abstände bei getrennten 44-px-Tippflächen und 320/390/768/1024 Pixel.
- `m76.js` verwendet für Übungen jetzt ausdrücklich die Vorauswahl-/Spot-Klickquelle; `m77.js` verlangt bei reinem Futures-Ausfall weiter aktuelle Spot-Demo und erhält alle übrigen Fachprüfungen.
- `unit-orderflow-demo.js` zusätzlich Marktquelle/Altbuch-Kompatibilität (30 Fälle).
- Alle Browserprüfungen weiter ausschließlich seriell.

### Orderflow-/BTC-Ergänzung (3.54.0)

- `unit-orderflow.js`, `unit-orderflow-demo.js`: reale OHLC-/Takerfelder, waagerechte Kerzengeometrie, neutrale Körpergrenze, UTC-Restzeit und gebührenfreier eigener Demo-Bestand mit Speichergrenzen.
- `unit-orderflow-signal.js`: BTC-Stufen/Grenzen, Beschleunigung/Gegenbewegung, Glättung, identischer Score in beiden Positionszuständen, Rohwert-Veto, Long/Short, Schutzvorrang, Tickraster und bestätigte Futures-Indikatoren.
- `unit-orderflow-feed.js`: tatsächlicher asynchroner Verbraucher, begrenzte Historien, keine doppelten BTC-Abos, Quellen-/Kontext-/Epochenschutz, Pause/Frische und Kontraktraster.
- `unit-orderflow-journal.js`: Originale, tatsächliche 5/15/30-Minuten-Folgekurse, unbekannte Lücken, getrennte Warten-/Positionsauswertung, beobachtete Trade-Extrema/erste Ausstiegsempfehlung, CSV und Offline/Timeout-Unterscheidung.
- `unit-orderflow-explainer.js`: beide Anbieter nur mit Attrappen, Modellfreigabe, echtes 8-s-Zeitlimit, globaler 30-s-Abstand sowie echter lokaler HTTP-Endpoint mit Schlüssel-/CORS-/Regelprüfung. Keine echten Schlüssel/Anbieteraufrufe.
- `m76.js`: Kerzenbild/Kurztext/Timer, echte Klickkurse mit Hebel, rote Verlusttaste, Neustart/Sicherung, Touch und Spot-/Originalschutz.
- `m77.js`: echte App/Worker-Signalansicht, Ring, BTC, antippbare OHLC-Einstiege, Positionsbegleitung/Score/Neustart, Journal/CSV und gemeinsamer Teil-Ausfall mit lokalem Neuversuch.
- `m78.js`: tatsächliche KI-Anbindung mit Antwort-/Zeitlimit-/Kontextschutz und Regel-Fallback, alle acht G14-Farbpaletten mit AA-Kontrast.
- Alle neuen Ziele gehören zum seriellen Gesamtlauf (131 Ziele). Kein Parallelstart von Browser-/Installer-Tests: Die bestehenden festen Testports werden geteilt. Reale iPad-/Oracle-/Anbieterabnahme wird separat ausgewiesen.
- Orderflow-Regressionsvorbedingungen: m76 wartet vor dem Frischeverlust auf einen tatsächlich aktiven Demo-Knopf; m50 bemisst die reale vollständige Sicherung und behält alle QR-/10-/11-Teil-Grenzen. m39 misst den zusätzlichen BTC-Kopf getrennt vom Chart, m46 platziert die Watchlist-Kachel mit ausreichend Detailplatz, m28/m30 erlauben nach Mitternacht das bestehende „gestern“-Label. m35 nutzt im ersten Profil bekannte halbe Wochenendspannen mit Wochenstreuung; die Fachberechnung und Grenzen bleiben unverändert. m58 ergänzt sichere Zählerdiagnosen. Safari m32/m34 prüfen weiterhin dieselben Scrollgrenzen; die neuen Panels verwenden den bestehenden Ankerrahmen. Erstbefunde und vollständige Nachläufe werden getrennt dokumentiert.

| Befehl | Was er tut | Dauer |
|---|---|---|
| `bash run-all.sh` | alle Tests nacheinander (Einheitentests, Installer, m3–m69, ui, functional, Statusseite, Rauchtest, Sichtprüfung) | etwa 2,5 Stunden |
| `node m51.js` | ein einzelner Test, hier G02 (Lose, Nachkauf, Teilabschluss) | wenige Minuten |
| `node m51.js svc` | nur ein Abschnitt eines Tests | |
| `bash lint.sh` | ESLint über App und G10-Fachmodule (0 Fehler, 3 bekannte App-Warnungen) | Sekunden |
| `node unit-confluence.js` | G10(a): 135 feste Fachprüfungen ohne Browser | Sekunden |
| `node m61.js` | G10(a): Node/Browser/Worker, Versionsgleichheit, echter Offline-Import | Sekunden |
| `node unit-bitget.js` | G10(b): 55 öffentliche Quellen-/Zeit-/Zustands-/Fehlerprüfungen | Sekunden |
| `node m62.js` | G10(b): Adapter-Parität, echtes Browser-fetch mit lokalen Antworten, Offline/Netzausfall | Sekunden |
| `node unit-bitget-patterns.js` | G10(c): unveränderte G09-Engine auf Bitget, Quellenbindung, Kenntnis-/Bestätigungszeit (20 Fälle) | Sekunden |
| `node unit-confluence-live.js` | G10(c): Long/Short einschließlich Konflikt, Referenzkurs, Anker, Kostenannahmen, Größe, Divergenz, Ablauf und ehrliche Grenzwertanzeige (46 Fälle) | Sekunden |
| `node unit-confluence-costs.js` | KI-Korrektur: gemeinsame Ausstiegskosten, Audit-Gegenbeleg, cf-1/cf-2-Originalschutz, Archiv/Jobfortsetzung und Dienstupgrade | Sekunden |
| `node unit-confluence-presentation.js` | Aktuelle Kurs-/Modellbestätigung getrennt vom Originalsignal, Alter/Fehler/Pause/Freigabe | Sekunden |
| `node m71.js` | Tatsächlicher App-Worker: Fehler/Kursalter/Modellwechsel, Originalschutz, native Altfälle und Mobile | Sekunden |
| `node m63.js` | G10(c): echter App-Worker, Reiter, Badge, Infobutton, Bitget-Chart, Modellgrenzen, Tabs, IndexedDB und Offline-Cache (36 Fälle) | Sekunden |
| `node unit-confluence-replay.js` | G10(d): Originalscore, 60/70/80, TP/SL/Timeout, tatsächliche Kosten, 29/30, definierte R-Folge (33 Fälle) | Sekunden |
| `node unit-bitget-history.js` | G10(d): öffentliche Preis-/Mark-/Fundingseiten, Abbruch/429 und fortgesetzte Jobs (15 Fälle) | Sekunden |
| `node m65.js` | G10(d): tatsächlicher App-Worker, Original-IDB, Wiederaufnahme, Quotenstatus, Reload und Mobile | Sekunden |
| `node unit-confluence-service.js` | G10(e): echter Dienst-/Bitget-Kern, Neustart, Originalhistorie, Telegram-Absender, Zustand und Zustellfehler (26 Fälle) | Sekunden |
| `node m66.js` | G10(e): echter HTTP-Dienst, Auswahl/Schalter bestätigt, Fehler, Kartenimport, Reload und 390px | Sekunden |
| `node m64.js` | Chartmuster-Anzeige: Alter 0/3/4/10/11, Altbereich, Filter, DOM-Erhalt, Live-Kurs und Zielfarbe | Sekunden |

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
- **G10(b):** `unit-bitget.js` importiert den tatsächlichen öffentlichen Adapter; feste UTC-/Funding-/Kontraktantworten, exklusive Seitengrenzen wie live geprüft, begrenzte Jobs, JSON-Fortsetzung, Quellen-/Revisionswechsel, Lücken/Konflikte, 429/Timeout/Abbruch. `m62.js` prüft tatsächliche Modulimporte in Node/Browser/Worker und Browser-fetch mit lokal abgefangenen Bitget-URLs; keine echte Browser-/CORS-Abnahme. Separate öffentliche Live-Prüfung und Grenzen in `docs/G10-BITGET.md`.
- **G10(c):** `unit-bitget-patterns.js` nutzt die unveränderte echte G09-Engine; `unit-confluence-live.js` prüft Long/Short, öffentliche Tickerzeiten und explizite Szenarien. `m63.js` startet den tatsächlichen App-Worker mit lokalen Bitget-Antworten und echten EMA-/MACD-Werten; Node/Browser/Worker-Parität, Reiter/Badge/Info/Chart, gleiche Karte bei Wiederholung und zweitem Tab, IndexedDB, 320/390px, Netzausfall und frischer Offline-Appstart. Keine echten Nachrichten/Orders/privaten Daten. 94 Zielbefehle im seriellen Gesamtlauf; Vertrag in `docs/G10-KARTEN.md`.
- **Oberfläche:** `m*.js`, `ui.js`, `functional.js`, `smoke.js`, `visual.js`, `statuscheck.js` laufen im Browser.
- **Erzeugte Dateien:** Zwischenstände (`*.json`) und Bilder (`*.png`) entstehen beim Lauf und sind von git ausgenommen (`.gitignore`).

### Angepasste ältere Tests (3.42.0)
- `unit-247d.js`: erwartete Dienstversion von 2.3.0 auf 2.4.0 erhöht; fachliche Schlussalarm-Prüfungen unverändert.
- `inst-247.sh`: Installation und Importierbarkeit der beiden neuen Muster-Module zusätzlich geprüft. Benutzer-ID wie die vorhandenen Systemaufrufe nachgebaut, damit der isolierte Test auch als Nicht-root läuft; echte Ablehnung ohne Rootrecht zusätzlich geprüft.
- `m53.js`: Nach dem Griffziehen wartet der Entfernen-Klick 550 ms auf das Ende der vorhandenen 450-ms-Klicksperre statt nur 400 ms. Die Watchlist-Funktion bleibt unverändert.

### Ergänzungen (3.43.0, G10a)
- Bestehende Fachtests unverändert; neue Tests im Gesamtlauf.
- `lint.sh` prüft zusätzlich die gemeinsamen Module. Die Server-Konfiguration kennt die tatsächlich verwendeten Node-Globals `Buffer`/`performance`. Vollständiger Server-Lint: 0 Fehler, zwei bestehende Warnungen in der erzeugten Muster-Engine. Neue G10-Module: 0 Fehler/0 Warnungen.

### Ergänzung (3.43.1, Positionsbutton)
- `m51.js lots`: zusätzlich tatsächliche Farben für Gewinn/Verlust im hellen und dunklen Farbschema, Farb-/Textwechsel bei Live-Kursen und neutraler Button bei genau null (19/19).

### Ergänzungen (3.44.0, G10b)
- `unit-bitget.js` und `m62.js` vorn im Gesamtlauf (jetzt 91 Zielbefehle). Bitget-Antworten vollständig lokal; bestehende Binance-Attrappe unverändert.
- Server-/Modul-Lint kennt zusätzlich die Standardglobals `URLSearchParams`, `AbortController` und `TextDecoder`. Kein Polyfill oder neue Produktionsabhängigkeit.

### Ergänzungen (3.45.1, Chartmuster-Panel)
- `m64.js` prüft die neue reine Anzeige. Engine/Regelgüte bleiben unverändert (unit-247e 38/38). `m58.js ui` erwartet den ausdrücklich gewünschten neuen Leertext; übrige Prüfungen unverändert. Altmuster bleiben im DOM im geschlossenen Bereich und für Filter/Info verfügbar.

- **G11 Kern:** `unit-po3.js` (34 Fälle) und `unit-po3-stream.js` (16 Fälle) importieren echte gemeinsame Module: Preisanker/Score, Limitreihenfolge, Restmenge/Gebühren über Abschnitte, Journal-Dublettensperre, vollständige OHLC-Regelkette Long/Short, Prefixgleichheit und CSV-Originale. Öffentliche Testantworten sind keine Börsenausführung. App-/Dienstanbindung folgt separat.

- **G11 Integration:** `unit-po3.js` abschließend 35/35, `unit-po3-stream.js` 19/19 (auch neue Struktur/Sweep-Reihenfolge, Original-ID/Planprüfung und FVG-Vergleich), `unit-po3-service.js` 20/20 (tatsächlicher gemeinsamer Adapter/Watcher, separate Stufen, Zustandsdatei und Sendefreigabe), `m67.js` 22/22 (echter KI-Worker/IDB, Restore, Mobile/Tablet/Desktop, Vollbild und bestätigtes HTTP-Command). Gezielte bestehende Prüfungen m63 36/36, m66 11/11, Installer 29/29, unit-confluence-service 26/26, Bitget 55/55 und Enginegleichheit 38/38. Gesamtlauf vor Veröffentlichung noch ausstehend; echte Safari/VM-Abnahme nicht bewiesen.

- **G12 Kern:** `unit-bot-limits.js` 37/37 (tatsächliche exakte Geld-/Mengenschwellen, eigene Laufbasis, vorzeichenbehaftetes Funding, 10 Sekunden, Fremdbestand/Teilfill/Modus und Schutzwirkung); `unit-bot-simulation.js` 16/16 (serialisierte Commands, IDs/Revisionen, Save-vor-Bestätigung, Restore und Protokollgrenze). Simulation keine Börsenausführung; Demo/Echtgeld gesperrt. App-/Oracleanbindung folgt separat.

- **G12 Integration:** `m68.js` 23/23: tatsächliche native IDB, Oracle-HTTP-Commands, verlorene Startantwort, Stopps/Reload, globales Bestandsveto und 320/390/768/1440 Pixel. Kein automatischer Strategieexecutor/privater Börsenadapter. Drei Reiter mit eigener Sichtbarkeit/ARIA/Tastatur. Im Gesamtlauf.

- **G13:** `unit-model-archive.js` 13 Fälle (Originale/Versionen/Quellen/Kosten, separate Bot-JSON, kein Auto-Start), `unit-release.js` 6 Fälle (reproduzierbare PWA-/Dienstliste, kompletter Importgraph, Version/Lizenz). `m69.js` prüft tatsächliche native Archive, Dateiabläufe, Teilfehler, den bisherigen 3.45-Service-Worker, Hashabbruch/Retry, Cachegrenze und frischen Offline-Start; keine Safari-/VM-Abnahme. `inst-247.sh` jetzt 35 Fälle mit fehlerhaftem Download und tatsächlichem Programm-Rückfall. `unit-247d.js` nur erwartete Dienstversion auf 2.8.0 erhöht, Schlussalarm-Regeln unverändert. `run-all.sh` erhält Fehlerstatus über Pipefail/ERR bis zum Ende; serieller Vollnachweis speichert zusätzlich jedes Ziel mit vollständigem Log und Exitcode.

- **G13 Befundkorrekturen:** m57 prüft den angezeigten Pearson-Wert exakt in deutscher Präzision auch bei negativen zeitabhängigen Testdaten, statt fälschlich ausschließlich Unicode-Minus vorauszusetzen. m56 trennt Historienseiten mit startTime von der unabhängigen Trend-Ampel; Start 0, Seitenlimit 1000, Spotquelle und vollständig geschlossene Blöcke bleiben verpflichtend. Produktfunktionen unverändert; Erstabweichungen und vollständige Nachprüfung im Liefernachweis dokumentiert.

- **Gemeinsame Abnahme 3.50.0 / Dienstquelle 2.8.0:** sämtliche 110 Zielbefehle vollständig seriell mit Rohlogs/Rückgabewerten ausgeführt; nach vollständigen Nachläufen m57 41/41 und m56 55/55 alle 3471 zählbaren Einzelprüfungen sowie Status/Rauch/Sicht grün. App-/Modul-/Dienst-/Generator-Lint 0 Fehler (3/2 bekannte Warnungen). Produktcode `0206f24` unverändert, Korrekturen nur in Tests/Doku. [Vollständiger Testnachweis](../docs/G13-TESTNACHWEIS.md) mit maschinenlesbaren Erstläufen/Nachläufen; echte Geräte/VM bleiben offen.

### G14 (3.51.0)
- `unit-appearance.js`: 23 direkte Farbprüfungen am HTML-Kopf (WCAG/sRGB, Kurzform, acht sichere Vorschläge, Text/Status/Rahmen/Buttons und ähnliche lesbare Variante).
- `m70.js`: 61 tatsächliche Browserprüfungen, beide Layouts mit allen drei Modi, gespeicherte unabhängige Präferenzen, Zweittab/Backup, DOM-/Fokus-/Entwurfs-/Datenerhalt, keine neuen Intervalle/Worker/Kurs-Abos, 48px/ARIA/Tastatur und 320/390/768/1440 sowie alle Handyreiter. Beide Tests vorn im seriellen Gesamtlauf (112 Zielbefehle).
- `lint.sh` prüft zusätzlich das Vorab-Skript im HTML-Kopf. Bestehende drei App-Warnungen unverändert, 0 Fehler.
- Angepasster älterer Test: `m69.js` liest die aktuelle Version direkt aus `APP_VERSION` und simuliert die folgende Patchversion statt fest 3.50.0/3.50.1. Alle 19 Original-/Hash-/Cache-/Offlineprüfungen bleiben erhalten; alter 3.45-Service-Worker und Archivherkunft 3.50.0 bleiben ausdrücklich Fixtures.
- Bedienung und Prüfschritte: [G14-Ansicht](../docs/G14-ANSICHT.md). 112 Gesamtlaufziele sowie Befundnachläufe/gezielte Abschlussprüfung abgeschlossen: 3555/3555. [Nachweis](../docs/G14-TESTNACHWEIS.md).

- **G14 Nachprüfung:** m70 zusätzlich sechs tatsächliche alte Schema-8-Dateiimportprüfungen (Hell/Dunkel auch bei zuvor eigener Farbe, ohne Vorauswahl und ohne stille Übernahme). Nur Anzeigepräferenzen ergänzt, ursprüngliche Datei unverändert. m3-Stopprüfung zählt/wartet jetzt nur auf die geprüften ETH-Stop-Meldungen und zusätzlich exakt je Kanal, statt unabhängige BTC-Puls-Meldungen als Stop-Wiederholung zu zählen; strengere Ereignisbindung, keine veränderte Produktregel. Vollständige Nachläufe m39 50/50 und m6 58/58 unverändert; m3 68/68 mit präziser Ereignisbindung. Die gezielte abschließende Sicherungs-/PWA-/Farb-/Releaseprüfung bestätigt die danach ergänzte Anzeigeimport-Kompatibilität.

- m70 wartet nach der importbedingten Neuladung zusätzlich auf den tatsächlichen App-Kern, bevor Daten geprüft werden: das Farbschema steht bereits vorher im HTML-Kopf. Alle 61 Prüfungen bleiben erhalten, keine Produktänderung.

KI-Übersicht 3.52.0: `unit-signal-overview.js` (27 Auswahl-/Originalprüfungen) und `m72.js` (25 tatsächliche Browserprüfungen: gemeinsame Modell-/Status-/Coin-/Richtungs-/Horizontfilter, eine Karte pro ID, Detail-/Fokuserhalt, 320/390/768/1440 in beiden Layouts). Bestehende m63/m65/m66/m67/m71 öffnen jetzt bewusst Kartendetails bzw. Archiv/Beobachten; ihre fachlichen Originalprüfungen bleiben erhalten.

KI-Risiko/Ausführung 3.52.0: `unit-confluence-risk.js` (28: exaktes Mengenraster, eigene Budgetgrenze, Mindestmenge/-wert, Long/Short, gleicher/geänderter Kurs, veraltet/fremd/Stop/Ziel/Funding/Originalschutz), `unit-confluence-evidence.js` (18: Kohorten-/Vorwärtsfilter, Dubletten/Konflikte/Reife/Kurs-/Kostenlücken und Nettoverteilung), `m73.js` (20: tatsächlicher öffentlicher Worker, Größenhilfe/persönliche Sicherung, aktuelle/stale/fehlgeschlagene Quote, Originale, IDB-Fälle im Worker, Füllstand, 320/390/768/1440/Reload). Alle neuen Ziele in `run-all.sh`.

KI-Gesamtlauf: m67 verwendet für Journal/Markierung/Export einen tatsächlich vom gemeinsamen Simulator abgeschlossenen Fall und die Archivansicht. Ein offener Testfall konnte durch die normale Nachbewertung während des Tests seinen Status wechseln (22/22). m59 verwendet für die Format-/Farbprüfung feste Pivots und prüft beide Abstände exakt sowie zusätzlich einen berechtigt fehlenden Widerstand (19/19). Kurslevel-/ATR-Produktcode unverändert. m69 ergänzt Zustandsdiagnosen für einen Aktivierungs-Timeout; vollständige Nachprüfung 19/19, zusätzliche diagnostisch verzögerte Lieferung 19/19. Der erste Timeout war nicht reproduzierbar, Ursache nicht gesichert; Hash-/Cache-/Offline-Prüfungen und SW-Produktcode unverändert. Gesamtlauf und Nachprüfungen ausschließlich seriell.

Visuelle KI-Abnahme: m72 zusätzlich tatsächlicher Trefferpunkt auf dem rechten Preis-/Risikofeld beim Scrollen in Standard/Dashboard und Rückkehr zur bisherigen mitlaufenden Preisalarm-Seitenspalte (28 Prüfungen). Reproduzierter Erstbefund 27/28: Kontostand verdeckte die breite Standard-KI-Karte. Eine CSS-Regel beendet das Mitlaufen nur bei aktiver KI-Übersicht. `statuscheck.js` prüft jetzt sechs echte Aussagen und gibt bei Abweichung Exit 1 zurück; anonym erwartete HTTP 401/405 sind an ihre exakten Test-URLs gebunden, bewusst blockierte Streams an die Blockierphase. Test-Favicon 204, keine pauschale Unterdrückung von JavaScript-/HTTP-Fehlern.

### PDF Etappe 1 (3.53.0)
- `unit-orderflow.js`: tatsächlicher gemeinsamer Volumenkern, Coins/USDT, fehlende/ungültige Werte, echte Null, UTC-Zeitplätze, Abschluss, verspätete REST-/Live-Antworten, 5-Sekunden-Grenze und kompakte Zahlen.
- `m74.js`: bestehender echter Worker/REST, absichtlich 100-facher Futures-Kurs gegenüber Spot, beide Zeitebenen, echter Minutenabschluss, feste DOM-Zeilen, fehlende Quote, Pause, Einheit/Backup/Neustart, beide Layouts und beide Einheiten bei 320/390/768/1024px, Hell/Dunkel/acht AA-Farben, Vollbild/Halo und Spot-only Coin.
- `m75.js`: echte gespeicherte Spot-Position, Futures-Historienbeobachter, Subscription-Deduplizierung, REST-Live-Rennen und A→B→A-Kontext, gezielte Lückenreparatur, echte WS-Unterbrechung/Wiederverbindung, Touch-iPad-Anordnung und öffentlicher HTTP-429-Abstand. Retry-After wird im Mock ausdrücklich per CORS exponiert; ohne diese Freigabe gilt der konservative bestehende API-Abstand.
- Die Attrappe ergänzt ausschließlich die bislang fehlenden Quote-/Takerfelder bei gleichen OHLC/Kursen. `/orderflow` verändert Futures-Testmeldungen gezielt; Standardwerte sind neutral. Keine doppelte Verbindung desselben Markts, kein zusätzlicher Worker/Intervalltimer und keine Handelsentscheidung. Bei Spot plus Futures werden zwei notwendige Marktverbindungen im selben Worker verwendet. Alle drei Ziele im seriellen Gesamtlauf (jetzt 123).
- Ältere Streamtests unterscheiden die Panel-Futures-Abos ausdrücklich und messen Wiederverbindungen des tatsächlich beobachteten Hauptmarkts (m8/functional); Kontrollabstände bleiben je Verbindung verbindlich. m47 wartet nach „Status prüfen“ auch auf das Ende einer gleichzeitig laufenden Übergabe und protokolliert ausschließlich Alarm-/Preiswerte, keine Kanalkonfiguration.

Orderflow 3.54.0 abschließend: 131 Ziele seriell, nach vollständigen getrennt erhaltenen Befundnachläufen **4133/4133**, Lint 0 Fehler. [Nachweis](../docs/ORDERFLOW-TESTNACHWEIS.md). m74 vergleicht den Fremdabruf synchron nach vollständiger Zeichnungsbereitschaft. m4/m5/visual bringen den tatsächlich geprüften Chart ins Bild; m4 trennt Spot-Chart-Cache von Futures und den eigenen 261-Kerzen-Trendzonen. m7 hält nur im Sicherungs-Testprofil zusätzliche Futures-Beobachtungen still, damit der unveränderte Vollstand auch mit neuen Journal-/Begleitbüchern unverändert ist; volle Bücher bleiben gesichert, Spot-/Sender-/Zählergrenzen gleich. Die QR-Diagnose erhält die tatsächlich erzeugte komplette Packung; die Sichtprüfung berücksichtigt den korrekten Übergrößenhinweis und verlangt ausdrücklich die stabile Kerzenauswahl. Produktdateien unverändert, Erstlogs und beide Nachlaufreihen erhalten.
