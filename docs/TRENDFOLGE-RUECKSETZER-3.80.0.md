# Trendfolge-Rücksetzer · 3.80.0

Dritter fester Eintrag im vorhandenen Bereich **Analyse** unter „Chart-Ebenen, Whales & Werkzeuge“. Vorauswahl, exklusive Analyse-Ansicht, gespeicherte Coin-Freigaben, Bildkarten, Telegram-Ziel „Analyse-Signale“, Historienclient, Börsencache und persönliche Datensicherung werden weiterverwendet. Top-Down und NY Open Killzone behalten ihre Regeln und Bedienung.

## 1. Trend, Rücksetzer und Signal

Dateien: `shared/analysis-config.mjs`, `shared/trend-pullback-core.mjs`, `shared/trend-pullback-feed.mjs`, `shared/directional-movement.mjs`.

- Einstellbare Strategie-, Risiko-, Lern- und Laufzeit-Startwerte stehen oben in `PULLBACK`. Normale OHLC-Kerzen, ausschließlich bekannte geschlossene Kerzen. Bestehende EMA-, RSI-, ATR-, MACD-, Swing- und 4h-Zonen-Bausteine werden verwendet. Gemeinsamer Wilder-ADX liefert auch +DI/−DI für die separate Marktphase.
- 4h: EMA 21/50/200 und Kurs in Trendrichtung, bestätigte höhere Hochs/Tiefs bzw. spiegelbildlich, ADX mindestens 20.
- 1h: bestätigtes Impulsbein, Rücksetzer 38,2–61,8 %, Berührung von EMA-21/50-Band oder bestehender 4h-Zone; RSI seit Impulsende über 35 bzw. unter 65. Die EMA-Berührung wird mit den Werten der jeweiligen damaligen Kerze geprüft.
- 15m: mindestens zwei von Umkehrkerze, Schluss jenseits EMA 21 und MACD-Histogramm-Drehung. „Beobachten“ ist noch kein Einstieg. Stop hinter dem Rücksetzer plus 0,1 Stunden-ATR, CRV zu Ziel 1 mindestens 1,5 und Stopabstand 0,2–1,5 %.
- Ein Einstieg bleibt für sein Impuls-Setup fest. Kein nachträgliches Verschieben von Einstieg oder Stop. Je Richtung bis zum Signalende plus vier Stunden gesperrt; dasselbe Impuls-Setup wird nicht doppelt eingetragen.

Test: Long und Short prüfen. Fehlende 4h-Übereinstimmung, ungültige Tiefe, RSI-Grenze oder zu enger/weiter Stop müssen das Signal verhindern. Eine laufende Kerze darf keine Freigabe ändern. Die Gründe stehen in „Prüfung & Erklärung“.

## 2. Chart und Prognose-Linien

Dateien: `shared/trend-pullback-chart.mjs`, `shared/analysis-chart.mjs`, `weather-widget-v2.html`.

Modellname oder Chart-Haken aktiviert den Analysefokus, Coin-Name öffnet dessen 15m-Chart. Eigene 4h-EMA-21/50/200, bestätigtes Impulsbein, Fibonacci-Bereich und Zone; Einstieg, Stop, Ziel 1 und Extension 1,272 als beschriftete Linien. Stop/Ziele sind mit dem bestehenden Prognose-Inspector antippbar: Kurs, Uhrzeit und farbiger Punkt. Preisbeschriftungen fangen die Berührung nicht ab. Chart-Info erklärt Regeln, aktuellen Grund, Wahrscheinlichkeit und Dauer. Ausschalten stellt die vorherigen Indikatoren wieder her.

Test: Analyse ein-/ausschalten, Coin wechseln, Stop/Ziel-Linien antippen, Chart verschieben/zoomen. Linien und Beschriftungen bleiben beim Aktualisieren sichtbar. MACD, Zonen und freie Chartansicht außerhalb dieses Fokus prüfen.

## 3. Menü, Vorauswahl und Quittieren

Dateien: `shared/analysis-view.mjs`, `shared/analysis-overview.mjs`, `shared/trend-pullback-view.mjs`, `shared/trend-pullback-notices.mjs`, `weather-widget-v2.html`.

Die Modellkarte zeigt drei Stufen und klare Wartegründe. Für diesen neuen Eintrag aktiviert der **Name den Fokus**; **Coins** klappt die Coin-Schalter unabhängig davon auf. Bestehende Modellnamen klappen weiterhin nur ihre Coins auf/zu.

Bei aktuellem Signal pulsiert die Modellzeile mintgrün im 1,2-s-Takt, samt Anzahl; zugeklappt pulsiert stattdessen der Analyse-Kopf. Coin-Karten pulsieren grün bei Long, rot bei Short, mit Pfeil und „Rücksetzer“. „Beobachten“ hat nur einen ruhigen Punkt. Die Coin-Auswahl der Analyse gilt für diese Hinweise und Telegram; der globale Telegram-Coin-Schalter betrifft ausschließlich den Versand.

Modellname quittiert die Zeile bis zum nächsten Signal. Antippen einer Signal-Coin-Karte quittiert diesen Coin und öffnet dessen Analyse-Chart. Quittierungen bleiben nach Neustart erhalten. Abgelaufene/beendete, fehlerhafte oder offline/pausierte Signale blinken nicht. Bei „Bewegung reduzieren“ bleibt die Hervorhebung ruhig.

Test: Telegram ausgeschaltet lassen: aktuelle Signale müssen trotzdem hervorgehoben werden. Coins ausschließen, Zeile und einzelne Coins quittieren, neu laden; übrige Coins und deren Quittierungen bleiben unabhängig.

## 4. Telegram-Foto und Ergebnis-Antwort

Dateien: `shared/analysis-card.mjs`, `shared/trend-pullback-delivery.mjs`, vorhandener Versand in `weather-widget-v2.html`.

Gleiche Bildkarte und Fotofunktion wie bei Top-Down/NY. Karte mit 15m-Mini-Chart, Zone, verlängerten Einstieg-/Stop-/Ziellinien, Richtung, CRV, Wahrscheinlichkeit/Lernphase, erwarteter Dauer und deutscher Zeit. Ohne Chartdaten bleibt der Versand möglich. Vorschau: Coin · Richtung · Einstieg · Wahrscheinlichkeit.

Es gelten unverändert alle drei Freigaben: Analyse-Telegram, Coin global und Coin in dieser Analyse. Ein optionaler Wahrscheinlichkeitsfilter kommt nur für das neue Modell hinzu. „Alarme aufs Smartphone → Analyse-Signale → Testkarte: Trendfolge-Rücksetzer“ verwendet denselben eigenen Bot/Chat; die vier bisherigen Ziele bleiben erhalten.

Ergebnis-Antworten beziehen sich ausschließlich auf die bestätigte Foto-Nachricht im ursprünglichen Chat/Thread. Kein blindes Wiederholen bei unklarer Zustellung. Ziel 1 beendet das aktive Signal, Ziel 2 wird separat weiterbeobachtet und gegebenenfalls später beantwortet. Stop zuerst bei gleichzeitigem Stop/Ziel innerhalb einer OHLC-Kerze; Kurslücken können schlechter als −1R ausfallen.

Test: eigenen Test-Chat verwenden. Drei Freigaben einzeln ausschalten und Versand verhindern; zweimalige Auswertung darf kein zweites Foto auslösen. Ergebnis muss auf das ursprüngliche Foto antworten. Ein nachträglich geänderter Chat darf keine fremde Ergebnis-Antwort erhalten.

## 5. Protokoll und Sechs-Monats-Startdaten

Dateien: `shared/trend-pullback-store.mjs`, `shared/trend-pullback-backtest.mjs`, `shared/trend-pullback-worker.mjs`, `shared/trend-pullback-feed.mjs`.

Beim ersten Start lädt die aktive App nach kurzer Anlaufzeit sechs Kalendermonate für alle Vorauswahl-Coins, samt Indikator-Vorlauf. Historischer Client und Cache mit bestehender Abrufbegrenzung, kleine Zeitfenster, nur nötige 4h-/1h-/15m-Kerzen. CPU-Arbeit läuft im Modul-Worker. Jeder fertige Coin wird sofort gespeichert. Beim Wechsel in den Hintergrund wird pausiert und später fortgesetzt. Netzwerkfehler führen zu begrenzten Wiederholungen, ohne fehlerhafte Coins als vollständig geprüft zu zählen. „Pausieren“ im Lernstand stoppt den automatischen Lauf bewusst bis zum nächsten manuellen Start.

**ⓘ Lernstand → Backtest · 6 Monate** startet einen neuen Lauf. Alte Coin-Fertigmeldungen werden dabei zurückgesetzt; gespeicherte Lerndaten und bereits abgeschlossene Ergebnisse bleiben erhalten. Nach Fortsetzen umfasst der Bericht auch die zuvor fertig geprüften Coins. Gebühren 0,05 % und Slippage 0,02 % je Seite werden im Nettoergebnis berücksichtigt.

Gespeichert: Merkmale beim Einstieg, Richtung, Coin, Zone/Marken, Schlusszeitpunkt, erste Beendigung, separate Ziel-2-Beobachtung sowie größter modellierter Gewinn/Verlust in R bis zum ersten Signalende. Neue Ergebnisse können keine damals bekannte Eingangsinformation ändern. Datenlücken bleiben erkennbar unvollständig. Historische Signale erhalten keine nachträglich erfundenen Modell-Prozente.

Test: Erstlauf starten lassen, App kurz verlassen und zurückkehren. Fertige Coins bleiben gespeichert. Backtest pausieren/neu starten; unvollständige Börsenfenster dürfen keine künstliche Null-Trefferquote erzeugen. Gebühren und offene Fälle im Lernstand prüfen.

## 6. Lernmodell und Lernstand

Dateien: `shared/trend-pullback-learning.mjs`, `shared/trend-pullback-view.mjs`; Sicherung/Validierung in `shared/trend-pullback-store.mjs` und `weather-widget-v2.html`.

Lokale logistische Regression, kein externer KI-Dienst. Eingangsdaten: ADX, Rücksetzer-Tiefe, RSI, mittleres Volumenverhältnis zum Impuls, ATR in %, Abstand zum Impuls-Key-Level, zyklische Uhrzeit, Coin und Richtung. Ziel: Ziel 1 vor Stop bzw. anderem Signalende.

Älteste 70 % trainieren, neueste 30 % prüfen; über den Trennzeitpunkt reichende Trainings-Ergebnisse werden entfernt. Skalierung nur auf Trainingsdaten. Prozentanzeige erst ab 100 abgeschlossenen Fällen, ausreichend Gewinnen/Verlusten in beiden Teilen und besserem Brier-Fehler als die konstante Trainings-Trefferquote. Neuprüfung nach jeweils 20 neuen Abschlüssen, erstmals direkt beim Erreichen von 100. Bis dahin „Lernphase (x/100)“. Eine schlechtere neue Version ersetzt eine im gleichen Prüffenster bessere alte Version nicht; Versionen bleiben lokal erhalten.

Erwartete Dauer: Median vorher abgeschlossener Ziel-1-Fälle in derselben Richtung, sonst gekennzeichnete ATR-Schätzung. Kein verlässliches Zeitversprechen. „Mindest-Wahrscheinlichkeit“ ist standardmäßig aus. Bei eingeschaltetem Filter und fehlendem freigegebenem Modell bleiben Blinken/Telegram aus, feste Regeln und Chart bleiben sichtbar.

Der Lernstand zeigt Fallzahlen, Trefferquote Ziel 1, separate Ziel-2-Quote, Netto-R, Verlustserie, Modellqualität und Ergebnisse pro Coin. Wöchentliche Gruppenhinweise lassen sich für eine eigene Prüfung merken; kein Bestätigen ändert automatisch Regeln oder Coin-Freigaben. Lerndaten und Modell sind in persönlicher Sicherung/GitHub-Sicherung enthalten, Telegram-Empfangsquittungen nicht.

Test: ohne 100 Fälle müssen Lernphase und deaktivierter Prozentfilter verständlich sein. Sicherung erzeugen/prüfen. Modellprüfungen und Vorschläge dürfen keinerlei Trading-Regel ändern.

## Verifikation und Betriebsgrenze

Automatische Tests verwenden ausschließlich lokale OHLCV-/Telegram-Testantworten. Sie belegen korrekte Regeln, Kausalität, Bedienung, Speicherung und Versandfreigaben; keine profitable Strategie oder echte Markt-Trefferquote. Chromium und WebKit ersetzen keinen physischen iPhone-Test.

App und Service Worker 3.80.0; bestehende Analyse-Service-Schlüssel und atomarer Duplikatschutz weiterverwendbar. Der 24/7-Dienst bleibt Version 2.15.1; keine Server-/VM-Bereitstellung. Diese neue Analyse rechnet und versendet aktuell aus der sichtbaren aktiven App.
