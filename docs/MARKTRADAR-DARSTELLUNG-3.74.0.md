# Marktradar und Darstellung

App 3.74.0 · Dienst unverändert 2.15.1

## Bedienung

**Marktradar:** im Arbeitsbereich Chart direkt über Orderflow aufklappen. Der Kopf zeigt Coin, Futures-Markt und den aktuellen Datenzustand; darunter stehen Aktivität, Positionierung und Umfeld. Orderflow, News und Termine öffnen die vorhandenen Bereiche. Der Klappzustand bleibt gespeichert.

**Darstellung:** Einstellungen → Darstellung & App → Darstellung. „Neue Darstellung“ schaltet die eingestellte Gestaltung für alle großen Flächen ein oder auf die bisherigen Flächen zurück. Die Werte bleiben beim Ausschalten erhalten. **Der große Chart einschließlich seiner enthaltenen Werkzeuge und des Marktradars bleibt deckend und filterfrei; Kreise und Linien scheinen dort nicht durch.**

- Transparenz 0–70 % in 5er-Schritten, Standard 40 %.
- Unschärfe 0–24 px in 2er-Schritten, Standard 12 px. 0 schaltet den Filter vollständig aus; Safari-Präfix vorhanden, ohne Filterunterstützung bleibt die Oberfläche benutzbar.
- Rand 0–40 % in 2er-Schritten, Standard 12 %. Auch unsichtbar bleibt der Rand 1 px breit.
- Bunte Kreise und Linien separat, beide standardmäßig an. Beides aus ergibt eine einfarbige Hintergrundebene.
- Hintergrund Aktuell, Aubergine, Nachtblau, Petrol, Bordeaux oder eigene Farbe. Aktuell folgt der bisherigen App-Farbe. „Grunddesign“ enthält weiterhin die bisherigen Hell-/Dunkel-/Farbeinstellungen.
- Zurücksetzen stellt sämtliche Standards einschließlich Hauptschalter, Dekorationen und Aktuell wieder her.

Alle Werte wirken sofort, bleiben lokal gespeichert und sind in der vorhandenen Sicherung enthalten. Die statische SVG-Ebene liegt fest hinter den Inhalten und fängt keine Berührungen ab. Nur äußere große Flächen erhalten einen Blur; verschachtelte Bereiche bleiben ohne weiteren Filter. Die Bedienelemente, Zeitrahmen und Signalberechnungen bleiben erhalten. Helle Grunddesigns erhalten auf transparenten Glasflächen helle Beschriftungen; deckende Unterkarten und Felder behalten ihre bisherigen Textfarben. Transparente Schaltflächen folgen ihrer Textumgebung.

## Was der Radar tatsächlich auswertet

Er verwendet ausschließlich bereits vorhandene Daten, ohne zusätzliche Abos, API-Schlüssel, Polling-Intervalle oder Bestellungen. Keine Orders, Telegram-Nachrichten, Long-/Short-Empfehlungen oder Erfolgswahrscheinlichkeiten.

| Bereich | Grundlage und fester Hinweis |
| --- | --- |
| Volumen | Letzte vollständig geschlossene Futures-1m-Kerze gegen die vorherigen 20, lückenlos. Ab 2× Durchschnitt auffällig; laufende Kerzen zählen nicht. |
| Große Trades | Beobachtete Börsentrades der vorhandenen Whale-Anzeige, mit ausgewiesenem Spot-/Futures-Markt, Schwelle und tatsächlicher Beobachtungsdauer bis 60 s. Kein eigenständiges Signal. |
| Open Interest | Bestehendes 15-Minuten-Fenster, Veränderung ab ±3 % auffällig, Kursveränderung im selben Fenster daneben. Keine Ableitung einer Handelsrichtung. |
| Funding | Bestehende Futures-Rate; ab ±0,10 % Risiko. Richtung der Funding-Zahlung beschrieben, keine Kursprognose. |
| Umfeld | Wichtige ausgewählte Coin-Schlagzeilen, Binance-Risikomeldungen und wichtige USD-Termine. Terminrisiko ±15 Minuten; neue wichtige Meldungen eine Stunde auffällig. |

Coin und Aktualität werden je Quelle geprüft. Futures-Kurs höchstens 5 Sekunden, Funding 3 Minuten, OI 10 Minuten, News-Auszug 4 Stunden, USD-Kalender 12 Stunden alt. Meldungsdatum und Stand des periodischen Auszugs werden getrennt ausgewiesen. Quellenlücken heißen Teildaten; Ruhig setzt alle fünf Quellen und einen aktuellen Futures-Kurs voraus. Pause, Offline, Laden und veralteter Kurs werden ausdrücklich angezeigt. Beim Coinwechsel verschwinden die Werte des vorherigen Coins sofort.

Es sind keine On-Chain-Wallets oder Fear-&-Greed-Quellen angeschlossen. Börsentrades werden nicht als Blockchain-Transfers ausgegeben. Die Quellen und Grenzen stehen im aufklappbaren Erklärungstext.

## Optionale Beobachtungen

Standardmäßig ausgeschaltet. „Radarhinweise im App-Speicher merken“ protokolliert bis zu 200 tatsächlich beobachtete Hinweise bei aktuellem Futures-Kurs. Gleiche Hinweise desselben Coins werden innerhalb von 15 Minuten zusammengefasst. +15m und +60m beziehen sich auf den ersten geschlossenen Minutenschluss ab dem jeweiligen Zielzeitpunkt, höchstens 60 Sekunden später. Fehlende Daten bleiben offen; der Radar interpoliert nicht und ersetzt sie nicht durch spätere Kurse. Fortgeschrieben wird beim geöffneten Programm für den ausgewählten Coin. Es sind Kursbewegungen und keine simulierten Nettogewinne. JSON-Export verfügbar.

## Geänderte Stellen

- `weather-widget-v2.html`: Einbindung, vorhandene Feed-Adapter, native Klappfläche, statische SVG-Ebene, Panel-CSS und frühes Laden der Darstellungspräferenzen.
- `shared/market-radar-{core,journal,view}.mjs`: getrennte Bewertung, optionale Beobachtungen und Oberfläche.
- `shared/panel-appearance.mjs`: validierte Einstellungen, native Regler/Schalter, CSS-Variablen über Animation Frames, lokales Speichern, Reset und Mehrtab-Abgleich. Regler zeichnen keine Charts oder Datenbereiche neu.
- `tests/unit-market-radar.js`, `tests/unit-panel-appearance.js`, `tests/m117.js`, `tests/m118.js`, `tests/run-all.sh`: Fach-, Geometrie-, Touch-, Speicherung- und Isolationsprüfungen.
- `bundles/3.74.0/`, `sw.js`, `server/release-manifest.json`: reproduzierbares neues Versionsbündel; frühere Bündel unverändert. Kein neues Dienstverhalten und keine VM-Installation erforderlich.

## Prüfung und Geräteabnahme

Gezielte Fach- und Browserprüfungen laufen seriell mit mockierten Marktdaten und Telegram-Schnittstellen; keine echten Telegram-Testnachrichten. Sie decken Datenalter, unvollständige/andere Coin-Quellen, laufende Kerzen, Pause/Offline, Beobachtungszeitpunkte, Export, alle Reglergrenzen, CSS-Werte, Randgeometrie, deckenden Chart, Touch-Flächen ab 44 px, Mehrtab-/Neustart-Speicherung sowie 320/390/430/768/820/1440 px ab. Bestehende Gerätewahl, Hintergrundfarben, Navigation, Sicherung, Vorauswahl und Offline-Veröffentlichung werden mitgeprüft. **820/820 Einzelprüfungen in 19 gezielten Programmen bestanden**, Lint 0 Fehler / 3 bekannte Warnungen; reproduzierbarer Lieferstand geprüft. Isolierte Freigabeprüfung des fertigen Pakets bei 320/390/768 px ebenfalls bestanden, ohne JavaScript-Fehler oder Telegram-Aufruf. Öffentlicher Nachweis im Release-PR. Kein neuer vollständiger Gesamtlauf.

iPhone/iPad nach Aktualisierung auf 3.74.0:

- Darstellung öffnen, drei Regler bewegen: Wirkung sofort, Werte vollständig lesbar, ohne Seitensprung.
- Neue Darstellung aus/ein: bisherige Flächen bzw. gemerkte Werte zurück; nach Neustart erhalten.
- Kreise und Linien einzeln ausschalten, beide aus und eigene Hintergrundfarbe prüfen; Zurücksetzen kontrollieren.
- **Großen Chart im Hochformat und Vollbild ansehen: durchgehend deckender Hintergrund, keine Kreise oder Linien im Chart.** Zoomen, Blättern und Kursupdates weiter bedienbar.
- Vorauswahl, Analysen und Positionen ansehen: große Flächen im eingestellten Stil; Coin-Karten ohne eigenen Blur, Grün/Rot und Eingaben erhalten.
- Radar per Tipp auf-/zuklappen; Coin wechseln, Quellen/Zeiten und Pause/Offline prüfen. Beobachtungen nur bei gewünschter Aufzeichnung aktivieren.

Automatisierte Mobilprüfungen nutzen Chromium-Touch-Emulation; eine physische Safari-/iPhone-Abnahme ist damit nicht ersetzt.
