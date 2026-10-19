# Neue Modelle und gemeinsame Auswahlhilfen

App 3.82.0. Unter **Chart → Analyse** stehen zusätzlich „Range-Rückkehr“, „Ausbruch mit Rücktest“ und „Relative Stärke“. Bestehende Modelle, Regeln, Zähler, Alarme und Telegram-Zugangsdaten bleiben erhalten. Die neuen Handelsmodelle starten mit **Telegram aus** und protokollieren Beobachtungen trotzdem. Es werden keine Orders ausgeführt.

## Bedienung

- Modellname: Coins und Werkzeuge auf-/zuklappen. Der Chart-Haken oder ein Coin-Name öffnet den Analysefokus; Ausschalten stellt die vorherigen Indikatoren wieder her. Neue Handelsmodelle öffnen 15m, Relative Stärke 1h.
- „ⓘ Prüfung & Erklärung“: Regeln, Werte und Status. Neue bestätigte Signale zeigen auch die Bestätigungszeit. Nach dem ersten 15m-Fenster heißen noch offene Fälle „Beobachtung“.
- Telegram für ein neues Handelsmodell erst bewusst einschalten. Zusätzlich gelten „Telegram-Chats → Analyse-Signale“, Coin global und Coin im Modell. Neue Fotos nutzen die vorhandene Karte, den bestehenden Analyse-Bot und den bestehenden Versand. Ein neuer Einstiegshinweis wird nur innerhalb der ersten 15 Minuten nach Bestätigung verschickt, danach bleibt die Beobachtung im Protokoll.
- Relative Stärke ist eine Auswahlhilfe ohne eigene Einstiege oder Telegram-Fotos. Die Coin-Schalter bestimmen, welche Vorauswahl-Coins in diese Rangliste eingehen.
- „Backtest“ findet sich im aufgeklappten Coin-/Werkzeugbereich jedes neuen Handelsmodells. Standard: 180 Tage, 0,05 % Gebühr und 0,02 % Slippage je Seite. Zeitraum und Kosten sind dort einstellbar. Kein automatischer großer Historienabruf beim Appstart.

## 1. Range-Rückkehr

Die feste 1H-Marktphase muss Seitwärts zeigen. Aus den **vor dem Auslöser geschlossenen** 48 Stundenkerzen entsteht eine Range: mindestens zwei zeitlich getrennte Tests je Grenze, mindestens 0,4 % bzw. 1,5 ATR breit, höchstens 8 ATR. Berührungstoleranz 0,25 Stunden-ATR, Mindestabstand zwischen Tests drei Stundenkerzen.

Long: Eine 15m-Kerze durchsticht die Unterkante um mindestens 0,05 ATR und schließt wieder innerhalb der Range. Die folgende geschlossene Kerze muss steigen und über dem Hoch dieser Rückkehrkerze, weiterhin innerhalb der Range, schließen. Short gilt spiegelbildlich. Ein Docht oder bloßes Berühren reicht nicht.

Einstieg: Bestätigungsschluss. Stop hinter dem Sweep-Extrem mit 0,15 ATR Puffer. Ziel 1: Range-Mitte. Ziel 2: gegenüberliegende Grenze.

## 2. Ausbruch mit Rücktest

Verdichtung über 24 vorher bekannte Stundenkerzen: wie oben mehrere Tests, höchstens 6 ATR breit. Der geschlossene 15m-Ausbruch muss mindestens 0,05 ATR außerhalb liegen; Körper mindestens 55 % der Kerze, Volumen mindestens 1,2× der **vorherigen** 20 Kerzen. Eine bestätigte gegensätzliche 1H-Phase verhindert den Einstieg; Seitwärts ist für den Übergang in einen Trend erlaubt.

Innerhalb der nächsten acht 15m-Kerzen muss ein Rücktest stattfinden; die anschließende Kerze bestätigt mit einem Schlussbruch in Ausbruchsrichtung. Der Rücktest berührt das Niveau innerhalb von 0,25 ATR und schließt auf der gehaltenen Seite. Ein zwischenzeitlicher Schluss mehr als 0,5 ATR auf der falschen Seite verwirft das Setup. Zur Bestätigung gehören auch Schlusskurs und Steigung der 15m-EMA 20 in Ausbruchsrichtung.

Stop hinter dem Rücktest-Extrem mit 0,15 ATR Puffer. Ziel 1 ist das nächste damals bestätigte 1H-Level oder die einfache Range-Projektion, je nachdem, was näher liegt. Ziel 2 ist die doppelte Range-Projektion. Ein zu nahes Level wird nicht zugunsten eines schöneren CRV übersprungen.

## Gemeinsame Plausibilität und Lebenszyklus

Stopabstand 0,15–2 %, CRV zu Ziel 1 mindestens 1,5 brutto und 1,2 nach angenommenen Ein- und Ausstiegskosten. Die Kostenprüfung berücksichtigt den jeweiligen Einstiegs-, Stop- und Zielpreis. Neue Signale erhalten feste Marken. Ziel 1 oder Stop beendet den aktiven Einstiegshinweis; Ziel 2 wird getrennt weiter beobachtet, maximal 24 Stunden. Anschließend vier Stunden Sperre je Coin, Richtung und Modell. Wiederholungen desselben Setup-Schlüssels werden nicht neu protokolliert oder versendet.

Bei unbekannter Reihenfolge innerhalb einer OHLC-Kerze gilt Stop vor Ziel. Eine Kurslücke kann mehr als −1R ergeben. Fehlende Ergebniskerzen erzeugen keinen erfundenen Treffer; längere Apppausen werden über denselben Historienclient ergänzt.

## 3. Relative Stärke

Verglichen werden normale, geschlossene **1H-Kerzen** der aktuellen Vorauswahl mit BTC desselben Börsenmarktes, exakt zu denselben Zeitpunkten. Zeitfenster: 1, 4 und 24 Stunden. Die relative Veränderung ist die Veränderung des Coin/BTC-Verhältnisses, nicht bloß der Unterschied zweier gerundeter Prozentanzeigen.

Rang: gewichtete relative Bewegung mit 20/30/50 % für die drei Zeitfenster, geteilt durch die Stunden-ATR in Prozent. Volumen und Überdehnung bleiben zusätzlich sichtbar. Long-/Short-Kandidaten brauchen gleichgerichtete relative 4h-/24h-Bewegungen mit mindestens 0,2 ATR Abstand, mindestens durchschnittliches Stundenvolumen und höchstens 2,5 ATR Abstand zur 1H-EMA 20.

Das ist keine Gewinnwahrscheinlichkeit. Ein Einstieg muss weiterhin aus einem bestätigten Handelsmodell kommen. Fehlende Coins werden übersprungen und die Datenabdeckung wird angezeigt; ohne passenden aktuellen BTC-Vergleich gibt es keinen Ersatzrang. Nach vollständigem Laden bleibt der Rang bis zum nächsten Stundenschluss stabil. Chart-Zeitrahmen und Heikin-Ashi ändern die Messung nicht.

## Marktphase und gemeinsame Ereignisse

Jede Modellkarte hat eine aufklappbare Einordnung: „Modell passt zur Marktphase“, „Eingeschränkt geeignet“ oder „Aktuell ungünstig“, jeweils mit Erklärung und letztem 1H-Schluss. Quelle bleibt ausschließlich die vorhandene zentrale Marktphase mit ihrer Zwei-Kerzen-Bestätigung. **Bisherige Signalregeln werden dadurch nicht gefiltert oder umgewichtet.** Bei den neuen Modellen sind die beschriebenen Phasenbedingungen explizite eigene Regeln.

Aktive Signale mehrerer Modelle für denselben Coin/Markt und dieselbe Richtung werden innerhalb eines 30-Minuten-Einstiegsfensters als gemeinsames Marktereignis angezeigt. Ein Modell zählt dabei einmal. Aktive entgegengesetzte Richtungen werden als Konflikt sichtbar. Dies liefert keine Zusatzpunkte und verändert bestehende Telegram-Meldungen nicht. Unterschiedliche Coins bleiben ebenfalls korreliert; die Anzeige behauptet keine unabhängigen Stichproben.

## Protokoll und historischer Test

Beide neuen Handelsmodelle teilen Abrufe und Ergebnisbeobachtung. Neu berechnet wird nach einem 15m-Schluss; 1H-Daten werden nur nach Stundenschluss ersetzt. Relative Stärke verwendet den vorhandenen Stunden-Cache und lädt bei Bedarf fehlende Daten. Historische Daten laufen begrenzt über den vorhandenen Börsenclient und Cache; die Berechnung läuft im vorhandenen Worker-Aufrufrahmen in einem neuen Modul-Worker. Einzelne Coinfehler blockieren die übrigen Coins nicht. Ein Test lässt sich pausieren und wird beim Verlassen der aktiven App abgebrochen.

Der Bericht nennt Signale, Abschlüsse, Trefferquote, durchschnittliches R nach Kosten, Profitfaktor, realisierten R-Rückgang und längste Verlustserie sowie Ergebnisse pro Coin und Phase. Er trennt die älteren 70 % der Zeit von den neueren 30 %. Entwicklungsergebnisse, die am Zeittrenner noch nicht bekannt waren, werden ausgeschlossen. Feste Regeln werden nicht automatisch optimiert und kein Gewinner wird automatisch gewählt.

Ausführungsannahme: theoretischer Einstieg am Bestätigungsschluss mit angegebenen Kosten, vollständiger Ausstieg am ersten Ziel oder Stop, spätestens nach 24h. Das ist keine Füllgarantie. R bezieht sich auf den ursprünglichen Stopabstand. Der Rückgang summiert realisierte R und ist kein Kontodrawdown mit Positionsgrößen oder offenen Positionen. Short auf Spot ist hypothetisch; Funding wird nicht modelliert. Kleine oder abhängige Stichproben belegen keinen Vorteil.

Live-Ergebnisse verwenden die beim Signal gespeicherten Kosten. Ein gespeicherter Bericht zeigt seinen ursprünglichen Zeitraum und seine Kosten. Änderungen an den Eingabefeldern rechnen ihn nicht nachträglich um. Protokoll und Berichte sind in der vorhandenen Datensicherung und im verschlüsselten Abgleich enthalten; ältere Sicherungen ohne diese neuen Felder bleiben lesbar. Historische Fälle lösen keine Live-Fotos aus.

## Geänderte Stellen

- `shared/analysis-config.mjs`, `analysis-feed.mjs`: drei Konfigurationseinträge und geteilte Runtime-Registrierung.
- `shared/market-strategy-core/feed/history/worker/view.mjs`: feste Regeln, gemeinsamer Feed, Protokoll, Kostenprüfung, kausaler Backtest, Bericht und Fokusdarstellung.
- `shared/relative-strength.mjs`, `analysis-context.mjs`: Auswahlhilfe, Marktphasen-Eignung und gemeinsame Ereignisse.
- `shared/analysis-view.mjs`, `analysis-overview.mjs`: bestehende Modellkarten und klappbare Erklärungen erweitert.
- `shared/trend-pullback-chart.mjs`: vorhandene Linien, Touch-Inspector und Chart-Gruppen mit optionalen Darstellungstexten wiederverwendet. Bisherige Rücksetzer-Darstellung bleibt Standard. `trend-pullback-core.mjs`: Ergebnisfunktion erhält einen optionalen Haltezeitparameter mit unverändertem Standardwert.
- `shared/analysis-card.mjs`, `analysis-chart.mjs`, `weather-widget-v2.html`: bestehende Bildkarte, Testknöpfe, Info-Dialog, Chart-Skalierung ausschließlich im neuen Fokus, Sicherung und Einbindung.
- App/PWA-Bündel 3.82.0 mit 148 Dateien; vollständige Dienst-Lieferliste mit 160 Dateien. Dienstquelle bleibt 2.15.3, bestehende Ziele und stille Alarmübernahme unverändert.

## Gerätetest

1. Auf dem iPhone/iPad unter Analyse die sechs Modelle prüfen; neue Coin-Listen zunächst zu.
2. Range/Ausbruch aufklappen, Coin-Schalter testen und einen Coin öffnen. Chart-Haken aus: vorherige Indikatoren erscheinen wieder.
3. Neue Zonen, Range-Grenzen und Handelsmarken prüfen. Stop-/Ziellinie antippen: Kurs, Uhrzeit und Punkt im vorhandenen Inspector.
4. Relative Stärke öffnen. Zeitrahmen mehrfach wechseln und HA umschalten: Rang und feste 1H-Messwerte bleiben gleich.
5. „ⓘ Marktphase“ und „Gemeinsame Marktereignisse“ prüfen; ein Richtungskonflikt darf keine verstärkte Kauf-/Verkaufsempfehlung ergeben.
6. Einen historischen Test starten, Kosten ändern und den gespeicherten Zeitraum vergleichen. Pause, Neustart und Datensicherung testen.
7. Bewusst eine neue Testkarte senden; „Analyse-Signale aus“ muss auch diese sperren. Neue Modell-Telegram-Schalter sind standardmäßig aus.

Die Analysen, Auswahlhilfen und Tests laufen weiterhin in der aktiven App. Dieses Update aktiviert keinen Analysebetrieb bei geschlossener App auf Oracle und verändert keine privaten Server-Zugangsdaten. Automatische Tests verwenden lokale Börsen-/Telegram-Attrappen; sie sind kein Nachweis einer Marktprofitabilität.
