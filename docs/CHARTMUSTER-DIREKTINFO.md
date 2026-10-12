# Muster direkt erklären – 3.64.1

Die Chartmuster-Kacheln im Kursbereich sind direkt erklärbar:

1. **Kurz antippen:** Muster im Chart einzeichnen oder ausblenden, wie bisher.
2. **Etwa eine halbe Sekunde gedrückt halten:** Die vorhandene Erklärung öffnet sich. Das Loslassen verändert die Zeichnungsauswahl nicht.
3. **ⓘ antippen:** Dieselbe Erklärung sofort öffnen. Der Knopf hat mindestens 44 × 44 px Tippfläche. Auch ungültige/abgelaufene Muster bleiben darüber erklärbar, ihre Zeichnung bleibt gesperrt. Der aktive Infoknopf bleibt in allen Hintergrundmodi kontrastreich, während der gesperrte Mustertext abgegraut ist.
4. **×, Schließen oder Escape:** Erklärung wieder schließen. **Im Chart zeigen** setzt den Ausschnitt auf das erklärte gültige Muster. Bei zwischenzeitlicher neuer Sortierung wird dieses Muster anhand seiner ID wiedergefunden.

Die Erklärung zeigt die bestehende Kerzen-/Formationszeichnung, Musterbeschreibung, Bestätigungsbedingungen, gemessene Werte, verfügbare Kurslevel und die Begründung der Regelgüte. Es werden keine neuen Prognosen oder Erfolgswahrscheinlichkeiten berechnet.

**Seitlich wischen** scrollt weiterhin die Liste. Bewegung, abgebrochene Touch-Gesten, Coinwechsel und entfernte Kacheln beenden einen ausstehenden langen Druck. Die normale Browser-Textauswahl wird nur für die Kachel unterdrückt; Texte in der Erklärung bleiben zugänglich. Rechtsklick am Computer öffnet ebenfalls die Erklärung.

Im vergrößerten Chart zuerst **Werkzeuge** öffnen; danach sind Kacheln und ⓘ erreichbar. Die Höhe der Musterleiste bleibt gleich, und bestehende Zeichnungen werden durch das Öffnen einer Erklärung nicht ein-/ausgeschaltet.

## Kurzer iPhone-/iPad-Test

Ein erkanntes Muster kurz antippen, dann auf demselben Muster länger drücken. Die Erklärung muss erscheinen und die eingezeichnete Formation erhalten bleiben. Mit × schließen; ein weiterer kurzer Tipp muss die Zeichnung wieder entfernen. Anschließend seitlich wischen, ⓘ verwenden und das Ganze im vergrößerten Hochkant-Chart wiederholen.

## Betroffene Stellen

- `weather-widget-v2.html`: Kachelgruppe mit getrenntem Infoknopf, begrenzter Drucktimer, Abbruch-/Klickschutz und bestehendes Info-Sheet; keine Änderung der Mustererkennung, Alarme, Kurse oder Handelslogik.
- `tests/m93.js`: echte Touch-Gesten im Browser, Maus/Tastatur, Kontextwechsel und 320–1440 px; `tests/m92.js` behält die vorhandenen Chartprüfungen.
- `sw.js`, `server/release-manifest.json`, `bundles/3.64.1/`: gemeinsamer App-/SW-Release. Oracle-Dienst unverändert 2.12.0; hierfür kein Oracle-Update nötig.

Automatische Touchprüfungen laufen in Chromium. Der praktische Safari-Test auf den echten Geräten bleibt separat.
