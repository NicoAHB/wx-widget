# Adaptive AI-Grid – Testnachweis 3.57.0

Alle **137 Zielbefehle** aus `tests/run-all.sh` vollständig seriell auf Produktstand `30b2cc041d4463e0799b96a336d90ceb9b0bd6a4`. Nach vollständig dokumentierten Nachprüfungen **4385/4385** zählbare Prüfungen, Status/Rauch/Sicht grün. Lint **0 Fehler**. Alle **111 gesicherten Produktdateien** unverändert. Rohlogs, Rückgabewerte und Test-/Produkthashes neben dieser Datei.

Neue Prüfungen: reiner Grid-Kern 54, öffentlicher Feed 15, Runtime/Archiv/echter lokaler Oracle-HTTP-Vertrag 37, native m81 41. Range/BB/ATR/RSI, 14-Tage-Abdeckung, Gebühren/Raster/Kapital/Stoprisiko, reduzierender Long-Bestand, Ausbrüche/Stop/Verriegelung, atomare Speicherung/IDs/Revisionen, ursprüngliche G12-Sperren, Worker/Abbruch/429/Netzfehler, unabhängiger Chartcoin, Reload/Archive, alte Dienstversionen und 320/390/768/1440px/beide Layouts/AA-Palette. Bestehende Bot-/Alarm-/Preis-/KI-/Sicherungsprüfungen erhalten. Keine privaten Börsenanfragen oder Fills.

Erstlauf-Befunde: inst-247, m77, m39, m7. Installer 31/35: vier alte feste CLI-Versionserwartungen 2.10.0/2.10.1 trotz neuer Quelle 2.11.0; Test liest nun die Lieferlisten-Version und erzeugt konsistent den nächsten Patchstand. Alle Hash-/Modul-/CLI-/Rückfall-/Nutzerdatenprüfungen erhalten.

m77 brach nach 14 erfolgreichen Prüfungen beim manuellen Abschluss ab: Meldung „Frischen Live-Kurs abwarten“, spätere Momentaufnahme frisch. Diagnose direkt am Klick ergänzt. Vollständiger diagnostischer Zwischenlauf 32/33: Abschluss mit frischer Quote/korrekter manueller Auswahl erfolgreich, ursprünglicher Abbruch nicht reproduziert; Spot-Verlustfarbe noch grün nach Preiszwischenspeicher-Wechsel. `knownPrice` bevorzugt den laufenden Chartkurs, dessen Kline getrennt eintrifft. Endgültiger Test wartet auf diese tatsächlich verwendete Kursbasis, nicht auf die erwartete Farbe; zusätzlich wird ein eingeplanter Abschlussklick mit veralteter Quote ohne Bestandsänderung abgewiesen. Ein weiterer vollständiger Zwischenlauf erfasste am abgewiesenen Klick eindeutig `quote: null` und keine WS-Kerze, bei korrekt ausgewählter manueller Position und noch aktivem vorherigem Zeichenstand. REST darf während der Initialisierung die laufende WS-Kerze ersetzen. Die Abschlussprobe wartet nun auf vier Historien, den Abschluss der tatsächlichen Futures-REST-Anfragen und danach eine neue frische WS-Kerze; weiterhin echter Playwright-Klick. Die ursprünglichen 33 Erwartungen bleiben, eine Negativprüfung kommt hinzu. Produktcode unverändert; alle ersten Logs erhalten.

m39 49/50: 90-ms-Aufklappmessung bereits bei Endhöhe; Klick-/Animationszeiten als Testdiagnose ergänzt, Erwartung unverändert, vollständiger Nachlauf 50/50. m7 45/46: zusätzliche Sicherung enthielt veränderte Positionsbegleitung bei gleichem Journal. Bisherige Futures-Isolation erst nach dem Laden ließ anfängliche Historien weiterleben; Spot-Zufallswalk konnte Beobachtungsextreme ändern. Test isoliert zusätzliche Beobachtungen vor dem ersten Laden (REST leer/WS gehalten, Spot-Walk aus, Spot-Streams weiter live) und prüft diese Voraussetzung ausdrücklich. Alle 46 ursprünglichen Erwartungen bleiben, eine Vorbedingung kommt hinzu. Erster vollständiger Nachlauf 46/47: Deduplizierung bestanden, einmal kein Verlassen-Upload. Die neue Änderung begann nach Mock-Eingang der vorigen Datei; vor dieser Probe wartet der Test nun auf den sichtbaren bestätigten aktuellen Sicherungsstand. 200-ms-Schließfrist und Ergebnisprüfungen erhalten. Abschließender vollständiger Nachlauf 47/47, einschließlich Verlassen-Upload und keiner weiteren Datei bei unverändertem Neuaufruf. Beide Zwischenlogs erhalten.

Der Gesamtlauf wurde ausschließlich zwischen abgeschlossenen Browserzielen für diese seriellen diagnostischen Nachläufe angehalten und anschließend fortgesetzt. Nachprüfungen und Vorläufe sind getrennt vom vollständigen Erstlauf erfasst; keine Fehlermeldung entfernt. Reale iPhone-/iPad-/Safari-Abnahme bleibt offen; private VM unverändert.

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
| inst-247 | 31/35 → Nachlauf |
| m81 | 41/41 |
| m80 | 51/51 |
| m79 | 49/49 |
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
| m47 | 50/50 |
| m46 | 40/40 |
| m45 | 75/75 |
| m44 | 27/27 |
| m43 | 7/7 |
| m42 | 18/18 |
| m41 | 20/20 |
| m40 | 40/40 |
| m39 | 49/50 → Nachlauf |
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
| m7 | 45/46 → Nachlauf |
| m6 | 58/58 |
| m5 | 24/24 |
| m4 | 41/41 |
| m3 | 68/68 |
| ui | 63/63 |
| functional | 35/35 |
| statuscheck | 6/6 |
| smoke | Exit 0 |
| visual | Exit 0 |
