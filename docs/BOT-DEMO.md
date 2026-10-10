# Lokale KI-Handelsdemo · 3.61.0

Unter **Analysen → Trading-Bot** (oder dem Bot-Knopf beim Chart) stehen Status, eigener Demokurs, Ergebnis, offene Positionen und Abschlüsse zusammen. „Demo einrichten“ ist zunächst geschlossen. Strategie, eigene Übungsbasis, Exposition und Stoprisiko wählen; „Übungswerte einsetzen“ füllt nur leere Geldfelder. Fehlende Eingaben werden mit ihrem Feldnamen gemeldet. Kosten sind editierbar. Anschließend bewusst **Demo starten**.

Ein neuer Lauf verwendet genau den Coin der Vorauswahl. Ein vorhandener Lauf bleibt beim ursprünglichen Coin; „Auswahl“ und „Lauf“ zeigen beide ausdrücklich. Verfügbare Demo-Kurse sind öffentliche **Bitget USDT-Futures**. Die manuelle Orderflow-Übung nimmt dagegen unverändert den angezeigten Markt/Kurs der Vorauswahl (Spot oder Futures). Beide sind mit ihrer Quelle gekennzeichnet.

**Grün „Demo läuft“** bedeutet: eigener aktiver Executor, frischer passender Kurs und verfügbare Modelldaten. Bei fehlenden Daten pausieren Einstiege; es werden keine Ersatzkurse oder Trades erfunden. In der Live-Karte stehen Coin/Richtung, Einstieg, Kurs, Ergebnis, ROE mit Hebel, Stop, Ziel, Größe und Beginn. Die Karte bleibt beim Aktualisieren dieselbe. Abschlüsse und Grid-Limits sind klappbar. **Demo beenden** ist rot; mit frischem Kurs schließt es eigene Modellpositionen. Ohne frischen Kurs bleibt Restbestand sichtbar erhalten. Reload startet niemals automatisch; vorhandenen Lauf bewusst fortsetzen.

Die früheren Knöpfe für selbst eingegebene Snapshots, Oracle-Laufschutz und Modell-Export sind unter **Demo einrichten → Erweiterte manuelle Modellprüfung** weiterhin verfügbar. Diese Prüfung hat keinen privaten Börsenexecutor.

## Strategien und Modellgrenzen

- **Konfluenz:** vorhandenes cf-2-Modell und KI-Einstellungen, mindestens 70 Punkte. Aktueller Kursplan und ursprünglicher Nettofilter werden vor dem Fill erneut geprüft. Eigene Exposition/Risiko/Margin und Bitget-Mindestmengen begrenzen die abgerundete Menge.
- **Power of Three:** vorhandenes po3-1/G10-Profil, eigener öffentlicher Scanner für Sweep, Retest und Impuls. Nur nach Laufbeginn verfügbare Signale. Vollständiger Abschluss am tatsächlichen TP1 des ursprünglichen Zielarrays. Limits warten auf eine spätere passende Kursberührung; keine rückwirkenden Wunschfills.
- **Adaptive AI-Grid:** unveränderte 14-Tage-/15m-/BB-/ATR-/RSI-Regeln, nur eigene Longs. Limits werden erst durch eine spätere Quote gefüllt. Dump stoppt Nachkäufe gemäß gewählter Pausen-/Schließregel; bekannte Stops bleiben vorrangig. Pump wird vor TP-Ausführung bewertet und kann Verkäufe für Trendbegleitung pausieren. Geschlossene Historie wird je Viertelstunde wiederverwendet, Quote/Volumen separat aktualisiert.

Das Ergebnis berücksichtigt modellierte Gebühren und Slippage. **Funding ist ausdrücklich ein Szenario:** beim Einstieg bekannte Rate und Takt bleiben bis zum modellierten Abschluss konstant; spätere echte Abrechnungen sind unbekannt. Stoplücken schließen zum beobachteten verfügbaren Kurs. Reihenfolge, Orderbuch-Fills, Marginverbrauch und Liquidation einer echten Börse sind dadurch nicht bewiesen. Keine belegte Profitabilität; bei fehlendem Setup darf die Demo ohne Trade laufen.

Das eingestellte Stoprisiko ist in der Handelsdemo ein gemeinsames Budget aller offenen Positionen. Exposition und verfügbare Modell-Margin begrenzen die Größe zusätzlich. Funding und Kontraktraster müssen zum Coin des Laufs gehören; fremde Daten erlauben keinen Einstieg.

Der Executor läuft nur bei sichtbarer, fortgesetzter App mit verfügbaren Daten. Er läuft nicht bei geschlossener App. Ein WebLock verhindert zwei Executor-Tabs desselben Geräts. Ein eigenes IDB-Buch bestätigt jeden Stand vor Anzeige; Epochennummern und Revisionsvergleich verwerfen verspätete Antworten. Speicherfehler stoppen den Lauf. Signalarchive, persönliche Positionen/Trades und der Oracle-Dienst werden nicht beschrieben.

## Demo löschen und Sicherung

**Demo-Trade-Daten löschen** löscht nach Beenden und eigener Bestätigung nur das Bot-Demo-Buch. In **Orderflow → Demo üben** löscht **Orderflow-Demo-Daten löschen** nach Bestätigung nur diese Übungen aller Coins. Persönliche Positionen, eigene DEMO-Bücher aus dem Positionsformular, KI-Originalarchive und die jeweils andere Demo bleiben erhalten.

Neue persönliche Sicherungen enthalten **keine Übungstrades**: Bot-Buch, Orderflow-Buch und persönliche DEMO-Positionen/-Historie bleiben lokal. Auch Demo-Kontexte in exportierter Orderflow-Positionsbegleitung und Signaljournal werden ausgefiltert; der lokale Originalbestand bleibt stehen. Datei, Textcode, QR/kompakte Datei, Teilen und Telegram verwenden denselben bereinigten Payload. Reine Demoänderungen lösen keine automatische persönliche Sicherung aus. Schema-8-Demofelder bleiben für ältere Leser leer. Alte Sicherungen mit Demo-Einträgen bleiben bewusst importierbar.

## Prüfen

1. Chart-Coin wählen, Bot öffnen und Einrichtung ausklappen. Leere Geldfelder verhindern einen Start; eigene Werte bzw. Übungswerte eintragen.
2. Konfluenz/PO3 wählen und starten. Auf ein geprüftes Setup warten; Grund erscheint im Panel. Grün und Livekarte prüfen. Coin wechseln: alter Lauf bleibt eindeutig beim alten Coin. Beenden, neuen Lauf starten: jetzt gilt die neue Vorauswahl.
3. Grid wählen, Kapital eintragen und starten. Die Limits aufklappen; tatsächliche spätere Berührungen erzeugen Positionen. Beenden schließt bei verfügbarem Kurs eigene Positionen und hält neue Trades an.
4. Zweiten Tab öffnen: kein Autostart; Fortsetzen während des ersten Laufs wird abgelehnt. Reload erhält Bestand, führt aber erst nach bewusstem Fortsetzen weiter.
5. Nach Beenden Demo löschen und Abbrechen/Bestätigen prüfen. Persönliche Positionen bleiben erhalten. Eine neue persönliche Sicherung enthält keine Demo-Trades.
6. Auf iPhonebreite alle Beschriftungen prüfen; Chart/Analysen-Vorauswahl klappen. Bereichsauswahl scrollt mit der Seite weg, „Einstellungen“ passt vollständig. Verbindungsdetails erscheinen erst beim Antippen des farbigen Punktes.

Automatisierte Prüfungen: `unit-paper-bot`, `unit-paper-controller`, `unit-paper-worker`, `m85`, `m86`, aktualisierte m50/m68/m76/m79/m80/m81/m84 sowie vollständiger serieller Release. Reale Safari-/iPhone-/iPad-/Browser-CORS- und private VM-Abnahmen bleiben getrennt; keine privaten Börsenorders oder VM-Änderung.
