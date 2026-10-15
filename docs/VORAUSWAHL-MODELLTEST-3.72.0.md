# Vorauswahl-Modelltest und Journal – 3.72.0

## Bedienung

Unter **Einstellungen → Vorauswahl · Modelltest** schaltet „Strenges 5/5-Modell testen“ zwischen bisheriger Vorauswahl und Testmodell um. Standard ist Bisherig. Die Auswahl wird im bestehenden App-Speicher unter `scalpdesk.watch-model.v1` gesichert, zwischen offenen Tabs abgeglichen und in persönliche/verschlüsselte GitHub-Sicherungen aufgenommen. Ältere GitHub-Sicherungen ohne die neuen Schlüssel bleiben ladbar; sie stellen Bisherig wieder her. Der Rückwechsel erhält Coins, manuelle Reihenfolge, Raster/Liste und den bisherigen Prozent-/Signalzeitraum.

Das strenge Modell betrifft ausschließlich die Vorauswahl. Das bestehende Vier-Regel-Modell, Chart, Journalberechnungen, Alarme, Telegram und Oracle-Dienst verwenden weiter ihre bestehenden Wege. Es werden keine Orders erzeugt. Während des Testmodus werden für jeden geladenen Vorauswahl-Coin zusätzlich 15m- und 4h-Kerzen desselben Markts bezogen. Im bisherigen Modus entstehen dafür keine zusätzlichen Abrufe/Streams.

## Die fünf Pflichtregeln

| Regel | Long | Short |
|---|---|---|
| 4h-Trend | Schluss über steigender EMA 200 | Schluss unter fallender EMA 200 |
| 15m-Kurs | Schluss über EMA 200 | Schluss unter EMA 200 |
| RSI 14 | vorher ≤30, jetzt >30 | vorher ≥70, jetzt <70 |
| MACD 12/26/9 | neue Kreuzung über Signallinie | neue Kreuzung unter Signallinie |
| Volumen | mindestens 2 × Durchschnitt der **20 vorherigen** 15m-Kerzen | gleich |

Alle Regeln müssen auf derselben abgeschlossenen 15m-Kerze passen. Die 4h-Kerze muss zu diesem Entscheidungszeitpunkt bereits abgeschlossen sein. Verwendet werden höchstens 500 Kerzen je Ebene; mindestens 300 geschlossene Kerzen sind nötig. Die Initialisierung von RSI/EMA/MACD entspricht den bestehenden App-Indikatoren. Fehlende, ungültige, lückenhafte, marktgemischte oder veraltete Daten sperren die Freigabe. Die zeitliche Einordnung nutzt die vorhandene um Börsenzeitstempel korrigierte App-Uhr.

Bei 5/5 blinkt die Kachel/Listenzeile grün für Long oder rot für Short. Der Badge zeigt die größere erfüllte Regelzahl; teilweise Übereinstimmung bleibt neutral. Die Filter heißen im Testmodus Long 5/5 und Short 5/5. Alle fünf Regeln und beide Richtungszählungen sind im Coin-Detail sichtbar. Das Signal gilt bis zum nächsten 15m-Schluss und wird dann neu geprüft. Pause, Offline oder ausgeblendete App sperren die Freigabe sofort; reduzierte Bewegung ersetzt das Blinken durch einen festen farbigen Rand.

**5/5 bezeichnet Regelübereinstimmung, keine bekannte Trefferwahrscheinlichkeit oder Gewinngarantie.** Die gleichzeitigen RSI-/MACD-Kreuzungen sind absichtlich streng und können selten auftreten.

## Vergleich unter gleichen Bedingungen

„Beide Modelle vergleichen“ berechnet beide Modelle unabhängig vom Schalter auf denselben ausgewählten Coins und identischen 15m-Spotkerzen von Binance. Das bisherige Modell behält seine unveränderten vier Regeln und seine Freigabe ab drei Regeln in dieselbe Richtung. Für die kontrollierte Gegenüberstellung werden auch dessen Regeln auf 15m angewandt; dies ist kein Vergleich verschiedener ursprünglicher Zeitraum-Einstellungen. 4h-Kontext kommt nur für das Testmodell hinzu.

- Zeitraum: 7–90 Tage, Standard 30; bis zu 30 aktuelle Vorauswahl-Coins. Gemeinsamer Vorlauf und identischer letzter bestätigter Kerzenschluss.
- Einstieg erst zur **nächsten** Kerzenöffnung nach dem Signal; höchstens ein Trade je Coin und Modell gleichzeitig.
- Standard: Stop 1,5 × ATR 14, Zielabstand 2 × Stopabstand, maximal 16 Kerzen (4 Stunden), Gebühr 0,05 % und Slippage 0,02 % jeweils pro Seite. Alle Werte sind für beide Modelle gemeinsam einstellbar.
- ATR und sämtliche Signalmerkmale stammen nur aus bereits abgeschlossenen Kerzen. Bei Stop und Ziel in derselben Kerze gilt konservativ der Stop zuerst. Ungünstige Kurslücken werden zur Öffnung statt zum überholten Stop abgerechnet.
- **1 R** entspricht dem modellierten Verlust am normalen Stop einschließlich beider Gebühren und Slippage. Kurslücken können mehr als 1 R kosten. Keine Hebel-/Funding- oder Leihkostenrechnung; Short auf Spotkursen bleibt hypothetisch.
- Fehlende Historie schließt einen Coin für **beide** Modelle gemeinsam aus und wird sichtbar benannt. Bei keinem vollständigen Coin entsteht kein neuer Bericht.
- Ergebnis: abgeschlossene Trades, Netto-Summe und Ø je Trade in R, Trefferquote, Profitfaktor, Rückgang aus realisierten Ergebnissen, offene/wartende Fälle. Der Rückgang ist **kein** Kontodrawdown inklusive offener Risiken. Es wird kein automatischer Gewinner gewählt.

Die Berechnung läuft in einem eigenen Worker und lässt sich abbrechen. Das vorherige Ergebnis bleibt bei Abbruch oder Fehler erhalten. Ergebnis, Modellversionen, Kosten und Zeitfenster werden unter `scalpdesk.watch-compare.v1` gespeichert und als JSON heruntergeladen. Veränderte Eingabefelder ändern keinen bereits gespeicherten Lauf. Geschlossene Fälle, offene Positionen und noch nicht ausgeführte Signale bleiben getrennt. Der Vergleich ist eine historische Simulation; eine kleine oder zeitlich abhängige Stichprobe belegt keinen Vorteil.

## Journalzeile

Coin und Richtung stehen zusammen; Hebel, Margin-Modus und Menge folgen in einer eigenen Zeile. Einstieg und Ausstieg sind beschriftet. Der vollständige Ergebnisbetrag bleibt zusammen mit USDT lesbar; eingefrorener Euro-Wert und Rendite stehen darunter. Kamera-/Versandstatus und die vier vorhandenen Aktionen erhalten eigenen Platz. Auf schmalen Panels wird einspaltig angeordnet, auf breiteren Panels stehen Zeit, Trade und Ergebnis nebeneinander. Aktionen haben mindestens 44 × 44 px. Notiz, Teilabschlüsse, Funding, Börsen-Ergebnisquelle und Sendefehler bleiben vorhanden; sämtliche Berechnungen und Handler sind unverändert.

## Prüfung und Release

Neue Prüfungen: `unit-watch-models`, `unit-watch-model-feed`, `m115`, `m116`, ergänzt um aktuelle und ältere Modellauswahlen im bestehenden GitHub-Sicherungstest `m90`. In `run-all.sh` registriert. Fachtests decken echte 5/5-Long-/Short-Daten, jede fehlende Einzelregel, Vorlauf, Kerzenlücken, falsche Quellen, Frische/Abbruch, kausale Entscheidungen und Kosten/Stops einschließlich Kurslücken ab. Native Browsertests verwenden die tatsächlichen Settings-, Worker-, Speicher-, Download- und Navigationswege. Journaldaten werden vor/nach der Darstellung verglichen und die vorhandenen Aktionen bedient.

Dazu serielle Nachprüfung der betroffenen bestehenden Vorauswahl-, Touch-, Alarm-, Navigations-, Sicherungs-, Journal-, Trade-Bild- und Offline-Wege. Keine Browserläufe parallel und kein echter Telegram-Versand. Der ältere etwa 2,5-stündige vollständige Gesamtlauf bleibt 3.71.1 zugeordnet; für dieses Release wird gezielt die neue Logik und ihre Integrationen geprüft. Abschließend **774/774 Einzelprüfungen** bestanden, Lint 0 Fehler/3 bekannte Warnungen und reproduzierbarer Release-Abgleich. Einzelresultate: [VORAUSWAHL-MODELLTEST-3.72.0-TESTS.json](VORAUSWAHL-MODELLTEST-3.72.0-TESTS.json). Die zusätzliche isolierte Vorabprüfung des tatsächlichen Lieferstands besteht bei 320/390 px: Schalter/Neustart, vollständiger Journalbetrag/Euro-Wert, große Touchflächen, Alarm-Rücksprung und keine JavaScript-Fehler. Abschließende öffentliche Hash-/MIME- und Browserprüfung im Release-PR.

App und Service Worker 3.72.0; eigenständiges neues Bündel mit 86 PWA-Dateien. Dienstlogik 2.15.0 unverändert; frühere Bündel unverändert. Chromium emuliert iPhone-Touch, eine Prüfung auf einem echten iPhone/Safari steht separat aus.

## iPhone-Checkliste

- App 3.72.0 öffnen. Einstellungen → Vorauswahl · Modelltest: einschalten, App schließen/öffnen, wieder ausschalten. Modell, Zeitraum, Coins und Reihenfolge prüfen.
- Vorauswahl als Kacheln und Liste öffnen; Coin-Detail zeigt im Testmodus 15m/4h und alle fünf Regeln. Ohne 5/5 kein Blinken, bei Pause/Offline ebenfalls kein gültiges Blinksignal.
- Zeile/Kachel lange drücken und verschieben; normale kurze Wischbewegung scrollt weiter. Nach Ansichtwechsel und Neustart bleibt die Reihenfolge erhalten.
- Vergleich starten, einmal abbrechen, erneut abschließen; Kosten und gleiche Zeitfenster prüfen. Herunterladen und gespeichertes Ergebnis nach Neustart kontrollieren.
- Journal: XRP-Beispiel mit +49,93 USDT / +43,88 € / +89,54 %, lange Preise wie 81.245,67 und negative Beträge ansehen. Kein Abschneiden oder seitlicher Überlauf.
- € öffnen, Notiz bearbeiten, Kamera-Vorschau öffnen; Versandstatus bleibt beim zugehörigen Trade. Löschen weiterhin nur nach Bestätigung.
