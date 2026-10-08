# PDF-Etappe 1 – vollständiger Testnachweis

App/SW **3.53.0**, Dienstquelle unverändert **2.9.0**. Abschließend geprüfter Produktstand `687e709e39fc8d63bd543184a9570ca007a4eac7`.

Alle **123 registrierten Zielbefehle** vollständig seriell auf diesem eingefrorenen Stand ausgeführt. Einziger Befund im abschließenden Gesamtlauf: m6 erfasste eine einzelne 57-ms-Aufgabe über der unveränderten 50-ms-Grenze (57/58). Vollständiger unveränderter m6-Nachlauf **58/58**; nach dieser Nachprüfung **3909/3909 zählbare Einzelprüfungen** grün, zusätzlich Rauch-/Sichtprüfungen ohne Fehler. Vollständige Rohlogs, Rückgabewerte und Erstbefunde sind in der JSON-Begleitdatei enthalten. Keine parallelen Browser-/Installerläufe.

Lint **0 Fehler**; drei bestehende App- und zwei erzeugte Engine-Warnungen. Reproduzierbarer Releasegraph **45 PWA-/39 Dienstdateien**. App- und Service-Worker-Version gemeinsam 3.53.0.

## Erstbefunde und Korrekturen

Der erste vollständige 123er-Lauf auf `28c66c6` hatte 16 Zielprogramme mit Befunden. Diese Ergebnisse wurden erhalten, nicht als grüner Lauf ausgegeben.

- **Chart-Anordnung:** Der erste Panelwrapper trennte die bestehenden Fibonacci-/Liquidations-/Whale-Leisten vom Chart. Auf schmalen Ansichten lag der Chart dadurch außerhalb des sichtbaren Bereichs; sein bestehender Zeichnungsaufschub ließ alte SVG-Elemente stehen. Jetzt stehen Chart, alle bisherigen Leisten und Ebenenschalter gemeinsam vor bzw. neben dem Panel. Halo bleibt am ursprünglichen Chartcontainer, Vollbild nutzt die ursprünglichen Elemente. Erkennung, Güte und Handelsberechnungen unverändert. Vollständige betroffene Nachläufe sowie alle funktionalen Chartprüfungen im abschließenden Lauf grün.
- **Stream-Tests m45/m8/functional:** Die zusätzliche Futures-Marktverbindung wurde bisher teilweise als veraltetes Abo oder als Wiederverbindung des Spot-Hauptcharts gezählt. Tests binden Wiederverbindungen ausdrücklich an den beobachteten Hauptmarkt, verlangen Kontrollabstände je Verbindung und erlauben nur die beiden exakten Futures-Panel-Abos des aktuellen Coins. Alte Timing-/Preis-/Statusanforderungen erhalten; Spot-Schutz zusätzlich im echten Worker und mit gespeicherter Position geprüft.
- **m6-Leistungsmessung im abschließenden Lauf:** Einmal 57 ms, übrige Funktionsprüfungen grün; durchschnittliche Skriptzeit 19 ms/s mit Heatmap, 13 ms/s ohne. Vollständiger unveränderter Nachlauf 58/58, einschließlich beider Messphasen, Minutenwechsel und Abgleich. Grenze bleibt 50 ms. Ursache der einmaligen Überschreitung nicht gesichert; keine Produkt- oder Teständerung, ursprünglicher Rohlog erhalten.
- **m4:** Ein erster Screenshot scheiterte am Bildausschnitt; vollständiger unveränderter Nachlauf und abschließender Gesamtlauf grün. Keine Bild-/Funktionsprüfung abgeschwächt.
- **m47:** Wiederholter Erstbefund der Selbstsendung bei Dienststörung; isoliert 9/9, Diagnose im vollständigen Programm sendete korrekt, las aber zeitweise „Übergebe …“. Statushelper wartet jetzt auf den tatsächlichen Übergabeabschluss. Zustandsdiagnosen enthalten nur Alarm-/Preiswerte. Keine Alarm-/Dienstlogik geändert. Der genaue Auslöser der früher fehlenden Selbstsendung ist nicht gesichert; Rohbefunde bleiben sichtbar. Vollständiger Nachlauf und abschließender Gesamtlauf 49/49.
- **Neue Panel-Vorprüfungen:** DOM-Bereitschaft, der tatsächliche WS-Empfang bei REST/WS-Rennen und der 250-ms-Zeichnungstakt werden abgewartet. Retry-After ist im Mock ausdrücklich per CORS exponiert; ohne Exposition gilt die konservative bestehende API-Drossel. Alle damaligen Befunde samt Rohlogs sind erhalten.

Die automatische Prüfung ersetzt keine reale iPad-/Safari-/CORS-Abnahme. Diese bleibt gemäß PDF vor Etappe 2 offen; die private Oracle-VM wurde nicht aktualisiert. Etappen 2–7 sind nicht enthalten.

## Vollständige Zielausführungen

| Ziel | Erster Gesamtlauf | Abschließender Gesamtlauf |
| --- | --- | --- |
| unit-orderflow | 43/43 | 43/43 |
| unit-confluence-risk | 28/28 | 28/28 |
| unit-confluence-evidence | 18/18 | 18/18 |
| unit-signal-overview | 27/27 | 27/27 |
| unit-confluence-costs | 46/46 | 46/46 |
| unit-confluence-presentation | 23/23 | 23/23 |
| unit-appearance | 23/23 | 23/23 |
| unit-release | 6/6 | 6/6 |
| unit-model-archive | 13/13 | 13/13 |
| unit-bot-limits | 37/37 | 37/37 |
| unit-bot-simulation | 16/16 | 16/16 |
| unit-po3 | 35/35 | 35/35 |
| unit-po3-service | 20/20 | 20/20 |
| unit-po3-stream | 19/19 | 19/19 |
| unit-confluence-service | 26/26 | 26/26 |
| unit-confluence-replay | 33/33 | 33/33 |
| unit-bitget-history | 15/15 | 15/15 |
| unit-confluence-live | 46/46 | 46/46 |
| unit-bitget-patterns | 20/20 | 20/20 |
| unit-bitget | 55/55 | 55/55 |
| unit-confluence | 135/135 | 135/135 |
| unit-247e | 38/38 | 38/38 |
| unit-m8 | 24/24 | 24/24 |
| unit-zz | 28/28 | 28/28 |
| unit-zzp | 17/17 | 17/17 |
| unit-div | 10/10 | 10/10 |
| unit-ew | 27/27 | 27/27 |
| unit-fib | 6/6 | 6/6 |
| unit-ob | 9/9 | 9/9 |
| unit-cd | 16/16 | 16/16 |
| unit-hl | 13/13 | 13/13 |
| unit-ec | 22/22 | 22/22 |
| unit-cn | 40/40 | 40/40 |
| unit-wl | 64/64 | 64/64 |
| unit-fmt | 4/4 | 4/4 |
| unit-vola | 44/44 | 44/44 |
| unit-247 | 96/96 | 96/96 |
| unit-247b | 25/25 | 25/25 |
| unit-pub | 7/7 | 7/7 |
| unit-247d | 16/16 | 16/16 |
| unit-247c | 55/55 | 55/55 |
| unit-pulse | 44/44 | 44/44 |
| unit-lots | 31/31 | 31/31 |
| unit-acct | 39/39 | 39/39 |
| inst-247 | 35/35 | 35/35 |
| m75 | 15/15 | 15/15 |
| m74 | 66/66 | 73/73 |
| m73 | 20/20 | 20/20 |
| m72 | 28/28 | 28/28 |
| m71 | 23/23 | 23/23 |
| m70 | 61/61 | 61/61 |
| m69 | 19/19 | 19/19 |
| m68 | 23/23 | 23/23 |
| m67 | 22/22 | 22/22 |
| m66 | 14/14 | 14/14 |
| m65 | 12/12 | 12/12 |
| m64 | 19/19 | 19/19 |
| m63 | 36/36 | 36/36 |
| m62 | 8/8 | 8/8 |
| m61 | 8/8 | 8/8 |
| m60 | 14/14 | 14/14 |
| m59 | 19/19 | 19/19 |
| m58 | 60/60 | 60/60 |
| m57 | 41/41 | 41/41 |
| m56 | 54/55 | 55/55 |
| m55 | 49/49 | 49/49 |
| m54 | 52/52 | 52/52 |
| m53 | 102/102 | 102/102 |
| m52 | 101/101 | 101/101 |
| m51 | 73/73 | 73/73 |
| m50 | 116/116 | 116/116 |
| m49 | 18/18 | 18/18 |
| m48 | 79/79 | 79/79 |
| m47 | 48/49 | 49/49 |
| m46 | 40/40 | 40/40 |
| m45 | 69/75 | 75/75 |
| m44 | 27/27 | 27/27 |
| m43 | 7/7 | 7/7 |
| m42 | 18/18 | 18/18 |
| m41 | 20/20 | 20/20 |
| m40 | 40/40 | 40/40 |
| m39 | 50/50 | 50/50 |
| m38 | 19/19 | 19/19 |
| m37 | 22/22 | 22/22 |
| m36 | 20/20 | 20/20 |
| m35 | 40/40 | 40/40 |
| m34 | 9/9 | 9/9 |
| m33 | 16/16 | 16/16 |
| m32 | 5/5 | 5/5 |
| m31 | 21/21 | 21/21 |
| m30 | 32/32 | 32/32 |
| m29 | 12/12 | 12/12 |
| m28 | 39/39 | 39/39 |
| m27 | 20/22 | 22/22 |
| m26 | 18/18 | 18/18 |
| m25 | 20/20 | 20/20 |
| m24 | 27/28 | 28/28 |
| m23 | 23/25 | 25/25 |
| m22 | 26/26 | 26/26 |
| m21 | 14/14 | 14/14 |
| m20 | 12/12 | 12/12 |
| m19 | 24/24 | 24/24 |
| m18 | 30/31 | 31/31 |
| m17 | 8/10 | 16/16 |
| m16 | 21/23 | 23/23 |
| m15 | 22/23 | 23/23 |
| m14 | 18/18 | 18/18 |
| m13 | 12/13 | 13/13 |
| m12 | 17/17 | 17/17 |
| m11 | 30/36 | 36/36 |
| m10 | 37/37 | 37/37 |
| m9 | 9/9 | 9/9 |
| m8 | 40/41 | 41/41 |
| m7 | 46/46 | 46/46 |
| m6 | 57/58 | 57/58 → Nachlauf 58/58 |
| m5 | 24/24 | 24/24 |
| m4 | 40/41 | 41/41 |
| m3 | 68/68 | 68/68 |
| ui | 63/63 | 63/63 |
| functional | 34/35 | 35/35 |
| statuscheck | 6/6 | 6/6 |
| smoke | ohne Zähler, Exit 0 | ohne Zähler, Exit 0 |
| visual | ohne Zähler, Exit 0 | ohne Zähler, Exit 0 |
