# Top-Down und NY Open lernen lokal mit · 3.81.0

Unter **Analyse → beim jeweiligen Modell „ⓘ Lernstand“** stehen jetzt getrennte Lernstände für Top-Down und NY Open Killzone. Die vorhandene Rücksetzer-Analyse bleibt erhalten und verwendet denselben herausgelösten logistischen Lernkern.

## Was automatisch gelernt wird

- Bestätigte Signale der freigegebenen Vorauswahl-Coins werden in der aktiven App auch bei ausgeschaltetem Analyse-Telegram protokolliert. Laufende Kerzen und Heikin-Ashi fließen nicht ein. Coin-Liste, Chart-Fokus, bekannte Blinkereignisse und alle drei Versandfreigaben bleiben erhalten.
- Merkmale zum Einstieg werden eingefroren: CRV, Stop-/ATR-Abstand, Zonenbreite, Abstand des Einstiegs zur Zone, Konfluenz, RSI/MACD soweit vorhanden, relatives Volumen, Coin, Richtung, Markt und Uhrzeit. NY zusätzlich Opening Range, Ausbruchskörper und FVG-Größe. Fehlende Werte haben eine eigene Fehlwert-Kennung.
- Top-Down beobachtet Ziel 1 vor dem ursprünglichen Stop für maximal 24 Stunden. Ziel 2 wird getrennt weiterbeobachtet. Ein Zeitablauf ist kein Zieltreffer. NY verwendet seine bestehende Zwei-Stunden-Beobachtung und vergleicht denselben Verlauf mit festem Stop sowie Stop auf Einstieg ab 1R. Offene Zwei-Stunden-Fälle und nicht ausgeführte Limits bleiben zensiert und zählen nicht als Verlust.
- Bei unbekannter Reihenfolge innerhalb einer Kerze hat der Stop Vorrang. Ergebnislücken werden ausgewiesen. Bereits protokollierte Setups und die Top-Down-Sperrzeit werden nicht mehrfach als neue Beispiele gezählt. Der ursprüngliche Signalversand bleibt auch bei einem Fehler des Lernspeichers verfügbar.

## Wann Prozentwerte erscheinen

Mindestens **100 auswertbare Abschlüsse je Analyse/NY-Optionskombination**, genügend Gewinne und Verluste, zeitliche Trennung **70 % Training / 30 % Prüfung** und ein besserer Brier-Fehler als die konstante Trainings-Trefferquote sind erforderlich. Trainings-Ergebnisse, die erst während des Prüffensters bekannt wurden, werden entfernt. Skalierung ausschließlich aus Trainingsdaten. Ergebnisse, die zum Trainingszeitpunkt noch nicht bekannt waren, sind ausgeschlossen.

Vorher steht **„Lernphase (x/100)“**. Nach jeweils **20 weiteren Abschlüssen** wird erneut geprüft. Eine schlechtere neue Version ersetzt eine weiterhin geeignete alte Version nicht. Die fünf letzten Kandidaten und getrennte NY-Optionsmodelle bleiben gespeichert. Ein Optionswechsel vermischt keine Daten und löscht das bisherige Modell der anderen Kombination nicht.

Die Wahrscheinlichkeit und gegebenenfalls die mittlere historische Zieldauer stehen beim bestätigten Signal im Analyse-Menü, in der Chart-Erklärung sowie auf dem bestehenden Telegram-Foto und in dessen kurzer Bildunterschrift. Die Prognose wird zum Einstieg eingefroren. Ein später trainiertes Modell schreibt historischen Signalen keine nachträgliche Prognose zu.

Die NY-Prozentzahl bezieht sich auf abgeschlossene Ziel-/Stop-Fälle; sie ist keine unbedingte Chance, innerhalb von zwei Stunden das Ziel zu erreichen. Ein bestandener Test ist kein Profitabilitätsnachweis.

## Einstiege, Kauf-/Verkaufszonen und Ausstiege verbessern

Der Lernstand zeigt die tatsächlichen Ergebnisse pro Coin, netto nach den zentralen Kostenannahmen, und wöchentliche beschreibende Gruppenvergleiche: Long/Short, CRV, Einstieg nahe/weit von der Zone, Zonenbreite, Order Blocks, FVG, Supply/Demand, Konfluenz und NY-Ausbruchsstärke. Zu kleine Gruppen werden nicht ausgewertet. Top-Down zeigt Ziel 1 und Ziel 2 getrennt, NY vergleicht beide Stopvarianten.

**Feste Einstiegskriterien, Zonen, Stop-/Zielmarken und Telegram-Freigaben werden nicht automatisch umgeschrieben.** Die Gruppen sind Prüfvorschläge; daraus folgt keine automatische Handelsfreigabe. So bleiben Änderungen nachvollziehbar und können gezielt getestet werden.

## Historische Startdaten und Sicherung

**„Lerndaten ergänzen · 60 Tage“** im Lernstand startet einen historischen Lauf für die aktuelle Vorauswahl. Der bestehende NY-Backtest übernimmt seine Ergebnisse ebenfalls in den Lernstand. Beide verwenden den vorhandenen begrenzten Historienclient und Cache; keine Telegram-Nachrichten beim Test. Top-Down scannt im Modul-Worker, speichert vollständige Coin-Ergebnisse und lässt sich pausieren. NY lädt weiterhin nur die benötigten Sitzungsfenster plus Vorlauf und Ergebnisfenster. Fehlende Marktdaten werden als Fehler ausgewiesen, nicht als vollständig geprüfter Coin.

Lerndaten, Modellversionen und Ergebnisse liegen lokal in IndexedDB und sind in der vorhandenen Datensicherung und dem verschlüsselten GitHub-Abgleich enthalten. Es werden keine neuen Telegram-Ziele, Tokens oder Sendesperren in die Sicherung aufgenommen. Ältere Sicherungen ohne Lernstand bleiben lesbar.

**Der bestehende private 24/7-Dienst führt diese Analysen und Lernmodelle noch nicht aus.** Das Lernen und der Analyseversand arbeiten derzeit aus der geöffneten, aktiven App. Ein Update des Dienstes allein aktiviert dafür keinen neuen Hintergrundbetrieb.

## Umsetzung und Dateien

1. Gemeinsames Lernen/Ergebnisse: `signal-learning.mjs`, `analysis-learning.mjs`, `analysis-learning-features.mjs`, `analysis-learning-feed.mjs`; alte Regression in `trend-pullback-learning.mjs` wiederverwendet. Top-Down/NY liefern zusätzliche Merkmale; Regeln und Marken unverändert.
2. Historie/Worker: `analysis-learning-history.mjs`, `analysis-learning-worker.mjs`; vorhandener `runNyBacktest`, Historiencache und Worker-Lebenszyklus wiederverwendet.
3. Menü/Prognosen: `analysis-learning-view.mjs`, Katalog/View, bestehende Bildkarte und Chart-Infos. In `weather-widget-v2.html`: Datenquelle, Speicherung, Sicherung, Sync und Workerbindung.
4. Release: App/SW **3.81.0**, vollständiges PWA-Bündel und Installer-Lieferliste. Dienstcode unverändert **2.15.2**, alte Bündel unverändert.

## Handy-/Tablet-Test

1. App aktualisieren, Analyse öffnen. Beide neuen „ⓘ Lernstand“-Knöpfe öffnen das richtige Modell. Coin-Aufklapper, Fokus und Telegram-Schalter dürfen dabei nicht wechseln.
2. Ohne historische Daten erscheint Lernphase. Ein bestätigtes Signal protokolliert seinen Einstieg genau einmal, auch bei Reload und ausgeschaltetem Telegram.
3. Lernstand auf 320/390px sowie Tablet-Hochformat prüfen: scrollbarer Dialog, keine abgeschnittenen Texte, mindestens 44px hohe Aktionen. Mehrere Live-Updates dürfen keine zusätzlichen Prognosefelder anhängen.
4. Historische Lerndaten ergänzen, pausieren, Datenfehler und Fälle pro Coin prüfen. NY-Option ändern: eigener Lernstand; zurückschalten erhält das frühere Modell.
5. Ziel-/Stop-Verlauf im Protokoll prüfen, Datensicherung erstellen und wieder einlesen. Historische Signale dürfen keine nachträgliche Prozentzahl bekommen.
6. Telegram-Testkarte nur bei Bedarf bewusst auslösen; bestehende Chats/Token und Kursalarme bleiben erhalten.

Automatisierte Fach-/Browserergebnisse: `ANALYSE-LERNEN-3.81.0-TESTS.json`. Kontrollierte Testdaten belegen technische Eigenschaften, keine Marktprofitabilität und keine Prüfung auf einem physischen iPhone/iPad.
