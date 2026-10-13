# Muster-Bot: Hammer, Engulfing, Konfluenz und Power of Three

Unter **Analysen → Muster-Bot · Kerzenmuster, Konfluenz & PO3 · nur Übung** das Panel aufklappen. Es verwendet den im Chart geladenen Coin und dessen öffentlichen Binance-Spot-/Futures-Markt. Keine echten Orders, keine Schlüssel. Persönliche Bücher und andere Funktionen bleiben getrennt.

**Seit 3.68.0:** Konfluenz und Power of Three (vorher Teil der entfernten KI-Signale) sind als weitere Modelle wählbar, beide auch **Short**. Neu sind außerdem ein **Hebel** mit modellierter Liquidation, die Wahl der Positionsgröße (Risiko oder Einsatz) und ein verständliches Telegram-Feld.

## Modelle

Jedes Feld und jede Ergebnisspalte hat einen antippbaren **i**-Button mit Erklärung und Beispiel. Unter der Modellauswahl steht eine Kurzbeschreibung des gewählten Modells. **X**, Escape oder Tippen daneben schließen das Popup.

| Modell | Chartmarke | Richtung | Einstieg |
|---|---|---|---|
| Hammer | H | Long | Sofort, Buy-Stop oder Schlusskurs |
| Bullish Engulfing | E | Long | Sofort, Buy-Stop oder Schlusskurs |
| Hammer + Engulfing | H/E | Long | je Muster eigener Modus |
| Konfluenz | K | Long und Short | nächste Öffnung |
| Power of Three | P | Long und Short | nächste Öffnung |

Long-Marken stehen grün unter der Kerze, Short-Marken rot über der Kerze. Kontext sind immer abgeschlossene 4h-Kerzen.

### Hammer und Engulfing (unverändert)

Startwerte: 1.000 USD Übungskapital, 1 % geplantes Stop-Risiko pro Trade, 0,05 % Gebühr je Kauf/Verkauf, 15m-Musterkerzen und 90 Tage Historie. 4h-Kontext: tiefstes Tief der letzten 20 Kerzen, ATR(14), optional Kurs über EMA50.

- Hammer: Körper höchstens 35 % der Spanne, unterer Docht mindestens 60 % und mindestens doppelt so lang wie der Körper, oberer Docht höchstens 15 %, Spanne mindestens 0,5 × Muster-ATR. Ein passender Dragonfly-Doji zählt ebenfalls.
- Engulfing: rote Vorgängerkerze, grüne Musterkerze, vollständig umschlossener Vorgängerkörper, eigener Körper mindestens 0,5 × Muster-ATR. Das tiefere Tief beider Kerzen ist das Muster-Tief.
- „Hammer + Engulfing“: das erste passende Muster; bei gleichzeitigem Treffer Hammer samt Hammer-Einstiegsmodus. Muster-Tief höchstens 0,5 × 4h-ATR über dem Support. Volumen größer als SMA(20).
- Sofort: nächste Öffnung. Buy-Stop: Hoch + 0,05 × Muster-ATR, standardmäßig eine Folgekerze gültig. Schlusskurs: die nächste Kerze muss über dem Hoch schließen; Einstieg erst an der folgenden Öffnung.
- Stop: Muster-Tief − 0,1 × Muster-ATR; Ziel: Einstieg + 2 × Risikoabstand.

Signal-IDs von Hammer/Engulfing sind unverändert; laufende Demos und gesendete Meldungen bleiben gültig.

### Konfluenz (K)

Übernommen aus dem Konfluenz-Score der früheren KI-Signale, jetzt auf den Binance-Kerzen des Charts. Jede abgeschlossene Musterkerze erhält Punkte:

- **Trend 25:** Kurs > EMA 50 > EMA 200 (Short: umgekehrt) auf der Musterebene und auf 4h; nur auf der Musterebene 10 Punkte.
- **Zone 20:** Kurs höchstens 0,5 ATR an EMA 50, einem bestätigten Swing-Hoch/-Tief oder Fib 61,8 % auf der richtigen Seite.
- **RSI 15** (+5 bei Divergenz): Long 30–45 und steigend, Short 55–70 und fallend.
- **MACD 15:** Histogramm dreht in Signalrichtung.
- **Volumen 10:** mehr als 1,5 × Durchschnitt der 20 Kerzen davor.

Score = Punkte ÷ 90 × 100 (Funding ist im Muster-Bot nicht verfügbar, deshalb 90 statt 100 erreichbare Punkte). Signal ab **Mindestscore 70** (einstellbar 50–100). Laufen beide Trends gegen die Richtung, gibt es kein Signal; erfüllen Long und Short zugleich die Regeln, ebenfalls nicht. Stop: 1 × ATR hinter der gefundenen Zone bzw. dem jüngsten Hoch/Tief (einstellbar).

### Power of Three (P)

Übernommen aus dem PO3-Modell der früheren KI-Signale, auf einer Ebene:

1. **Akkumulation:** die letzten 6 Kerzen (einstellbar) bilden eine Box mit Höhe höchstens 1,5 × ATR.
2. **Manipulation (Sweep):** eine Kerze sticht unter (Long) bzw. über (Short) die Box und schließt wieder darin.
3. **Verteilung:** Fair-Value-Gap in Gegenrichtung, Rücktest in die Lücke und Impulskerze mit mindestens 1,5 × durchschnittlichem Körper, die über (Long) bzw. unter (Short) der Gegenstruktur seit dem Sweep schließt.

Zusätzlich muss der **4h-Trend** passen (Kurs über/unter EMA 50 mit steigenden bzw. fallenden Hochs und Tiefs); erst dann erreicht der PO3-Score die Schwelle 70. Stop: 0,1 × ATR hinter dem Sweep-Extrem. Kommt nach dem Sweep innerhalb von 20 Kerzen kein vollständiger Ablauf, verfällt das Setup. PO3 ist selten, aber klar definiert.

**Short-Signale erlauben** (Haken, nur bei Konfluenz/PO3 sichtbar): ohne Haken handeln die Modelle nur Long.

## Kapital, Hebel und Positionsgröße

- **Hebel 1–50×** (Standard 1 = wie bisher ohne Hebel). Modelliert wird isolierte Margin: Margin = Positionswert ÷ Hebel.
- **Liquidation:** Long bei Einstieg × (1 − 1/Hebel + 0,5 %), Short bei Einstieg × (1 + 1/Hebel − 0,5 %). Liegt der Stop hinter dem Liquidationspreis, wird zuerst liquidiert; der Verlust ist dann die ganze Margin plus Gebühren. Long ohne Hebel hat keine Liquidation. Unter dem Hebelfeld steht, wie weit der Kurs bis zur Liquidation laufen darf (z. B. Hebel 10 → etwa 9,5 %).
- **Positionsgröße nach Risiko je Trade:** Größe aus dem Stopabstand; ein Stop kostet etwa den eingestellten Prozentsatz. Mit Hebel 1 bleibt die Größe auf das Guthaben begrenzt.
- **Positionsgröße nach Einsatz (Margin):** fester Anteil des Guthabens (Standard 10 %) als Margin, multipliziert mit dem Hebel.
- In jedem Fall gilt: Margin + Einstiegsgebühr ≤ Guthaben.

Die Ergebnistabelle hat eine Spalte **Liquidationen**; die offene Demo-Position zeigt Hebel, Margin und Liquidationspreis.

## Backtest

**Backtest · alle 33 Varianten:** 27 Hammer/Engulfing-Varianten (Hammer/Engulfing/beide × 5m/15m/1h × Sofort/Buy-Stop/Schlusskurs) plus Konfluenz und Power of Three je 5m/15m/1h. **Einzeltest · meine Einstellungen** verwendet genau deine Auswahl. Spaltenkopf antippen zum Sortieren, Zeile antippen für die Equity-Kurve.

Die Historie wird in echten API-Seiten geladen, mit genug älteren Kerzen zum Starten der Durchschnitte (Konfluenz braucht EMA 200 auf Musterebene und 4h). Kein künstliches Auffüllen. Trefferquote, Profit Factor und Ø R zählen nur abgeschlossene Nettotrades nach Gebühren. Unter 100 Trades gibt es eine deutliche Warnung. Unter 33 Varianten kann eine zufällig besonders gute sein; mit anderen Zeiträumen gegenprüfen. Vergangene Ergebnisse versprechen keinen Gewinn.

## Papertrading

**Demo starten** hält Coin, Markt, Modell und Parameter fest. Der grüne Status nennt Coin, Modell, Ebene, Hebel und ob Telegram an ist. Die offene App prüft alle 30 Sekunden. Neue Signale erscheinen als **H/E/K/P** im passenden Chart und in der Liste (mit Richtung und Score). Buy-Stop, Stop/Ziel und Liquidation werden konservativ mit abgeschlossenen Kerzen abgerechnet; das ist ein Kerzenmodell, keine tickgenaue Börsenausführung.

**Demo beenden** (rot) stoppt die Prüfung, das Ergebnis bleibt. **Demo-Trade-Daten löschen** entfernt nur das Muster-Demo-Buch (eigene IndexedDB, nicht in der Sicherung).

### Telegram-Meldungen (Ankreuzfeld)

Das Feld **„Telegram-Meldungen für diese Demo senden“** steht jetzt als eine Zeile mit Erklärung darunter. Vorher war es durch eine allgemeine Formularregel als großes leeres Kästchen mit senkrecht gestapelter Beschriftung dargestellt.

- **An:** Die geöffnete App meldet an dein Telegram-Ziel **„Trades“** (Einstellungen → Telegram): beim **Einstieg** mit Modell, Richtung, Score, Einstieg, Stop, Ziel und ggf. Hebel/Liquidation, beim **Abschluss** mit Ergebnis. Wartet ein Signal noch auf Buy-Stop oder Schlusskurs-Bestätigung, kommt zusätzlich eine **Signalmeldung**. Bei Sofort-Einstieg (immer bei Konfluenz/PO3) enthält die Einstiegsmeldung das Signal; so kommen keine zwei Nachrichten gleichzeitig.
- **Aus:** Die Demo läuft still.
- Ist Telegram nicht eingerichtet oder das Ziel „Trades“ aus, steht ein Hinweis unter dem Feld.
- Gilt ab dem nächsten Demo-Start. Jede Nachricht ist als Übung gekennzeichnet und wird nur einmal gesendet; bei geschlossener App wird nicht geprüft.

## Kurzer Gerätetest

1. BTC im Chart laden, Analysen öffnen, Panel aufklappen. Modell **Power of Three** wählen: Erklärung erscheint, Einstiegsmodi verschwinden, Short-Haken erscheint. **i** neben der Erklärung zeigt alle Modelle und eine PO3-Skizze.
2. Hebel 10 eintragen, Größe „Einsatz“ wählen: Hinweis „etwa 9,5 % gegen den Trade“ erscheint, Feld „Einsatz je Trade“ statt „Risiko je Trade“.
3. Papertrading: Telegram-Feld ist eine Zeile mit Kästchen links und Text daneben.
4. Einzeltest, danach **alle 33 Varianten**; Konfluenz- und PO3-Zeilen prüfen, Spalte Liquidationen beachten.
5. Demo mit Konfluenz starten; neue Signale als K (grün Long, rot Short) im passenden Chart.
