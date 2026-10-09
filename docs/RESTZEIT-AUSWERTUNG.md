# Restzeit und mobile Positionsauswertung – 3.58.0

Die aktuelle Minuten- und Stundenkarte zeigt unter „jetzt“ die Restlaufzeit `MM:SS` bis zum UTC-Kerzenschluss. Abgeschlossene Karten haben keinen Timer. Kopf und Karte verwenden dieselbe bestehende Zeitberechnung und denselben Sekundentakt. Die zehn vorhandenen Kerzenknoten bleiben erhalten; kein zusätzlicher Feed oder Timer.

Unter Positionen → Auswertung erscheinen die Gruppen ab „Nach Grund“ in schmalen Bereichen als gerahmte Karten. Trades, Trefferquote, Ø R und Netto einschließlich Durchschnitt sind direkt beschriftet. Lange Coinnamen und große Originalzahlen brechen innerhalb der Karte um. Positive/negative Balken stehen unter den Zahlen, ohne Text zu überdecken. Kleine Stichproben bleiben ausdrücklich „vorläufig“, ihre Werte sind ohne Deckkraftverlust lesbar. Auf größeren Flächen bleibt die vorhandene Spaltenansicht.

Die Monatsübersicht zeigt auf kleinen Displays ebenfalls beschriftete Monatskarten mit allen vorhandenen Werten und gesonderter Summe. Beide Layouts und alle Hintergrundmodi verwenden dieselben Elemente. Trades, Berechnungen, Gebühren, Datenquellen, Speicherung und die Grid-Strategie sind unverändert.

## Kurz prüfen

1. Chart → Kauf-/Verkaufsvolumen öffnen. In beiden letzten Karten steht „jetzt“ mit Restlaufzeit; die Kopfzeit stimmt überein. Nach Kerzenschluss beginnt die neue Minutenkarte bei `01:00`, die Stundenkarte bei `60:00`. Die Karten sollen beim Ticken nicht springen.
2. Positionen → Auswertung öffnen: „Nach Grund“, Gründe-Bereich, Coin, Long/Short, Einstiegszeit und Haltedauer prüfen. Auf dem iPhone stehen Beschriftungen über den Werten; kein Wert ragt rechts heraus. Lange Namen und große Zahlen bleiben vollständig.
3. Monatsübersicht weiter unten öffnen: Trades, Trefferquote, Netto, Kosten und Steuer-Rücklage sowie Summe prüfen. Mit dem Journal vergleichen; Werte ändern sich durch den Layoutwechsel nicht.
4. Ansicht zwischen Standard/Dashboard sowie Hell/Dunkel/eigenen Farben wechseln. Die Anzeige bleibt lesbar und ohne seitlichen Überlauf; Neuladen erhält alle Bücher.

Automatisiert: `m82.js` prüft Restzeit, Grenzwechsel, feste Knoten/Höhen, sechs Auswertungen und Monatswerte bei 320/390/768/1440 px in beiden Layouts, acht AA-Farben, große Zahlen/lange Namen und unveränderte Originalbücher nach Reload. Vorlauf **45/45**. Bestehende m79/m76/m48/m59/m52 und Release-Liefergraph vollständig grün, zusammen **318/318**; App-/Modul-/Dienst-/Generator-Lint 0 Fehler. Alle **138 Ziele** vollständig seriell, nach vollständigen dokumentierten Nachprüfungen **4431/4431**, Status/Rauch/Sicht grün. [Vollnachweis](RESTZEIT-AUSWERTUNG-TESTNACHWEIS.md) mit Erstlogs, Nachprüfungen und Produkt-/Testhashes. Echte Geräte-/Safari-Abnahme bleibt separat offen.
