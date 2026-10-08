# KI-Korrekturen – Kosten, Übersicht und Risiko

Arbeitsstand **App/SW 3.52.0**, Dienstquelle **2.9.0**. Öffentlich bleibt **3.51.0**, die private VM wurde nicht aktualisiert. Grundlage: freigegebene [KI-Prüfung](KI-AUDIT-2026-10-08.md). Die neue kompakte KI-Übersicht und die ergänzende Risiko-/Ausführungsansicht sind getrennte Folgegruppen.

## Kostenmodell cf-2

Der bisherige Live-/Replay-Auswahlfilter berechnete das Netto am genauen Ziel-/Stop-Level, obwohl der Simulator beim Ausstieg zusätzlich Slippage abzieht und ungünstig auf das Tickraster rundet. Ab **cf-2 / cf-live-2 / cf-replay-2** verwenden Filter, lokale Karte, Dienst und Simulator dieselbe Funktion `executionExitPrice`. Die bereits im Referenzeinstieg enthaltene Einstiegsslippage wird dabei nicht nochmals abgezogen.

- Long: Ziel-/Stop-Ausführung unter dem Level, auf ganze Ticks abgerundet.
- Short: Ziel-/Stop-Ausführung über dem Level, auf ganze Ticks aufgerundet.
- Gebühren beider Seiten und das unveränderte Funding-Szenario gehen danach in das Netto ein. Nettoziel / Betrag Nettoverlust muss weiterhin mindestens **1,5** erreichen.
- Freigaben prüfen auch die Bindung von Ausstiegsslippage und Tickgröße an Score und Preisplan. Scoregewichte, Indikatoren und Stop-/Zielregeln bleiben erhalten.

Der Gegenbeleg aus der Prüfung hat weiterhin **95 Punkte**, Entry **100,00**, SL **99,40**, TP **101,20**. Bei **10 bp** Slippage und **0,05 %** Gebühr je Seite ergeben sich TP-Ausführung **101,09** und SL-Ausführung **99,30**, Netto **+0,989455 / −0,799650** je Einheit. Das korrigierte Netto-R:R beträgt **1,23736**, der Kandidat wird gesperrt. Die damalige cf-1-Karte bleibt mit **1,57124** und ihrem ursprünglichen Freigabestatus dokumentiert.

Künftiges Funding bleibt eine ausdrücklich gewählte Annahme, historische fehlende Fundingeingaben bleiben nicht bewertbar. Ein am Level berechneter Stopverlust ist weiterhin ein Szenario: Kurslücken und tatsächliche Ausführung können ihn überschreiten.

## Originalschutz und Dienstupgrade

Der bisherige cf-1-Kern einschließlich Indikatoren und Mustergewicht, Live-/Anker-/Fundingfunktionen und Replay liegt unverändert in `shared/confluence-legacy-*.mjs`. Tests vergleichen ihn mit dem veröffentlichten Bündel 3.51.0; ausschließlich interne Importadressen sind angepasst. Bereits veröffentlichte Bündel werden nicht überschrieben.

Originalbeobachtungen beider Modelle können gemeinsam gesichert/importiert werden, zählen pro ID einmal und werden jeweils mit ihrem eigenen Modell nachbewertet. Alte Karten, Originalscores, Parameter, Startanker und abgeschlossene Auswertungen werden nicht migriert oder gelöscht. Ein unterbrochener cf-replay-1-Job behält Grenze und Version; seine Fortsetzung verwendet den alten Kern. Kohorten beider Modelle bleiben getrennt.

Der Dienst erneuert beim Modellupgrade ausschließlich ableitbare Feedfortschritte, behält Originale, Zustellmerker und die bestätigte Auswahlrevision und beginnt ohne Nachversand früher bestätigter Kerzen. Noch wartende cf-1-Meldungen werden vor Zustellung verworfen; Kursalarme und PO3 haben weiter ihre eigenen Regeln. Der Dienststatus nennt `modelVersion`. Die App kann alte Dienstkarten weiterhin lesen und kennzeichnet sie als frühere Modelle. Eine neue Konfluenz-Auswahl für das korrigierte Modell verlangt Dienstquelle 2.9.0; bei altem Dienststand erscheint ein Updatehinweis.

Das tatsächliche VM-Update ist ein eigener, noch offener Schritt. Zuerst persönliche Sicherung und native KI-/Bot-Originale sowie die Oracle-Zustandsdateien sichern; später den bereits dokumentierten geprüften Installerweg aus [G13](G13-LIEFERUNG.md) verwenden.

## Aktuelle Anzeige statt grüner Altfreigabe

`confluence-presentation.mjs` trennt den jetzigen Anzeigezustand vom damaligen gespeicherten Signal:

- Der Richtungs-Chip verwendet die **aktuelle lokale Prüfung**, keine gespeicherte Karte als Ersatz. Kursquelle/Instrument, Kostenmodell, aktive Einstellungen, Freigabe, Kursalter und jüngste geschlossene Trendkerzen müssen passen. Ein neuer Basiskerzenschluss nimmt die alte Bestätigung zurück, auch wenn deren Quote noch unter 30 Sekunden alt ist.
- Bei laufender Prüfung, Ticker-/Funding-/Feed-/Speicherfehlern, Pause, Neustart ohne neue Prüfung oder veraltetem Referenzkurs entfällt die positive Bestätigung.
- Die bereits für Referenzkurse verwendete **30-Sekunden-Grenze** gilt auch für die Anzeige und wird beim Planungsschritt erneut geprüft. Sie ist weder Nachrichtenablauf noch Trade-Haltedauer. Es gibt keinen zusätzlichen Kursfeed; „Jetzt prüfen“ lädt bewusst neu.
- Gespeicherte Karten zeigen „aktuelle Daten fehlen“, „Referenzkurs erneut prüfen“, „aktuell nicht bestätigt“, „älterer Referenzplan“ oder grau „früheres Modell“. Zeit/Modell/Revision, deutscher Fehlergrund und nächster Prüfschritt bleiben sichtbar. Originalpreise und Score bleiben erhalten.
- Ein neuer Kurs derselben Basiskerze erzeugt weiterhin keine zweite Signal-ID. Eine neue Referenzbewertung überschreibt keinen Originalplan.

Die bestehende Listenanordnung bleibt in dieser Gruppe erhalten. Deduplizierung der sichtbaren Listen, Kandidaten/Beobachten/Archiv, gemeinsame Filter, kompakte Karten und ein breiterer KI-Bereich folgen als getrennte Schritte innerhalb der inzwischen ausdrücklich erteilten Gesamtfreigabe. Auch Verlustbudget, aktuelle Ausführbarkeitsprüfung und belastbare Vorwärtsauswertung sind noch offen. Ein technischer Fix belegt keinen profitablen Marktvorteil.

## Kurzer Test in der App

1. KI öffnen, Slippage und Funding-/Stop-Regel bewusst wählen und eine lokale Analyse starten. Auf einer geeigneten aktuellen Bewertung den Modellhinweis **cf-2**, den Kurszeitpunkt und die Kosteninfo für beide Ausstiege prüfen.
2. „Jetzt prüfen“ wählen. Mit einem vollständig geprüften frischen Kandidaten darf der Richtungs-Chip Long/Short anzeigen; nach mehr als 30 Sekunden ohne neue Quote fehlt diese aktuelle Bestätigung.
3. Bei unterbrochener Bitget-Verbindung erneut prüfen: deutscher Datenfehler, keine positive Altfreigabe, gespeicherter Originalplan weiterhin vorhanden.
4. Mustergewicht oder andere Modellparameter ändern: alte Karte grau „früheres Modell“, ursprünglicher Score/Preisplan unverändert. Pause und Neustart bestätigen keine gespeicherte Karte als aktuellen Einstieg.
5. Native KI-/Bot-Originalsicherung mit alten cf-1-Beobachtungen einspielen und wieder exportieren: IDs/Quelle/Anker/Version erhalten, Wiederimport zählt einmal. Persönliche Sicherung bleibt separat.

## Prüfung und Freigabe

Gezielte Kern-, tatsächliche Worker-/Browser-, Archiv-, Dienst- und Installerprüfungen sowie Lint sind im gesonderten Testnachweis festgehalten. Vor einer Veröffentlichung folgen der vollständige serielle Gesamtlauf und die Releaseprüfung des finalen Programmstands. Keine Veröffentlichung, privaten Orders, echten Telegram-Nachrichten oder Änderung der privaten VM in dieser Gruppe.

Gezielter Abschluss Gruppe 1: Kosten 46/46, Darstellung 23/23, m71 23/23, m63 36/36, Dienst 26/26, Installer 35/35, Release 6/6, m69 19/19. Im m69-Erstbefund wurde das asynchrone Aktivierungsergebnis im Test zu früh geprüft: Playwright bewertet ein zurückgegebenes Promise als wahr. Der Test wartet nun ausdrücklich auf dessen Ergebnis und prüft bis zur bestätigten Aktivierung erneut. Der tatsächliche Cache-/Marker-/Offlinevertrag bleibt vollständig geprüft; kein SW-Produktfehler aus diesem Befund. Vollständige Erst-/Nachlauflogs liegen im Arbeitsbereich, der endgültige Release-Testnachweis folgt nach den weiteren beiden Gruppen.

## Gruppe 2 – gemeinsame kompakte Übersicht

Eine Liste zeigt jede Konfluenz-Original-ID einmal und die eigenständigen PO3-Modellfälle. Gespeicherte Originale haben Vorrang vor einer späteren Referenzbewertung derselben ID; aktuelle Prüfergebnisse ändern den Anzeigezustand. Kandidaten, Beobachten und Archiv werden getrennt angezeigt, alte Modelle standardmäßig im Archiv. Modell-, Coin- und Richtungsfilter gelten gemeinsam; ein gewählter Konfluenz-Horizont blendet PO3 bewusst aus. Bestehende PO3-Journal-/Kohorten-/Herkunftsfilter bleiben unter Einrichtung erhalten und beeinflussen dessen angezeigte Fälle und getrennte Statistik.

Die kompakte Karte zeigt Modell, Richtung, Regelpunkte, Preislevel und nächste Handlung. Einzelpunkte, Muster, Originalrevision/Kurszeit, Historie und Charts liegen in aufklappbaren Details. Einrichtung/Dienst/Speicher stehen unter der Liste. Unveränderte Karten behalten ihren DOM-Knoten; auch erneuerte Belege erhalten geöffnete Details und Tastaturfokus. Am Desktop verwendet der KI-Bereich die volle Breite; bei Rückkehr zu Preisalarmen/Bot gilt wieder die vorhandene Anordnung.

PO3 „Offen“ bezeichnet einen simulierten Modell-Entry, „Aktiv“ das wartende Limitmodell. Das ist kein Auftrag für einen zweiten Einstieg und kein Beleg einer echten Position. „Von mir gehandelt“ bleibt eine persönliche Markierung.

Gezielt geprüft: unit-signal-overview 27/27, m72 25/25, m63 36/36, m71 23/23, m67 22/22, m65 12/12, m66 14/14. Zum Testen zwischen beiden Modellen und Statusansichten wechseln, gemeinsame Coin-/Richtungsfilter prüfen, Details öffnen und „Jetzt prüfen“ wählen: Original bleibt einmal erhalten. Einrichtung öffnen für Modell-/Kostenannahmen und die bisherigen PO3-Kohortenfilter.

## Gruppe 3 – Risiko, aktuelle Preise und ehrliche Verteilung

Der modellierte Stopverlust steht bei selbst gewähltem Einsatz direkt auf Konfluenzkarten: EUR/USDT, Margin und Positionswert. Die vorhandene PO3-Größe zeigt ihren Stopverlust ausdrücklich nach Gebühren, vor Funding. Unbekannte Größen/Kosten bleiben nicht verfügbar. Kurslücken und tatsächliche Ausführung können das Szenario überschreiten; Cross bleibt ohne vollständiges Konto nicht bewertbar.

Unter Einrichtung eine separate Größenhilfe wählen: optionales eigenes Verlustbudget (zunächst leer) und ein UTC-Prüfzeitpunkt. Diese Werte werden getrennt gespeichert und sind als Präferenz in der persönlichen Sicherung enthalten. Sie ändern keine Originalpläne oder Scoreparameter. „Bitget-Kurs & Größe prüfen“ ruft bewusst über den vorhandenen Worker/client aktuellen Geld/Briefkurs, Funding und Kontraktraster ab. Kein weiterer Dauerfeed. Einstieg wird ungünstig um Slippage/Ticks angepasst; Originalstop und Originalziel bleiben erhalten. Aktuelles Brutto-/Netto-R:R, Spread, Abstand in R, gerundete Menge, Margin und Stopverlust sind getrennt vom Original sichtbar. Mindestmenge/Mindestwert werden geprüft, ein zu kleines Budget niemals angehoben. Geändertes Tickraster, überschrittener Originalstop/-ziel, Nachrichtenablauf und fehlende aktuelle Kosten blockieren eine positive Preisprüfung. Diese Momentaufnahme belegt keine zwischenzeitlichen Berührungen und bestätigt Trend/Score nicht neu. Veraltete Ergebnisse werden gekennzeichnet, beim Neustart nicht als aktuelle Prüfung übernommen. Keine Order.

Aus der bestehenden Originalhistorie kommen zusätzlich beschreibende Netto-Verteilungswerte: Mittel/Median, 10.–90. Perzentil und Anteil netto positiver Replays. Mindestens 30 auswertbare Fälle und vollständige modellierte Gebühren/Slippage/belegtes Funding; unreife Fälle, Kurs-/Kostenlücken und widersprüchliche IDs sichtbar. Originalschlüssel trennt Modell, Revision, Coin, Richtung, Horizont und Anker. Der bewusst gewählte Vorwärtszeitpunkt grenzt spätere Entscheidungen aus demselben gespeicherten Job ab; keine zusätzlichen Börsenabrufe. Ein vorab gewählter, beibehaltener Zeitpunkt ist für spätere Beobachtung gedacht, nachträgliche Fensterauswahl ist kein Vorteilsbeleg. Überlappende/korrelierte Signale werden nicht zu unabhängiger statistischer Sicherheit erklärt. Persönliche Trades ohne belegte Modell-/Ausführungszuordnung werden nicht als KI-Erfolg gezählt. PO3 bleibt wegen seines anderen Kostenumfangs getrennt.

Speicher zeigt Karten- und Originalarchivfüllstand; keine automatische Löschung. Sicherung/importierte Originale bleiben unverändert.

Test in der App: eigene Margin setzen und sichtbaren Stopverlust prüfen. Optionales Budget wählen, dann aktuelle Bitget-Prüfung auslösen: Menge/Raster/Mindestwert, Spread und Verlustbetrag prüfen. Netz unterbrechen bzw. mehr als 30 Sekunden alte Prüfung ansehen: Fehlermeldung/veraltet. Für Verteilung erst Historie/Backtest laden, unter Einrichtung UTC-Prüfzeitpunkt wählen und in Kartendetails Vorwärtsfenster auswerten. Ohne genügend vollständige Originalfälle bleibt die Verteilung nicht bewertbar.
