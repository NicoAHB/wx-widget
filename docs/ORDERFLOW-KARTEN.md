# Orderflow-Ansicht 3.55.0

Nutzerauftrag nach der veröffentlichten 3.54.0: übersichtliche Einzelkarten, Klappbereiche, ruhiges Signal und Demo-Kurs wie in der Vorauswahl.

## Änderungen

- Genau fünf gerundete Karten je Minuten-/Stundenblock; OHLC, waagerechte Kerze, Volumen, Delta und Kerzenbild bleiben zusammen. Der laufende Zeitplatz bleibt gestrichelt.
- Minuten, Stunden, Orderflow-Signal und Positionsbegleitung lassen sich einklappen. Auch BTC, Demo, Gruppen, Einstellungen, Journal und Einstiegsformular merken ihren Klappzustand in `scalpdesk.orderflow.v1`. Einheitenwechsel überschreibt diese Auswahl nicht; die persönliche Sicherung enthält sie.
- Signal direkt unter BTC, vor den anderen Live-Blöcken. Feste Flächen für Badge/Score, Begründung, Warnungen und Erklärung verhindern Höhenwechsel. Längere Texte bleiben scrollbar und per Tastatur erreichbar. Bestehender Safari-Scrollausgleich bleibt aktiv.
- Demo-Kurs und tatsächliche Einstieg-/Ausstiegsklicks verwenden die Kursfunktion der Vorauswahl. Bei vorhandener Kachel exakt deren Spot-/Futures-Quelle, sonst die bestehende Hauptkursquelle. Keine Futures-Ersatzquote, wenn der Vorauswahl-Livekurs fehlt; Frischeprüfung bleibt intern erhalten.
- Neue Übungen speichern ihre Kursquelle. Alte Übungen werden erhalten, ein Quellenwechsel wird erklärt. Spot-Übungen erhalten keine aus Futures-ATR/Levels abgeleiteten Schutzvorschläge. Native Positionen und bestehende Handelsmodelle bleiben unverändert; Kerzen/Score/BTC weiterhin ausdrücklich Futures.

## Kurz testen

1. Minuten und Stunden aufklappen: je fünf Rahmen mit zusammengehörigen Werten und Restzeit. Einzelne Bereiche schließen, Seite erneut öffnen und die gespeicherte Auswahl prüfen.
2. Orderflow-Signal beim Live-Betrieb beobachten: die Box und ihre Position bleiben ruhig. Längere Warnungen/Erklärungen innerhalb der Textfläche scrollen.
3. Demo aufklappen: Livekurs mit derselben Coin-Kachel der Vorauswahl vergleichen. Einsatz/Hebel einstellen, Kurs antippen, später zum dann aktuellen Vorauswahlkurs schließen. Gewinn grün, Verlust rot.
4. Hell/Dunkel/eigene Farbe und beide Layouts prüfen. Im Flugmodus bleibt der Demo-Klick gesperrt, bis dieselbe Kursquelle wieder frische Werte liefert.

## Prüfstand

Demo-Kern 30/30 und vorhandene Kerzen-/Demoansicht m76 19/19 bestanden. Neue Karten-/Geometrie-/Quellenprüfung m79 44/44 (beide Layouts/acht AA-Farben, zusätzlich Spot-/Futures-only), Signal-/Volumen-/Feed-/Journalkern unverändert grün, Releasegraph 6/6. Alle 15 gezielten Zielprogramme nach vollständigen Befundnachläufen grün: insbesondere m77 33/33, m78 16/16, m74 73/73, m75 15/15, Safari-Verankerung m32 5/5 und m34 9/9, G14 m70 61/61. Vollständiger serieller Gesamtlauf mit 132 Zielen folgt. Erste Testvorbedingungen werden erhalten: Vorauswahl muss tatsächlich geladen sein; Handelsknöpfe erst nach Zeichnung prüfen; Termintext exakt an den tatsächlichen Veto-Text binden. App-/Modul-Lint bisher 0 Fehler, 3 bestehende Warnungen. Noch nicht veröffentlicht.

Die optionale private VM und reale iPad-/Safari-/CORS-/Anbieterabnahmen bleiben separat offen. Keine echten Orders oder neuen Zugangsdaten.
