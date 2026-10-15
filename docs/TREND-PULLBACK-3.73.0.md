# Trend-Pullback 5/5 · v2 – 3.73.0

Der Nutzer meldet null Trades im strengen 5/5-Vergleich und bestätigt die Überarbeitung zum Trend-Pullback-Modell mit weiterhin fünf Pflichtregeln. Der bisherige Vier-Regel-Ansatz bleibt unverändert und ist weiter der Standard. Die Journalkorrektur mit umrahmten Aktionen und nebeneinanderstehenden Antworten wurde davor als 3.72.1 veröffentlicht.

## Ursache und feste Regeln

V1 verlangte die RSI-Rückkehr aus dem Extrembereich und eine neue MACD-Kreuzung auf genau derselben 15m-Kerze, zusätzlich EMA200-Trend auf 4h/15m und mindestens doppeltes Volumen. Diese seltene Kombination führte auch in der geladenen Kontrollstichprobe zu null Freigaben. Null Trades sind kein Nachweis eines besseren Modells.

V2 trägt die Kennung `watch-strict-2`. Alle fünf Regeln müssen auf der aktuellen **abgeschlossenen** 15m-Kerze erfüllt sein; der Rücksetzer liegt davor. Die Regeln wurden vor dem Kontrolllauf festgelegt und anschließend nicht zur Verbesserung seines Gewinns verändert.

| Pflichtregel | Long | Short |
|---|---|---|
| Übergeordneter Trend | 4h-Schluss über steigender EMA 200 | 4h-Schluss unter fallender EMA 200 |
| Trading-Zeitrahmen | 15m-Schluss über EMA 200 | 15m-Schluss unter EMA 200 |
| RSI 14 · Rücksetzer und Erholung | Unter den acht **vorherigen** 15m-Kerzen mindestens ein RSI ≤45; aktuell RSI >50 und <70 sowie steigend zur Vorperiode | Vorher mindestens ein RSI ≥55; aktuell RSI <50 und >30 sowie fallend |
| MACD 12/26/9 · Momentum | Linie über Signal und Histogramm höher als davor | Linie unter Signal und Histogramm niedriger als davor |
| Volumen | mindestens 1,2 × Durchschnitt der 20 **vorherigen** 15m-Kerzen | gleich |

Damit bestätigen RSI und MACD eine Erholung in Trendrichtung. Zwei frische Kreuzungen auf derselben Kerze sind nicht mehr nötig. Der acht Kerzen lange Rücksetzerkontext umfasst zwei Stunden. Die aktuelle Kerze geht weder in diesen Rücksetzerkontext noch in die Volumenbasis ein. Unverändert: ausschließlich bereits abgeschlossene 4h-Kerzen zum jeweiligen Entscheidungszeitpunkt, maximal 500 Kerzen je Ebene, mindestens 300 Kerzen Vorlauf und Sperre bei ungültigen/lückenhaften/veralteten oder marktgemischten Daten. Pause, Offline und reduzierte Bewegung funktionieren wie bisher. Blinken nur bei vollständigen 5/5; dies bezeichnet Regelübereinstimmung, keine bekannte Trefferwahrscheinlichkeit.

## Bedienung, Ergebnisse und Diagnose

Unter **Einstellungen → Vorauswahl · Modelltest** heißt der Testschalter jetzt „Trend-Pullback 5/5 testen“. Die gespeicherte Auswahl bleibt erhalten; Bisherig lässt sich jederzeit wieder einschalten. Zeitraumfelder und bestehende Ausführungsannahmen gelten weiter gemeinsam für beide Vergleichsmodelle.

**Für v2 einen neuen Vergleich starten.** Vorhandene Berichte von v1 werden unverändert wiederhergestellt, als „Streng 5/5 · v1 (alt)“ beschriftet und bleiben herunterladbar. Ein deutlicher Hinweis unterscheidet den alten Lauf vom jetzt verfügbaren v2-Modell. Er wird nicht nachträglich als v2-Ergebnis ausgegeben. Neue Ergebnisse tragen v2 in Modellkennung und Anzeige.

Die Ergebnisansicht zählt zusätzlich Signal-Kerzen. Unter „Filterdiagnose · Was begrenzt die Einstiege?“ stehen für jede Pflichtregel Long-/Short-Treffer und deren Anteil an den gemeinsamen 15m-Entscheidungen. Eine weitere Zeile zählt alle fünf gleichzeitig. Diese Zahlen enthalten auch Kerzen während laufender Trades und sind deshalb keine Anzahl ausgeführter Trades. Fehlende alte Diagnosen verlangen einen neuen Lauf, statt Werte zu erfinden. Bei null abgeschlossenen Testtrades erklärt die Anzeige offene/wartende Fälle bzw. fehlende Freigaben und behauptet keinen Modellvorteil.

Ein-/Ausstiegsmodell, Gebühren, Slippage, ATR-Stop, Ziel, Timeout, konservative Intrabar-Behandlung, R-Definition und Ausschluss fehlender Coins für beide Modelle bleiben identisch. Die neue Logik erzeugt keine echten Orders oder zusätzlichen Telegram-Nachrichten; sie betrifft die Vorauswahl und ihren Simulator.

## Geladene Kontrollstichprobe

Binance Spot, 15.09.2026 18:00 UTC bis 15.10.2026 18:00 UTC, BTC / ETC / BCH / LTC / XRP / NEAR / DOT. Je Coin 3.380 geschlossene 15m-Kerzen und 680 geschlossene 4h-Kerzen einschließlich Vorlauf. Gleiche Kosten/Stops/Ziele wie im App-Standard (0,05 % Gebühr und 0,02 % Slippage je Seite; Stop 1,5 ATR; Zielabstand 2 × Stopabstand; höchstens 16 Kerzen).

- V1: **0** abgeschlossene Trades.
- V2: **191** abgeschlossene Trades, netto **−3,66 R** nach den modellierten Kosten.
- Bisherig: **1.498** abgeschlossene Trades. Das vollständige Bisherig-Ergebnis einschließlich jeder Buchung stimmt bei allen sieben Coins exakt mit dem unveränderten alten Kern überein (Deep-Equality-Prüfung).

Die Stichprobe prüft, ob die überarbeiteten Regeln tatsächlich Einstiege zulassen und der Vergleich unverändert fair rechnet. Sie ist kein Beleg künftiger Profitabilität; das v2-Netto ist in diesem Lauf negativ. Es wurden keine Regelparameter nachträglich auf einen positiven Gewinn angepasst. Die ausgewählten heutigen Coins bilden keine vollständige historische Marktpopulation ab. [Ergebnisse, Filterzahlen, Zeitfenster, Kosten und Quelldaten-Hashes](TREND-PULLBACK-3.73.0-STICHPROBE.json).

## Validierung und Auslieferung

Erweiterte Fachtests prüfen jede einzeln fehlende Pflichtregel, die RSI-Grenzen und das exakte acht Kerzen lange Fenster, MACD-Bestätigung ohne frische Kreuzung, nachlassendes Momentum, den inklusiven 1,2×-Volumenrand, Frische, Markt, Lücken, Kosten, offene Fälle, Abbruch und Zukunftsunabhängigkeit. Diagnosezähler werden gemeinsam mit den Signalen geprüft. Native Browserprüfung: aktuelle v2-Berechnung im tatsächlichen Worker, Blinken, Filter, Rückwechsel, Neustart, Download/Abbruch, verständliche Null-Fälle, aufgeklappte Diagnose ohne Überlauf bei 320/390/768/1440 px sowie unveränderte v1-Berichte nach Neustart.

Zusätzlich serielle Nachprüfung der betroffenen bestehenden Vorauswahl-, Touch-, Journal-, Sicherungs-, Navigations- und PWA-/Offline-Wege. Kein echter Telegram-Versand. Der ältere vollständige Gesamtlauf bleibt 3.71.1 zugeordnet; alle **499/499 Einzelprüfungen** in zwölf Programmen bestanden, Lint 0 Fehler/3 bekannte Warnungen und reproduzierbarer Release-Abgleich; der genaue Umfang steht im [Testnachweis](TREND-PULLBACK-3.73.0-TESTS.json). Isolierte Vorabprüfung bei 320/390 px bestanden: v2-Umschalten/Neustart, erhaltener und beschrifteter v1-Bericht, Rückwechsel auf Bisherig sowie umrahmte Journalaktionen/Ja und Nein nebeneinander, keine JavaScript-Fehler. Öffentlicher Hash-/Browsernachweis im Release-PR. Echte iPhone/Safari-Kontrolle bleibt separat offen.

App und Service Worker 3.73.0 mit eigenem Bündel (86 PWA-Dateien); alte Bündel bleiben unverändert. Dienstlogik und Version 2.15.0 bleiben erhalten.

## iPhone-Kontrolle

- Version 3.73.0 neu laden; Einstellungen → Vorauswahl · Modelltest zeigt Trend-Pullback v2.
- Alten gespeicherten 0-Trades-Lauf ansehen: v1 ist ausdrücklich als alt markiert. Für v2 „Vergleich starten“ drücken.
- Neue v2-Kennung, Signal-Kerzen und Filterdiagnose prüfen; Download, Neustart und Rückwechsel auf Bisherig testen.
- Vorauswahl in Liste und Raster öffnen; 5/5-Details passen zu den beschriebenen Regeln, Pause/Offline sperren das Blinken.
- Journal: umrahmte Aktionszeile und nebeneinanderstehende Ja/Nein-Antworten bleiben erhalten.
