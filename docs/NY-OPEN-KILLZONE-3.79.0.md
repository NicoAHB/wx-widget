# NY Open Killzone · Scalp Desk 3.79.0

Unter **Chart → Chart-Ebenen, Whales & Werkzeuge → Analyse → NY Open Killzone**. Unter der neuen Zeile lässt sich **NY-Einstellungen, Protokoll & Backtest** öffnen. Telegram bleibt zunächst aus; die vorhandenen Coin-Freigaben gelten auch hier. Die Vorauswahl wird dynamisch gelesen.

## Was vorhanden war und wiederverwendet wird

Analyse-Katalog und Menü, Fokus mit Wiederherstellung, drei Telegram-Freigaben, eigener fünfter Telegram-Bereich, atomarer Versand-Duplikatschutz, FVG-Erkennung, ATR-Berechnung, Top-Down-4h-Bias, historische Börsenabfragen, IndexedDB und die gemeinsame SVG→PNG→sendPhoto-Kette. Top-Down-Regeln sowie die vier ursprünglichen Telegram-Ziele bleiben erhalten. Es werden keine Broker-Aufträge erzeugt.

## 1 · NY-Zeit und Opening Range

**Dateien:** `shared/ny-open-time.mjs`, `shared/ny-open-core.mjs`, `shared/ny-open-history.mjs`, `shared/ny-open-feed.mjs`; kleine Erweiterung `shared/muster-bot-feed.mjs` für historische 1m-Kerzen.

`America/New_York` bestimmt den Handelstag und die UTC-Anker der Kerzen. Anzeige und Bildkarte verwenden unverändert `Europe/Berlin` (MEZ/MESZ). Keine feste Stundenverschiebung und keine Verschiebung der Börsen-Abfragen. Montag–Freitag; NYSE-Feiertage standardmäßig überspringen, einschließlich Karfreitag, beobachteter Feiertage und bekannter Sonderschließungen. Verkürzte Börsentage haben weiterhin ein normales 09:30-Open. Zukünftige außerordentliche NYSE-Schließungen müssen im Kalender ergänzt werden.

Die vollständige 5m-Kerze 09:30–09:35 definiert Hoch und Tief einschließlich Dochten. Mindestbreite 0,15 % ihres Schlusskurses. Neue Setups nur mit Bestätigungsschluss zwischen 09:35 und 10:30. Ein technischer Nachlauf von höchstens 60 Sekunden verarbeitet den letzten Schluss; eine spätere Kerze kann kein neues Signal bilden. Außerhalb des Fensters kommen Range-Werte aus dem lokalen Protokoll; ohne gespeicherte Range wird kein ganztägiger Live-Abruf gestartet.

**Test:** US/EU-Sommerzeit-Übergangswochen, Wochenende, Karfreitag, Columbus Day (NYSE geöffnet), 09:34/09:35 und 10:30 vergleichen. Einstellungen bleiben nach Neuladen erhalten.

## 2 · Ausbruch, FVG und Risiko

**Dateien:** `shared/ny-open-core.mjs`, `shared/analysis-config.mjs`, `shared/analysis-feed.mjs`.

Alle Strategie-Startwerte stehen oben in `NY_OPEN`; die vier gespeicherten Schalter stehen in `NY_DEFAULT_OPTIONS`.

- Normale, geschlossene 1m-OHLC-Kerzen, unabhängig vom Heikin-Ashi-Schalter.
- Standardmäßig Richtung des unveränderten Top-Down-4h-Bias; neutral sperrt den Einstieg. Der Filter ist abschaltbar.
- Ausbruchskörper mindestens 60 % der Kerzenspanne, Schluss über Range-Hoch / unter Range-Tief.
- Ausbruch als mittlere FVG-Kerze; Lücke mindestens 0,3 ATR(14), bestätigt erst nach Schluss der Folgekerze.
- Markt-Einstiegsreferenz = Bestätigungsschluss; optional Limit in FVG-Mitte, 15 Minuten gültig.
- Stop hinter dem Tief/Hoch der Ausbruchskerze plus 0,1 ATR Puffer. Risikoabstand 0,15–1,0 % des Einstiegs.
- Ziel 2R, 1R-Marke separat. Die Live-Modellbeobachtung zieht standardmäßig bei 1R den Stop auf Einstieg; dies ist ein gespeicherter Schalter.
- Erstes bestätigtes Signal pro Coin und NY-Handelstag bleibt festgeschrieben. Spätere Einstellungsänderungen ändern weder den historischen Einstieg noch dessen gespeicherte Stop-Regel.

**Test:** Long und Short, nur Docht, schwacher Körper, zu kleines FVG, zu enger/weiter Stop, neutraler/entgegengesetzter Bias, noch laufende Bestätigung. Keine neuen Signale durch Heikin-Ashi, Zoom oder Neuladen.

## 3 · Menü und Chart

**Dateien:** `shared/analysis-view.mjs`, `shared/ny-open-view.mjs`, `shared/ny-open-chart.mjs`, `shared/ny-open-notices.mjs`, `shared/analysis-notices.mjs`, `weather-widget-v2.html`.

Ab Version 3.79.1 klappt der Modellname die Coins und NY-Werkzeuge auf/zu. Haken oder Coin-Name aktivieren den bestehenden exklusiven Analyse-Fokus. Nur NY-Range, Zeitfenster, FVG, Einstiegs-/Stop-/Zielmarken bleiben sichtbar. Die vorherigen Indikatoren kommen beim Ausschalten exakt zurück. Zeitrahmen, persönliche Positions-/Alarmmarken und Live-Kurs bleiben erhalten. Im NY-Fokus wird rechts Platz für verlängerte Linien reserviert; Beschriftungen werden entzerrt. Außerhalb des sichtbaren Kursbereichs zeigen Preislabels die Richtung mit einem Pfeil.

Range-Linien reichen nach rechts, bis die nächste tatsächlich gespeicherte Opening Range sie ersetzt. Der Status vergleicht den aktuellen Kurs laufend mit den Range-Grenzen, ohne dafür die Strategie neu zu rechnen. Info im Chart erklärt Regeln und Signalwerte. Frische Einstiege und beobachtete Stop-/Zielberührungen markieren die Analyse-Zeile mit Grund; ein Hinweis erlischt nach spätestens einer Minute, bei ungültigem/abgeschlossenem Einstieg, Pause oder Offline. „Gelesen“ beendet ihn vorzeitig; reduzierte Bewegung behält eine ruhige Farbmarkierung.

**Test:** Auf iPhone/iPad Coin antippen, Chart-Info öffnen, zoomen, scrollen, Analyse ausschalten und die ursprünglichen Indikatoren vergleichen. 320/390/430/768/820/1440 px ohne horizontalen Menüüberlauf; neue Touch-Flächen mindestens 44 px.

## 4 · Telegram-Foto

**Dateien:** `shared/analysis-card.mjs`, `shared/analysis-delivery.mjs`, `weather-widget-v2.html`.

Im vorhandenen Dialog **Alarme aufs Smartphone → Analyse-Signale** gibt es zusätzlich **Testkarte · NY Open Killzone**. Derselbe Bot/Chat wie Top-Down, keine Änderung an Kursalarm/Sicherung/Trades/Chartmuster. Dieselbe Karten- und sendPhoto-Funktion; eine kurze Caption für die Push-Vorschau, keine zweite Textnachricht. Die Karte enthält Range, FVG, 1m-Kerzen, Einstieg, Stop, Ziel, 1R-Hinweis, drei Stufen und deutsche Anzeigezeit. Fehlt der Mini-Chart, bleibt die vollständige Wertekarte versendbar.

Analyse-Telegram **und** Coin global **und** Coin in dieser Analyse müssen an sein. Die atomare Tages-Sperre gilt unabhängig von Richtung/Markt auch nach Neustart und zwischen Tabs. Die bestehende Prüfung verhindert die Bot-ID als Chat-ID; kein Rückfall auf andere Telegram-Ziele.

**Test:** Testkarte an den eigenen Analyse-Chat senden. Danach alle drei Freigaben prüfen. Ein erneuter Rechenlauf, Richtungswechsel oder Neuladen darf das gleiche Tagessignal nicht nochmals senden. Automatisierte Tests verwenden ausschließlich simulierte Telegram-Endpunkte.

## 5 · Protokoll und 60-Tage-Backtest

**Dateien:** `shared/ny-open-backtest.mjs`, `shared/ny-open-feed.mjs`, `shared/ny-open-view.mjs`, `shared/ny-open-history.mjs`, `weather-widget-v2.html`.

Lokales IndexedDB-Protokoll: Datum, Coin, Richtung, Range, FVG, Einstieg, ursprünglicher Stop, Ziel, feste Optionen und Ergebnis. Ziel/Stop/Stop auf Einstieg werden auf geschlossenen 1m-Kerzen beobachtet; nach zwei Stunden noch offene Fälle sind ausdrücklich offen. Ein Limit kann vorher ablaufen. Fehlende Kerzen ergeben keine erfundenen Treffer. Ein Tab-Abgleich erhält das erste Signal und bereits festgestellte Endergebnisse.

Der Button untersucht die letzten 60 Kalendertage für alle Coins der aktuellen Vorauswahl. Nur vollständig beobachtbare Sitzungen zählen; Feiertage richten sich nach dem aufgenommenen Schalterstand. ATR benötigt 30 Minuten Vorlauf, der 4h-Bias seinen bestehenden EMA-Vorlauf. Zusätzlich werden für bereits bestätigte Fälle bis zu zwei Stunden Ergebnisdaten und ggf. 15 Minuten Limitgültigkeit geladen. Die Live-Prüfung lädt außerhalb des NY-Fensters nur Daten für solche bereits bestehenden Fälle.

Verwendet werden der vorhandene historische Börsen-Client und Kerzen-Cache, ergänzt um einen begrenzten IndexedDB-Fenstercache. Neue NY-Netzaufrufe werden seriell mit mindestens 750 ms Abstand gestartet; 429/418-Retry-After und Abbruch bleiben beim vorhandenen Client. Ein Coin-/Tagesfehler wird ausgewiesen, die übrigen laufen weiter. Fehlerwiederholungen erhalten eine Wartezeit; nach dem vollständigen Ergebnisfenster endet die automatische Wiederholung nach drei gescheiterten Versuchen ausdrücklich mit unbekanntem Ergebnis. Pause, Offline oder verborgene App brechen den Backtest ab. Das vorher gespeicherte Ergebnis bleibt erhalten.

Zwei Spalten vergleichen auf **identischen Signalen**:

1. Ursprünglicher Stop.
2. Stop auf Einstieg ab 1R.

Gebühr und Slippage je Seite sind einstellbar (Start 0,05 % + 0,02 %). Angezeigt werden Signale, abgeschlossene Fälle, Netto-Trefferquote, durchschnittliches Netto-R und längste Verlustserie, außerdem offene/abgelaufene Fälle und Datenabdeckung. Stop hat konservativ Vorrang, wenn innerhalb einer Kerze Stop und Ziel erreichbar sind. Auch die Reihenfolge beim 1R-Nachziehen wird konservativ behandelt. Ein Break-even vor Kosten kann netto ein kleiner Verlust sein. Offene/abgelaufene/unklare Fälle gehen nicht als abgeschlossene Trades in Trefferquote und Durchschnitt ein. Bei zeitgleichen Abschlüssen ist die Reihenfolge der Coins alphabetisch. Keine automatische Wahl eines Gewinners; kein Hebel und kein Funding.

**Test:** Backtest starten, abbrechen, erneut starten, Kosten ändern und Ergebnis vergleichen. Einstellungen nach einem Lauf dürfen dessen gespeicherte Annahmen nicht verändern. Ein Backtest versendet keine Nachrichten und erzeugt keine Live-Protokollfälle. Die 60-Tage-Ausführung mit sieben Coins ist automatisiert mit deterministischen OHLCV geprüft; dies ist kein Nachweis einer Profitabilität auf echten Marktdaten.

## Betrieb und Lieferstand

Analyse-Versand und Live-Beobachtung laufen derzeit in der geöffneten, aktiven App. Die spätere 24/7-Dienst-Anbindung wird durch diese Erweiterung nicht aktiviert. Dienstquelle bleibt 2.15.1, keine VM-Änderung. Neue statische App-Version 3.79.0; ältere Release-Bündel bleiben unverändert.

Tests: `unit-ny-open.js`, `m130.js` (Chromium/WebKit), bestehende `unit-analysis*`, `m129.js` (Chromium/WebKit), historische Client-Tests, Release-/PWA-Prüfung und ESLint. Gerätebedienung wird mit mobilen Browser-Kontexten geprüft; ein realer iPhone-Test bleibt sinnvoll.
