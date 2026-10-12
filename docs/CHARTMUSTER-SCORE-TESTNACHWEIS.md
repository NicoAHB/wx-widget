# Muster-Score 3.65.0 – Testnachweis

Alle **165** registrierten Ziele vollständig seriell ausgeführt. Nach vollständigen relevanten Nachläufen abschließend **5298/5298** gezählte Prüfungen sowie Status/Rauch/Sicht grün. Lint **0 Fehler**, drei bestehende Warnungen.

## Geprüfter Umfang

- Sieben Faktoren, Doppel-Top 82.563 → 83.854, unveränderte Regelgüte, Gegen-Schluss/Ziel/Alter, aktuelle Reststrecke auch bei Wochenmustern und keine erfundene Stimme aus fehlenden Daten.
- Reale App und benannter Worker auf sieben Zeitebenen; serieller Cache, Pause/Abbruch/429/Teil-Ausfall, Coin-/Marktbindung, keine neuen Trades/Alarme/Lernfälle. 100 Cache-Neuzeichnungen erhalten DOM/Scroll/Höhe; Messwerte im M94-Rohlog, keine Behauptung zur realen Safari-Leistung.
- Native Chip-/Info-/Halte-/Tastatur-/Vollbild-Wege und identisch neue Engineobjekte; aktuelle Messwerte ohne alte Referenzen, Klapp-/Scrollstand bleibt. Zehn tatsächliche Farbmodi mit mindestens 4,5:1 an Faktoren und aktivem Info-Knopf; 320–1440 px.
- Vollständiger Lauf auf `64191bf1e3a9419f89eb44e57eaf215dbce9eee3`, alle **149** Produktdateien währenddessen unverändert. Finaler Stand `14a0a96baf710d65e9b78ec0d998869549f0fa4d`: **3** geänderte Produktdateien gegenüber dem Gesamtlauf; 146 unverändert. Änderungen und alle finalen Hashes im JSON. Nachläufe erneut mit geschütztem Produktstand.
- App/SW **3.65.0**, Dienst **2.12.0**, Bündel 73 PWA-/71 Dienstdateien. Keine Änderung von pat-1, Handelsmodellen oder Telegram-Auslösern.

## Befunde und Nachläufe

Der vollständige serielle Erstlauf dauerte 95,0 Minuten: alle 165 Ziele ausgeführt, 5273/5275 gezählte Prüfungen; M88 zusätzlich nach zehn positiven Fällen ohne Gesamtzählung abgebrochen. Alle 149 Produktdateien blieben während des Laufs unverändert. Drei Befunde wurden vor Veröffentlichung getrennt untersucht, die Erstlogs bleiben erhalten:

1. **M88 – Vorauswahl-Mustersprung:** Der neue Kopfbereich brachte den Plot unter das sichtbare Fenster (top 1229,6 px bei 844 px Fensterhöhe). Intern waren das richtige Muster und 500 neue Kerzen vorhanden, ohne Kursfehler; der absichtlich erst bei Sichtbarkeit zeichnende Plot enthielt noch den alten SVG. Der explizite Mustersprung scrollt jetzt zum tatsächlichen Plot statt zum Kartenanfang. Nachlauf **17/17**, einschließlich neuer Sichtbarkeitsprüfung.
2. **M17 – Fibonacci nach Neuladen:** Der wiederhergestellte Scrollstand setzte den Plot vollständig oberhalb des Fensters (bottom −326,2 px). 500 Kerzen waren vorhanden, ohne Kursfehler oder laufenden Ladeauftrag; das Rendering pausierte korrekt außerhalb des Fensters. Der Test scrollt vor dem SVG-Auslesen ausdrücklich zum Plot. Alle ursprünglichen Erwartungen bleiben erhalten; vollständiger Nachlauf **16/16**.
3. **M35 – Stundenmarkierung:** Das Erstlog zeigt „Stand 06:59“, zunächst Auswahl/Anzeige 6–7, danach Rückkehr bereits 7–8. Die externe erwartete Stunde wurde damals nicht separat aufgezeichnet; der Stundenwechsel ist naheliegend, aber daraus allein nicht bewiesen. Der Test erhebt Uhr und UI jetzt im selben Browser-Snapshot und meidet nur das schmale Zeitfenster um den Stundenwechsel. Er wartet nicht auf eine gewünschte Markierung. App-Volatilitätsberechnung unverändert; Nachlauf **40/40**.

Gegenüber dem Erstlauf ändern sich nur HTML-Navigationsziel, zugehöriger Manifest-Hash und SW-Buildkennung: **3 Produktdateien geändert, 146 unverändert**. Die relevanten vollständigen Nachläufe laufen seriell auf erneut hashgeschütztem Produktstand; die JSON-Ergebnisse trennen Erst- und Endergebnisse.

Bereits vor dem Erstlauf wurde ein reproduzierbarer Referenzfehler bei wertgleichen neuen Engineobjekten behoben: alte Cache-Referenzen verhinderten die Erklärung. Native Vorherdiagnose mit Index −1, danach stabile Muster-ID und Ergebnisobjektbindung; M93 **40/40** einschließlich Erklärung während Haltegeste und Erhalt von Messwerten/Klapp-/Scrollstand. Der Cache wird bei unveränderten Ticks weiterhin wiederverwendet. Keine temporäre Produktdiagnostik im Release.

**Zusätzlicher Befund im relevanten Nachlauf:** `functional` 33/35, beide Erwartungen zur nachträglichen LTC-Alarmierung fehlgeschlagen; der 165-Ziele-Erstlauf war hier 35/35. Der unveränderte Binance-Mock erzeugt beim ersten `series()`-Abruf synthetische Vorgängerkerzen. Bei einem Minutenwechsel zwischen beobachteter Spitze und erstem Abruf geht der echte Vorgängerdocht verloren. Zeitgesteuerter Replay derselben unveränderten Mock-Funktionen: Spitze 71,5 kurz vor der Grenze, erster Abruf danach → geliefertes Hoch 70,2115, Alarm 71 nicht erreichbar; mit zuvor initialisierter Historie Hoch 71,5. Die reine Marktfixture wird jetzt vor der Spitze initialisiert, keine App geöffnet und kein Alarmcode geändert. Alle 35 Erwartungen bleiben erhalten; gezielt erzwungene Minutengrenze zusätzlich nativ geprüft. Der fehlgeschlagene Nachlauf bleibt in der JSON-Ergebnisliste neben dem vollständigen erfolgreichen Nachlauf stehen.

Für den fehlgeschlagenen funktionalen Zwischenlauf wurde der Rohlog-Dateipfad beim erneuten Lauf wiederverwendet. Das zuvor ausgelesene Ergebnis und die Fehlerbeobachtung sind deshalb ausdrücklich als `functional-before-fixture.observation.json` erhalten, nicht als unverändertes Originalrohlog bezeichnet. Rückgabewert und 33/35 bleiben in der Ergebnisliste; Erst-Gesamtlauf und alle übrigen Rohlogs sind separat erhalten.


## Reproduzieren und Grenzen

`bash tests/lint.sh` und `bash tests/run-all.sh`; alle Browser-/Installerziele strikt seriell wegen gemeinsamer Ports. Erstlogs und Nachläufe getrennt unter `/workspace/.wx-widget-tools/release-3.65.0-full-suite/` und `release-3.65.0-followups/`. JSON erhält Rückgabewerte, Erst-/Endergebnisse und Produkt-Hashes; abgebrochene/ungelaufene Erstfälle werden nicht als bestanden gezählt.

Automatische Touchprüfungen verwenden Chromium. Praktischer iPhone-/iPad-/Safari-Test und reale Leistung bleiben offen; Anleitung in [CHARTMUSTER-SCORE.md](CHARTMUSTER-SCORE.md). Keine echten Orders, Nachrichten oder VM-Änderungen für die Tests.

| Ziel | Letztes vollständiges Ergebnis |
|---|---|
| m94 | 39/39 |
| unit-chart-pattern-quality | 52/52 |
| unit-chart-pattern-overview-feed | 33/33 |
| m93 | 40/40 |
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
| m88 | 17/17 |
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
