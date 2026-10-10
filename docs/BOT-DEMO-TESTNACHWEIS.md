# Bot-Demo – Testnachweis 3.61.0

Alle **145 Zielbefehle** aus `tests/run-all.sh` vollständig seriell auf Produktstand `7bcb54a546abadfef57106ad0c1952a75cf8ef4a`. Abschließend **4757/4757** zählbare Prüfungen; Status/Rauch/Sicht ohne Fehler. App-/Modul-/Dienst-/Generator-Lint **0 Fehler**, bekannte Warnungen separat erhalten. Alle **121 eingefrorenen Produktdateien** unverändert. Die JSON-Datei daneben enthält vollständige Erstlogs, Rückgabewerte, Test-/Produkthashes und getrennte Nachprüfungen.

Native m85 prüft den tatsächlichen öffentlichen Konfluenz-Worker, bestätigte eigene IDB, frischen grünen Laufstatus, dieselbe Livekarte bei Kursupdates, PnL, zweite Tab-Sperre, TP/Stop, BTC→ETH, Reload ohne Autostart, bewusstes Löschen und vier Bildschirmbreiten. Native m86 prüft den tatsächlichen Grid-Worker mit 14-Tage-/15m-Historie, Limits/Fills/Abschlüsse, Historiencache mit frischem Volumen, IDB-Konkurrenz/Widerruf sowie Orderflow LTC→BTC→ETH einschließlich verspäteter LTC-Antwort und eigener Löschung. Nichtleere persönliche Positionen/Trades, KI-Archive und ursprüngliche Demo-Bücher bleiben erhalten; neue Sicherungen enthalten keine Übungstrades.

M84 prüft die Vorauswahl: Chart zunächst offen, Analysen zunächst geschlossen mit demselben Coin, Positionen/Einstellungen ohne Vorauswahl. Tatsächliche Klapp-/Touchwege, zugänglicher Statuspunkt und Detaildialog, alle vier Beschriftungen innerhalb der Buttons auf 320 px, Navigation scrollt aus dem Bild, beide Layouts/Hintergründe und tatsächlicher Offline-Appstart.

Die manuelle Bot-/Oracle-Modellprüfung bleibt separat klappbar erhalten. Die alten Fachtests öffnen ihren tatsächlichen Bereich; keine Klickumleitung oder erzwungenen Klicks. M80 fand zunächst eine fehlende ARIA-Zuordnung an den neuen Kostenfeldern und eine alte Status-/Bereichsannahme; Feldzuordnung und ehrliche manuelle Zusammenfassung korrigiert. M76 maß zunächst die verborgenen neuen Bestätigungsknöpfe mit 0 px: jetzt wird der Löschdialog vor dem unveränderten 44-px-Kriterium tatsächlich geöffnet und anschließend abgebrochen. M50 zählt bewusst fünf persönliche Einträge statt sieben einschließlich Demos; ältere Demo-Dateien bleiben durch einen zusätzlichen tatsächlichen Import geprüft. Erstlogs bleiben erhalten; keine Fachregel oder Scoregrenze herabgesetzt.

M77 brach im Erstlauf nach dem tatsächlichen Liveabschluss ab: Die lokale Ausstiegspause wird bewusst nicht mehr übertragen, der alte Test las sie aber aus dem Export. Jetzt direkt im lokalen Begleitungsbuch gelesen und zusätzlich der Ausschluss aus der Sicherung geprüft; alle 34 ursprünglichen Fachkriterien erhalten. Vollständige Nachprüfung separat dokumentiert. M48 vor seinem Zielstart angepasst: neue persönliche Exporte ohne Demo, lokal erhaltene Übungsbücher; sämtliche bisherigen Demo-Wiederherstellungs-/Änderungs-/Lösch-/Moduswechsel-Fälle weiterhin über ausdrücklich alte Schema-7-Dateien geprüft. Alte/neue Testquellen und Hashstände erhalten; Produktdateien unverändert.

Gegenüber 3.60.0 sind 101 Produktdateien hashgleich, 10 gezielt geändert und 10 Papierdemo-Quell-/Bündeldateien ergänzt. App/SW gemeinsam 3.61.0, Dienstquelle unverändert 2.11.0; ursprüngliche Konfluenz-/PO3-/Grid-Berechnungen unverändert. [Bedienung und Modellgrenzen](BOT-DEMO.md). Reale iPhone-/iPad-/Safari-/Provider-CORS-Abnahme offen, private VM unverändert. Die lokale Demo läuft nur in sichtbarer App; Funding ist ein festgehaltenes Szenario, keine belegte Profitabilität oder echte Börsenausführung.

Befunde im vollständigen Lauf: m77, m39, m7.

| Ziel | Vollständiger Lauf |
|---|---|
| unit-paper-bot | 34/34 |
| unit-paper-controller | 11/11 |
| unit-paper-worker | 5/5 |
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
| m86 | 18/18 |
| m85 | 26/26 |
| m84 | 177/177 |
| m83 | 49/49 |
| m82 | 45/45 |
| m81 | 41/41 |
| m80 | 51/51 |
| m79 | 49/49 |
| m78 | 16/16 |
| m77 | Exit 1 → vollständige Nachprüfung |
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
| m50 | 118/118 |
| m49 | 18/18 |
| m48 | 81/81 |
| m47 | 50/50 |
| m46 | 40/40 |
| m45 | 75/75 |
| m44 | 27/27 |
| m43 | 7/7 |
| m42 | 18/18 |
| m41 | 20/20 |
| m40 | 40/40 |
| m39 | 47/50 → vollständige Nachprüfung |
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
| m25 | 21/21 |
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
| m7 | 46/47 → vollständige Nachprüfung |
| m6 | 58/58 |
| m5 | 24/24 |
| m4 | 42/42 |
| m3 | 68/68 |
| ui | 63/63 |
| functional | 35/35 |
| statuscheck | 6/6 |
| smoke | Exit 0 |
| visual | Exit 0 |

## Befunde und vollständige Nachprüfungen

M77 brach im Erstlauf nach dem tatsächlichen Liveabschluss ab, weil die lokale Ausstiegspause absichtlich nicht mehr im Sicherungsexport steht. Der Test liest diese Pause jetzt im gespeicherten lokalen Begleitungsbuch und prüft zusätzlich ihren Ausschluss aus der Übertragung. Vollständig **35/35** (34 bisherige Fachkriterien und eine zusätzliche Prüfung). Alte/neue Testquelle sowie die unveränderten Produktdateien sind im JSON dokumentiert.

M39 zuerst vollständig **47/50**: Der als 90-ms-Zwischenstand geplante Aufklappwert wurde tatsächlich erst nach **253,7 ms** bei deklarierter **240-ms-Animation** gelesen; das Zuklappen war bereits beendet. Zusätzlich 4 px abweichender Chart-/Toolbar-Abstand nach dem Coinwechsel. Vollständige diagnostische Nachprüfung **50/50**, unveränderte Gesten, Wartezeiten und Kriterien: Aufklappen tatsächlich nach 156,2 ms bei 319 statt final 331 px, laufende Animation; Zuklappen nach 104 ms bei 132 statt final 0 px, laufende Animation. Toolbar-Beginn unverändert; Charttop minus Toolbarhöhe vor/nach Coinwechsel jeweils 853 px. OHLC in beiden Nachmessungen 36 px hoch. Keine Produktänderung. Der erste Abstands-/Zuklappbefund ist im Nachlauf nicht wiederholt; ohne entsprechende Erstbeobachtung ist seine genaue Ursache nicht bewiesen. Erstlog und reine Diagnosequelle bleiben vollständig erhalten.

Die ursprüngliche Geschwindigkeitsprüfung m47 bereits im Gesamtlauf **50/50**: Notiz speichern einschließlich Neuzeichnen bei 5.000 Trades Median **188 ms**, bei 10.000 Trades **237 ms**, jeweils unter dem unveränderten 400-ms-Kriterium. Keine zusätzliche Wiederholung oder Produktänderung.

M7 zuerst vollständig **46/47**: Die letzte Sicherung nach Änderung und Schließen nach 200 ms kam nicht im Mock an. Vollständige diagnostische Nachprüfung **47/47**, alle Originalaktionen/Kriterien und die 200-ms-Schließfrist unverändert. Beobachtet: `pagehide` um 08:44:49.384 UTC, `editMessageMedia` mit `keepalive: true` und **5.923 Bytes** um 08:44:49.387, `visibilitychange` um 08:44:49.388, geschlossene Seite um 08:44:49.396. Mock erhält die neue Fassung mit sieben statt sechs Positionen; Wiederaufnahme nach 503 und Vermeidung doppelter Zustellungen ebenfalls bestanden. Nur zusätzliche Ereignis-/Dateigrößenbeobachtung, kein Produktfix. Genaue Ursache des ersten Ausbleibens ohne Ersttrace nicht bewiesen; keine Ursachenbehebung behauptet. Erstlog, vollständiger Nachlauf und ausgeführte Diagnosequelle im JSON erhalten.
