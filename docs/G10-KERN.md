# G10(a) – gemeinsamer Konfluenz-Kern

Arbeitsstand 3.43.0, Modell `cf-1`. Die fehlenden Codebeilagen wurden anhand von G10 neu geschrieben. Vorhandene Chart-/Positionsrechnung
bleibt erhalten. Bitget-Feed, Karten, Backtest-Worker und Telegram folgen in G10(b)–(e). Noch keine produktiven KI-Signale oder Erfolgszahlen.

## Module

| Datei | Inhalt |
| --- | --- |
| `shared/confluence-core.mjs` | Einstieg, Snapshot, Score, Freigabe, Level, Größe, Kosten, Kohorten |
| `shared/indicators.mjs` | EMA/MACD, Wilder-RSI/-ATR, geschlossene Kerzen, bestätigte Pivots/Fib/Divergenz |
| `shared/pattern-score.mjs` | Skalierung, gedeckeltes Mustergewicht, Gegenmuster, Deduplizierung |

Keine Netzwerk-, DOM-, Speicher-, Timer- oder Sendeseiteneffekte. Dieselben ES-Module werden in Node, Browser und Browser-Worker getestet;
Adapter müssen sie später tatsächlich importieren. Der Service Worker speichert alle drei Dateien für den Offline-Import.
Tests: `unit-confluence.js` (135 feste Fachprüfungen), `m61.js` (8 Laufzeit-/Offlineprüfungen). `tests/fixtures/` enthält ausschließlich Testdaten.

## Eingangsvertrag und Zustand

- Zeiten: UTC-Millisekunden, Kerzenende exklusiv. Kerze `{ time, end, knownAt, open, high, low, close, volume }`,
  `end=time+periodMs`, `knownAt>=end`. Historische Kenntniszeit aus offengelegtem Feed-/Latenzmodell, nicht heutiger Downloadzeitpunkt.
  Laufende/zukünftig bekannte Kerzen zählen nicht; Lücken, Dubletten und falsche OHLCV sind Fehler.
- `scope`: Bitget, `USDT-FUTURES`, Instrument, `USDT`, Basis-/Kontextintervall, Horizont `short/long`, Modell `cf-1`,
  `settingsRevision`, `asOf`, explizite `maxHoldMs`, `slippageBps`, `indicatorAnchors:{base,context}`. Kein erfundener Einsatz/Haltezeit.
  Signalintervalle 1h/4h/1d; Kontext höher als Basis, Standardpaare laut Vorgabe 1h/4h und 4h/1d.
- Basis-/Kontext-/Funding- und Musterquelle tragen diesen Kontext, eigenes Intervall und `parametersKey(settings)`. Abweichende Börse, Coin,
  Einstellungen, Revision, Horizont, Haltedauer, Slippage oder Startanker verhindern Bewertung. Bestätigte Revision später mit Oracle
  synchronisieren; der lokale Kernaufruf ersetzt keine Serverbestätigung.
- `createIndicatorState({time,periodMs})`, dann `advanceIndicators(state,candles,asOf)`: neuer Zustand/Werte, unveränderte Eingänge,
  lückenlose Fortsetzung ab `nextTime`. Zustand und Markt-/Parameterkontext zusammen speichern; Chart-Zoom setzt keinen neuen Anker.
- `frameSnapshot({source,state,candles,asOf})` liefert eigene Indikatoren, RSI-Reihe, Pivots/Zonen, letzte fünf Histogrammwerte,
  letzte Kerze und deren vorherige 20 Volumina. Für Ausschnitte gespeicherten Zustand **vor** dem Ausschnitt verwenden und genug
  Kerzen für Volumen/Pivots mitgeben. EMA200-Warm-up nicht verkürzen: je Zeitebene mindestens 200 Kerzen seit ihrem eigenen Startanker.
  Basis/Kontext müssen jeweils die jüngste geschlossene Kerze enthalten: nach Ablauf einer weiteren ganzen Kerze sind alte Werte nicht
  bewertbar. Snapshot und Signal kopieren die Ankerdaten; spätere Eingabeänderungen verändern gespeicherte Ergebnisse nicht.

## Berechnung und Sperren

EMA: SMA der ersten N gültigen Werte, dann alpha=2/(N+1). MACD=EMA12−EMA26, Signal=EMA9(MACD), Histogramm=M−S; keine Nullauffüllung,
kein Faktor zwei. Signal beginnt nach neun gültigen MACD-Werten. RSI14: zuerst 14 Schlusskursänderungen, danach Wilder;
ATR14: erste 14 True Ranges (erste Kerze High−Low), danach Wilder. Flacher RSI ohne Gewinn/Verlust: 50.

Pivots: zwei geschlossene Nachbarn je Seite, striktes Extremum; gleiche Hochs/Tiefs nicht eindeutig. Zeit und spätere Kenntniszeit getrennt.
Fib 0,618 aus abgeschlossener bestätigter gerichteter Strecke, Snapshot nimmt die jüngste passende Strecke. Long-Zonen unter/auf Preis,
Short-Zonen darüber/auf Preis, maximal 0,5 ATR entfernt; EMA50 ebenso prüfen. Konkreten Stopanker später ausdrücklich im Adapter wählen.

Divergenz: letzte zwei passende bestätigte Preis-Pivots samt RSI, zusätzliche fünf Punkte getrennt von den 15 RSI-Zonen-/Steigungspunkten.
Fehlender Pivot-RSI ist unbekannt. **Nutzerentscheidung 07.10.2026: drei Basiskerzen ab Bestätigung durch die zweite Nachbarkerze.**
Alter 0/1/2 aktiv, ab Alter 3 keine Zusatzpunkte. Im 1h-Beispiel: 14:00 bestätigt, 17:00 abgelaufen. Keine vorläufigen/zukünftigen Pivots.

`scoreConfluence` bewertet Long/Short getrennt. Fehlende notwendige Daten: `score:null`, „nicht bewertbar“, kein kleinerer Nenner.
W=15 skaliert Basis B auf 85: B=80 und bestätigtes 1h-Muster mit 90 % Regelgüte ergeben 68+10,8=78,8. Leere erfolgreiche Musteranalyse
ist etwas anderes als nicht verfügbare Analyse (unbekannt, außer W=0). Äquivalente überlappende Familien je Richtung/Ebene zählen
stärksten Beitrag einmal; 1D/1d und 1W/1w jeweils identisch. Vorläufige ZigZag-Endpunkte geben nichts, Bildung auf geschlossenen Kerzen halb.
Musteradapter liefern nur aktuelle Fälle; der Kern prüft ihre Kenntniszeiten erneut.

Nutzerentscheidung 07.10.2026: höherer Trend aus dem letzten geschlossenen Kurs seiner eigenen 4h-/1d-Zeitebene, nicht dem Basis-Kurs.
Die bestehende Trend-Ampel verwendet weiterhin aktuellen Kurs; der Infobutton benennt diese unterschiedliche Kursbasis.

Ab 70 Kandidat ohne vorheriges Runden, 50 bis unter Mindestgrenze nur beobachten. Beide Trends dagegen sperren hart. Score ist keine
Wahrscheinlichkeit. `combineDirections` sperrt gleichzeitige Long-/Short-Kandidaten. `signalDecision` verlangt außerdem dieselbe
Parameterrevision/Richtung/Preisplanung, mindestens 2R und vollständige bestandene Kostenszenarien; keine Bot-/Orderfreigabe.

## Risiko und Kosten

`tradeLevels`: ausdrücklich gewählter Anker, ATR, Tickgröße. Entry in Handelsrichtung gerundet, SL konservativ weg vom Entry
(`Anker−d*ATR*Faktor`), TP nach Rundung mindestens 2R. Stop auf falscher Seite/negative Ziele ablehnen.
`referenceEntry`: frühestens nächster verfügbarer Beginn nach Entscheidung, Slippage ausdrücklich angeben; Level danach erneut prüfen.
Ausführung/Kurslücken/kompletter Simulator folgen in G10(d).

`positionSize`: selbst gewählte `marginEUR`, `fx` (USDT/EUR), Hebel, Entry. Fehlende Margin/FX: Menge/Eurogrößen `null`, Preislevel/Score
weiter nutzbar. Keine angenommene Kontosumme. `crossStatus`: Liquidationspreis/Abstand immer `null` mit Grund, keine Isolated-Freigabe.

`netPnl`: d*q*(Exit−Entry) minus beide Gebühren (Modellstandard 0,05 % je Seite) minus tatsächliche Fundingabrechnungen.
Funding `{kind:'history'|'scenario',complete,from,to,events}` braucht Abdeckung der Haltedauer; Ereignis `{at,rate,markPrice,quantity?}`.
Rate ist Dezimalbruch (`0.0005=0,05 %`), positiver Satz: Long zahlt/Short erhält. Tatsächlichen Satz am Termin **nicht** auf 8h normieren.
Modell-Haltedauer `[entryAt,exitAt)`: nur enthaltene Termine, keine aufgerundeten 8h-Blöcke/Dubletten. Optionale Teilmenge ist die am Termin
noch gehaltene Menge; PnL für mehrere Teilverkäufe bleibt Aufgabe des Simulators. Unvollständige Kosten: kein vollständiges Netto.
Künftiges Funding ist ein beschriftetes Szenario; historisches Funding muss belegt sein. Die **Punkteprüfung** normiert dagegen mit
`rate*8/intervalHours` aus damaligem tatsächlichem Intervall; unbekanntes Intervall/Vorzeichen sperrt.
`costFilter`: Modellmenge 1, positives TP-Netto / Betrag negatives SL-Netto mindestens 1,5, beide Pfade mit vollständigen Kostenszenarien.

## Kohorten

Fall: stabile `id`, `scope` einschließlich Richtung, `parametersKey`, Score damals, `decisionAt`, wirklicher modellierter `entryAt>=decisionAt`,
`maxHoldMs`, `resolvedAt`, `outcome:tp/sl/timeout/gap`, `netReturn`=Netto/anfänglicher Positionswert, `costsComplete`, `costKind:'history'`.
`cohortStats` trennt Markt/Coin/Richtung/Intervalle/Horizont/Modell/Parameter/Haltezeit/Slippage/Anker, Score ±10 und aktive Mindestgrenze.
Erst `entryAt+maxHoldMs<=asOf` reif: keine bevorzugte Auswahl schneller Gewinner. TP, SL und alle Timeouts im Nenner; positive Timeouts
sind keine TP-Treffer/vollen SL-Verluste. `barrierOutcome`: beide Barrieren in derselben Kerze konservativ SL. Kurslücken/feinere Daten im Simulator.
Unreife Fälle, Datenlücken und Konflikte getrennt; identische IDs einmal, widersprüchliche IDs heraus. Bekannte Preisauflösung mit fehlenden
Kosten verkleinert den TP-Nenner nicht; Netto-Erwartung unbekannt. Unbekannte Timeoutkosten nicht als positiv/negativ erfinden.

Unter 30 keine Prozentquote/Euro-Erwartung. Ab 30 Mittelwert aller vollständigen tatsächlichen Netto-Renditen, mit selbst gewählter
Modellgröße skalieren; keine doppelte Gebühr. Anfragezeitraum und tatsächliche Fallzeiten getrennt: kein Nachweis lückenloser Historie.
90-Tage-/2-Jahres-Feed, Coverage, getrennte 60/70/80-Backtests und Drawdown folgen in G10(d).

## Gewünschter Infobutton in G10(c)

Zugänglicher Knopf an den Signalkarten, kurze deutsche Erklärung, Restzeit und konkreter Prüfschritt; Text zusätzlich zur Farbe.
`divergenceInfo`: frisch `positive`, letzte Basiskerze `warning`, abgelaufen/unbekannt `muted`, Ablaufzeit und kurze Handlungsempfehlung.
Für `confirmedAt` die Schlusszeit der zweiten Nachbarkerze verwenden (`Pivot.time+3*periodMs` bei lückenlosen Kerzen),
`knownAt` bleibt die zusätzlich geprüfte tatsächliche Kenntniszeit. Spätes Laden alter Daten setzt das Alterslimit nicht zurück.
Frisch: „Trend, Setup und Kosten prüfen“; abgelaufen: „Keine Divergenz-Zusatzpunkte mehr. Neue Bestätigung abwarten.“
Bestätigung bedeutet fester Pivot, keine Gewissheit über nächsten Kurs. Sichtbarer Knopf mit G10(c), vorhandene G07-Anzeige bleibt erhalten.
Das Alterslimit betrifft nur die Divergenz-Zusatzpunkte. Kartenalter (kurz 1h/lang 24h laut G10), maximale Modell-Haltedauer und
Laufzeit echter Positionen getrennt erklären; eine alte Karte schließt keine Position automatisch.
