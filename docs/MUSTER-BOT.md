# Muster-Bot: Hammer und Bullish Engulfing

Unter **Analysen → Muster-Bot · Hammer & Engulfing · nur Übung** das neue Panel aufklappen. Es verwendet den im Chart geladenen Coin und dessen vorhandenen öffentlichen Binance-Spot-/Futures-Markt. Es arbeitet ausschließlich long, ohne Hebel und ohne echte Orders. Die bisherigen Strategien und persönlichen Bücher bleiben getrennt.

## Einstellungen

Jedes Feld und jede Ergebnisspalte hat einen antippbaren **i**-Button: Erklärung, Bedeutung und Beispiel. Die Muster-Erklärung zeigt eine Kerzenzeichnung. **X**, Escape oder Tippen daneben schließen das Popup; Hover ist nicht nötig. Eigene Einstellungen werden für den nächsten Start gespeichert.

Startwerte: 1.000 USD Übungskapital, 1 % geplantes Stop-Risiko pro Trade, 0,05 % Gebühr je Kauf/Verkauf, 15m-Musterkerzen und 90 Tage Historie. Kontext sind ausschließlich abgeschlossene 4h-Kerzen: tiefstes Tief der letzten 20, ATR(14), optional Kurs über EMA50. ATR beschreibt die typische Schwankungsbreite. Alle numerischen Strategieparameter und beide Einstiegsmodi sind editierbar; die Kontext-Ebene bleibt bewusst 4h.

- Hammer: Körper höchstens 35 % der Spanne, unterer Docht mindestens 60 % und mindestens doppelt so lang wie der Körper, oberer Docht höchstens 15 %, Spanne mindestens 0,5 × Muster-ATR. Ein passender Dragonfly-Doji zählt ebenfalls.
- Engulfing: rote Vorgängerkerze, grüne Musterkerze, vollständig umschlossener Vorgängerkörper, eigener Körper mindestens 0,5 × Muster-ATR. Das tiefere Tief beider Kerzen ist das Muster-Tief.
- Beide: erstes passendes Muster; bei gleichzeitigem Treffer Hammer samt Hammer-Einstiegsmodus. Muster-Tief höchstens 0,5 × **4h-ATR** über dem Support. Volumen größer als SMA(20), standardgemäß einschließlich der Musterkerze.
- Sofort: nächste Öffnung. Buy-Stop: Hoch + 0,05 × Muster-ATR, Standard nur eine Folgekerze gültig; bei einem Sprung darüber gilt das höhere Open. Schlusskurs: exakt die nächste Kerze muss über dem Hoch schließen; Einstieg erst an der folgenden Öffnung.
- Stop: Muster-Tief − 0,1 × Muster-ATR; beim Schlusskursmodus niedrigeres Tief von Muster und Bestätigung. Ziel: Einstieg + 2 × Risikoabstand. Der ATR-Wert wird bei der Musterbestätigung festgehalten.
- Eine Position oder wartende Einstiegsmarke gleichzeitig. Sind Stop und Ziel in einer Kerze berührt, gilt immer der Stop, auch in der Buy-Stop-Auslösekerze. Ein Gap unter einen bereits bestehenden Stop wird zum schlechteren Open abgerechnet.

Die Menge berechnet sich aus dem Prozent-Risiko und wird zusätzlich auf das verfügbare Kapital inklusive Einstiegsgebühr begrenzt. Dadurch ist kein versteckter Hebel möglich. Der tatsächliche Stop-Risikobetrag kann bei engem Stop kleiner als der Prozentwert sein; Gebühren und Gaps kommen zum geplanten Risiko hinzu.

## Backtest

**Backtest · alle 27 Varianten** prüft Hammer/Engulfing/Beide × 5m/15m/1h × Sofort/Buy-Stop/Schlusskurs. Bei „Beide“ verwendet die Vergleichstabelle denselben Einstieg für beide Muster. **Einzeltest · meine Einstellungen** verwendet dagegen genau deine Auswahl, auch unterschiedliche Einstiege pro Muster. Spaltenkopf antippen zum Sortieren, Zeile antippen für die Equity-Kurve (Verlauf des Übungsguthabens). Mobil bleibt die Tabelle in ihrem eigenen horizontalen Scrollbereich.

Die Historie wird in echten API-Seiten geladen, mit älteren Kerzen zum Starten der Durchschnitte. Kein künstliches Auffüllen fehlender Kerzen. Reale Rate-Limits werden mit Pause erneut versucht; nach begrenzten Versuchen erscheint eine verständliche Meldung. **Test abbrechen** erhält die letzten Ergebnisse.

Trefferquote, Profit Factor und durchschnittliches R zählen ausschließlich abgeschlossene Nettotrades nach Gebühren. Profit Factor ohne Verluste wird als „keine Verluste“ angezeigt, ohne erfundene unendliche Quote. Netto-% und Equity bewerten eine am Ende offene Position zum letzten bekannten Schlusskurs; kein erfundener Endverkauf. Drawdown wird an Kerzenschlüssen gemessen. Die Kurvendarstellung großer Tests verwendet bis etwa 2.000 Stichpunkte; die Kennzahlen werden auf allen Kerzen berechnet. Unter 100 Trades gibt es eine deutliche Warnung. Unter 27 Varianten kann eine zufällig besonders gute sein; mit anderen Zeiträumen gegenprüfen. Vergangene Ergebnisse versprechen keinen Gewinn.

## Papertrading

**Demo starten** hält Coin, Markt und Parameter für diesen Lauf fest. Der grüne Status benennt diesen Coin. Die offene App prüft alle 30 Sekunden. Neu bestätigte Muster erscheinen als **H/E** im passenden Chart und in der Liste. Ein Sofort-Einstieg darf das bereits bekannte Open der laufenden Folgekerze verwenden; deren zukünftiges High/Low/Close gehen nicht in die Mustererkennung ein. Buy-Stop und Stop/Ziel werden konservativ mit abgeschlossenen Kerzen abgerechnet. Das ist ein Kerzenmodell, keine tickgenaue Börsenausführung. Ein offener Trade zeigt Einstieg, Stop, Ziel und laufendes Ergebnis; eine andere Coinauswahl ersetzt seinen Kurs nicht.

**Demo beenden** ist rot und stoppt die laufende Prüfung. Das Ergebnis bleibt sichtbar. **Demo-Trade-Daten löschen** entfernt nur das eigene Muster-Demo-Buch. Persönliche Positionen/Trades und andere Strategien bleiben erhalten. Das Demo-Buch liegt in einer separaten IndexedDB und wird weder gesichert noch übertragen. Die Einstellungen dürfen Teil der allgemeinen Sicherung bleiben.

Optional **Paper-Meldungen an Trades** aktivieren. Dazu muss das vorhandene Telegram-Trades-Ziel eingerichtet/eingeschaltet sein. Die geöffnete App sendet ausdrücklich gekennzeichnete Übungseinstiege/-abschlüsse; die reine Oracle-Chartmuster-Variante führt diesen Bot nicht aus. Bereits reservierte Meldungen werden nach verlorener Antwort nicht doppelt verschickt. Bei Pause/Offline/geschlossener App werden keine neuen Daten geprüft; keine automatische echte Order entsteht daraus.

## Kurzer Gerätetest

1. BTC im Chart laden, Analysen öffnen, Panel aufklappen; alle Feldbeschriftungen auf 320/390 px prüfen.
2. Hammer- und Engulfing-Einstieg unterschiedlich wählen, i öffnen, SVG prüfen, daneben/X schließen.
3. Kurzen Einzeltest ausführen, anschließend 27 Varianten. Nach Trades/Profit Factor sortieren, Zeile und Kurve antippen, Warnung bei weniger als 100 Trades beachten.
4. Demo starten: grüner Status mit BTC. Während des Laufs LTC öffnen: Lauf bleibt ausdrücklich BTC. Nach einem neuen passenden Muster H/E im passenden Chart prüfen. Rot beenden, gezielt löschen.
5. Sicherung exportieren: persönliche Bücher erhalten; keine Muster-Demo-Trades enthalten. Ein API-Fehler soll nur den Muster-Bereich betreffen, andere Charts/Funktionen bleiben bedienbar.
