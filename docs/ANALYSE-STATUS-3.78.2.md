# Top-Down: verständliche Freigabeprüfung · 3.78.2

Im Bereich **Analyse** zeigt jeder ausgewählte Coin jetzt drei getrennte Stufen. Die bisherige pauschale 4h-Begründung steht nicht mehr hinter „15m“.

## 4h: Was blockiert?

Der Bereich „ⓘ 4h-Prüfung · Was stimmt überein?“ nennt fünf Einzelprüfungen mit tatsächlichen Kurs-/Indikatorwerten:

1. **Marktstruktur:** die letzten zwei bestätigten Hochs und Tiefs, jeweils vorher → aktuell. Gemischte oder gleiche Hochs/Tiefs bleiben neutral; fehlende bestätigte Paare heißen „Noch unklar“.
2. **EMA 50 zu EMA 200:** beide Werte und die Lage über/unter/gleich.
3. **Richtung EMA 50:** Vergleichswert vor drei 4h-Kerzen (12 Stunden) → aktueller Wert.
4. **Richtung EMA 200:** derselbe Zeitvergleich, separat erklärt.
5. **Schlusskurs zu EMA 200:** letzter berücksichtigter 4h-Schlusskurs im Verhältnis zur EMA 200.

Jede Prüfung trägt die Richtung **Long**, **Short** oder **Neutral**. Bei einem Widerspruch nennt die Zusammenfassung zwei konkret gegensätzliche Prüfungen. Bei neutralen/fehlenden Kriterien werden deren Namen genannt. Die Einzelprüfung öffnet sich bei einem neu angezeigten neutralen Coin automatisch; manuelles Zu-/Aufklappen bleibt während der Aktualisierung erhalten. Kleine echte EMA-Unterschiede werden mit zusätzlicher Genauigkeit angezeigt, damit unterschiedliche Werte nicht identisch gerundet erscheinen.

Der Info-Bereich erläutert EMA 50/200, die Periodeneinstellung „200“, bestätigte Hochs/Tiefs, den 12-Stunden-Vergleich und die Farben. Der verwendete geschlossene 4h-Zeitpunkt steht in deutscher Zeit dabei. Die Farben sind Einzelrichtungen; sie sind noch keine Einstiegsfreigabe.

## 1h und 15m

- **4h neutral:** 1h und 15m heißen „Noch nicht geprüft“ und nennen die vorausgehende Freigabe.
- **4h freigegeben, 1h noch nicht gültig:** Unterschieden werden fehlende Konfluenzzonen und vorhandene, aber noch nicht gültig berührte Zonen. 15m ist noch nicht geprüft.
- **1h gültig:** Die tatsächlich berührte Zone wird genannt, statt eines beliebigen ersten Kandidaten. Ohne vollständigen Einstieg steht bei 15m „Noch kein Einstieg“, mit den weiterhin benötigten Voraussetzungen (Umkehr, Schlussbruch und passende Ziele).
- **15m bestätigt:** Einstieg, Stop, Ziele und CRV erscheinen wie berechnet.

Die Chart-Info verwendet dieselbe Diagnose wie das Analyse-Menü. Datenfehler/fehlende Schlusskerzen bleiben ausdrückliche Datenmeldungen.

## Technik und Prüfung

- `analysis-top-down.mjs` liefert ausschließlich zusätzliche Diagnosewerte und die berührte Setup-Zone. Richtung, Grenzwerte, Bestätigung, Preise, Kerzenfilter und Modellversion bleiben unverändert.
- `analysis-status.mjs` formatiert die gemeinsam genutzte Diagnose; je Auswertung/Format zwischengespeichert. Keine zusätzlichen Börsenabrufe.
- `analysis-view.mjs` zeigt Stufen, aufklappbare Einzelprüfung, Info und Werte. Bestehende Coin-Navigation, Fokus-Wiederherstellung und Telegram-Schalter bleiben erhalten.
- `analysis-chart.mjs` und `weather-widget-v2.html` binden dieselbe Erklärung ein. Styles sind auf den Analyse-Status begrenzt.

Tests vergleichen Long/Short/Neutral einschließlich Signalen und Setup-Daten mit der veröffentlichten 3.78.1-Engine, prüfen sehr kleine Änderungen, Gleichheit, fehlende bestätigte Pivots, Stufenzuordnung und die echte berührte Zone. Native Browserprüfungen rechnen widersprüchliche OHLCV in Chromium/WebKit, testen 320–1440 px, Touch, Klappzustände, Coin-Wechsel und Chart-Info. Telegram wird ausschließlich lokal simuliert.

## Auf iPhone/iPad testen

1. App aktualisieren, Version **3.78.2** kontrollieren; Analyse öffnen und einen Coin mit neutralem 4h-Bias auswählen.
2. Widerspruch lesen; bei den fünf Prüfungen Werte und Richtungen vergleichen. 1h/15m müssen als noch nicht geprüft erscheinen.
3. Info öffnen: EMA-Erklärung und Zeitvergleich lesen. Diagnose zuklappen, kurz warten: sie muss geschlossen bleiben.
4. Zu anderem Coin wechseln und Chart-Info öffnen: dieselben coinbezogenen Werte/Begründungen erwarten.
5. Bei vollständigem Signal bleiben Einstiegs-/Stop-/Ziellinien und Telegram-Verhalten erhalten; keine neuen Signale allein durch die Anzeige erwarten.
