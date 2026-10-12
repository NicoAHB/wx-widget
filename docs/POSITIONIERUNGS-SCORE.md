# Positionierungs-Score

Seit 3.66.0 veröffentlicht, in **3.67.0** als Kreis-Score neu dargestellt und im Datenabruf korrigiert (siehe unten).

## Anzeige (3.67.0)

Rechts in der Karte **Muster-Gesamtbild** steht der Block **Positionierung ⓘ** als Kreis: Die Zahl 0–100 steht in der Mitte, der farbige Bogen läuft ab 12 Uhr im Uhrzeigersinn bis zum Score. Farbe: **rot** unter 35 (Short-lastig), **gelb** 35–65 (neutral), **grün** über 65 (Long-lastig). Darunter steht das Label (Short-lastig / Neutral / Long-lastig); unter 15 bzw. über 85 erscheint stattdessen **⚠ Squeeze**. Ohne aktuelle Daten zeigt der Kreis nur den grauen Ring, „–“ und „nicht verfügbar“ bzw. „lädt …“.

Der ganze Block ist eine Taste (mindestens 44 px): Antippen öffnet die Erklärung mit Teilwerten und Datenumfang; X oder Tippen daneben schließt. Das Muster-Gesamtbild links behält sein eigenes Tippziel.

0 = Short-lastig, 100 = Long-lastig, 50 = Neutral, jeweils **relativ zum eigenen Verlauf**. Das ist kein absoluter Anteil aller Long-/Short-Positionen. Die globale Binance-Long/Short-Ratio zählt Konten, nicht deren Positionsgröße. **Positionierung am Markt, keine Kursprognose.** Der Wert beeinflusst weder Muster-Qualität noch Handels-, Bot- oder Alarmentscheidungen.

## Korrektur 3.67.0: warum der Score bisher „-“ blieb

Die echte Binance-API war in der Entwicklungsumgebung gesperrt (Netzwerkrichtlinie). Die folgenden drei Stellen sind deshalb die im Code gefundenen wahrscheinlichen Ursachen, nicht live nachgewiesen; alle drei sind behoben.

- **30-Tage-Grenze:** Binance liefert Long/Short-Daten nur für die letzten 30 Tage. Die App fragte mit `startTime` = genau jetzt − 30 Tage an. Beim Eintreffen der Anfrage liegt dieser Zeitpunkt bereits außerhalb des verfügbaren Fensters; Binance kann solche Startzeiten ablehnen. Der Verlauf wird jetzt **ohne Startzeit** über die Anzahl geladen: `period=4h&limit=180` (180 × 4 h = 30 Tage).
- **Frischeprüfung:** Der neueste 4h-Wert durfte höchstens 4 h 5 min alt sein. Trägt der Zeitstempel den Periodenbeginn, ist der neueste veröffentlichte Wert jedoch bis zu acht Stunden alt. Grenze jetzt zwei Perioden plus 5 min.
- **Geräteuhr:** Werte mit einem Zeitstempel kurz nach der Geräteuhr wurden verworfen. Jetzt sind bis zu 10 min Abweichung zulässig.

Die Mock-Tests konnten diese Fälle nicht zeigen, weil der Test-Server jede Startzeit akzeptierte. Die Unit-Tests prüfen jetzt ausdrücklich: keine Startzeit an der Grenze, 4h10 alter Periodenwert gültig, Geräteuhr 2 min hinter Binance.

## Berechnung und öffentliche Daten

- Immer das gleichnamige Binance-USDT-Perpetual des gewählten Coins, auch bei Spot, z. B. `LTCUSDT`. Kein Ausweichen auf BTC oder einen anderen Coin.
- Aktuelle Funding-Rate aus `/fapi/v1/premiumIndex`; bereits verfügbare frische Funding-Antwort desselben Coins aus der App wird wiederverwendet.
- Abgerechnete Funding-Raten der letzten 30 Tage aus `/fapi/v1/fundingRate`, gegebenenfalls paginiert (1000 Werte pro Seite).
- Kontenverhältnis aus `/futures/data/globalLongShortAccountRatio`, `period=4h`, `limit=180` ohne Start-/Endzeit; dazwischen nur neuester Wert mit `limit=1`.
- Empirischer Perzentilrang = `100 × (Anzahl kleinerer Werte + 0,5 × Anzahl gleicher Werte) / Anzahl Vergleichswerte`. Eine konstante Reihe ergibt 50. Nur endliche Zahlen und mindestens zwei Vergleichswerte je Teil werden bewertet.
- Score = gerundetes Mittel beider Perzentile mit jeweils 50 % Gewicht. Richtung und Extremhinweis verwenden diesen angezeigten ganzzahligen Score. Fehlende Faktoren werden nicht umgewichtet.

Fachkern und Startwerte stehen in `shared/positioning-score.mjs`, `POSITIONING_CONFIG` (neu: `ratioLimit`, `ratioMaxAgeMs`, `clockSkewMs`).

## Abgleich und Fehlerschutz

Abgleich alle 5 Minuten bei sichtbarer Karte oder geöffneter Erklärung, aktiver App und laufender Aktualisierung. Pause, unsichtbare App und vom Gerät gemeldetes Offline stoppen Abrufe. Vier Coins im RAM-Cache, keine neuen Speicher-/Sicherungsdaten.

Funding-Historie stündlich inkrementell ergänzen und auf 30 Tage kürzen. Konten-Historie alle vier Stunden erneuern, neue aktuelle Zeitpunkte dazwischen einfügen. Verspätete Antworten werden verworfen; gemeinsamer Binance-API-Client mit Timeout/Rate-Limit; kontrollierte Wiederholung frühestens nach fünf Minuten.

Bei Fehler, fehlendem passenden Futures, unvollständigen/veralteten Daten oder zu kurzer Vergleichsreihe zeigt der Kreis „–“. Den Grund nennt die Erklärung (Antippen); die übrige App bleibt bedienbar.

## Prüfen

Automatisch: `node tests/unit-positioning-score.js` (40 Fälle) und `node tests/m95.js` (40 Fälle, Browserziele seriell), zusätzlich M94.

Auf dem iPhone: BTC und LTC öffnen – der Kreis muss nach wenigen Sekunden eine Zahl zeigen. Antippen öffnet die Erklärung mit „Vergleichsdaten … Funding · 180 × 4h“. Bleibt „–“, steht der genaue Grund in der Erklärung (z. B. Binance-Fehlercode); diesen Text bitte melden.
