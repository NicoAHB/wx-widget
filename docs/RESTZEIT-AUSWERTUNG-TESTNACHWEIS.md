# Restzeit und Positionsauswertung – Testnachweis 3.58.0

Alle **138 Zielbefehle** aus `tests/run-all.sh` vollständig seriell auf Produktstand `44d1b3203eaa5723e78f3781c57b0c1bcbc31b84`. Abschließend **4431/4431** zählbare Prüfungen, Status/Rauch/Sicht grün. Lint **0 Fehler**, bekannte 3 App-/2 erzeugte Engine-Warnungen. Alle **111 gesicherten Produktdateien** unverändert. Vollständige Erstlogs, Rückgabewerte, Nachprüfungen sowie Produkt-/Testhashes neben dieser Datei.

Neue native Prüfung m82 **45/45**: Restzeiten an den aktuellen Minuten-/Stundenkarten, gleiche Kopfzeit, keine Restzeiten bei abgeschlossenen Karten, stabile Knoten und Höhen während des Tickens, UTC-Grenzwechsel auf 01:00/60:00. Sechs Auswertungen und Monatsübersicht mit langen Namen und großen positiven/negativen Originalzahlen, Werte/Labels/Zellen ohne seitlichen Überlauf bei 320/390/768/1440 px in beiden Layouts, acht AA-Farben ohne abgesenkte Zahlendeckkraft, ausdrücklich vorläufige kleine Stichproben, unveränderte Originalbücher und Reload.

Gezielte bestehende Regression: m79 49/49, m76 19/19, m48 79/79, m59 19/19, m52 und Release-Liefergraph vollständig (Einzelergebnisse im Rohbeleg). App/SW gemeinsam 3.58.0, Dienstquelle unverändert 2.11.0. Keine Änderung an Rechenfunktionen, Gebühren, Journalbüchern, Feeds oder Grid-Kern. Lokale Screenshots der mobilen Auswertungs-/Monats-/Timeransicht geprüft. Echte iPhone-/iPad-/Safari-Abnahme bleibt offen; private VM unverändert.

Erstlauf-Befunde: m47, m4. Nachprüfungen werden getrennt erhalten; keine ursprüngliche Erwartung wird gelockert.

| Ziel | Erstlauf |
|---|---|
| unit-adaptive-grid | 54/54 |
| unit-adaptive-grid-feed | 15/15 |
| unit-adaptive-grid-runtime | 37/37 |
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
| m82 | 45/45 |
| m81 | 41/41 |
| m80 | 51/51 |
| m79 | 49/49 |
| m78 | 16/16 |
| m77 | 34/34 |
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
| m47 | 48/50 → Nachlauf |
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
| m7 | 47/47 |
| m6 | 58/58 |
| m5 | 24/24 |
| m4 | 40/41 → Nachlauf |
| m3 | 68/68 |
| ui | 63/63 |
| functional | 35/35 |
| statuscheck | 6/6 |
| smoke | Exit 0 |
| visual | Exit 0 |

## Befundnachprüfung

m47 vollständig im Erstlauf 48/50: Schon vor bestätigter Dienststörung war der Alarm mit `svcAt` und Auslösekurs oberhalb Ziel markiert, spätere Kursanzeige darunter; ursprüngliche Vorbedingung und eigener Fallbackversand fehlten. Anfangsquelle im Erstlog nicht protokolliert. Ausschließlich Testdiagnose ergänzt: gespeicherte Alarme bei Dokumentstart, tatsächliche BTC-Worker-Nachrichten/Tickerantworten sowie Schließen/Senken/Wiederöffnung mit Zeiten. Vollständiger diagnostischer Nachlauf **50/50**: alle ersten Kurse unter Ziel, ursprünglicher Alarm zunächst nicht ausgelöst, eigener App-Versand und spätere Dienstnachlieferung erfolgreich. Der erste höhere Kurs wurde nicht reproduziert; dessen genaue Quelle bleibt ohne frühes Erstprotokoll ungeklärt. Keine Ursachenbehebung behauptet, keine Produkt-/Alarm-/Senderregel geändert, alle 50 ursprünglichen Erwartungen erhalten. Erst-/Nachlogs vollständig getrennt erhalten. Der serielle Gesamtlauf pausierte ausschließlich zwischen regulär abgeschlossenem m41 und m40 für diesen vollständigen Nachlauf und wurde danach fortgesetzt. Alle 111 Produktdateien hashgleich.

m4 im vollständigen Erstlauf **40/41**: Value-Area-Vergleich las im ersten Profil noch „—“, im frischen zweiten Profil schon den fertigen Wert. Der Test wartete auf Signalzeiträume, während die G07-Analyse unabhängig lädt. Nun wird für jedes Profil dessen eigene fehlerfreie fertige BTC-Spot-Analyse mit endlichen Profilgrenzen und ohne Platzhalter abgewartet; ausdrücklich keine Wartebedingung auf die Gleichheit beider Ergebnisse. Eine zusätzliche Fertigkeitsvorbedingung, alle 41 Originalfälle erhalten. Vollständiger Nachlauf **42/42**, beide 4h-Analysen mit 499 abgeschlossenen Kerzen, gleichen Zeitgrenzen und identischen Profil-/Value-Area-Werten. Rechner-/Analyse-/Profil-/Cache-Code unverändert; keine Prüfgrenze gelockert, Erstlog getrennt erhalten. Diese Nachprüfung lief nach allen 138 Zielen.
