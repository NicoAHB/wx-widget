# Relative Stärke: kompakte Coin-Liste

App 3.82.1. Unter **Chart → Analyse → Relative Stärke** bleibt eingeklappt ausschließlich die Modellkopfzeile mit Coin-Anzahl und den bisherigen Info-/Chart-Bedienelementen sichtbar. Der große Statusblock und die zusätzliche Rangliste in den Prüfungen entfallen für diese Auswahlhilfe.

Ein Tipp auf **Relative Stärke** klappt genau eine Coin-Liste auf oder zu. Je Coin stehen der Name, der Rang und die relative 4h-Veränderung gegenüber BTC. Die bisherigen Coin-Auswahlschalter bleiben platzsparend rechts; ausgeschlossene Coins lassen sich dort wieder aktivieren. Ein Coin-Name öffnet weiterhin dessen Chart mit dem Analysefokus. Der Klappzustand wird wie bisher gespeichert.

Die Rangfolge stammt unverändert aus der bestehenden Berechnung über normale geschlossene 1H-Kerzen. Neue Zeilen ohne aktuelle Vergleichsdaten zeigen einen Gedankenstrich statt eines geschätzten Rangs. Die Anzeige nutzt nur vorhandene Ergebnisse; keine zusätzlichen Börsenabfragen. Die fünf Handelsmodelle, Regeln, Telegram-Freigaben und der Dienst bleiben unverändert.

## Geänderte Stellen

- `shared/analysis-view.mjs`: kompakte Informationszeile; Rang und bestehende Coin-Auswahl in einer Liste zusammengeführt.
- `weather-widget-v2.html`: vorhandene Vergleichswerte an die Liste übergeben, ausschließlich dort kompaktere Styles; Touch-Ziele mindestens 44 px.
- App/SW und vollständiges Bündel 3.82.1, Dienst-Lieferliste mit unveränderter Dienstquelle 2.15.3. Alte Bündel bleiben erhalten.
- `tests/m135.js`: vorhandene Browserprüfung an die kompakte Liste angepasst; Auf-/Zuklappen, unveränderte Werte und fehlender Eingriff in den Chart-Fokus geprüft.

## Auf dem iPhone/iPad prüfen

1. App aktualisieren und „Relative Stärke“ mehrfach antippen: nur die Coin-Liste öffnet und schließt, ohne Chartwechsel.
2. Rang und 4h-Vergleich zu BTC prüfen, einen Coin öffnen sowie dessen Auswahlschalter aus- und wieder einschalten.
3. App neu öffnen: Klappzustand und Auswahl bleiben erhalten. Chart-Zeitrahmen und Heikin-Ashi ändern die festen Vergleichswerte nicht.

Automatische Browserprüfungen verwenden kontrollierte Börsen-/Telegram-Attrappen und ersetzen keinen Test auf einem physischen iPhone.
