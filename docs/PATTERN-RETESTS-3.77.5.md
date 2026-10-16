# Rücktests von Chartmustern · 3.77.5

Ein bestätigter Ausbruch scheitert nicht mehr allein daran, dass eine spätere Kerze den damaligen Ausbruchskurs unterschreitet beziehungsweise überschreitet. Das Anzeige-Modell heißt jetzt **cpq-2**. Die Erkennung **pat-1**, Regelgüte, gemessenen Ziele und die Handels-/Backtestmodelle bleiben erhalten.

## Was die Anzeige bedeutet

| Zustand | Bedeutung |
| --- | --- |
| bestätigt | Bestätigter Ausbruch; die letzte abgeschlossene Folgekerze liegt außerhalb der Rücktestzone. |
| rücktest | Rücklauf zur Ausbruchszone oder dahinter; das Muster bleibt auswählbar und zählt zum Muster-Gesamtbild. Ein erster deutlicher Strukturbruch wird hier als **1/2** erklärt. |
| gescheitert | Zwei unmittelbar aufeinanderfolgende abgeschlossene Kerzen schließen jenseits der gegenüberliegenden Strukturgrenze einschließlich Puffer. Bullish: unter der Unterstützung; bearish: über dem Widerstand. |
| erfüllt | Das Ziel wurde auf einer abgeschlossenen Folgekerze berührt. Ein späterer Rückfall ändert diese Erfüllung nicht. |

Die bestehende Info-Schaltfläche **ⓘ am Muster** erklärt die Zustände, den maßgeblichen Grenzkurs, den Puffer und einen gegebenenfalls noch unbestätigten Strukturbruch. Tatsächlich gescheiterte Muster bleiben über „Ausgegraut im Chart zeigen“ untersuchbar.

## Rechenregeln

- **Puffer:** 0,25 × ATR 14 nach Wilder, nur aus den bis zum Ausbruch bereits abgeschlossenen Kerzen. Spätere Ausschläge erweitern den Puffer nicht. Bei fehlendem Rechenvorlauf dient die vorhandene ATR der Formation als Fallback; fehlt auch sie, steht ausdrücklich „ATR nicht verfügbar“, ohne erfundenen Puffer.
- **Rücktestzone:** bis 0,5 ATR vor der laufenden Ausbruchsgrenze sowie Rückläufe dahinter, solange kein bestätigter Strukturbruch vorliegt. Die erste Bestätigungskerze allein erhält noch keinen Rücktest-Status.
- **Keile, Dreiecke, Kanäle, Flaggen und Wimpel:** Unterstützung und Widerstand folgen ihren vorhandenen Linien über die Kerzenindizes. Nach einer zusammenlaufenden Spitze werden die Strukturgrenzen dort eingefroren; sie werden nicht verkehrt herum weitergeführt. Die bestehende Projektion endet weiterhin spätestens an der Spitze.
- **Böden, Tops, Schulter-Kopf-Schulter und Tasse mit Henkel:** Die vom Erkennungsmodell gelieferte Gegengrenze bleibt maßgeblich.
- Nur **Schlusskurse** bestätigen einen Strukturbruch. Dochte, laufende Kerzen und reine Live-Ticks reichen nicht. Gleichheit mit der gepufferten Grenze gilt nicht als Bruch. Erholung, ungültige Schlussdaten und eine Kerzenlücke unterbrechen die Bestätigungsserie.
- Der erste bestätigte Endzustand bleibt erhalten. Fallen Zielberührung und zweiter Bruchschluss in dieselbe Kerze, zählt konservativ „gescheitert“. Eine frühere Zielberührung bleibt „erfüllt“. Die Ausbruchskerze selbst zählt nicht als späterer Zieltreffer. Die bestehende Altersgrenze bleibt zehn Kerzen.
- Status und Teilpunkte werden auf geschlossenen Kerzen aktualisiert. Der Live-Kurs aktualisiert weiterhin Restziel und Chance/Risiko, ohne einen Endzustand zu erfinden. Die Live-Rücklaufmeldung verwendet die laufende schräge Grenze; im Hintergrundcache wird die aktuelle Kerze mitgerechnet.

Das ist eine Einordnung des Musters, keine Stop-Order und kein neuer Einstiegsauslöser. Zwei Schlusskerzen bringen eine Bestätigungsverzögerung mit sich. Die Anzeige ersetzt keinen gesetzten Stop.

Die gut sichtbaren Konstanten stehen oben in [shared/pattern-lifecycle.mjs](../shared/pattern-lifecycle.mjs). Chips, Qualitätsscore und Linien-Projektion verwenden diesen gemeinsamen Lebenszyklus. Ein gültiger Rücktest erhält dieselben Zustandspunkte wie ein bestätigter Ausbruch. Sonstige Scoregewichte und Restzielregeln bleiben gleich.

## Prüfungen

`tests/unit-pattern-lifecycle.js` prüft alle 19 Formationsarten und ihre unterstützten Richtungen: Keile, Dreiecke, Kanäle, Rechteck, Flaggen, Wimpel, Doppel-/Dreifach-Böden und Tops, beide Schulter-Kopf-Schulter-Formen sowie Tasse mit Henkel. Zusätzlich werden Rücktest/Erholung, Puffergrenze, offene Kerzen, Dochte, Lücken, gleichzeitige Ereignisse, unveränderliche Eingaben und die zeitliche Reihenfolge geprüft.

Der Fall mit **Ausbruch 58,29 → Rücklauf 58,20** ist als Regression enthalten: Die obere Keillinie liegt zu diesem Zeitpunkt bereits bei **58,10**. Das Muster bleibt gültig; eine anschließende Erholung auf **59,63** bestätigt es weiter. Das ist ein kontrollierter Rechenfall zum gemeldeten Problem, keine Rekonstruktion der vollständigen historischen LTC-Marktdaten des Screenshots.

`tests/m126.js` prüft die echte App in Chromium und WebKit: unveränderte Erkennung aller 19 Katalogfälle, auswählbare Rücktests, Projektionen, Info-Texte, echte Invalidierung, Zielerfüllung und Touch-Bedienung bei 320–1440 px. Der ältere Score-Test prüft weiterhin alle Farbthemen; eine gezielte Korrektur erhält in der deckenden Muster-Info-Box auch bei hellem Design mit Glas-Effekt die passenden Textfarben. Regressionen prüfen zusätzlich Prognose-Labels/-Punkte, MACD, Live-/Fadenkreuzbedienung, Vollbild und PWA-Update/Offline.

Zum lokalen Start: `node tests/unit-pattern-lifecycle.js` und `node tests/m126.js` bei vorhandener Playwright-Umgebung. Kein Test verschickt echte Telegram-Nachrichten. Browserprüfung ersetzt keinen Test auf einem physischen iPhone oder iPad.

## Kurzer Gerätecheck nach dem Update

1. In der App Version **3.77.5** laden; gegebenenfalls angebotene Aktualisierung übernehmen.
2. Ein bestätigtes Muster mit Rücklauf öffnen: Es bleibt bei einem normalen Rücktest farbig und auswählbar. ⓘ nennt Grenze und Puffer.
3. Beim ersten Schluss jenseits der Strukturgrenze auf den Hinweis **1/2** achten; erst zwei aufeinanderfolgende deutliche Bruchschlüsse beenden das Muster.
4. Ein erfülltes Muster bleibt nach einem Rückfall erfüllt. Gescheiterte Muster lassen sich weiter ausgegraut anzeigen.
5. Prognoselinie antippen, Chart verschieben/zoomen und MACD zuschalten; Preis, Fadenkreuz und bestehende Beschriftungen bleiben bedienbar.
