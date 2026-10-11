# Chart-Vollbild – Testnachweis 3.62.0

Alle **145 Release-Ziele** vollständig seriell auf Produktstand `a068a077159371c1c48c5a496c26202faa8e0621`. Abschließend **4813/4813** zählbare Prüfungen; Status/Rauch/Sicht grün. App-/Modul-/Dienst-/Generator-Lint **0 Fehler**; bekannte Warnungen getrennt erhalten. Alle **121 Produktdateien** während der Prüfung unverändert. Die JSON-Datei enthält Erstlogs, Rückgabewerte, Test-/Produkthashes und gegebenenfalls getrennte vollständige Nachprüfungen.

Die neue Bereichssicht überschreibt bisher den Vollbild-Flexcontainer mit `display:block!important`: ungedrehtes iPhone-Hochformat nur 412 statt 786 px Chartfläche; gedreht/quer abgeschnitten. Genau eine CSS-Ausnahme stellt die Flexanordnung wieder her. Handelsberechnungen, Nutzerdaten und normale Anordnung bleiben unverändert. 117 Produktdateien gegenüber 3.61.0 hashgleich; 4 ausschließlich HTML-/Versions-/Lieferdateien geändert.

M10 erhält sämtliche bisherigen Gesamtansichts-/Zeiger-/Kurswechselprüfungen und prüft zusätzlich die tatsächliche neue Bereichssicht in beiden Darstellungen bei 320/390/768/1440 px: exakte Bildschirmränder und verbleibende Charthöhe, gezeichnete SVG-Größe, ungedrehtes Hochformat, Werkzeuge, echte Drehwechsel, originale Chart-/Scrollrückkehr und gespeicherte Drehwahl nach Neuladen. M84 prüft weiterhin die tatsächliche Navigation, Vorauswahl und Offline-PWA.

Erste gezielte Testbefunde bleiben erhalten: Der neue Test wartete vor dem Sichtbarwerden auf ein SVG; die App zeichnet absichtlich erst sichtbare Charts. Nach tatsächlichem Scrollen wartet er auf die Zeichenfläche. Ein Desktopfall maß bei 600 ms die nach einer weiteren Livebox-Höhenänderung noch alte SVG-Höhe: Diagnose zeigte Änderung bei 577,8 ms und korrekten Neuzeichner bei 691,5 ms. Nun wird der tatsächliche ResizeObserver-Neuzeichner bis höchstens 3 s abgewartet; alle exakten Größen-/Rückkehrkriterien bleiben gleich. Keine zusätzliche Produktänderung für diese Testvorbedingungen.

App/SW gemeinsam 3.62.0; Dienstquelle weiterhin 2.11.0, private VM unverändert. Reale iPhone-/iPad-/Safari-Abnahme beim Nutzer offen. [Kurze Testanleitung](CHART-HOCHFORMAT.md).

Befunde im Gesamtlauf: m79, m59, m39, m7.

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
| m79 | Exit 1 → vollständige Nachprüfung |
| m78 | 16/16 |
| m77 | 35/35 |
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
| m59 | 1/2 → vollständige Nachprüfung |
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
| m39 | 48/50 → vollständige Nachprüfung |
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
| m10 | 93/93 |
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

M79 brach im Erstlauf nach neun bestandenen Vorprüfungen ab: Nach tatsächlichem Übungskauf erschien die erwartete Praxisposition nicht innerhalb der unveränderten 30-s-Frist. Erstlog vollständig erhalten. Ursache noch nicht belegt; nach allen 145 Zielen vollständige Nachprüfung mit reinen Klick-/Zustandsbeobachtungen, ohne geänderte Aktionen/Prüfgrenzen.

M59 brach im Erstlauf nach der bestandenen R-Berechnung früh mit einem undefinierten Symbol ab. Sein Alarmfall liest nach fester 1500-ms-Startpause den BTC-Kurs; eine tatsächliche aktuelle Quote wird noch nicht ausdrücklich abgewartet. Separate Diagnosekopie beobachtet Kurs/Alarm bei unveränderten Aktionen/Fristen; Ursache im ersten Lauf noch nicht belegt. Vollständige Nachprüfung nach allen 145 Zielen.

M39: Abstand Chart minus Toolbarhöhe nach BTC→XRP um 4 px verschieden (853 vs. 849 px); erster beobachteter Größenbefund. Produkt außerhalb des Vollbilds unverändert. Komplette reine Diagnosekopie ergänzt tatsächliche OHLC-/Nachbarboxgrößen und Animationszeitpunkte, ohne ursprüngliche Gesten/Fristen oder die 50 Kriterien zu ändern; vollständige Nachprüfung nach allen 145 Zielen offen.

M39 vollständig 48/50: zusätzlich Aufklappmessung erst nach 322,2 ms, deklarierte Animation 240 ms; erwarteter 90-ms-Zwischenstand daher schon abgeschlossen. Ursprüngliche 50 Kriterien/90-ms-Wartefrist im Nachlauf erhalten; keine Animationsbehebung oder Ursache des 4-px-Befunds ohne Beobachtung behaupten.

M7 vollständig 46/47: Schließen nach unveränderten 200 ms lieferte im Mock keine letzte Sicherung (4 statt 5 Zustellungen, alte 6 statt neuer 7 Positionen). Die weiteren Sicherungsfälle bestanden. Vollständige Diagnosekopie beobachtet pagehide/visibilitychange, Keepalive und Dateigröße ohne URLs/Zugangsdaten oder andere Kriterien/Schließfrist; nach allen 145 Zielen vollständig nachprüfen. Erste Ursache noch nicht belegt, keine Produktbehebung behaupten.

Vollständige erste Nachprüfung: m79 49/49 (tatsächlicher Spot-Kauf, Praxisposition innerhalb 1 s sichtbar und tatsächlicher Abschluss), m59 19/19 (Quote vorhanden/Alarm tatsächlich gespeichert), m7 47/47 (pagehide, 2 ms später Keepalive mit sieben Positionen, anschließend hidden/geschlossen). Jeweils unveränderte Originalaktionen/Fristen/Kriterien, Beobachtungen ergänzt. Die Erstursachen dieser drei Ziele sind im Nachlauf nicht reproduziert und bleiben nicht abschließend belegt; keine Produktbehebung behauptet.

M39-Nachprüfung 48/50: Animationszeitpunkt 175,9 ms statt 90 ms, Ablesung der Höhe danach noch später; OHLC tatsächlich vor Wechsel 36 px und nach Wechsel 32 px, Toolbarhöhe 108→58 px. Deshalb ursprünglicher Test jetzt gezielt berichtigt: Zwischenhöhe innerhalb des Browsers per 90-ms-Timer am tatsächlichen Klick gemeinsam mit Zeit/Animation messen. Chart-/Toolbar-Rückkehr direkt vor/nach dem Schließen am selben vollständig geladenen XRP messen; deren Dokumentposition muss um die gesamte Detailhöhe zurückkehren (höchstens 1 px Rundung). Kein permissiver 4-px-Abzug, keine Produkt-/Animations-/OHLC-Änderung. Alle 50 Fälle und ursprüngliche Fach-/Gesten-/Zwischenhöhenabsichten erhalten, neue kontrollierte Messvorbedingung und Geometrievergleich ausdrücklich dokumentiert. Vollständiger zweiter Nachlauf offen.

M39 zweiter vollständiger Nachlauf 50/50, originaler Test mit kontrollierter Messung: Öffnung 234→331 px, tatsächliche Timer-Ablesung 119,8 ms/Animation 100,1 ms, Schließen mit positiver Zwischenhöhe→0. XRP vor/nach Schließen: Detailhöhe 331→0, Toolbar 1116→785 und Chart 1242→911 px, beide exakt um 331 px zurückgekehrt. Alle übrigen Coin-/Signal-/Tastatur-/Touch-/Mobilfälle bestanden. Damit alle 145 Ziele abschließend grün; alle 121 Produktdateien gegenüber dem eingefrorenen Stand unverändert.
