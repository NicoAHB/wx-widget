# G14 – vollständiger Testnachweis

App/SW **3.51.0**, Dienstquelle **2.8.0**. Geprüfter Produktstand: `fb7ad3a83e123c49e862f21f98eda05d6285437a`.

Alle **112 Zielbefehle** aus `tests/run-all.sh` vollständig seriell ausgeführt. Mit den unten dokumentierten vollständigen Nachläufen und gezielter Abschlussprüfung **3555/3555 zählbare Einzelprüfungen** (je Ziel letzter geprüfter Stand), keine offene Abweichung. Status-/Rauch-/Sichtprüfungen ohne Fehler.

App-/HTML-Kopf-/Modul-/Dienst-/Generator-Lint: **0 Fehler**, drei bestehende App-/zwei erzeugte Engine-Warnungen. Neue G14-Prüfungen unit-appearance **23/23**, m70 **61/61**; PWA-/Archiv-/Offline-Integration m69 **19/19**.

Der vollständige Erstlauf verwendete Produktstand `42dd6e253d60401e1b9e5d4448f3120bb7fb3305`. Danach wurde ausschließlich die G14-Anzeigeübernahme alter Hell-/Dunkelsicherungen ergänzt und der Kontrasthinweis präzisiert. Auf dem abschließenden Produktstand `fb7ad3a83e123c49e862f21f98eda05d6285437a` wurden m70 (61 Fälle), m50 (vollständige Sicherungsregression), m69 (vollständige PWA-/Archiv-/Offline-Integration), beide neuen/relevanten Einheitentests und Lint erneut vollständig geprüft. Gemeinsame Fach-/Dienstmodule und bestehende Aufklapp-/Heatmap-/Stoplogik blieben unverändert.

## Erstbefunde und Nachprüfung

- **m39**: Erstlauf 49/50. Vollständiger unveränderter Nachlauf **50/50**, Exit 0. Keine Prüfgrenze gelockert, kein Produktfix für diesen Befund.
  - Erstbefund: ✗ Weiches Aufklappen: nach 90 ms erst teilweise offen — 331 → 331 px
  - Im unveränderten Nachlauf nicht reproduziert; konkrete Ursache nicht gesichert.
- **m6**: Erstlauf 57/58. Vollständiger unveränderter Nachlauf **58/58**, Exit 0. Keine Prüfgrenze gelockert, kein Produktfix für diesen Befund.
  - Erstbefund: ✗ Keine langen Aufgaben über 50 ms, auch beim Kerzenschluss und Abgleich (mit und ohne Heatmap) — {"an":{"urls":2,"long":[],"sec":54,"scriptMsPerS":14},"aus":{"urls":0,"long":[55],"sec":54,"scriptMsPerS":15}}
  - Im unveränderten Nachlauf nicht reproduziert; konkrete Ursache nicht gesichert.
- **m3**: Erstlauf 66/68. Vollständiger korrigierter Nachlauf **68/68**, Exit 0. Keine Prüfgrenze gelockert, kein Produktfix für diesen Befund.
  - Erstbefund: ✗ Solange der Kurs unter dem Stop bleibt: keine Wiederholung — 4 [{"svc":"tg","t":"🛑 ETH Long: Stop-Loss erreicht\nETH Long: Stop-Los","chat":"987654321"},{"svc":"dc","t":"🛑 ETH Long: Stop-Loss erreicht\nETH Long: Stop-Los"},{"svc":"tg","t":"⚡ BTC-Puls: BTC +0,61 % in 5 Min. (64.420,84 USDT)","chat":"987654321"},{"svc":"dc","t":"⚡ BTC-Puls: BTC +0,61 % in 5 Min. (64.420,84 USDT)"}]; ✗ Neu laden mit Kurs unter dem Stop: keine Doppel-Meldung — 6
  - m3 zählte unabhängige BTC-Puls-Meldungen als ETH-Stop-Wiederholung und wartete dadurch auf das falsche Ereignis. Jetzt exakt die ETH-Stop-Meldungen, zusätzlich je Kanal 1/2; zweite Auslösung und Reload bleiben streng geprüft.

- **m70 Abschlussprüfung**: Nach importbedingtem Reload wurde die vorab gesetzte Farbe sichtbar, bevor der App-Kern geladen war. Der Test griff zu früh auf `__g05` zu (ReferenceError); Startwartebedingung ergänzt, Produktcode unverändert. Vollständiger Nachlauf **61/61**. Der erste Abbruch bleibt in der Begleitdatei erhalten.

Vollständige lokale Rohlogs und Rückgabewerte für jedes Ziel erhalten. Die maschinenlesbare Begleitdatei enthält alle Erstläufe und vollständigen Nachläufe einschließlich des Erstfehlers.

Das veröffentlichte Modulbündel 3.50.0 und alle gemeinsamen Fach-/Dienstmodule bleiben unverändert. 3.51.0 hat einen eigenen vollständigen Hashgraph. Reale Safari-/iPhone-/iPad-/CORS-/Leistungs-/VM-Abnahmen bleiben offen; lokale Browserattrappen beweisen diese nicht.

## Zielausführungen

| Ziel | Erstlauf | Vollständiger Nachlauf | Sekunden Erstlauf |
| --- | --- | --- | ---: |
| unit-appearance | 23/23 | 23/23 | 0.5 |
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
| unit-cn | 40/40 | – | 0.3 |
| unit-wl | 64/64 | – | 0.3 |
| unit-fmt | 4/4 | – | 5.7 |
| unit-vola | 44/44 | – | 2.8 |
| unit-247 | 96/96 | – | 0.8 |
| unit-247b | 25/25 | – | 0.4 |
| unit-pub | 7/7 | – | 9.0 |
| unit-247d | 16/16 | – | 3.7 |
| unit-247c | 55/55 | – | 0.5 |
| unit-pulse | 44/44 | – | 2.9 |
| unit-lots | 31/31 | – | 0.3 |
| unit-acct | 39/39 | – | 0.3 |
| inst-247 | 35/35 | – | 114.4 |
| m70 | 55/55 | 61/61 | 10.0 |
| m69 | 19/19 | 19/19 | 6.6 |
| m68 | 23/23 | – | 15.2 |
| m67 | 22/22 | – | 7.6 |
| m66 | 11/11 | – | 3.1 |
| m65 | 12/12 | – | 3.0 |
| m64 | 19/19 | – | 2.8 |
| m63 | 36/36 | – | 10.7 |
| m62 | 8/8 | – | 2.1 |
| m61 | 8/8 | – | 2.0 |
| m60 | 14/14 | – | 10.0 |
| m59 | 18/18 | – | 17.1 |
| m58 | 60/60 | – | 36.9 |
| m57 | 41/41 | – | 47.2 |
| m56 | 55/55 | – | 88.1 |
| m55 | 49/49 | – | 113.5 |
| m54 | 52/52 | – | 176.3 |
| m53 | 102/102 | – | 204.8 |
| m52 | 101/101 | – | 86.6 |
| m51 | 73/73 | – | 59.2 |
| m50 | 116/116 | 116/116 | 105.5 |
| m49 | 18/18 | – | 123.2 |
| m48 | 79/79 | – | 49.2 |
| m47 | 49/49 | – | 181.3 |
| m46 | 40/40 | – | 103.8 |
| m45 | 75/75 | – | 121.0 |
| m44 | 27/27 | – | 37.9 |
| m43 | 7/7 | – | 19.9 |
| m42 | 18/18 | – | 47.4 |
| m41 | 20/20 | – | 25.9 |
| m40 | 40/40 | – | 64.2 |
| m39 | 49/50 | 50/50 | 59.2 |
| m38 | 19/19 | – | 35.1 |
| m37 | 22/22 | – | 34.6 |
| m36 | 20/20 | – | 206.2 |
| m35 | 40/40 | – | 167.0 |
| m34 | 9/9 | – | 48.5 |
| m33 | 16/16 | – | 41.5 |
| m32 | 5/5 | – | 140.5 |
| m31 | 21/21 | – | 53.9 |
| m30 | 32/32 | – | 50.1 |
| m29 | 12/12 | – | 12.8 |
| m28 | 39/39 | – | 44.7 |
| m27 | 22/22 | – | 29.8 |
| m26 | 18/18 | – | 54.2 |
| m25 | 20/20 | – | 27.5 |
| m24 | 28/28 | – | 39.7 |
| m23 | 25/25 | – | 195.9 |
| m22 | 26/26 | – | 138.1 |
| m21 | 14/14 | – | 29.7 |
| m20 | 12/12 | – | 41.3 |
| m19 | 24/24 | – | 27.0 |
| m18 | 31/31 | – | 41.8 |
| m17 | 16/16 | – | 24.5 |
| m16 | 23/23 | – | 36.7 |
| m15 | 23/23 | – | 33.9 |
| m14 | 18/18 | – | 96.8 |
| m13 | 13/13 | – | 23.8 |
| m12 | 17/17 | – | 11.4 |
| m11 | 36/36 | – | 47.9 |
| m10 | 37/37 | – | 30.0 |
| m9 | 9/9 | – | 128.7 |
| m8 | 41/41 | – | 58.5 |
| m7 | 46/46 | – | 249.1 |
| m6 | 57/58 | 58/58 | 225.8 |
| m5 | 24/24 | – | 82.5 |
| m4 | 41/41 | – | 137.4 |
| m3 | 66/68 | 68/68 | 48.3 |
| ui | 63/63 | – | 42.1 |
| functional | 35/35 | – | 76.1 |
| statuscheck | Exit 0 | – | 3.6 |
| smoke | Exit 0 | – | 14.6 |
| visual | Exit 0 | – | 14.1 |
