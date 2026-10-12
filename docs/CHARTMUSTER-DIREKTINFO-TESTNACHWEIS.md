# Direkte Mustererklärung 3.64.1 – Testnachweis

Alle **162** registrierten Release-Ziele vollständig seriell ausgeführt. Abschließend **5171/5171** gezählte Prüfungen sowie Status/Rauch/Sicht grün; Lint **0 Fehler**, drei bestehende Warnungen.

## Geprüfter Umfang

- M93 **38/38**: echte Touch-Gesten, kurzer/langer Druck, Loslassen ohne Zeichnungsklick, sofortiger Folgetipp, natives Wischen, Touch-Abbruch, Live-Neuzeichnung, Filter-/Coinwechsel, Maus/Rechtsklick/Tastatur, Escape, ungültige Muster, Vollbild und 44×44-px-Infoknöpfe bei 320–1440 px. Muster-ID allein darf beim Coinwechsel keine alte Erklärung übernehmen; neue Sortierung findet das ursprüngliche Muster wieder. Zehn zusätzliche Fälle prüfen den tatsächlich sichtbaren Textkontrast an ungültigen Kacheln mit Farben/Deckkraft/Hintergrund in Hell, Dunkel und acht eigenen Paletten: mindestens 4,5:1.
- Bestehender Charttest M92 **42/42**; seine fachlichen Erwartungen bleiben unverändert. Hauptanalyse, Detaildaten, Alarme, Positionen, Zeichnungsauswahl und Leistenhöhe weiter geprüft.
- Erster vollständiger Lauf auf `1f1b275b27a45ec8af6aaeefe4bfd60b69ea7818`: **5161/5161**, 92,3 Minuten, alle **145** Produktdateien geschützt und unverändert.
- Finaler Produktstand `0ef956decb8728cf46b08f6c3dfd3d8a3001904e`: nur App-HTML, dessen Manifest-Hash und SW-Buildkennung ändern sich nach dem Gesamtlauf; **142** Produktdateien einschließlich aller Handels-/Erkennungs-/Dienstmodule unverändert. Vollständige relevante Nachläufe M93, M92, M31, M70, M88, M69, Releasegraph, allgemeine Funktionen, Status, Rauch und Sicht; dabei alle 145 Produktdateien erneut geschützt und unverändert. App/SW 3.64.1, Dienst weiterhin 2.12.0; 71 PWA-/69 Dienstdateien.
- Sichtprüfung der Kachel und vorhandenen Erklärung auf schmalem Display. Keine Erkennungs-, Alarm- oder Handelsregel geändert.

## Erstbefund und Messvorbedingung

Der erste neue M93-Versuch wartete auf Muster, obwohl der Chart noch außerhalb des sichtbaren Fensters lag. Diagnose: BTC/1h-Kerzen korrekt geladen, `busy=false`, keine App-Laufzeitfehler, aber noch kein passives Musterergebnis. Die passive Erkennung läuft bewusst nur im sichtbaren Chart. Der Test scrollt jetzt ausdrücklich dorthin; Erwartungen und Zeitgrenze bleiben unverändert. Anschließend 27/27, nach der Kontextprüfung 28/28. Erstlogs bleiben unter `/workspace/.wx-widget-tools/` erhalten.

Keine Abweichungen im vollständigen Release-Lauf.

## Eng begrenzte Kontrastkorrektur

Nach dem vollständigen grünen Lauf zeigte die zusätzliche Prüfung ein konkretes Darstellungsproblem: Der neue aktive Infoknopf erbte bei ungültigen Mustern die 0,5-Gruppendeckkraft. Rechnerisch etwa 3,25:1 im Hellmodus; die vollständige Browser-Vorherprüfung reproduziert **33/38**, fünf helle Modi jeweils **3,228:1** (Hell, Elfenbein, Nebelblau, Salbei, Flieder). Der gesperrte Mustertext bleibt abgegraut, der aktive Infoknopf wird nun nicht mehr mitgedimmt. Dieselbe vollständige M93-Prüfung anschließend **38/38**; Zeitgrenzen, Kontrastgrenze und fachliche Erwartungen unverändert. Vorher-/Nachherlogs und Rückgabewerte separat erhalten. Keine Änderung an Gesten-, Handels- oder Erkennungslogik für diese Korrektur.

## Reproduzieren und Grenzen

`bash tests/lint.sh` und `bash tests/run-all.sh`; Einrichtung in `tests/README.md`. Browserziele strikt seriell wegen gemeinsamer lokaler Ports. Vollständige Rückgabewerte, Ergebnisse und Hashes in [CHARTMUSTER-DIREKTINFO-TESTNACHWEIS.json](CHARTMUSTER-DIREKTINFO-TESTNACHWEIS.json); ungekürzte Rohlogs außerhalb des Checkouts in `/workspace/.wx-widget-tools/release-3.64.1-full-suite/`.

Automatische Browser-/Touchprüfungen verwenden Chromium. Der praktische Test auf echten iPhone-/iPad-/Safari-Geräten bleibt separat; Anleitung in [CHARTMUSTER-DIREKTINFO.md](CHARTMUSTER-DIREKTINFO.md). Kein Oracle-Update für diese Erweiterung und keine echten Orders oder Telegram-Nachrichten durch die Abnahme.

| Ziel | Letztes vollständiges Ergebnis |
|---|---|
| m93 | 38/38 |
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
