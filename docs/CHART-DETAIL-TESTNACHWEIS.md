# Chart-Erweiterung 3.64.0 – Testnachweis

Alle **161** registrierten Ziele vollständig seriell ausgeführt. Nach den vollständigen betroffenen Nachläufen **5133/5133** gezählte Prüfungen sowie Status/Rauch/Sicht grün. Lint: **0 Fehler**, drei bestehende App-Warnungen.

## Umfang und Produktstand

- Erster Gesamtlauf auf `d733f4a`: 5100/5111, 94,7 Minuten. Alle 145 Produktdateien währenddessen unverändert; keine Ziele ausgelassen.
- Endgültige Korrektur auf `f9ccffb`: ausschließlich App-HTML, dessen Manifest-Hash und SW-Buildkennung. 142 Produktdateien einschließlich aller Handels-, Dienst- und Erkennungsmodule unverändert.
- Vollständige relevante Nachläufe: M31, M24, M12, M10, M85, M59, M47, M34, M35, M56, M84, M88, M69, Releasegraph, allgemeine Funktionen, Status, Rauch und Sicht. Neue Chartprüfung M92 42/42 auf demselben Produktstand; 145 Dateien während der Nachläufe erneut geschützt.
- App/SW 3.64.0, Dienst weiterhin 2.12.0; 71 PWA-/69 Dienstdateien. Keine Änderung der Signal-, Alarm-, Positions- oder Erkennungsregeln.

## Befunde und Nachprüfung

- **M31:** Eintreffende Muster vergrößerten die Leiste bei 390 px von 59,5 auf 110 px; bei 320 px vergrößerte ein BTC-Pfeil den Knopf von 44 auf 47,875 px. Leere/gefüllte Leiste und BTC-Zeilen haben nun feste Höhe. M31 21/21; M92 prüft zusätzlich alle fünf Pfeilformen und Leer-/Musterwechsel bei 320/390/768/1440 px.
- **M24:** Unter 160 px Restplatz erzwang die alte RSI-Erklärung 220 px und ragte heraus. Sie öffnet bei Bedarf oberhalb und begrenzt sich aufs Fenster; M24 28/28.
- **M12/M10:** Die Leiste war auch bei eingeklappten Vollbild-Werkzeugen sichtbar und beanspruchte Charthöhe. Sie klappt jetzt gemeinsam mit den Werkzeugen ein; Zeichnungen bleiben. M12 17/17, M10 93/93, zusätzliche M84-/M56-Nachprüfung grün.
- **M85:** Der Test las eine neue Quote vor der möglichen asynchronen IDB-/UI-Bestätigung. Er wartet nun ausdrücklich auf die bestätigte passende Quote; Karte und positives Netto bleiben unveränderte Erwartungen. Erste Abweichung im Diagnose-Nachlauf nicht reproduziert (27/27); finaler Originalfall 26/26. Keine Produktbehebung für diesen ersten Befund behauptet.
- **M59:** Feste Startpause konnte vor dem ersten BTC-Kurs enden; daraus entstanden kein gültiger Alarm und ein Abbruch beim Lesen seiner Daten. Vor dem Alarm wartet der Test auf den tatsächlich geladenen endlichen Kurs. Diagnose und vollständiger Nachlauf jeweils 19/19; erstes Timing nicht abschließend reproduziert.
- **M47:** Erstlauf: einmal 524 ms Median für 5000 Trades über der unveränderten 400-ms-Grenze. Vollständiger Nachlauf: 168 ms (5000) und 346 ms (10000), 51/51. Speicher-/Journalpfad und Zeitgrenze unverändert; erste Laufzeitursache nicht gesichert.

## Reproduzieren und Grenzen

Einrichtung und Befehle stehen in `tests/README.md`; Gesamtlauf: `bash tests/run-all.sh`, Lint: `bash tests/lint.sh`. Browserziele strikt seriell, weil sie dieselben lokalen Testports verwenden. Die vollständigen Rückgabewerte, Erstbefunde, Nachläufe und Dateihashes stehen in `CHART-DETAIL-TESTNACHWEIS.json`; ungekürzte Rohlogs liegen in der Prüf-Workspace-Ablage `/workspace/.wx-widget-tools/`.

Automatische Browserprüfungen verwenden Chromium mit Touch-/Viewportprofilen. Echte iPhone-/iPad-/Safari-Abnahme bleibt separat; Anleitung in `CHART-DETAIL-MUSTER.md`. Keine private Oracle-VM geändert und keine echten Orders oder Telegram-Nachrichten gesendet.

| Ziel | Letztes vollständiges Ergebnis |
|---|---|
| unit-chart-detail | 35/35 |
| unit-chart-pattern-chips | 17/17 |
| m92 | 42/42 |
| unit-pattern-projection | 22/22 |
| unit-github-sync | 24/24 |
| m91 | 8/8 |
| m90 | 18/18 |
| unit-muster-bot | 23/23 |
| unit-muster-feed | 8/8 |
| unit-muster-paper | 9/9 |
| m89 | 18/18 |
| unit-market-intervals | 7/7 |
| m88 | 16/16 |
| unit-patterns-only | 16/16 |
| unit-telegram-format | 33/33 |
| m87 | 22/22 |
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
| m47 | 51/51 |
| m46 | 40/40 |
| m45 | 75/75 |
| m44 | 27/27 |
| m43 | 7/7 |
| m42 | 18/18 |
| m41 | 20/20 |
| m40 | 40/40 |
| m39 | 50/50 |
| m38 | 20/20 |
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
| m7 | 47/47 |
| m6 | 58/58 |
| m5 | 24/24 |
| m4 | 42/42 |
| m3 | 67/67 |
| ui | 63/63 |
| functional | 35/35 |
| statuscheck | 7/7 |
| smoke | grün |
| visual | grün |
