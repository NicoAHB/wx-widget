# Eine Signalübersicht mit Info-Buttons · 3.75.1

Die frühere Bullish-/Bearish-Liste unter „Indikator-Erklärungen & Chartmuster“ ist entfernt. Beim Antippen eines Coins erscheint eine gemeinsame Prüfung des gewählten Modells: vier Regeln im bisherigen Modell, fünf im Trend-Pullback-Testmodell. Jede Regel hat ihren eigenen Info-Button. Die Erklärung öffnet sich innerhalb derselben Zeile und lässt sich erneut schließen. Ein zweites Antippen des Coins oder × schließt das gemeinsame Detailfeld.

## Verständliche Begriffe und Werte

- **Kurs zum EMA 20** ersetzt „Kursfilter“: letzter abgeschlossener Kurs im Vergleich zum geglätteten Durchschnitt. Beispiel: Schlusskurs 8,0600 über EMA 20 (8,0432). Im Testmodell entsprechend EMA 200 auf 15m.
- **Kursstärke (RSI 14):** „Vorher 53,43 → zuletzt 56,69 · gestiegen“. Die Zahl 14 steht für 14 Kerzen. Im bisherigen Modell zählt das für Long erst unter 30 und steigend; Short benötigt über 70 und fallend. Im Testmodell werden dessen bestehenden Pullback-Regeln erklärt.
- Identische RSI-Werte heißen „unverändert“. Verschiedene Rohwerte, die auf dieselben zwei Nachkommastellen gerundet werden, heißen „minimal gestiegen/gefallen (gerundet)“. In der Erklärung stehen genauere Vergleichswerte und der Hinweis auf die ungerundete Regelprüfung.
- **Kursschwung (MACD):** Vergleich mit seinem geglätteten 9er-Durchschnitt, der Signallinie. Die Erklärung nennt beide berechneten Werte und sagt ausdrücklich, dass die MACD-Signallinie im großen Kurschart dieser App derzeit nicht eingezeichnet ist. Im Testmodell werden die vorhandenen Histogrammwerte und deren Bedingung erklärt.

Das Chartmuster bleibt im bisherigen Modell einmal separat erreichbar. Lange Musternamen werden umgebrochen und vollständig angezeigt. Die zweite Gesamtbewertung und der doppelte Fußtext entfallen. Modellschalter, Regeln, Berechnungen, Zeitrahmen, Datenabrufe, Order-/Alarmfunktionen und Telegram-Versand ändern sich nicht. Punkt 2 (Risikoübersicht) bleibt ein Entwurf.

## Prüfung

522/522 gezielte Prüfungen in zwölf Läufen bestanden. Lint: 0 Fehler / 3 bekannte Warnungen. Zusätzlich isolierte Prüfung des tatsächlichen Release-Bündels bei 320/390/768 px ohne Seitenfehler oder Telegram-Aufrufe.

Native App-Tests prüfen eine einzige Regelübersicht, die konkrete RSI-Konstellation aus dem Screenshot, Long-/Short-/Neutralzustände, Info-Bedienung, aktualisierte Werte bei offener Erklärung, Esc/Fokus, Chartmuster, fehlende Daten und das Entfernen eines Coins. Weitere Prüfungen decken beide Ansichten, Modellwechsel und Backtest, Drag/Scroll, lange Preise, sechs Zeiträume, Darstellungseinstellungen sowie PWA-Update/Offline ab. Browser- und Telegram-Verbindungen der lokalen Tests verwenden ausschließlich Attrappen. Ein physisches iPhone/iPad ist nicht verfügbar; WebKit und Chromium werden auf Handy-/Tablet-Breiten geprüft.

Kurzer Gerätetest: Coin öffnen → jede Info antippen → erneut schließen → zwischen Kachel/Liste wechseln → Long/Short und beide Modelle prüfen. Bei Pause/Offline darf keine aktuelle Bestätigung bestehen bleiben. Es darf keine zweite Bullish-/Bearish-Liste erscheinen.
