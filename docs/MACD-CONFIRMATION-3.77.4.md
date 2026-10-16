# MACD-Hinweise 3.77.4

Das ⓘ meldet neue MACD-Befunde, ohne in Seitwärtsphasen bei jeder kleinen Ein-Kerzen-Kreuzung grün oder rot zu blinken.

- **Gelb, ruhig:** Eine geschlossene Kerze hat MACD/Signal oder die Nulllinie gekreuzt. Die Erklärung ist sofort erreichbar und kennzeichnet den Hinweis ausdrücklich als unbestätigt.
- **Grün/Rot:** Auch die unmittelbar folgende Schlusskerze hält dieselbe Richtung und erreicht den Mindestabstand. Sie muss auf der neuen Seite schließen; Berührung, Rückkreuzung und zu kleiner Abstand reichen nicht. Ein verfehlter Abstand wird später nicht nachgemeldet.
- **Einmal etwa fünf Sekunden blinken, dann ruhig farbig:** Gleichzeitige Befunde teilen einen Impuls und verlängern ihn nicht. Ereignis-IDs aus Coin, Markt, Chart-Zeitrahmen und absoluten Ereigniszeiten werden lokal gespeichert. Wiederöffnen, Neuladen, Rückkehr zum Coin oder Wiederverbindung spielen denselben Hinweis nicht erneut ab. Mehr als 30 Sekunden verspätete Bestätigungen bleiben ohne Blinkimpuls farbig. Pause, Offline, Datenlücken und veraltete Daten neutralisieren die Anzeige.
- **Gemischte bestätigte Befunde:** Ein gemeinsamer grün/roter Impuls; danach statisch zweifarbig. Bei reduzierter Bewegung bleibt jede Hervorhebung statisch.

## Wie viel später kommt die Bestätigung?

Für Kreuzungen zählt die Kreuzungskerze als erste, die unmittelbar folgende als zweite. Es kommt genau **eine** Kerze zum ersten beobachteten Kreuzungsschluss hinzu. Maßgeblich ist das im Chart dargestellte Kerzenintervall einschließlich einer gewählten Detailauflösung, nicht das Intervall der Hauptanalyse.

| Chart-Kerzen | Zusätzliche Bestätigungszeit |
| --- | --- |
| 1m | 1 Minute |
| 5m | 5 Minuten |
| 15m | 15 Minuten |
| 1h | 1 Stunde |
| 4h | 4 Stunden |

Der gelbe Vorhinweis ist schon nach der ersten Schlusskerze sichtbar. Ein schneller Verlauf kann während der zusätzlichen Kerze bereits weit laufen; das Verfahren garantiert keinen rechtzeitigen oder profitablen Einstieg. Es gibt keine zusätzliche pauschale Sperrzeit über mehrere Kerzen. Die fünf Sekunden Blinken verzögern die Bestätigung nicht: Sie beginnt mit dem Hinweis.

Divergenzen brauchen wie bisher zwei abgeschlossene rechte Nachbarn des zweiten Kurs-Pivots. Dieser vorhandene Bestätigungsaufwand bleibt bestehen; es kommt keine weitere Wartekerze hinzu. Zusätzlich muss die MACD-Differenz zwischen den verglichenen Pivots den Mindestabstand erreichen.

## Mindestabstand und Aktualität

Der Mindestabstand beträgt 2 % der größten absoluten Auslenkung aus bis zu 60 damals bereits geschlossenen Kerzen, einschließlich der Kreuzungs-/Pivot-Kerze. Bei MACD/Signal zählt das Histogramm, bei der Nulllinie der MACD-Wert, bei Divergenzen die MACD-Differenz zwischen den Kurs-Pivots relativ zur MACD-Auslenkung. Die Schwelle bleibt am Ereignis fixiert: Zoomen, Verschieben, offene Kerzen und spätere Ausschläge ändern sie nicht rückwirkend.

Bestätigungen bleiben höchstens drei Schlusskerzen aktuell, bei einem Gegenbefund oder unterschrittenem Abstand kürzer. Im Dialog stehen die Bestätigungszeit, die Anzahl abgewarteter Folgekerzen und der tatsächliche sowie nötige Abstand.

Konstanten: `MACD_NOTICE` oben in `shared/macd-notice.mjs` (`confirmBars`, `minFraction`, `referenceBars`, `pulseMs`, `maxLagMs`, `seenLimit`, `storeKey`). `createMacdNotice` steuert ausschließlich Hinweise. `macdFindings` ist die UI-Auswertung; Vorauswahl-Modelle, Backtest, Orders, Alarme und MACD-12/26/9-Berechnung bleiben unverändert. Die vorhandenen Chart-Punktfilter und die Chart-Geometrie bleiben ebenfalls erhalten.

## Gerätecheck

1. Auf 1m/5m im MACD eine neue Kreuzung beobachten: zunächst gelbes ⓘ und „noch unbestätigt“, erst nach passender Folgekerze grün/rot.
2. Kurze Gegenkreuzungen dürfen keinen bestätigten Blinkimpuls erzeugen. Kleine mehrkerzige Schwankungen können weiterhin einzelne Filter bestehen; ein vollständiger Seitwärts-/Profitabilitätsfilter ist dies nicht.
3. Nach fünf Sekunden muss das Symbol ruhig farbig bleiben. Informationen öffnen/schließen, Coin wechseln und zurückkehren sowie die App neu laden: kein erneutes Blinken für denselben Befund.
4. Pause/Offline neutralisieren. Fadenkreuz, Zoom, Prognose-Labels und beide Vollbildansichten weiter bedienen.
