# Trading-Bot – klare Felder und iPhone-Darstellung

Arbeitsgruppe nach Orderflow 3.55.0; App-/SW-Version 3.56.0. Keine Änderung an Strategie-, Geld-, Stopp-, Revisions- oder Oracle-Berechnungen.

## Änderungen

- Fünf gerundete Einstellungsgruppen: Modus/Strategie, Größe/Risiko, Stop/Kursziel, Gewinnstopp und Verluststopp. Titel direkt über der zugehörigen Eingabe, kurze getrennte Hilfetexte, explizite Label- und ARIA-Zuordnung.
- Kleine Displays und schmale Karten zeigen Eingaben untereinander. Lange Hinweise und Buttons brechen innerhalb des Rahmens um. Felder und Bedienflächen mindestens 44 px; Eingaben mit 16-px-Schrift vermeiden iPhone-Zoom beim Fokussieren.
- „Übungswerte einsetzen“ füllt ausschließlich leere passende Felder: 1.000 USDT Übungsbasis, 1 % Risiko, 100 USDT Exposition, Gewinnbeispiel 10 USDT und Verlustbeispiel 5 USDT. Vorhandene Beträge bleiben erhalten. Keine USDT-Beispiele in EUR-/Prozentgrenzen; kein erfundener FX. Stopps und Simulation werden dabei nicht eingeschaltet. Werte sind frei editierbare Simulationsbeispiele, keine Kontodaten oder Profitabilitätszusage.
- Bestehende technische Modellstarts bleiben sichtbar und editierbar: Konfluenz, beide Richtungen, Hebel 20, eine Modellposition, Mindestscore 70 und 60 Sekunden Pause. Hebel 20 ist der vorhandene Rechenstart, kein konservativer Anlagevorschlag.
- Bestätigter Modelllauf steht als eigene Faktenübersicht vor den Einstellungen. Laufwerte und neuer Eingabeentwurf sind getrennt; eine deaktivierte Simulation wird als pausiert dargestellt. Nettoergebnis verwendet die bestehenden Gewinn-/Verlustfarben.
- Beim Öffnen werden vorhandene bestätigte Laufwerte einmalig in die Eingaben übernommen. Aktuell bearbeitete Felder bleiben beim Statusladen erhalten. Kein neuer Lauf/Reset durch Laden oder Darstellung.
- Bestandswarnungen trennen erwarteten Bestand, tatsächlichen Bestand und Datenzeit; lange Werte bleiben im Rahmen.
- FX, Wiederanlauf, Modellwerte und Protokoll sind gesonderte Klappbereiche. Bei Wahl einer EUR-Grenze öffnet sich der Referenzkursbereich.

## Kurz testen

1. „Trading-Bot“ öffnen: jede Beschriftung steht über einem Feld. Auf dem iPhone (auch 320 px) dürfen Feldwerte, längere Hinweise und Buttons nicht rechts aus ihrem Rahmen ragen.
2. „Übungswerte einsetzen“: Geldfelder werden befüllt, der Bot bleibt deaktiviert. Einen eigenen Betrag ändern und den Button erneut drücken: eigener Betrag bleibt.
3. EUR als Grenz-Einheit wählen: Referenzkursbereich öffnet sich. Ein leeres EUR-Grenzfeld darf durch den Übungsbutton nicht mit einem USDT-Beispiel gefüllt werden.
4. Eigene Werte prüfen, Simulation ausdrücklich aktivieren und getrennt starten. Der bestätigte Lauf erscheint oben; geänderte Einstellungen darunter ändern ihn nicht.
5. „Bestätigten Stand laden“ erhält einen bereits bearbeiteten Entwurf. Nach vollständigem Neuladen werden die tatsächlich gespeicherten Laufwerte wieder angezeigt, ohne zweiten Start. „Simulation pausieren“ zeigt „Pausiert“.
6. Hell/Dunkel/eigene Farben und beide Layouts prüfen. Laufprotokoll und Modellwerte lassen sich getrennt öffnen.

## Stand / offen

Technisch umgesetzt und nativ vorgeprüft: m80 51/51, m68 23/23, m70 61/61, Grenzkern 37/37, Runtime 16/16 und Liefergraph 6/6 (194/194); Lint 0 Fehler. Vollständiger serieller 133-Ziele-Gesamtlauf und Veröffentlichung folgen als eigene Gruppe. Reale Safari-/iPhone-/iPad-Abnahme bleibt offen. Bot weiterhin lokale/Oracle-Laufsimulation; privater Bitget-Ausführungsadapter unverändert nicht vorhanden.
