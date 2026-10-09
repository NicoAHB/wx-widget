# Orderflow-Ansicht 3.55.0

Nutzerauftrag nach der veröffentlichten 3.54.0: übersichtliche Einzelkarten, Klappbereiche, ruhiges Signal und Demo-Kurs wie in der Vorauswahl.

## Änderungen

- O/T und H/S der Minutenwerte optisch direkt untereinander wie bei den Stundenwerten, auch auf dem Handy. Getrennte 44-px-Tippflächen erhalten; Anzeige und Treffbereiche werden unabhängig geprüft.
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

Alle **132 Zielprogramme** vollständig seriell auf eingefrorenem Produktstand `98f6f74`. Nach vollständigem Nachlauf von m77 **33/33** und m79 **49/49** insgesamt **4184/4184**, Status/Rauch/Sicht erfolgreich. Lint **0 Fehler** (3 bestehende App-/2 Engine-Warnungen); alle **107 Produktdateien** unverändert. [Vollständiger Testnachweis](ORDERFLOW-KARTEN-TESTNACHWEIS.md).

Erstbefunde sind erhalten: manueller Begleitungsabschluss nach Reload einmal nicht bestätigt; zusätzliche gezeichnete Knopf-/Live-Bereitschaft und sichere Diagnose im Test, vollständiger Nachlauf erfolgreich. Bildnachweis wartet nach Coinwechsel auf alle 40 tatsächlichen OHLC-Werte und zehn sichtbare Kerzen. Ursache des einzelnen Abschluss-Timeouts nicht sicher belegt, keine Fachgrenze verändert. Der vorherige Gesamtlauf wurde für den zusätzlichen Minuten-Abstandswunsch nach 55 grünen Zielen bewusst gestoppt; Rohlogs getrennt erhalten. Veröffentlichung folgt nach diesem abgeschlossenen Prüfstand.

Die optionale private VM und reale iPad-/Safari-/CORS-/Anbieterabnahmen bleiben separat offen. Keine echten Orders oder neuen Zugangsdaten.

Öffentlich ausgeliefert: App/SW 3.55.0 über PR #87; Pages und alle 51 PWA-Dateien per HTTPS geprüft. [Liefernachweis](ORDERFLOW-KARTEN-LIEFERUNG.md).
