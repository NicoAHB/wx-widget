# ZigZag-Prognose antippen · 3.76.3

Die türkis gestrichelte ZigZag-Prognose hatte bisher keinen Touch-Bereich für
die Wertanzeige. Version 3.76.2 markierte nur ausgewählte Chartmuster-Projektionen.
Damit fehlten im gemeldeten Fall (ETC, 4h, Heikin-Ashi, Hochformat-Vollbild)
sowohl Kurs-Label als auch der Punkt.

Die vorhandene ZigZag-Linie bekommt jetzt ebenfalls ein unsichtbares, 26 CSS-px
breites Fingerziel. Ein kurzer Tipp zeigt genau ein Label mit Kurs, UTC-Uhrzeit,
oberer und unterer Bandgrenze sowie Dollar-Abstand. Ein türkiser Punkt markiert
den gewählten Zeitpunkt auf der Linie. Die Grenzen stammen aus dem vorhandenen
Prognosekegel, ohne Vermischung mit Chartmuster-Linien. Es werden keine neuen
sichtbaren Linien hinzugefügt.

Die Auswahl bleibt an ihren absoluten Zeitpunkt gebunden. Wird die Prognose neu
gezeichnet, folgen Kurs und Punkt dem neuen Verlauf. Ein anderer Chart-Tipp
schließt Label und Punkt, die Prognose bleibt sichtbar. Coin-/Zeitrahmenwechsel
setzen die Auswahl zurück. Bestehende Pan-, Pinch- und Vollbildbedienung bleiben
erhalten. Forecast, Lernfaktor, Band, OHLCV-Daten und Signalmodell bleiben
unverändert; die Ergänzung liest nur bereits berechnete Darstellungswerte aus.

## Geänderte Stellen

- `weather-widget-v2.html`: ZigZag an die bestehende Wertanzeige anbinden,
  Chart-Hilfe ergänzen, Releasepfade auf 3.76.3 setzen.
- `shared/projection-inspector.mjs`: Prognosefamilien trennen und reine
  Bandgrenzen von antippbaren Linien unterscheiden.
- `tests/m123.js`: Screenshot-Fall mit ETC-4h-Kerzen, HA, Touch/Maus,
  Live-Neuberechnung, Größenwechsel und beiden Vollbilddarstellungen.
- `tests/unit-projection-inspector.js`: getrennte Bandwerte mit gleichzeitig
  vorhandenen Muster-/ZigZag-Daten prüfen.
- Releasebündel, Lieferlisten, Service Worker und Übergabe aktualisieren.
  Der Dienstquellstand bleibt 2.15.1; ältere Bündel bleiben unverändert.

## Kontrolle auf iPhone und iPad

1. Version 3.76.3 öffnen, ETC und 4h wählen, ZigZag-Prognose einschalten.
   Mit ausreichender Historie sollte die türkis gestrichelte Linie erscheinen.
2. Im normalen Chart und Hochformat-Vollbild auf die Linie tippen. Kurs und
   Uhrzeit müssen erscheinen; der türkise Punkt muss direkt auf der Linie sitzen.
3. Eine andere Stelle derselben Linie antippen: Kurs, Zeit und Punkt wandern.
   Oben/Unten beziehen sich auf das ZigZag-Band an dieser Uhrzeit.
4. Wischen und mit zwei Fingern zoomen; es darf keine zusätzliche Auswahl durch
   die Bewegung entstehen. Auch die gedrehte Vollbildansicht prüfen.
5. Bei einer tatsächlichen Neuberechnung bleiben Auswahlzeit und ein einzelnes
   Label erhalten; Kurs und Punkt werden mitgeführt.
6. Daneben tippen: nur Label und Punkt verschwinden. Die Prognose bleibt sichtbar.
7. Coin wechseln: vorherige Auswahl verschwindet. Bei BTC sind hohe Kurse im
   Label ganzzahlig, bei ETC mit vier Nachkommastellen formatiert.

Automatische Geräteprüfungen verwenden Chromium und WebKit mit simulierten
Bildschirmgrößen von 320 bis 1440 px. Physische iOS-Geräte stehen für die
Abnahme nicht zur Verfügung. Die Veröffentlichung wird zusätzlich direkt auf
GitHub Pages mit kontrollierten ETC-4h-Kerzen und allen PWA-Dateihashes geprüft.
