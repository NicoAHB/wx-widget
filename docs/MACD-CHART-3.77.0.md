# MACD im Chart · 3.77.0

Im Bereich **Chart-Ebenen, Whales & Werkzeuge** gibt es den neuen Schalter
**MACD**, daneben einen **i-Button**. Standardmäßig bleibt MACD aus. Die Auswahl
wird zusammen mit den vorhandenen Chart-Ebenen auf dem Gerät gespeichert und
von „Alle ausblenden / einblenden“ berücksichtigt.

Eingeschaltet erscheint unter dem Kursverlauf ein eigener Bereich:

- Blaue MACD-Linie: EMA 12 minus EMA 26.
- Orange Signallinie: EMA 9 der MACD-Linie.
- Grau gestrichelte Nulllinie, mit „0“ beschriftet.
- Histogramm: MACD minus Signallinie, grün positiv und rot negativ.

Die Zeitachse ist exakt dieselbe wie im Kurschart. Pan, Pinch, Maus-Zoom und
Vollbild verwenden die vorhandene Bedienung. Der MACD hat eine eigene vertikale
Skala und verändert keine Preiswerte. Beim Ausschalten wird die bisherige
Preisfläche wiederhergestellt. Die große Chartfläche bleibt deckend, ohne
Hintergrund-Kreise oder -Linien.

Es werden die vorhandenen normalen Schlusskurse und die unveränderte
12/26/9-Berechnung verwendet, auch bei eingeschaltetem Heikin-Ashi. Sind feinere
Detail-Kerzen gewählt, folgt der MACD deren sichtbarem Intervall. Die Erklärung
nennt dann zusätzlich das Hauptanalyse-Intervall. Keine neuen Datenabrufe,
Anbieter, Alarme oder automatischen Trades.

## Erklärungen und Hervorhebungen

Der i-Button öffnet ein auf kleinen Bildschirmen scrollbar bleibendes Infofenster
mit drei aufklappbaren Strategien und jeweils einer bullishen/bearishen Erklärung.
Ein bestätigter Befund hebt die passende Erklärung grün oder rot mit Leuchtrand
hervor. Auch die geschlossene Abschnittsüberschrift nennt dessen Richtung.

1. **Signallinien-Kreuzung:** MACD minus Signal wechselt von ≤0 auf >0 oder
   von ≥0 auf <0. Bloß oberhalb/unterhalb der Signallinie zu liegen ist keine
   neue Kreuzung. Ein positives Histogramm bedeutet nicht zwingend MACD über 0.
2. **Nulllinien-Kreuzung:** Der MACD wechselt von ≤0 auf >0 bzw. von ≥0 auf <0.
   Dies entspricht EMA 12 über/unter EMA 26, ohne garantierte Trendstärke.
3. **Reguläre Divergenz:** Die letzten beiden bestätigten Kurs-Tiefs/Hochs werden
   mit den MACD-Linienwerten an denselben Kerzen verglichen. Tieferes Kurs-Tief
   und höherer MACD ergeben bullish; höheres Kurs-Hoch und niedrigerer MACD bearish.
   Preis-Pivots müssen streng sein: je zwei geschlossene Nachbarkerzen links und
   rechts, Betrachtungsfenster 60 Kerzen. Kein vorläufiger Pivot zählt als bestätigt.

Ein Befund bleibt höchstens drei abgeschlossene Kerzen ab der tatsächlichen
Bestätigung hervorgehoben. Signal-/Nullkreuzungen verfallen früher bei Rückkehr
auf/über die Gegenseite; Divergenzen beim erneuten Unterschreiten/Überschreiten
des zweiten Extrempunkts. Gleiche Werte erzeugen keine Divergenz. Gegensätzliche
Divergenzen mit gleicher Bestätigungszeit bleiben neutral.

Die laufende Kerze aktualisiert die Linien und das Histogramm, zählt aber nie als
Bestätigung. Das Infofenster nennt die geprüfte Schlusskerze und den Zeitpunkt
der Erkennung in UTC. Pause, Offline, Datenfehler, Kerzenlücken oder veraltete
Schlussdaten neutralisieren die Hervorhebung. Seitwärtsphasen/Fehlsignale werden
in der Erklärung angesprochen. Die bestehenden Vorauswahl-Modelle und deren
Backtests bleiben unverändert; ihre MACD-Info verweist nun auf die Chart-Ebene.

## Geänderte Stellen

- `shared/macd-chart.mjs`: reine Befundprüfung, SVG-Unterbereich, Infofenster.
- `weather-widget-v2.html`: Schalter, gespeicherte Auswahl, Darstellung,
  gemeinsame Chart-Geometrie und Aktualisierung; neue Releasepfade.
- `shared/watch-signal-reasons.mjs`: bisherige Aussage über die fehlende
  MACD-Linie durch die neue Bedienungsanleitung ersetzen.
- `tests/unit-macd-chart.js`, `tests/m124.js` und aktualisierter Info-Text-Test.
- Releasebündel 3.77.0, Service Worker, Lieferlisten und Übergabe. Ältere Bündel
  unverändert; Dienstquellstand weiterhin 2.15.1.

## Gerätecheck

1. Am iPhone/iPad Chart-Ebenen öffnen, MACD einschalten. Zwei verschiedenfarbige
   Linien, graue Nulllinie und Histogramm müssen unter dem Kurs erscheinen.
2. Wischen, mit zwei Fingern zoomen und den Zeitrahmen wechseln. Kerzen und MACD
   müssen synchron bleiben. Heikin-Ashi verändert die MACD-Grundlage nicht.
3. i-Button öffnen, alle drei Strategien auf-/zuklappen. Erklärung und Schließen
   müssen im Hochformat auf den Bildschirm passen, ohne seitliches Scrollen.
4. Bei einem frischen bestätigten Befund muss die richtige Erklärung leuchten;
   Richtung und Zeitpunkt stehen dabei. Die offene Kerze darf die Bestätigung
   nicht überschreiben. Pause/Offline müssen diese Hervorhebung neutralisieren.
5. Beide Vollbildansichten prüfen. Ausschalten stellt die ursprüngliche
   Preisfläche wieder her. Neu laden sowie „Alle aus-/einblenden“ prüfen.

Automatische Tests verwenden kontrollierte Kerzendaten in Chromium und WebKit,
einschließlich 320–1440 px, Live-Pfad, Detail-Kerzen und beiden Vollbildansichten.
Physische iOS-Geräte sind nicht verfügbar. Die veröffentlichte Seite wird
zusätzlich im Browser und anhand aller PWA-Dateihashes kontrolliert.
