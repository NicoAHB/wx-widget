# Qualitätsfilter für Chartmuster-Meldungen (App 3.69.0, Dienst 2.13.0, Oracle-Musterdienst 1.1.0)

Ziel: Nur noch wirklich relevante Chartmuster-Signale gehen an Telegram. Der Filter sitzt **zwischen Mustererkennung und Telegram-Versand**, an allen drei Stellen, an denen Chartmuster-Meldungen entstehen. Alle drei nutzen dasselbe Modul `shared/pattern-quality.mjs`. Kursalarme, Trades und Sicherung sind nicht betroffen. Chartmuster gehen weiter an das eingerichtete Ziel „Chartmuster“; es gibt keinen neuen Chat.

| Stelle | Vorher | Jetzt |
|---|---|---|
| App (`weather-widget-v2.html`) | `pkRecord` → `patNotify` → Telegram bzw. Weitergabe an den 24/7-Dienst | `pkRecord` → **`patqRun`** (bewerten, auswählen, Journal) → `patNotify` nur für ausgewählte Signale, mit Bewertung |
| Oracle-Musterdienst (`server/patterns-247.mjs`) | `scan` → `patternCases` → Ereignis → `deliver` | `scan` → `patternCases` → **`patternEvaluate`** → **`selectPatternSignals`** über alle Märkte des Laufs → Ereignis nur für ausgewählte Signale |
| 24/7-Dienst (`server/scalpdesk-247.mjs`) | `checkPatterns` → `notifyPattern`; App-Weitergabe `POST /v1/patterns/notify` | `checkPatterns` → bewerten → **`gatePatterns`** → `notifyPattern`. App-Weitergabe nur mit bestandener Bewertung; der Dienst prüft dann Anti-Spam gemeinsam mit seinen eigenen Meldungen |

Kandidaten sind wie bisher frisch bestätigte Formationen: Ausbruch auf der letzten oder vorletzten abgeschlossenen Kerze, Regelgüte ≥ 80 %, Modell pat-1.

## 1. K.O.-Kriterien

Ein einziges nicht erfülltes Kriterium verhindert den Versand. Die Werte stehen für das Preset „Normal“.

- **Chance/Risiko ≥ 2,0**: (Ziel − Einstieg) ÷ (Einstieg − Ungültig). Einstieg ist der Schlusskurs der Ausbruchskerze.
- **Ausbruch bestätigt**: Status „Ausbruch …“ und Schlusskurs der Ausbruchskerze außerhalb der Musterlinie (`levels.brk`).
- **Signal höchstens 3 Kerzen alt**. Die Dienste prüfen ohnehin nur die letzten zwei abgeschlossenen Kerzen.
- **Kurs höchstens 50 % des Wegs zum Ziel gelaufen**: In der App zählt der Live-Kurs, sonst der letzte Schlusskurs.
- **Zielabstand ≥ 2,5 × ATR(14)** auf dem Signal-Zeitrahmen.
- **Zielabstand ≥ 3 × (Gebühren + Spread)**: Gebühren je Seite einstellbar (Spot 0,10 %, Futures 0,05 %), also zweimal pro Trade. Der Spread kommt aus Geld/Brief (`bookTicker`).
- **Liquidität**:
  - 24h-Volumen ≥ 5 Mio. USDT, gerechnet aus den Kerzen als Basisvolumen × Kurs.
  - Spread ≤ 0,10 %. Ist der Spread nicht abrufbar, wird er nicht bewertet; das Journal vermerkt es.
- **Trend**: Die Richtung muss zum nächsthöheren Zeitrahmen passen (5m→1h, 15m→1h, 1h→4h; außerdem 1m→15m, 3m→1h, 30m→4h, 2h→1d, 4h→1d, 1d→1w, 1w→1M).
  - Geprüft werden Kurs zur EMA 200 und Steigung der EMA 50 (über 5 Kerzen).
  - Zeigen beide gegen das Signal, ist es ein Gegentrend-Signal. Gegentrend-Signale sind standardmäßig aus; ein eigener Schalter erlaubt sie.

## 2. Signalscore 0–100

Mindestens 70 Punkte (einstellbar).

| Teil | Punkte | Regel |
|---|---|---|
| Chance/Risiko | 0–20 | linear: 1:1 = 0, **2:1 = 10, ab 3:1 = 20** |
| Trendausrichtung | 0–20 | nächsthöherer Zeitrahmen: je erfülltes Kriterium (EMA 200, Steigung EMA 50) 7 Punkte. Bei Altcoins kommt der BTC-Trend im selben Zeitrahmen dazu: je erfülltes Kriterium 3 Punkte. Bei BTC zählt der eigene Trend × 20/14. Unbekannt = halbe Punkte |
| Ausbruchsvolumen | 0–20 | Volumen der Ausbruchskerze ÷ Ø der 20 Kerzen davor: unter 1 → 0, bis 1,5 → bis 8, **ab 1,5 → 12**, ab 2,5 → 20 |
| Marktphase | 0–15 | Dreiecke, Keile, Wimpel, Rechteck: **Bollinger-Squeeze** vor dem Ausbruch (Bandbreite im untersten Fünftel der letzten 120 Kerzen = 15, im untersten Drittel = 8). Alle anderen Muster: **ADX(14) > 20** (ab 25 = 15, 20–25 = 10–15, darunter höchstens 5) |
| Regelgüte | 0–10 | gestreckt: 85 % = 0, 94 % = 6, 100 % = 10 (siehe unten) |
| Historische Trefferquote | 0–15 | je Muster und Zeitrahmen, erst ab **10 abgeschlossenen Fällen** (vorher neutral **7**): 30 % „Ziel erreicht“ = 0, 60 % = 15 |

Die Kurzbegründung für Telegram lautet zum Beispiel „Trend ✔ · Volumen ✔ · R/R 2,6“:
- ✔ beide Trendkriterien passen, ~ eins passt, ✖ Gegentrend, ? unbekannt;
- Volumen ✔ ab 1,5 × Durchschnitt.

### Regelgüte: Trennt sie?

Kaum. Die Regelgüte ist der Anteil erfüllter Regelgewichte (`quality()` in der Engine). Für einen Treffer müssen die Pflichtregeln erfüllt sein, also Geometrie und Ausbruch per Schlusskurs; bei bestätigten Ausbrüchen sind sie es immer. Schwanken können praktisch nur die Volumenregeln (erfüllt, nicht erfüllt oder ohne Volumen). Deshalb liegt die Regelgüte fast immer bei 88–100 %. Ein fester Schwellenwert (≥ 80 %) lässt dann nahezu jeden Ausbruch durch, und genau das verursachte die Flut.

Der Filter gibt ihr daher nur noch 10 Punkte und streckt den genutzten Bereich: 85 % = 0, 100 % = 10. Das echte Trennsignal Volumen bekommt eigene 20 Punkte.

## 3. Anti-Spam

Pro Prüflauf werden alle Kandidaten gemeinsam ausgewählt, der höchste Score zuerst.
- Gleiche Richtung, gleicher Coin, dieselbe Kerze: nur das Muster mit dem höchsten Score.
- Gegensätzliche Signale auf demselben Coin im selben Lauf oder gegen eine Meldung der letzten 60 Minuten: kein Versand.
- Je Coin und Zeitrahmen höchstens 1 Meldung je 60 Minuten.
- Insgesamt höchstens 3 Chartmuster-Meldungen je Stunde, inklusive der bereits gesendeten.

Alle Zeiten und Grenzen sind einstellbar.

## 4. Ergebnis-Tracking und Statistik

- Jedes bewertete Signal, gesendet oder gefiltert, kommt ins Journal. Gespeichert werden Zeit, Coin, Zeitrahmen, Muster, Richtung, Einstieg, Ziel, Ungültig, Score mit Teilpunkten, Kriterien, K.O.-Gründe, gesendet ja/nein und Filtergrund.
  - App: `scalpdesk.patsignals.v1`, die letzten 500, nur auf diesem Gerät.
  - Oracle-Musterdienst: `state.json` → `signals`.
  - 24/7-Dienst: Zustand → `patSignals`.
- Das Ergebnis wird automatisch mit späteren Kerzen bestimmt: **Ziel erreicht**, **Ungültig erreicht** (bei beiden in derselben Kerze zählt Ungültig) oder **Timeout nach 48 Kerzen**.
- Statistik je Muster, Zeitrahmen und Coin: Signale, gesendet, gefiltert, abgeschlossen, Ziel, Ungültig, Timeout, Trefferquote.
  - Die Trefferquote im Score nutzt nur abgeschlossene Fälle. Gesendete und gefilterte zählen gleich, weil beide echte Ausbrüche sind.
  - „Erlernt X/10“ in der Telegram-Meldung zählt wie bisher nur abgeschlossene Fälle.
- **Backtest** (App, Chartmuster-Fenster → „Telegram-Signale“ → „Backtest“): Walk-forward über die geladenen Kerzen von Coin und Zeitrahmen.
  - Je Kerze erkennt die Engine Muster nur mit Daten bis zu dieser Kerze.
  - Der höhere Zeitrahmen fließt nur bis zur Signalzeit ein; die Trefferquote nur aus Fällen, deren Ergebnis damals schon feststand.
  - Ausgabe: Tabelle je Score-Stufe, Trefferquote „würde senden“ gegenüber „gefiltert“ und die häufigsten Filtergründe.
  - Grenzen: Spread und 24h-Volumen wie heute; wenige Fälle ergeben unsichere Zahlen.

## 5. Anzeige und Einstellungen

- **Telegram**: Das bisherige Format bleibt (Pfeile, Sterne, Ziel fett, Chance/Risiko, Regelgüte, Erlernt). Neu ist die Zeile „🎯 Signalscore 78/100 · Trend ✔ · Volumen ✔ · R/R 2,6“ unter dem Status.
- **Gefilterte Signale** gehen nie an Telegram.
  - App: Chartmuster-Fenster (Knopf „KI“) → „Telegram-Signale · Qualitätsfilter“, mit Filtergrund, Kriterien, Ergebnis und Statistik.
  - Oracle-Musterdienst: Log-Zeilen „Chartmuster gefiltert: … – Grund“; Statistik mit `--statistik`, siehe [ORACLE_24-7.md](ORACLE_24-7.md).
  - 24/7-Dienst: Log und `GET /v1/patterns/signals`.
- **Einstellungen**: Telegram-Fenster → Ziel „Chartmuster“ → „Qualitätsfilter“. Presets **Streng / Normal / Locker**, alle Schwellen einzeln änderbar; dann „Eigene Werte“. Der Gegentrend-Schalter gilt in jedem Preset.
  - Die Schwellen gehen mit „Vorauswahl am Dienst übernehmen“ (24/7-Dienst) bzw. mit dem Export „Coin-Auswahl für Oracle“ (Feld `filter` in `scalpdesk-patterns-watch.json`) an den Server.
  - Ohne `filter` gilt am Server „Normal“.

| Preset | Score | R/R | Alter | Weg | ATR | Kosten | 24h-Vol. | Spread | je Coin/TF | gegensätzlich | je Stunde |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Streng | 80 | 2,5 | 2 | 35 % | 3 × | 4 × | 20 Mio. | 0,05 % | 90 Min. | 120 Min. | 2 |
| Normal | 70 | 2,0 | 3 | 50 % | 2,5 × | 3 × | 5 Mio. | 0,10 % | 60 Min. | 60 Min. | 3 |
| Locker | 60 | 1,8 | 4 | 65 % | 2 × | 2 × | 1 Mio. | 0,20 % | 30 Min. | 30 Min. | 5 |

## Prüfen

- `node tests/unit-pattern-quality.js` (33): alle K.O.-Kriterien, Score-Teile, Kurzbegründung, Regelgüte-Streckung, Trefferquote ab 10 Fällen, Anti-Spam (gleiche Richtung, gegensätzlich, Sperrzeit, Stundenlimit), Tracking, Statistik, Journal, Backtest. Enthält die drei Beispiele: Chance/Risiko 0,34 : 1; zwei Muster gleicher Richtung; Gegentrend.
- `node tests/unit-patterns-only.js` (20) und `node tests/unit-247e.js` (43): Filter in beiden Diensten, gefiltert nur Journal/Log, Scorezeile in der Meldung, App-Weitergabe nur mit Bewertung, Statistik-Endpunkt.
- `node tests/m102.js` (14): App mit Einstellungen, Presets, Journal, Telegram-Versand nur des besten Signals mit Scorezeile, Log im Chartmuster-Fenster, Tracking, Backtest.
