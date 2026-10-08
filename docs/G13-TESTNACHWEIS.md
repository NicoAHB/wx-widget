# G13 – Testnachweis App/SW 3.50.0 / Dienstquelle 2.8.0

Prüfabschluss UTC: 2026-10-08T05:48:29+00:00. Eingefrorener Produktcode: `0206f248643ce4b59ed2c91d2dc25e28a5d93b1b`. Danach ausschließlich Tests/Dokumentation; Produktdateien unverändert. Testkorrekturen in `a27ea18`.

**Alle 110 Zielbefehle vollständig seriell ausgeführt und nach den unten dokumentierten Nachprüfungen bestanden. 3471 zählbare Einzelprüfungen; Status-/Rauch-/Sichtprüfungen zusätzlich ohne Fehler.** Der Runner führt exakt die vorhandenen Befehle aus `tests/run-all.sh` mit ihren Zeitlimits aus und bewahrt die vollständige Ausgabe sowie Rückgabewerte. Keine Parallelisierung der Browser-/Installerprüfungen.

App-/Modul-Lint: 0 Fehler, 3 bekannte Warnungen. Dienst-/Generator-Lint: 0 Fehler, 2 Warnungen im unverändert erzeugten Musterkern. Reproduzierbare Lieferlisten/Hashes und gemeinsamer Versionsstand geprüft.

## Erstbefunde und Nachprüfung

- **m57 zunächst 40/41:** negative deutsche Intl-Anzeige verwendet ASCII-Minus; der alte Test erlaubte nur Unicode-Minus. Prüfung vergleicht jetzt exakt mit dem tatsächlichen Pearson-Wert in deutscher Präzision. Datenabrufe/Tooltips/Hinweise bleiben geprüft, Produktcode unverändert.
- **m56 zunächst 54/55:** gleichzeitig zulässige 261er-Tagesabfrage der Trend-Ampel war fälschlich als Historienseite gezählt. Historie wird über ihr vorhandenes startTime erkannt; Beginn 0, alle Seiten 1000/Spot und abgeschlossene ausgerichtete Blöcke bleiben verbindlich. Produktcode unverändert.

- Vollständiger Nachlauf **m57: 41/41**, Rückgabewert 0, keine Fehlermeldung.
- Vollständiger Nachlauf **m56: 55/55**, Rückgabewert 0, keine Fehlermeldung.

Maschinenlesbare Erstläufe und Nachläufe: [G13-TESTNACHWEIS.json](G13-TESTNACHWEIS.json). Erstabweichungen werden dort ausdrücklich erhalten.

## Alle Zielbefehle

| Ziel | Abschließender Zähler | Rückgabewert |
|---|---:|---:|
| unit-release | 6/6 | 0 |
| unit-model-archive | 13/13 | 0 |
| unit-bot-limits | 37/37 | 0 |
| unit-bot-simulation | 16/16 | 0 |
| unit-po3 | 35/35 | 0 |
| unit-po3-service | 20/20 | 0 |
| unit-po3-stream | 19/19 | 0 |
| unit-confluence-service | 26/26 | 0 |
| unit-confluence-replay | 33/33 | 0 |
| unit-bitget-history | 15/15 | 0 |
| unit-confluence-live | 46/46 | 0 |
| unit-bitget-patterns | 20/20 | 0 |
| unit-bitget | 55/55 | 0 |
| unit-confluence | 135/135 | 0 |
| unit-247e | 38/38 | 0 |
| unit-m8 | 24/24 | 0 |
| unit-zz | 28/28 | 0 |
| unit-zzp | 17/17 | 0 |
| unit-div | 10/10 | 0 |
| unit-ew | 27/27 | 0 |
| unit-fib | 6/6 | 0 |
| unit-ob | 9/9 | 0 |
| unit-cd | 16/16 | 0 |
| unit-hl | 13/13 | 0 |
| unit-ec | 22/22 | 0 |
| unit-cn | 40/40 | 0 |
| unit-wl | 64/64 | 0 |
| unit-fmt | 4/4 | 0 |
| unit-vola | 44/44 | 0 |
| unit-247 | 96/96 | 0 |
| unit-247b | 25/25 | 0 |
| unit-pub | 7/7 | 0 |
| unit-247d | 16/16 | 0 |
| unit-247c | 55/55 | 0 |
| unit-pulse | 44/44 | 0 |
| unit-lots | 31/31 | 0 |
| unit-acct | 39/39 | 0 |
| inst-247 | 35/35 | 0 |
| m69 | 19/19 | 0 |
| m68 | 23/23 | 0 |
| m67 | 22/22 | 0 |
| m66 | 11/11 | 0 |
| m65 | 12/12 | 0 |
| m64 | 19/19 | 0 |
| m63 | 36/36 | 0 |
| m62 | 8/8 | 0 |
| m61 | 8/8 | 0 |
| m60 | 14/14 | 0 |
| m59 | 18/18 | 0 |
| m58 | 60/60 | 0 |
| m57 | 41/41 | 0 |
| m56 | 55/55 | 0 |
| m55 | 49/49 | 0 |
| m54 | 52/52 | 0 |
| m53 | 102/102 | 0 |
| m52 | 101/101 | 0 |
| m51 | 73/73 | 0 |
| m50 | 116/116 | 0 |
| m49 | 18/18 | 0 |
| m48 | 79/79 | 0 |
| m47 | 49/49 | 0 |
| m46 | 40/40 | 0 |
| m45 | 75/75 | 0 |
| m44 | 27/27 | 0 |
| m43 | 7/7 | 0 |
| m42 | 18/18 | 0 |
| m41 | 20/20 | 0 |
| m40 | 40/40 | 0 |
| m39 | 50/50 | 0 |
| m38 | 19/19 | 0 |
| m37 | 22/22 | 0 |
| m36 | 20/20 | 0 |
| m35 | 40/40 | 0 |
| m34 | 9/9 | 0 |
| m33 | 16/16 | 0 |
| m32 | 5/5 | 0 |
| m31 | 21/21 | 0 |
| m30 | 32/32 | 0 |
| m29 | 12/12 | 0 |
| m28 | 39/39 | 0 |
| m27 | 22/22 | 0 |
| m26 | 18/18 | 0 |
| m25 | 20/20 | 0 |
| m24 | 28/28 | 0 |
| m23 | 25/25 | 0 |
| m22 | 26/26 | 0 |
| m21 | 14/14 | 0 |
| m20 | 12/12 | 0 |
| m19 | 24/24 | 0 |
| m18 | 31/31 | 0 |
| m17 | 16/16 | 0 |
| m16 | 23/23 | 0 |
| m15 | 23/23 | 0 |
| m14 | 18/18 | 0 |
| m13 | 13/13 | 0 |
| m12 | 17/17 | 0 |
| m11 | 36/36 | 0 |
| m10 | 37/37 | 0 |
| m9 | 9/9 | 0 |
| m8 | 41/41 | 0 |
| m7 | 46/46 | 0 |
| m6 | 58/58 | 0 |
| m5 | 24/24 | 0 |
| m4 | 41/41 | 0 |
| m3 | 68/68 | 0 |
| ui | 63/63 | 0 |
| functional | 35/35 | 0 |
| statuscheck | ohne Zähler | 0 |
| smoke | ohne Zähler | 0 |
| visual | ohne Zähler | 0 |

## Grenzen der Abnahme

Chromium/Mock-HTTP/Worker/native IndexedDB und Installer-Attrappe sind geprüft. Echte iPhone/iPad/iOS-Safari-, Pinch-/Rotation-/Safe-Area-/Leistungsabnahme, tatsächliche Bitget-Browser-CORS, private Oracle-VM und mehrere reale Geräte bleiben offen. Pages aktualisiert keine private VM.

G12 liefert die persistente Bot-Laufsimulation mit Oracle-Commands, ohne private Börsenorders und ohne automatische Strategie-Fills. Demo/Echtgeld bleiben gesperrt. PO3-Ergebnisse sind nach Gebühren vor Funding, unbekannte Kriterien sichtbar; fehlende historische Fundingankündigungen bleiben nicht bewertbar. G14 ist nicht begonnen.

Sicherung, Lieferung, Update und Rückfall: [G13-LIEFERUNG.md](G13-LIEFERUNG.md).
