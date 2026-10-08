# KI-Korrekturen – vollständiger Testnachweis

App/SW **3.52.0**, Dienstquelle **2.9.0**. Geprüfter Produktstand: `c6525099dbd04ebc16a212de3cb30ba5dcb3902f`.

Alle **120 Zielbefehle** aus `tests/run-all.sh` vollständig seriell mit ihren Rohlogs und Rückgabewerten ausgeführt. Nach vollständigen Befundnachprüfungen **3778/3778 zählbare Einzelprüfungen**, zusätzlich Status-/Rauch-/Sichtprüfungen ohne Fehler. Der Produktstand `1306bcf70a7133092044ccfc61e185b46ee2de90` blieb während des Gesamtlaufs unverändert. Die anschließende visuelle Prüfung reproduzierte eine Überlagerung im Standard-Desktop. Eine CSS-Regel beendet das Mitlaufen der Seitenspalte ausschließlich bei aktiver KI-Übersicht; alle Fach-/Dienstmodule und Berechnungen bleiben unverändert. Auf dem abschließenden Produktstand `c6525099dbd04ebc16a212de3cb30ba5dcb3902f` wurden m72 (28), m73 (20), m70 (61), m63 (36), m67 (22), m69 (19), statuscheck (6), unit-release (6) und Lint vollständig erneut geprüft. Das PWA-Bündel wurde dafür neu erzeugt.

App-/HTML-Kopf-/Modul-/Dienst-/Generator-Lint **0 Fehler**, drei bestehende App- und zwei erzeugte Engine-Warnungen. Releasegraph: **43 PWA-Dateien / 37 Dienstdateien** reproduzierbar und vollständig geprüft.

## Erstbefunde und Nachprüfung

- **Visuelle Abnahme / m72:** Zusätzlicher tatsächlicher Trefferpunkttest reproduzierte die verdeckende Kontostand-Seitenspalte (27/28). Nach eng begrenztem KI-CSS-Fix **28/28**: beide Layouts beim Scrollen frei, Rückwechsel zur ursprünglichen mitlaufenden Preisalarmansicht geprüft.
- **Statuscheck:** Alte Ausgabe enthielt erwartete HTTP 401/405 an anonymen Testendpunkten und ein fehlendes Test-Favicon, ohne diese als Prüfaussagen zu zählen. Jetzt **6/6** ausdrückliche Aussagen, anonyme Antworten exakt nach URL/Status gebunden, absichtlich gesperrte Streams an die Blockierphase, Favicon im Test 204; unerwartete HTTP-/JavaScript-/Konsolenfehler bleiben Fehler. Produktseite unverändert.

- **m67:** Erster UI-Fall verschwand durch legitime Hintergrund-Nachbewertung eines offenen Simulatorfalls in das Archiv. Der Test verwendet jetzt einen tatsächlich vom gemeinsamen Simulator abgeschlossenen Originalfall und die Archivansicht. Vollständiger Nachlauf **22/22**; Journal, Markierung, Export, Herkunft, Reload, Chart und Dienst bleiben geprüft. Keine Produktänderung.
- **m59:** Erster Kurslevel-Test erwartete zwingend einen Widerstand, obwohl der Mock-Kurs über allen bestätigten Hochs lag. Jetzt deterministische Pivots: beide Abstände exakt 2 %, ATR und Farbe aus denselben Kerzen; zusätzlich fehlender Widerstand oberhalb aller Hochs. Vollständiger Nachlauf **19/19**. Kurslevel-/ATR-Produktcode unverändert.
- **m69:** Im Erstlauf Timeout beim Warten auf das aktivierte Bündel. Vollständige Nachprüfung **19/19**, zusätzlich Diagnose mit verzögerter Lieferliste **19/19**: Installation/Aktivierung, absichtlich beschädigte Datei, Abbruch/Retry, Cachegrenze und frischer Offline-Start. Timeout nicht reproduziert, konkrete Ursache **nicht gesichert**. Zustandsdiagnosen ergänzt; keine Hash-/Cache-/Offline-Prüfung gelockert, SW-Aktivierungs-/Hash-/Offlinecode unverändert; abschließend neuer Build-Identifier für das CSS-Bündel geprüft. Frühere Gruppe-1-Korrektur des voreiligen Promise-Tests bleibt dokumentiert.

Für die Nachprüfung wurde der eigene Läufer zwischen Browserzielen pausiert und danach fortgesetzt. Die m46-Wandzeit enthält diese Pause. Keine parallelen Browser-/Installerprüfungen. Vollständige Erstlogs und Nachläufe erhalten; die JSON-Begleitdatei enthält alle Rückgabewerte und Erstabweichungen.

Lokale Attrappen beweisen keine reale Safari-/iPhone-/iPad-/CORS-/VM-Abnahme. Keine realen Orders/Nachrichten; private VM nicht aktualisiert. Alte cf-1-Originale/Bündel bleiben unverändert. Beschreibende hypothetische Verteilung ist kein geprüfter profitabler Marktvorteil.

## Zielausführungen

| Ziel | Erstlauf | Vollständiger Nachlauf | Sekunden Erstlauf |
| --- | --- | --- | ---: |
| unit-confluence-risk | 28/28 | – | 0.3 |
| unit-confluence-evidence | 18/18 | – | 0.3 |
| unit-signal-overview | 27/27 | – | 0.4 |
| unit-confluence-costs | 46/46 | – | 0.4 |
| unit-confluence-presentation | 23/23 | – | 0.4 |
| unit-appearance | 23/23 | – | 0.5 |
| unit-release | 6/6 | 6/6 | 0.7 |
| unit-model-archive | 13/13 | – | 0.3 |
| unit-bot-limits | 37/37 | – | 0.3 |
| unit-bot-simulation | 16/16 | – | 0.3 |
| unit-po3 | 35/35 | – | 0.3 |
| unit-po3-service | 20/20 | – | 0.4 |
| unit-po3-stream | 19/19 | – | 0.5 |
| unit-confluence-service | 26/26 | – | 0.5 |
| unit-confluence-replay | 33/33 | – | 0.3 |
| unit-bitget-history | 15/15 | – | 0.3 |
| unit-confluence-live | 46/46 | – | 0.4 |
| unit-bitget-patterns | 20/20 | – | 0.4 |
| unit-bitget | 55/55 | – | 0.4 |
| unit-confluence | 135/135 | – | 0.3 |
| unit-247e | 38/38 | – | 0.5 |
| unit-m8 | 24/24 | – | 0.4 |
| unit-zz | 28/28 | – | 0.4 |
| unit-zzp | 17/17 | – | 0.4 |
| unit-div | 10/10 | – | 0.4 |
| unit-ew | 27/27 | – | 0.9 |
| unit-fib | 6/6 | – | 0.3 |
| unit-ob | 9/9 | – | 0.3 |
| unit-cd | 16/16 | – | 0.3 |
| unit-hl | 13/13 | – | 0.3 |
| unit-ec | 22/22 | – | 0.4 |
| unit-cn | 40/40 | – | 0.4 |
| unit-wl | 64/64 | – | 0.3 |
| unit-fmt | 4/4 | – | 5.7 |
| unit-vola | 44/44 | – | 2.7 |
| unit-247 | 96/96 | – | 0.8 |
| unit-247b | 25/25 | – | 0.4 |
| unit-pub | 7/7 | – | 8.6 |
| unit-247d | 16/16 | – | 3.7 |
| unit-247c | 55/55 | – | 0.4 |
| unit-pulse | 44/44 | – | 2.9 |
| unit-lots | 31/31 | – | 0.3 |
| unit-acct | 39/39 | – | 0.3 |
| inst-247 | 35/35 | – | 169.3 |
| m73 | 20/20 | 20/20 | 7.3 |
| m72 | 25/25 | 28/28 | 6.5 |
| m71 | 23/23 | – | 8.4 |
| m70 | 61/61 | 61/61 | 26.0 |
| m69 | ohne Zähler, Exit 1 | 19/19 | 24.5 |
| m68 | 23/23 | – | 18.3 |
| m67 | ohne Zähler, Exit 1 | 22/22 | 37.0 |
| m66 | 14/14 | – | 5.0 |
| m65 | 12/12 | – | 4.6 |
| m64 | 19/19 | – | 4.3 |
| m63 | 36/36 | 36/36 | 16.1 |
| m62 | 8/8 | – | 3.7 |
| m61 | 8/8 | – | 3.1 |
| m60 | 14/14 | – | 11.8 |
| m59 | 17/18 | 19/19 | 18.2 |
| m58 | 60/60 | – | 44.8 |
| m57 | 41/41 | – | 53.4 |
| m56 | 55/55 | – | 96.2 |
| m55 | 49/49 | – | 119.8 |
| m54 | 52/52 | – | 184.8 |
| m53 | 102/102 | – | 192.1 |
| m52 | 101/101 | – | 86.7 |
| m51 | 73/73 | – | 58.5 |
| m50 | 116/116 | – | 103.3 |
| m49 | 18/18 | – | 122.9 |
| m48 | 79/79 | – | 48.8 |
| m47 | 49/49 | – | 182.1 |
| m46 | 40/40 | – | 289.7 |
| m45 | 75/75 | – | 122.2 |
| m44 | 27/27 | – | 40.7 |
| m43 | 7/7 | – | 21.1 |
| m42 | 18/18 | – | 49.1 |
| m41 | 20/20 | – | 28.7 |
| m40 | 40/40 | – | 65.1 |
| m39 | 50/50 | – | 57.7 |
| m38 | 19/19 | – | 32.4 |
| m37 | 22/22 | – | 34.8 |
| m36 | 20/20 | – | 206.8 |
| m35 | 40/40 | – | 142.7 |
| m34 | 9/9 | – | 47.4 |
| m33 | 16/16 | – | 42.1 |
| m32 | 5/5 | – | 138.7 |
| m31 | 21/21 | – | 53.1 |
| m30 | 32/32 | – | 46.1 |
| m29 | 12/12 | – | 12.6 |
| m28 | 39/39 | – | 44.7 |
| m27 | 22/22 | – | 29.7 |
| m26 | 18/18 | – | 58.9 |
| m25 | 20/20 | – | 27.7 |
| m24 | 28/28 | – | 40.0 |
| m23 | 25/25 | – | 196.4 |
| m22 | 26/26 | – | 139.0 |
| m21 | 14/14 | – | 29.9 |
| m20 | 12/12 | – | 41.7 |
| m19 | 24/24 | – | 27.1 |
| m18 | 31/31 | – | 41.9 |
| m17 | 16/16 | – | 23.8 |
| m16 | 23/23 | – | 35.2 |
| m15 | 23/23 | – | 33.2 |
| m14 | 18/18 | – | 96.0 |
| m13 | 13/13 | – | 23.9 |
| m12 | 17/17 | – | 11.6 |
| m11 | 36/36 | – | 49.7 |
| m10 | 37/37 | – | 32.7 |
| m9 | 9/9 | – | 129.0 |
| m8 | 41/41 | – | 64.3 |
| m7 | 46/46 | – | 252.8 |
| m6 | 58/58 | – | 212.5 |
| m5 | 24/24 | – | 83.0 |
| m4 | 41/41 | – | 136.8 |
| m3 | 68/68 | – | 52.9 |
| ui | 63/63 | – | 43.9 |
| functional | 35/35 | – | 83.5 |
| statuscheck | ohne Zähler, Exit 0 | 6/6 | 2.1 |
| smoke | ohne Zähler, Exit 0 | – | 16.5 |
| visual | ohne Zähler, Exit 0 | – | 15.4 |
