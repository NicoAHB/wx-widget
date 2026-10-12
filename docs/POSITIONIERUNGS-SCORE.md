# Positionierungs-Score – lokaler Arbeitsstand

Noch nicht veröffentlicht. Der Nutzer sammelt weitere Aufgaben und fordert Gesamttest/Veröffentlichung später ausdrücklich an. Die öffentliche Version bleibt 3.65.0.

## Was hinzugekommen ist

Rechts in der Karte **Muster-Gesamtbild** steht ein eigener Block **Positionierung** mit Zahl/Label, rot-orange-grünem Balken und Marker. Unter 15 bzw. über 85 erscheint **Squeeze-Risiko**. ⓘ erklärt die Teilwerte und Datenmenge; X oder Tippen daneben schließt. Das bisherige Muster-Gesamtbild links behält sein eigenes Tippziel.

0 = Short-lastig, 100 = Long-lastig, 50 = Neutral, jeweils **relativ zum eigenen Verlauf**. Das ist kein absoluter Anteil aller Long-/Short-Positionen. Die globale Binance-Long/Short-Ratio zählt Konten, nicht deren Positionsgröße. **Positionierung am Markt, keine Kursprognose.** Der Wert beeinflusst weder Muster-Qualität noch Handels-, Bot- oder Alarmentscheidungen.

## Berechnung und öffentliche Daten

- Immer das gleichnamige Binance-USDT-Perpetual des gewählten Coins, auch bei Spot, z. B. `LTCUSDT`. Kein Ausweichen auf BTC oder einen anderen Coin.
- Aktuelle Funding-Rate aus `/fapi/v1/premiumIndex`; bereits verfügbare frische Funding-Antwort desselben Coins aus der App wird wiederverwendet.
- Abgerechnete Funding-Raten der letzten 30 Tage aus `/fapi/v1/fundingRate`, gegebenenfalls paginiert (1000 Werte pro Seite).
- Kontenverhältnis aus `/futures/data/globalLongShortAccountRatio`, `period=4h`, 30 Tage. Ein vollständiger Abruf mit Limit 500 reicht für die ungefähr 180 Zeitpunkte; dazwischen nur neuester Wert mit Limit 1.
- Empirischer Perzentilrang = `100 × (Anzahl kleinerer Werte + 0,5 × Anzahl gleicher Werte) / Anzahl Vergleichswerte`. Eine konstante Reihe ergibt 50. Nur endliche Zahlen und mindestens zwei Vergleichswerte je Teil werden bewertet.
- Score = gerundetes Mittel beider Perzentile mit jeweils 50 % Gewicht. Richtung und Extremhinweis verwenden diesen angezeigten ganzzahligen Score. Fehlende Faktoren werden nicht umgewichtet.

Fachkern und Startwerte stehen in `shared/positioning-score.mjs`, `POSITIONING_CONFIG`. Ein kürzer verfügbarer Verlauf junger Coins wird nicht verlängert oder erfunden; tatsächliche Mengen stehen in der Erklärung. Funding wird entsprechend dem Nutzerauftrag als Rate verglichen, ohne zusätzliche Kosten-/Handelsrechnung. Open Interest ist kein zusätzlicher Faktor.

## Abgleich und Fehlerschutz

Abgleich alle 5 Minuten bei sichtbarer Karte oder geöffneter Erklärung, aktiver App und laufender Aktualisierung. Eigene Sichtbarkeit: der Plot muss dafür noch nicht im Fenster liegen. Pause, unsichtbare App und vom Gerät gemeldetes Offline stoppen Abrufe. Vier Coins im RAM-Cache, keine neuen Speicher-/Sicherungsdaten.

Funding-Historie stündlich inkrementell ergänzen und auf 30 Tage kürzen. Konten-Historie alle vier Stunden erneuern, neue aktuelle Zeitpunkte dazwischen einfügen. Coin-/Intervallwechsel vermischen keine Daten; Timeframe und Spot/Futures beeinflussen das verwendete Perpetual nicht. Verspätete Antworten verworfen, gemeinsamer vorhandener Binance-API-Client mit Timeout/Rate-Limit, kontrollierte Wiederholung frühestens nach fünf Minuten bzw. längerer Retry-Frist.

Bei Fehler, fehlendem passenden Futures, unvollständigen/veralteten Daten oder zu kurzer Vergleichsreihe **„-“** zeigen. Keine NaN-/Infinity-Ausgabe und keine alten Punkte als aktuelle Antwort. Grund über ⓘ erreichbar; übrige App bleibt bedienbar.

## Gezielt prüfen

`node tests/unit-positioning-score.js` und `node tests/m95.js`, Browserziele seriell. Bestehende Musteranzeige/Erklärung zusätzlich M94/M93. Keine echten Orders, Nachrichten oder Schlüssel. Der Gesamtlauf mit nun 167 Zielen wird erst nach Nutzeranweisung gestartet.

Auf einem echten iPhone: BTC und LTC öffnen, eigenes Label und Marker prüfen; ⓘ und linkes Muster-Gesamtbild getrennt öffnen; Hell/Dunkel/eigene Farbe, 320px, Vollbild und längsten Widerspruchstext prüfen. Fehlender Futures-Coin bleibt „-“. Reale Safari-/CORS-Abnahme separat.

Vor späterem Release den derzeit lokalen Root-Modulimport in das neue Versionsbündel übernehmen und APP_VERSION/SW-VERSION gemeinsam erhöhen. Veröffentlichte Bündel 3.65.0 bleiben unverändert.
