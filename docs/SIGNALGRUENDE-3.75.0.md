# Signalgründe · App 3.75.0

Ein Tipp auf einen Coin in der Vorauswahl öffnet das gemeinsame Detailfeld unter den Coins. Ein zweiter Tipp auf denselben Coin, × oder Esc schließt es. Ein anderer Coin wechselt den Inhalt. Die Bedienung gilt für Kacheln und Liste; Verschieben per langem Drücken bleibt erhalten.

Das gewählte Modell bestimmt die Erklärung:

- **Bisheriges Modell:** vier bestehende Regeln, unverändert mindestens drei gleichgerichtete Regeln für die bisherige Long-/Short-Tendenz. Zeitraumwahl bleibt im Kopf. Die bisherigen ausführlichen Indikator-Erklärungen und Chartmuster sind darunter separat aufklappbar.
- **Trend-Pullback 5/5 v2:** fünf bestehende Pflichtregeln auf geschlossenen 15m-/4h-Kerzen. Long/Short-Prüfung mit erfüllten/fehlenden Regeln, RSI-Verlauf, EMA-Werten, MACD-Richtung, Volumenvergleich, tatsächlichem Markt und Kerzenschlusszeiten. Unter 5/5 keine Freigabe. 5/5 ist Regelübereinstimmung, keine Gewinnwahrscheinlichkeit.

Long/Short im Detail ist ausschließlich die Ansicht der Prüfung, kein Wechsel des Modells und keine Order. Eine in der anderen Richtung bestehende Bestätigung wird ausdrücklich genannt. Pause, Offline, fehlende oder abgelaufene Kerzen zeigen unbekannte Zustände (–/4 bzw. –/5), niemals einen künstlichen Nullwert oder eine aktuelle Bestätigung.

Die Darstellung verwendet die bestehenden Regelentscheidungen. Zusätzliche Beobachtungswerte werden direkt bei derselben Modellprüfung aus denselben Kerzen mitgegeben. Es gibt keine zusätzlichen Kurshistorien-Anfragen, Parameteränderungen, neuen Speicherformate oder Telegram-Nachrichten. Die Modellkennungen, Backtest-Logik und Dienstversion 2.15.1 bleiben erhalten. Punkt 2 (Risikoübersicht) ist weiterhin nur ein früherer Entwurf.

## Prüfungen

497/497 gezielte Prüfungen in zwölf Läufen bestanden. Lint: 0 Fehler / 3 bestehende Warnungen. Zusätzlich isolierter Test des tatsächlichen Release-Bündels bei 320/390/768 px; keine Seitenfehler oder Telegram-Aufrufe.

- Reine Modell-/Darstellungstests: echte Long-/Short-OHLCV-Fixtures, jede Pflichtregel, 1,2×-Volumengrenze ohne irreführende Rundung, geschlossene 4h-Quelle, Datenlücken, Ablauf, Pause/Offline, ursprüngliche Vier-Regel-Ergebnisse und kausaler Backtest.
- Native App mit lokalen REST-/WSS-Attrappen: Auf-/Zuklappen, Coin-/Modellwechsel, Tastatur/Fokus, Richtungswahl, feste DOM-Knoten und stabile Höhe bei Live-Wechseln, beide Ansichten, keine zusätzlichen Historienabrufe.
- Chromium und zusätzliche Playwright-WebKit-Prüfung, 320/390/430/768/820 px, beide Farbschemata, keine seitlichen Überläufe, neue Buttons mindestens 44 px hoch. Physisches iPhone/iPad stand nicht zur Verfügung.
- Regressionen: Modellschalter/gepaarter Worker-Vergleich, Drag/Scroll/Reihenfolge, Prozentwerte/lange Preise, bisherige Detail-Erklärungen, Alarm-Navigation und Release-Prüfung. Kein echter Telegram-Versand.

## Kurzer Gerätetest

1. In der Vorauswahl einen Coin öffnen, denselben erneut antippen; × und einen anderen Coin prüfen.
2. Zwischen Kacheln und Liste wechseln und dort ebenso auf-/zuklappen; lang drücken und verschieben, normal scrollen.
3. Long und Short im Detail prüfen. Bei fehlender Regel muss klar sein, was fehlt.
4. In Einstellungen das bisherige Modell und das Testmodell wählen: vier bzw. fünf Gründe, keine automatische Modellumschaltung.
5. Pause/Offline prüfen, anschließend fortsetzen; bei veralteten Daten darf keine Bestätigung stehen bleiben.
6. iPhone/iPad hochkant: schließen und zum unteren Inhalt scrollen; keine abgeschnittenen Werte oder seitliche Bewegung.
