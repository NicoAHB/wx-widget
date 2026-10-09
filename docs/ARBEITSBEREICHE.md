# Übersichtliche Arbeitsbereiche – 3.60.0

Die Startansicht konzentriert sich auf Chart und kompakte Signalübersicht. Die **vorhandene Vorauswahl bleibt ganz oben sichtbar**, auch beim Wechsel zu Analysen, Positionen und Einstellungen. Alle Coins, Live-Kurse, Bewertungen, Detailfelder, Bearbeitung und Umsortierung bleiben erhalten. Auf dem Handy stehen die bisherigen zwei Kachelspalten; weitere Inhalte erreicht man durch vertikales Scrollen.

| Bereich | Inhalt |
|---|---|
| Chart | Geöffneter Kurschart, Signalübersicht und direkte Wege zu KI-Signalen, Preisalarmen und Bot |
| Analysen | KI-Signale/Bot/Preisalarme, Mittelwert-Zonen, Marktindikatoren, BTC-Entkopplung, Kalender, Coin-News und Stundenvolatilität |
| Positionen | Offene Trades, Kontostand, Journal, Auswertung und Positionsrechner |
| Einstellungen | Darstellung/App, Hinweise/Telegram, Datensicherung, Modellannahmen/Dienst und ausführliche Methodik |

Am Desktop zwei Spalten mit breitem Chart; keine drei konkurrierenden Bereiche in der Startansicht. Auf kleineren Bildschirmen eine Spalte. Die Bereichsnavigation bleibt beim Scrollen erreichbar. Verknüpfungen aus der Live-Leiste und die bisherigen Kopfknöpfe öffnen den passenden Bereich; die Sicherung ist also weiterhin direkt erreichbar.

Orderflow (BTC-Pfeile, Kerzen, Demo), Chart-Ebenen/Whales sowie die ausführliche KI-Einrichtung sind zunächst eingeklappt. Die Auswahl der neuen Klappflächen und der zuletzt gewählte Arbeitsbereich werden lokal gespeichert. Die Vorauswahl bleibt stets offen. Kalender und Coin-News zeigen zunächst höchstens drei Einträge, mit den bisherigen Mehr-Knöpfen den vollständigen gefilterten Bestand. Warnungs-/Filter-/Berechnungsregeln bleiben unverändert.

**Ansicht → Übersicht → Gesamtansicht** zeigt die bisherige Anordnung. **Arbeitsbereiche** wechselt zurück. Standard und Dashboard bleiben als getrennte Darstellungen wählbar; im Desktop-Dashboard steht die kompakte Signalspalte links und der breite Chart rechts. Hell/Dunkel/Eigene Farbe und die vorhandene AA-Kontrastprüfung bleiben erhalten. Die Übersichtswahl ist eine lokale Gerätepräferenz, kein Handelsdatum.

Die bestehenden DOM-Knoten werden bei Bedarf an ihren neuen Platz versetzt, anschließend für die Gesamtansicht als direkte Kinder ihrer ursprünglichen Bereiche zurückgestellt. Die drei neuen Klapphüllen werden dabei entfernt: zusätzliche Inhaltsboxen von Details dürfen die alte Vorauswahl nicht verengen. Kein zweiter Chart, keine kopierten Formulare, keine zusätzlichen Datenfeeds, kein Framework. Handelsberechnungen, Strategien, Schutzregeln, Positionen/Trades und bestehende Sicherungsformate bleiben erhalten. Verschiedene Analysen behalten ihre eigenen Zeiträume und Bezugsgrößen; sie werden nicht durch eine scheinbar einheitliche Bewertung vermischt.

## Kurze Bedienungsprüfung

1. Neue Ansicht öffnen: Vorauswahl oben, darunter breiter Chart und kompakte Signale. Coin antippen, Detailfeld und geöffneten Kurs prüfen; „Bearbeiten“ und Umsortierung funktionieren weiter.
2. Zwischen Chart, Analysen, Positionen und Einstellungen wechseln. Unfertige Formulareingaben bleiben erhalten. In Analysen KI-Signale, Preisalarme und Trading-Bot auswählen; die Bot-Simulation bleibt bis zur bewussten Aktivierung aus.
3. Orderflow und Chart-Ebenen auf-/zuklappen. Vollbild öffnen, Werkzeuge einblenden und wieder schließen. Neuladen: Bereich und Klappauswahl wiederhergestellt.
4. In Einstellungen Darstellung und alle drei Hintergründe ausprobieren. Die Kopfknöpfe „Ansicht“, „Hinweise“ und „Backup“ öffnen weiterhin ihre Funktionen. JSON-/kompakte Dateiübertragung bleibt vollständig.
5. In Kalender und News „Mehr“/„Ganze Woche“ und wieder „Weniger“ wählen. Alle Filter und Ereignisse bleiben verfügbar.
6. Bei 320/390 px, iPad und Desktop prüfen: keine Inhalte rechts außerhalb der Seite, klare Beschriftung, Navigation mindestens 44 px. Beim sehr schmalen Handy benötigt die vollständige Vorauswahl vertikalen Platz; der Chart wird beim Hineinscrollen gezeichnet.

## Automatisierte Prüfung

`m84.js` öffnet die tatsächliche **frische** App ohne Testpräferenz: Navigation, DOM-/Entwurfs-/Originalbucherhalt, tatsächlicher Datei-Download, Modelleinrichtung, Ressourcenanzahl, Vollbild, Gesamtansicht/Rückkehr, Speicherung und Offline-Start. Beide Darstellungen und drei Hintergründe, 320/390/768/1024/1440 px und echte mobile Touch-Konfigurationen; nutzbare Kachelbreiten sowie Tipp-/Umsortierwege. Sechs lokale wichtige Termine/News prüfen Top-3 und vollständiges Aufklappen. Der native Bitget-KI-Chart ersetzt Binance an derselben Stelle; 320/390/1440 px und beide Darstellungen prüfen echte Testkerzen, Referenzlinien und Rückkehr. Abschließende native Prüfung 130/130.

Die älteren Fachtests erhalten im Harness ausdrücklich die weiterhin verfügbare **Gesamtansicht**, damit ihre bisherigen Bedienungswege und Erwartungsgrenzen bestehen bleiben. Keine automatische Klickumleitung/erzwungenen Klicks, keine gelockerten Prüfungen. `h.launch({ workspace: 'fresh' })` verzichtet auf diese Vorbelegung und prüft den echten Standard. Kalender-/News-Testkopien an den optionalen Anzeigezweig angepasst; Fachfilter unverändert. Reale iPhone-/iPad-/Safari-Abnahme bleibt separat.
