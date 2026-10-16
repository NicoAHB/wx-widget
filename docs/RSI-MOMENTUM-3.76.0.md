# RSI-Momentum · App 3.76.0

Das bisherige Vier-Regel-Modell erhält einen zusätzlichen Weg zum **RSI-Long-Punkt**. Die bisherige Erholung unter 30 bleibt erhalten. Ein ungewöhnlich starker positiver RSI-Anstieg kann jetzt auch oberhalb von 30 zählen. Trend-, Kurs- und MACD-Regeln sowie die bestehenden Schwellen der Gesamtbewertung bleiben unverändert. Das Trend-Pullback-5/5-Testmodell erhält diese Ergänzung nicht und bleibt als Vergleich unverändert.

## Berechnung

Für die aktuelle abgeschlossene Kerze t:

```text
Δt = RSI(t) − RSI(t−1)
μ20 = Mittelwert der letzten 20 Δ-Werte, einschließlich Δt
σ20 = sqrt(Summe((Δi − μ20)²) / 20)
MomentumLong = Δt > 0 UND Δt > μ20 + 2 × σ20
RSILong = (RSI(t) < 30 UND RSI(t) > RSI(t−1)) ODER MomentumLong
```

Die zusätzliche Forderung Δt > 0 wurde vom Nutzer ausdrücklich bestätigt. Sie verhindert Long durch einen lediglich weniger stark fallenden RSI bei negativem Durchschnitt. Der Vergleich ist strikt größer, verwendet ungerundete Werte und die Populations-Standardabweichung (ddof=0). Eine Gleichheit reicht nicht. Für 20 Veränderungen sind 21 gültige RSI-Werte nötig. Fehlende Werte werden nicht mit null ersetzt. Ohne ausreichende Statistik bleibt der neue Momentum-Weg gesperrt; die bestehende Erholungsregel arbeitet weiter. Die Short-Regel (RSI über 70 und fallend) bleibt unverändert; es gibt keinen zusätzlichen Short-Momentum-Trigger. Wenn Erholung und Momentum gleichzeitig passen, zählt der RSI weiterhin nur einmal (+1).

## Integration und Versionsbindung

- Gemeinsame reine Berechnung in `shared/rsi-momentum.mjs`, genutzt von der Signalübersicht und dem Modellkern des Worker-Backtests. Vorhandene geschlossene Kerzen reichen aus; keine zusätzlichen Datenabrufe oder Orders.
- Die aufklappbare RSI-Info zeigt zusätzlich ΔRSI, Mittelwert, σ, Schwelle und Ergebnis des Momentum-Triggers. Die Regeldefinition steht auch in der Signalübersicht und den Modelleinstellungen.
- Das Standardmodell hat die neue Kennung `watch-classic-2` und heißt „Standard + RSI-Momentum · v2“. `watch-strict-2` bleibt unverändert. Der bestehende Modellschalter und die Zeitraumwahl bleiben erhalten.
- Alte gespeicherte Vergleiche mit `watch-classic-1` bleiben unverändert lesbar, als „ohne Momentum“ gekennzeichnet und ihren damaligen Regeln zugeordnet. Neue Vergleiche rechnen mit der neuen Standardregel. Ein neuer Lauf ist ausdrücklich erforderlich; alte Ergebnisse werden nicht neu etikettiert oder automatisch überschrieben.
- App/SW 3.76.0, Dienstquellstand 2.15.1 unverändert. Ältere Release-Bündel bleiben unverändert. Die separate Risikoübersicht aus Punkt 2 bleibt ein früherer Entwurf.

## Prüfung und Gerätetest

583/583 gezielte Prüfungen in 15 Läufen bestanden. Lint 0 Fehler / 3 bekannte Warnungen. Isolierte Prüfung des tatsächlichen Release-Bündels einschließlich Momentum-Mathematik und mobiler Bedienung bestanden.

Geprüft werden Handrechnungen für Mittelwert/σ, die exakte Gleichheitsgrenze, Nullvarianz, positiver Zusatzfilter bei negativer Vergleichsschwelle, fehlende/ungültige Werte, vorhandene Long-/Short-Fälle, keine doppelte RSI-Gewichtung sowie 500 weitere deterministische OHLCV-Fälle. Native App-Tests laden echte OHLCV-Fixtures über die lokale Börsenattrappe und vergleichen Signalübersicht, Vorauswahl und alte Modellrechnung. Offene Kerzen dürfen keinen neuen bestätigten Trigger erzeugen. Modellvergleich, historische Versionen, beide Ansichten, Info-Bedienung, Drag/Scroll, lange Preise und PWA-Update/Offline werden zusätzlich geprüft. Ein physisches iPhone/iPad ist nicht verfügbar; die Browserprüfung verwendet Chromium und WebKit auf Handy-/Tablet-Breiten.

Auf dem Gerät: Standardmodell wählen → Coin öffnen → RSI-Info antippen → ΔRSI und Schwelle vergleichen → Liste/Kacheln wechseln → bei Bedarf einen neuen Modellvergleich starten. Im Trend-Pullback-Testmodus gelten weiterhin dessen fünf bisherigen Pflichtregeln.
