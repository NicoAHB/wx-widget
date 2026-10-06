# HANDOVER – Scalp Desk

Laufende Übergabe. Sie wird nach jedem Arbeitsschritt aktualisiert, damit ein Abbruch jederzeit ungefährlich ist.

## Kurzstand
- **Version live:** 3.37.0 (G09 Teil A+B), Pull Request #60, Merge-Commit `255b4bd` auf `main` (davor 3.36.0/G08: PR #59, 3.35.0/G07: PR #58).
- **Arbeits-Branch:** `claude/scalp-desk-g03-j81c8k` (nach jedem Merge neu von `main` gestartet).
- **Gerade in Arbeit:** G09 – Teil A+B fertig (3.37.0). Offen: B6 und C1–C6 (siehe unten), danach G10.
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
- [x] B5a. Test `tests/m58.js` (trend 8, catalog 9 inkl. aller 41 Katalogfälle und 8 Intervalle, ui 11), Version 3.37.0
- [x] B5b. Gesamtlauf 79 Tests 2691/2691, Doku Teil AP, PR #60, Merge `255b4bd`
- [x] B6. Vorauswahl „Chartmuster erkannt“ (Übergabe G09 Punkt 11) – umgesetzt auf dem Branch (noch nicht veröffentlicht): `wlPat`, Knopf `.wl-d-pat`, `patFromWl`/`patWant`; Test m58 Abschnitt „wl“ (4/4)
  - Ziel: Kachel/Detailfeld der Vorauswahl zeigt „Chartmuster erkannt: <Name> (<Intervall>, <Status>)“; Tipp lädt den Coin per `setMarket(sym, iv)` (hier ausdrücklich mit Wechsel zum Chart), danach `pat.on = true`, Analyse und `pat.sel` auf genau diese Formation.
  - Dateien: `weather-widget-v2.html` (Vorauswahl: `wlLoad`/`wlPaint`/Detailfeld `wl-d-*`; Engine `patEngine().detect` auf `e.closed` der Kachel).
  - Fertig, wenn: Test zeigt Hinweis in der Kachel, Tipp öffnet Chart mit markierter Formation (Status + Intervall), kein Treffer → kein Hinweis.
- [x] C1. (umgesetzt: `pk*`-Funktionen, Schlüssel `scalpdesk.patknow.v1`, Quarantäne `scalpdesk.patknow.quarantine.v1`; m58 „know“) Getrennter Wissensspeicher (Punkte 13–15, 20): eigener Schlüssel/IndexedDB-Store `scalpdesk.patknow.v1` getrennt von Trades/Konten/Notizen; App-Reset (`reset-dialog`) und Profilwechsel löschen ihn nicht (kein `localStorage.clear()`); Altbestand `scalpdesk.zzpatterns.v1` + `data/muster-start.json` als „übernommene Statistik (Aggregat)“ erhalten, nicht mit neuen Fällen addieren. Fall = { id (stabil, z. B. Hash aus Markt|Symbol|Intervall|Muster|t0|t1|Modell), Markt, Symbol, Intervall, erkannt, bestätigt, Modell `pat-1`, Regeln/Werte damals, Prognose (Richtung), Ergebnis später angehängt }. Reimport/Geräteabgleich per ID ohne Doppelzählung. Fertig, wenn: Test „Reset ohne Wissensverlust“, „doppelter Import zählt einmal“, „negative Fälle bleiben“.
- [x] C2. (umgesetzt: `pkResolve`, `pkStats`) Kursrichtungsstatistik (Punkte 21–22): nach Bestätigung H = 12 Kerzen, ε = 0,10 %, R = 100·(PH/P0 − 1); auf/ab/seitwärts; offene Horizonte, fehlende Daten, Konflikte getrennt; nur gleicher Markt/Coin/Intervall/Modell; rekonstruierte und live protokollierte Fälle getrennt. Fertig, wenn: Unit-Test mit festen Kursreihen.
- [x] C3. (umgesetzt: `pkBand`, `pkSection` im Info-Sheet) „Vergangene Verläufe ansehen“ (Punkte 23–24) im Info-Sheet: „X von N aufwärts, Y abwärts, Z seitwärts“, Zeitraum, Abdeckung; Median + 25–75-%-Band normierter Kurse (kein Prognoseintervall); repräsentativer Einzelfall = geringste Abweichung vom Median, auch negative Beispiele; „Chart: X von N Fällen“; Aggregat ohne Pfade benennen; keine Archive beim Start laden.
- [ ] C4. Server-Archiv (Punkte 16–17): Originaljournal am 24/7-Dienst (`server/scalpdesk-247.mjs`, HTTPS-Weg aus G05 mit Revision) getrennt von Alarmkonfiguration, zusätzliche unabhängige Sicherung + getestete Wiederherstellung; Zustände „nur lokal / extern gespeichert / zusätzlich gesichert / veröffentlicht“. Nicht über den Sicherungsbot/Telegram.
- [ ] C5. Veröffentlichung (Punkte 18–19): bereinigter Bestand auf GitHub/Pages als Release/Serverexport (Manifest ≤ 64 KiB, Dateien ≤ 256 KiB, lokaler Cache ≤ 10 MiB, Warteschlange 2 MiB – voll → neues Lernen stoppt mit Hinweis, nichts löschen); keine Schreibschlüssel im Browser; ohne Schreibweg letzte Revision + Datum zeigen.
- [ ] C6. Muster-Telegram-Chat (Punkt 25): neues Ziel in „Telegram-Chats“ (G05-Mechanik: Schalter, Epoche, Sendefreigabe) für wichtige bestätigte Muster, auch bei geschlossener App über den 24/7-Dienst; Qualitätsgrenzen kenntlich (regelbasiert vs. erlernt).

## Optimierungen nach G08
(noch keine)

## Bekannte Stolpersteine
- **m43 beim Stundenwechsel:** Die Prüfung erwartet eine Puls-Meldung „für 23 Uhr“ in einer Zeitzone, in der es gerade 23 Uhr ist. Trifft der Lauf den Wechsel auf 0 Uhr, schlägt sie fehl. Das ist kein App-Fehler; einzeln wiederholen.
- **m47 Zeitmessung:** „10000 Trades … unter 400 ms“ ist lastabhängig; vereinzelt 410–430 ms, wiederholt bestanden.
- **m28 nach Mitternacht (Berlin):** „Ganze Woche“ erwartet „Heute“ in der Tagesliste; zwischen ca. 0 und 2 Uhr Berliner Zeit schlägt die Prüfung auch auf `main` fehl – Uhrzeit-Thema des Tests, kein App-Fehler.
- **m47 „App sendet den Kurs-Alarm selbst“:** zeitkritisch (20 s Wartezeit bei statischem Kurs); schlug vereinzelt fehl, einzeln/wiederholt bestanden.
- **Browser-Tests nie parallel** (fester Port 8765/8790).
- **Temporäre Testkopien** `weather-widget-v2.debug*.html` entstehen während m39/m45/m47; nicht committen.
- **Klassifikationsliste G08 (v1)** ist aus Wissen gebaut, nicht gegen echte CoinLore-Daten geprüft: Coins unter „ungeprüft“ in `DEC_OK`/`DEC_STABLE` aufnehmen und `DEC_CLASS_VER` erhöhen.
- **Codebeilage fehlt:** `code/entkopplung/scanner-refresh-policy.mjs` aus der ChatGPT-Übergabe liegt nicht vor; die Refresh-Regeln sind nach Schritt 4 der Übergabe selbst gebaut.
