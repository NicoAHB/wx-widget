# Darstellungsprüfung für iPhone und iPad

App 3.74.1 · Dienst unverändert 2.15.1

Der Nutzer beauftragt Punkt 5 der Optimierungsvorschläge (mobile Darstellungsprüfung). Zu Punkt 2 (Positionsrisiko) und Punkt 3 (Signalgründe) wünscht er ausschließlich Beispiele. **Diese beiden Funktionen werden nicht ergänzt oder verändert.** Die Vorschauen verwenden frei gewählte Beispieldaten und sind nicht mit der App verbunden.

## Kleine Darstellungsanpassungen

- Transparente große Flächen erhalten dezente dunkle Textkanten. Dadurch heben sich Beschriftungen auch bei 70 % Transparenz und einem sehr hell gewählten Hintergrund besser ab. Hintergrundfarben, eingestelltes Alpha, Panelgröße sowie Grün-/Rot-Paletten bleiben erhalten.
- Deckende Unterkarten, Felder und gefüllte Schaltflächen erhalten diesen Texteffekt nicht; transparente verschachtelte Bereiche erben ihn. Der große Chart einschließlich seiner Unterbereiche bleibt vollständig ausgenommen.
- Das neue Feld für die Hintergrundfarbe ist explizit 16 px groß. Das vermeidet eine Abhängigkeit von der automatischen Vergrößerung nativer Auswahlfelder und beugt Safari-Fokuszoom bei kleiner Formularschrift vor. Seine Touch-Höhe bleibt 44 px.
- Keine neuen Abfragen, Timer, dauerhaft erzwungenen Compositor-Ebenen oder Änderungen an Live-Daten, Modellen, Stops und Telegram.

Betroffen: `weather-widget-v2.html`, neuer Browserablauf `tests/m119.js`, Registrierung im seriellen Gesamtlauf, neues unveränderliches Versionsbündel `bundles/3.74.1/`, Service Worker und Lieferliste. Bestehende Bündel bleiben unverändert.

## Prüfung und Grenzen

Der neue Ablauf prüft die Original-App bei 320/390/430/768/820 px in Chromium und zusätzlich in Playwright-WebKit. HTTP- und WebSocket-Daten kommen ausschließlich aus den vorhandenen lokalen Markt-/Telegram-Attrappen. Der WebKit-Adapter vertraut nur dem lokalen Testzertifikat; es werden keine echten Telegram-Nachrichten oder Aufträge gesendet. Geprüft werden Überläufe, Touch-Flächen, Formularschrift, native Bedienung, Blur-Eigenschaften, Chart-Ausnahme, Textkanten bei hellen Hintergründen, unverändertes Alpha, Start-/Neustart sowie Seitenfehler. Vorhandene mobile Vorauswahl-, Gerätewahl-, Farb-, Navigation-, Offline- und Releaseprüfungen laufen zusätzlich seriell.

Ausführung auf einem vorbereiteten Rechner mit Playwright und Browser-Abhängigkeiten:

```sh
node tests/m119.js
WX_BROWSER=webkit node tests/m119.js
```

Die Scroll-Messung vergleicht 0/12/24 px Blur über Animation Frames des Testrechners. Sie dient der Diagnose. Maximale Unschärfe beansprucht erwartungsgemäß mehr Zeichenaufwand. Die Werte sind **keine Messung eines iPhone-Prozessors, seines Akkus oder der nativen Scrollträgheit**. Es wird kein automatisches Limit eingeführt und kein eingestellter Blurwert still reduziert. Standard bleibt 12 px, 0 bleibt aus.

Ein physisches iPhone oder iPad ist in dieser Umgebung nicht angeschlossen. Playwright-WebKit unter Linux ist nicht Safari auf iOS. Eine Abnahme von Safari-Bedienoberfläche, Bildschirmtastatur, Browserleisten, Home-Bildschirm-Modus, tatsächlicher Akkuentwicklung und dauerhafter Flüssigkeit auf einem realen Gerät bleibt offen. Der verwendete WebKit-Testport bestätigt die Filtereigenschaften; seine Screenshot-Compositing-Darstellung ist kein Nachweis des GPU-Blur-Eindrucks auf iOS.

**500/500 Einzelprüfungen in elf gezielten Läufen bestanden** (zehn Programme, davon der neue Ablauf zusätzlich in WebKit). Lint ohne Fehler, drei bekannte Warnungen. Isolierte Freigabeprüfung des fertigen Pakets bei 320/390/768 px bestanden, einschließlich 16-px-Feld, Textkontur, deckendem Chart und Neustart-Speicherung. Öffentlicher Liefernachweis im Release-PR. Kein vollständiger neuer Gesamtlauf.

## Kurzer Test am echten Gerät

1. Version 3.74.1 laden, Einstellungen → Darstellung & App → Darstellung öffnen. Farbwahl fokussieren; anschließend ins Formular zurückkehren. Kein störender Zoom oder abgeschnittener Inhalt.
2. Transparenz 70 %, Kreise und Linie an, sehr helle Hintergrundfarbe wählen. Beschriftungen und Zahlen sollten sich erkennbar abheben. Auch Hell/Dunkel wechseln.
3. Bei 0/12/24 px Unschärfe über Vorauswahl, Positionen und Einstellungen scrollen. Auf Ruckeln, Wärmeentwicklung und längerfristigen Akkuverbrauch achten; die Maximalstufe separat beurteilen.
4. Regler, native Schalter und Farbauswahl bedienen; anschließend neu starten. Werte bleiben erhalten, Hauptschalter und Zurücksetzen funktionieren.
5. Großen Chart normal und im Vollbild öffnen: deckend, ohne durchscheinende Kreise oder Linien. Zoomen, Blättern, Listenwechsel und langes Verschieben weiter prüfen.
