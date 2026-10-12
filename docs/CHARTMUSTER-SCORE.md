# Chartmuster-Score – Scalp Desk 3.65.0

Der Chart zeigt **Score-Punkte von 0 bis 100** und weiterhin die ursprüngliche **Regelgüte in %**. Der Score ergänzt die Form um Marktumfeld und verbliebenes Potenzial. Er ist keine Erfolgswahrscheinlichkeit und verändert keine Handels-, Bot- oder Alarmregel.

## Bedienung

1. Im Bereich **Chart** einen Coin und Zeitraum öffnen. In den Musterkacheln stehen Name/Richtung/Zustand sowie `Score … · Regelgüte … %`. Der dezente Balken zeigt die Punkte; die Farbe zeigt weiterhin die Musterrichtung. Aktuelle Muster mit hohem Score stehen vorne. Gescheiterte, ungültige, erfüllte und abgelaufene Muster stehen gedimmt hinten.
2. **Kurz tippen** zeichnet ein/aus. **Lange drücken oder ⓘ** erklärt das Muster, alle sieben Teilwerte und fehlende Eingaben. Bei inaktiven Chips bleibt ⓘ bedienbar; Zeichnen/Zoom sind dort gesperrt. Die bisherige historische Mustererklärung im großen Musterpanel behält ihren Chart-Zoom zur Untersuchung vergangener Verläufe.
3. **Muster-Gesamtbild · 5m–1w** antippen: Anteile, Zahl bewerteter Ebenen, Musterzahl und letzte abgeschlossene Kerze je Ebene ansehen. `6/7 Ebenen` bezeichnet ein Teilbild. Ohne gerichtete Muster mit positiven Punkten erscheint keine erfundene 50/50-Verteilung.
4. Bestehende Mindestregelgüte, Bullish/Bearish-Filter und Gap-Modus bleiben bedienbar. Der Richtungsfilter ändert die Chipanzeige; das Gesamtbild enthält beide Richtungen. Die Mindestregelgüte gilt auch dort.

**Score = Qualitätsmaß, keine Garantie für den Ausbruch.** Hoher Score allein ist keine Kaufempfehlung. Das eingezeichnete Invalidierungsniveau ist keine gesetzte Stop-Order.

## Faktoren und Startwerte

Alle Parameter stehen zentral in `shared/chart-pattern-quality.mjs`, Objekt `PATTERN_QUALITY_CONFIG`. Bei Änderung der Gewichte ihre Summe bei 100 halten. Das Anzeigenmodell heißt **cpq-1**; die Erkennung bleibt **pat-1**. Die bestehenden Chips zeigen Formationen; die Kerzenmuster und ihre Erkennung bleiben erhalten. Kein Vermischen mit Konfluenz-, PO3-, Orderflow- oder Bot-Scores.

| Faktor | Maximalpunkte | Nachvollziehbare Regel |
|---|---:|---|
| Regelgüte / Form | 25 | Unveränderte pat-1-Regelgüte × 0,25. Die Originalgüte enthält bereits einzelne Volumen-/Bestätigungsregeln; sie wird nicht neu definiert. |
| Zeitebene | 20 | 1m 0,20; 5m 0,30; 15m 0,40; 1h 0,55; 2h 0,65; 4h 0,75; 1d 0,90; 1w/1M 1,00, jeweils × 20. |
| Trendübereinstimmung | 15 | Genau die vorhandenen Trend-Chip-Urteile auf 5m, 15m, 1h, 4h, 1d: gleichgerichtet 1, Halten 0,5, Gegentrend 0. Mittel über die fünf Ebenen; fehlende/veraltete Ebenen geben keine Punkte. Neutralem Muster fehlt eine Richtung. |
| Zustand | 15 | Aktiv 0,5; bestätigt 1; inaktive Zustände 0, jeweils × 15. |
| Volumen | 10 | Erste und zweite Hälfte der geschlossenen Formation vergleichen (mindestens zwei Kerzen pro Hälfte, positive Volumina). Verhältnis ≤0,75 volle Punkte, ≥1,25 keine, dazwischen linear. Nach Bestätigung Hälfte des Gewichts für Formation, Hälfte für Ausbruchsvolumen gegenüber den 20 geschlossenen Vorgängern: ≤0,75× keine, ≥2× volle Punkte, dazwischen linear. Fehlende Hälfte erhält keine Punkte. |
| Support / Widerstand | 10 | Vorhandene bestätigte Pivot-Level der letzten 50 geschlossenen Kerzen. Bullisch: Musterrand/Invalidierung zum Support; bärisch zum Widerstand. Direkt am Level volle Punkte; Abstand ≥2 ATR keine; dazwischen linear. ATR bedeutet durchschnittliche Kerzenspanne einschließlich Kurslücken, hier Wilder ATR(14). |
| Chance / Risiko | 5 | Verbleibender Abstand zum Ziel geteilt durch Abstand zur Gegenseite/Invalidierung, ausgehend vom Chartkurs. Ab 3:1 volle Punkte, darunter proportional. Unpassende Abstände oder Nullrisiko nicht durch Division bewerten. Gebühren/echte Positionen werden hierfür nicht umgerechnet. |

Die Summe ergibt die Basispunkte. Fehlende Faktoren werden mit `—` bzw. fehlender Teilabdeckung erklärt und bringen keine Punkte. Es gibt keine automatische Umgewichtung auf vorhandene Faktoren. **Datenabdeckung** bezeichnet verfügbare Faktor-Gewichte, keine statistische Zuverlässigkeit.

## Zustand und Restziel

- **Aktiv:** in Bildung, noch ohne bestätigten Ausbruch. Die bestehende Kennzeichnung einer laufenden Musterkerze als vorläufig bleibt erhalten.
- **Bestätigt:** die Originalengine hat den Ausbruch per Schlusskurs bestätigt. Auch `Ausbruch nach oben/unten bestätigt` wird erkannt; „Ausbruch fehlt“, „nicht bestätigt“ und „unbestätigt“ zählen nicht als Bestätigung.
- **Gescheitert:** nach Bestätigung schließt eine Folgekerze bei bullischen Mustern **unter**, bei bärischen **über** dem bekannten Ausbruchslevel. Ein exakt gleicher Schluss ist kein Gegenbruch. Basispunkte × **0,3**, Hinweis „Mögliche Bullenfalle/Bärenfalle“. Der geometrische Invalidierungsrand kann weiter entfernt sein; ein Rückfall am Ausbruchslevel reicht bereits.
- **Erfüllt:** Hoch/Tief einer **geschlossenen Folgekerze** hat das Ziel erreicht. Score 0 und keine Stimme im Gesamtbild. Ein Zielwick der Bestätigungskerze kann vor deren Schluss gelegen haben und zählt deshalb nicht als vorher bekannter Zieltreffer.
- **Abgelaufen:** mehr als die bestehenden **10 Hauptkerzen** seit Musterende/Bestätigung. Im Hintergrund zählt die aktuelle Kerze mit, obwohl nur geschlossene Kerzen gecacht werden. Die Grenzen sind zentral änderbar; weder Minuten-Umrechnung noch Intervall-Lücke werden erfunden.
- **Ungültig:** bisherige explizite/geometrische Invalidierung ohne gültigen bestätigten Ausbruch bleibt erhalten.

Historische Folgekerzen werden der Reihe nach betrachtet. Der erste terminale Zustand bleibt bestehen: spätere Erholung macht ein gescheitertes Muster nicht wieder aktiv; Rückfall nach einem erreichten Ziel schreibt „erfüllt“ nicht um. Bei Zielwick **und** Gegen-Schluss in derselben Folgekerze gilt konservativ „gescheitert“; die Reihenfolge innerhalb der Kerze ist unbekannt. Erkennung und Originalstatus werden nicht überschrieben, sondern separat bewertet.

Für bestätigte, noch offene Muster wird die Summe außerdem mit der **Restzielstrecke** multipliziert:

`Restanteil = verbleibende Strecke vom Chartkurs zum Ziel / Strecke vom tatsächlichen Bestätigungsschluss zum Ziel`, auf 0–1 begrenzt.

Beispiel Wochenmuster: Bestätigungsschluss 68.717, Ziel 106.327, heutiger Kurs 83.844 → etwa **59,8 % Reststrecke**, unabhängig davon, wann die Wochenkerze endet. Dafür werden nur die preisabhängigen Teile billig fortgeschrieben; die Engine läuft nicht erneut. Bei Verbindungspause bleibt der letzte bekannte Chartkurs mit entsprechendem Hinweis in der Erklärung erhalten. Ein alter Wochenschluss darf die bereits verbrauchte Zielstrecke nicht zurückgeben.

Eine **laufende** Gegenbewegung wird als Warnung gezeigt, bestätigt den Zustand aber noch nicht. Eine laufende Zielberührung erhält bereits **Score 0** und „Ziel berührt“; die geschlossene Folgekerze bestätigt anschließend „erfüllt“ bzw. den konservativen Gegen-Schluss. So wirken verbrauchte Ziele sofort nicht mehr wie frische Einstiegschancen, ohne einen noch unbekannten Schluss zu erfinden.

## Gesamtbild und Leistung

- Ebenen: **5m, 15m, 1h, 2h, 4h, 1d, 1w**. 1m/1M werden im eigenen Chart bewertet, gehören nicht zum gewünschten Gesamtbild.
- Je Ebene die jüngste Formation jeder Art, wie in der bestehenden Chip-Auswahl. Nur aktive/bestätigte gerichtete Muster mit positiven Punkten zählen. Anteile = Summe bullischer/bärischer Score-Punkte ÷ beide Summen. Neutrale Muster, Zieltreffer und gescheiterte/ungültige/abgelaufene Muster liefern keine Richtungsstimme.
- **Widersprüchlich:** Muster ab Score 60 dominieren auf 1d/1w und kleineren Ebenen mit mindestens 65 % des jeweiligen Score-Gewichts in entgegengesetzte Richtungen. Diese Schwellen sind Startwerte, keine optimierte Handelsstrategie.
- Eigener benannter Worker mit identischer pat-1-Engine; ein Abruf und eine Analyse nach dem anderen. Kein Telegram-Versand, kein Lernen und keine Trade-/Backup-Einträge aus dieser passiven Analyse.
- Bis zu 500 geschlossene Kerzen pro Ebene; eigener Cache für bis zu vier Coin-/Markt-/Gap-Kontexte. Vorhandene frische Reihen werden wiederverwendet, Spot/Futures strikt getrennt. Erkennung nur nach Schluss/Contextwechsel, nicht auf jedem Tick. REST-Abgleich ab 2,5 Sekunden nach Schluss. Preisfortschreibung benötigt keine API-/Worker-Aufträge.
- Pausiert bei App-Pause, unsichtbarer App, Kursfehlern oder Offline-Meldung; bei unsichtbarem Chart wird nur mit weiterhin aktivierter Musteranzeige geprüft. Beim Zurückkehren fällige Ebenen nachladen. Antworten eines alten Coins verwerfen. Fehler betreffen nur ihre Ebene; Rate-Limit respektiert den gemeinsamen API-Abstand, bei zu kurzer Historie erst am nächsten Kerzenschluss nachladen.
- Bestehende Höhe der Chip-Leiste bleibt erhalten. Die neue Gesamtbild-Taste hat eine feste Höhe; Kacheln werden wiederverwendet. Während einer Geste wird ihre Reihenfolge gehalten; ein nachgereichter Touch-Klick nach Coinwechsel darf kein anderes Bedienelement öffnen.

## Kurztest auf iPhone / iPad

1. BTC auf 1h öffnen, dann LTC/anderen Coin. Score/Regelgüte prüfen, ⓘ und langen Druck ausprobieren. Kurz tippen zeichnet weiterhin ein/aus; nach horizontalem Wischen darf kein Dialog aufspringen.
2. Gesamtbild öffnen: sieben Ebenen und ggf. Teilfehler lesen. Coin wechseln und kontrollieren, dass auch das Gesamtbild zum neuen Coin gehört. Pause/Fortsetzen prüfen.
3. Bei bekanntem Doppel-Top mit geschlossenem Rückfall über die Ausbruchslinie „gescheitert“ und kleine Punkte erwarten; Regelgüte darf als Formwert unverändert bleiben. Laufende Kerze zunächst nur Gegenbewegung. Zielberührung verbraucht die Restpunkte, Ziel auf geschlossener Folgekerze wird „erfüllt“.
4. Hell, Dunkel und eigene Farbe bei 320–390 px sowie iPad/Vollbild prüfen: Text bleibt lesbar, keine Werte ragen heraus, alte Alarme/Trendchips/Kurs/Detail-Kerzen funktionieren.

Automatische Prüfungen: `node tests/unit-chart-pattern-quality.js`, `node tests/unit-chart-pattern-overview-feed.js`, `node tests/m94.js`, bestehende m93/m92 und serieller Gesamtlauf. Browser-/Touch-Automation verwendet Chromium; echte Safari-/Geräte-Abnahme bleibt separat. Die neue Anzeigenbewertung erfordert kein Oracle-Update.
