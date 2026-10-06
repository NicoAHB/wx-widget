# HANDOVER – Scalp Desk

Laufende Übergabe. Sie wird nach jedem Arbeitsschritt aktualisiert, damit ein Abbruch jederzeit ungefährlich ist.

## Kurzstand
- **Version live:** 3.36.0 (G08), Pull Request #59, Merge-Commit `c1b1c44` auf `main` (davor 3.35.0/G07: PR #58).
- **Arbeits-Branch:** `claude/scalp-desk-g03-j81c8k` (nach jedem Merge neu von `main` gestartet).
- **Gerade in Arbeit:** G09 (Nutzer hat nach G08 ausdrücklich „mit G09 weiter“ freigegeben). Teil A+B → 3.37.0, Teil C danach.
- **Danach:** G10 bis Ende schreibt ChatGPT, sofern der Nutzer nichts anderes sagt.

## Projekt in einem Satz
Single-File-PWA für Krypto-Scalping (`weather-widget-v2.html`, auf GitHub Pages) mit Binance-Kursen, Chart, Indikatoren, Positionen/Journal, Alarmen und Telegram. Optional gibt es einen 24/7-Dienst (`server/scalpdesk-247.mjs`) auf einer Oracle-Cloud-VM.

## Wichtige Dateien
| Datei | Zweck |
|---|---|
| `weather-widget-v2.html` | die ganze App (HTML, CSS, ein `<script type="module">`); `APP_VERSION` oben im Skript |
| `sw.js` | Service Worker; `VERSION` muss zur App-Version passen |
| `index.html` | Weiterleitung auf die App |
| `server/scalpdesk-247.mjs`, `server/install.sh` | 24/7-Dienst (Version 2.0.0) und Installer |
| `tests/` | Test-Server (`mock-binance.js`), `harness.js`, Tests `m*.js`/`unit-*.js`, `run-all.sh`, `lint.sh`, `README.md` |
| `.github/workflows/` | Kalender- und News-Daten (eigene Workflows) |

## G08 – Fortschritt
Siehe Abschnitt „G08-Plan“ unten; erledigte Schritte werden abgehakt.

### G08-Plan
Code: Block „3.36.0 (G08)“ in `weather-widget-v2.html` (vor `window.__g08`), Bereich `#dec-sec` im Reiter Indikatoren (anfangs zu → ohne Öffnen keine Abrufe). Test-Zugang `window.__g08`.
- [x] 1. Reine Berechnung (Klassifikation C/B/D, Schwellen, Abdeckung, Pearson) + Einheitentest
- [x] 2. Datenquellen: CoinLore-Rangliste (Cache), Stablecoin-Liste (versioniert), Binance-Spotpaare (exchangeInfo), rollierende Statistik (`ticker`, Fenster 1h/4h/1d)
- [x] 3. Liste mit Filtern, Zuständen, Abdeckung, Quelle
- [x] 4. Klick lädt Coin in den vorhandenen Chart (kein Scrollen, „Im Chart geladen“)
- [x] 5. Scheduler (60 s, sichtbar, ein Timer, Abort, Backoff/429), Fehlerarten
- [x] 6a. Test `tests/m57.js` (40 Prüfungen: unit, list, faults, corr, click, sched, errors) + Attrappen im Test-Server (`/dec`), Version 3.36.0 – m57 40/40
- [x] 6b. Gesamtlauf 78 Tests 2662/2663 (m47-Zeitmessung, wiederholt 49/49), Doku Teil AO, PR #59, Merge `c1b1c44`

## G09 – Plan und Fortschritt
Quelle: Abschnitt „G09“ der ChatGPT-Übergabe. Codebeilage `code/muster/` liegt nicht vor → alles neu gebaut.
Code: `patEngine()` (reine Engine, läuft als Blob-Worker), `PAT_LIB` (41 Einträge mit SVG-Schema), `patRun/patDone/patTick`, `patSheet/patOpenInfo/patZoom/patDraw`; Dialoge `#pat-sheet`, `#pat-info`; Knopf `#pat-btn` in der Zoom-Gruppe. Test-Zugang `window.__g09`. Liste/Chart zeigen je Muster das jüngste Vorkommen.
- [x] A1. Zentrale Musterbibliothek (41 Einträge: ID, deutscher Name, Richtung, Familie, Erklärung, Bestätigungsregel, eigenes Inline-SVG)
- [x] A2. Kerzenmuster (22) mit Vortrend N=8 (Regression, R² ≥ 0,35, |b·7| ≥ 0,75·ATR14), Regelgüte = erfüllte/mögliche Gewichte (unbekannt im Nenner), Krypto-Variante ohne Gap (strenger Gap-Modus optional)
- [x] A3. Formationen (19) aus ATR-ZigZag-Pivots (nur bestätigte), Toleranz min(2 %, 0,6·ATR), Ausbruch erst per Schlusskurs, Ziel/Invalidierung
- [x] A4. Worker + Cache, Analyse der sichtbaren Kerzen (max. 500), laufende Kerze vorläufig, Coin-/Intervallwechsel verwirft Treffer
- [x] B1. Knopf „KI“ in der Chart-Leiste (auch Vollbild), ohne zusätzliche Leistenzeile
- [x] B2. Bottom-Sheet mit Treffern, Filter, Mindestregelgüte 60, Leerzustand, Hinweis
- [x] B3. Info-Sheet (SVG, gemessene Werte, Regeln erfüllt/nicht/unbekannt, „Warum X %?“, „Im Chart zeigen“)
- [x] B4. Chart-Labels (Kerzen) und Linien/Zonen (Formationen), Auswahl hebt hervor
- [ ] B5. Test m58, Version 3.37.0, Doku, PR, Merge
- [ ] B6. Vorauswahl „Chartmuster erkannt“ (Punkt 11) – ggf. eigener Schritt
- [ ] C. Dauerhaftes Musterwissen (Punkte 13–25): getrennter Wissensspeicher, Fälle mit ID/Prognose/Ergebnis, Kursrichtungsstatistik H=12/ε=0,10 %, „Vergangene Verläufe ansehen“, Server-Archiv + Sicherung, Veröffentlichung, Muster-Telegram-Chat

## Optimierungen nach G08
(noch keine)

## Bekannte Stolpersteine
- **m43 beim Stundenwechsel:** Die Prüfung erwartet eine Puls-Meldung „für 23 Uhr“ in einer Zeitzone, in der es gerade 23 Uhr ist. Trifft der Lauf den Wechsel auf 0 Uhr, schlägt sie fehl. Das ist kein App-Fehler; einzeln wiederholen.
- **m47 Zeitmessung:** „10000 Trades … unter 400 ms“ ist lastabhängig; vereinzelt 410–430 ms, wiederholt bestanden.
- **Browser-Tests nie parallel** (fester Port 8765/8790).
- **Temporäre Testkopien** `weather-widget-v2.debug*.html` entstehen während m39/m45/m47; nicht committen.
- **Klassifikationsliste G08 (v1)** ist aus Wissen gebaut, nicht gegen echte CoinLore-Daten geprüft: Coins unter „ungeprüft“ in `DEC_OK`/`DEC_STABLE` aufnehmen und `DEC_CLASS_VER` erhöhen.
- **Codebeilage fehlt:** `code/entkopplung/scanner-refresh-policy.mjs` aus der ChatGPT-Übergabe liegt nicht vor; die Refresh-Regeln sind nach Schritt 4 der Übergabe selbst gebaut.
