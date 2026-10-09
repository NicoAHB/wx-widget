# Orderflow-Karten – Testnachweis 3.55.0

Alle **132 Zielbefehle** aus `tests/run-all.sh` vollständig seriell auf Produktstand `98f6f74b5d10483e75aaf8e7e9aeb057a3093cb7`. Nach dokumentierter vollständiger Befundnachprüfung **4184/4184** zählbare Prüfungen, Status/Rauch/Sicht grün. Lint **0 Fehler** (3 bestehende App-/2 Engine-Warnungen). Alle **107 gesicherten Produktdateien** unverändert. Rohlogs, Rückgabewerte und Hashes maschinenlesbar neben dieser Datei.

Neue m79-Prüfung: Einzelkarten, Klappzustände/Backup/Einheit, tatsächlicher Vorauswahlpreis trotz 100-facher Futures-Abweichung, Spot-/Futures-only Coins, reine Spot-Schutzquelle, beide Layouts/acht AA-Farben, Signalhöhe und Scrollposition. Vorhandene Kern-/Positions-/KI-/Offline-/Sender-/Cache-/Installationsprüfungen vollständig erhalten.

Der erste Gesamtlauf wurde wegen des zusätzlichen Nutzerwunschs zum Minutenwert-Abstand nach 55 grünen Zielen absichtlich gestoppt; Rohlogs und damaliger Produktstand bleiben erhalten. Die vollständige Release-Abnahme läuft auf dem danach eingefrorenen Stand.

Vorläufe erhalten: m79 anfangs vor geladenem Vorauswahleintrag gelesen, Sperrknopf vor dem Zeichnungstakt geprüft und Termintext falsch gesucht. m77 beim Neuladen mit noch nicht definiertem Testzugang abgebrochen (`window.__pdf2` jetzt sicher abgewartet). m76 erster Klicknachweis abgebrochen; zusätzlich tatsächliche Live-/Knopfbereitschaft vor Klick und Diagnosen. Im vollständigen Lauf wurde die manuelle Begleitung nach Reload einmal nicht beendet; vollständiger Nachlauf wartet zusätzlich auf den gezeichneten aktiven Abschlussknopf und erhält sichere Zustandsdiagnosen. Keine Frische-/Geometriegrenze gelockert. Diese Vorläufe sind keine Release-Abnahme; vollständige Nachprüfung und Gesamtlauf stehen separat im JSON.

Reale iPad-/Safari-Geräteabnahme bleibt offen; Chromium prüft Safari-Verankerungsverhalten. Private VM unverändert.

| Ziel | Erstlauf |
|---|---|
| unit-orderflow-demo | 30/30 |
| unit-orderflow-signal | 69/69 |
| unit-orderflow-feed | 19/19 |
| unit-orderflow-journal | 19/19 |
| unit-orderflow-explainer | 12/12 |
| unit-orderflow | 52/52 |
| unit-confluence-risk | 28/28 |
| unit-confluence-evidence | 18/18 |
| unit-signal-overview | 27/27 |
| unit-confluence-costs | 46/46 |
| unit-confluence-presentation | 23/23 |
| unit-appearance | 23/23 |
| unit-release | 6/6 |
| unit-model-archive | 13/13 |
| unit-bot-limits | 37/37 |
| unit-bot-simulation | 16/16 |
| unit-po3 | 35/35 |
| unit-po3-service | 20/20 |
| unit-po3-stream | 19/19 |
| unit-confluence-service | 26/26 |
| unit-confluence-replay | 33/33 |
| unit-bitget-history | 15/15 |
| unit-confluence-live | 46/46 |
| unit-bitget-patterns | 20/20 |
| unit-bitget | 55/55 |
| unit-confluence | 135/135 |
| unit-247e | 38/38 |
| unit-m8 | 24/24 |
| unit-zz | 28/28 |
| unit-zzp | 17/17 |
| unit-div | 10/10 |
| unit-ew | 27/27 |
| unit-fib | 6/6 |
| unit-ob | 9/9 |
| unit-cd | 16/16 |
| unit-hl | 13/13 |
| unit-ec | 22/22 |
| unit-cn | 40/40 |
| unit-wl | 64/64 |
| unit-fmt | 4/4 |
| unit-vola | 44/44 |
| unit-247 | 96/96 |
| unit-247b | 25/25 |
| unit-pub | 7/7 |
| unit-247d | 16/16 |
| unit-247c | 55/55 |
| unit-pulse | 44/44 |
| unit-lots | 31/31 |
| unit-acct | 39/39 |
| inst-247 | 35/35 |
| m79 | 48/48 |
| m78 | 16/16 |
| m77 | Exit 1 → Nachlauf |
| m76 | 19/19 |
| m75 | 15/15 |
| m74 | 73/73 |
| m73 | 20/20 |
| m72 | 28/28 |
| m71 | 23/23 |
| m70 | 61/61 |
| m69 | 19/19 |
| m68 | 23/23 |
| m67 | 22/22 |
| m66 | 14/14 |
| m65 | 12/12 |
| m64 | 19/19 |
| m63 | 36/36 |
| m62 | 8/8 |
| m61 | 8/8 |
| m60 | 14/14 |
| m59 | 19/19 |
| m58 | 60/60 |
| m57 | 41/41 |
| m56 | 55/55 |
| m55 | 49/49 |
| m54 | 52/52 |
| m53 | 102/102 |
| m52 | 101/101 |
| m51 | 73/73 |
| m50 | 116/116 |
| m49 | 18/18 |
| m48 | 79/79 |
| m47 | 49/49 |
| m46 | 40/40 |
| m45 | 75/75 |
| m44 | 27/27 |
| m43 | 7/7 |
| m42 | 18/18 |
| m41 | 20/20 |
| m40 | 40/40 |
| m39 | 50/50 |
| m38 | 19/19 |
| m37 | 22/22 |
| m36 | 20/20 |
| m35 | 40/40 |
| m34 | 9/9 |
| m33 | 16/16 |
| m32 | 5/5 |
| m31 | 21/21 |
| m30 | 32/32 |
| m29 | 12/12 |
| m28 | 39/39 |
| m27 | 22/22 |
| m26 | 18/18 |
| m25 | 20/20 |
| m24 | 28/28 |
| m23 | 25/25 |
| m22 | 26/26 |
| m21 | 14/14 |
| m20 | 12/12 |
| m19 | 24/24 |
| m18 | 31/31 |
| m17 | 16/16 |
| m16 | 23/23 |
| m15 | 23/23 |
| m14 | 18/18 |
| m13 | 13/13 |
| m12 | 17/17 |
| m11 | 36/36 |
| m10 | 37/37 |
| m9 | 9/9 |
| m8 | 41/41 |
| m7 | 46/46 |
| m6 | 58/58 |
| m5 | 24/24 |
| m4 | 41/41 |
| m3 | 68/68 |
| ui | 63/63 |
| functional | 35/35 |
| statuscheck | 6/6 |
| smoke | Exit 0 |
| visual | Exit 0 |
