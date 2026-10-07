Der letzte Punkt im Ablaufplan ist ein zweites Layout. Es ist eine Alternative zum ersten Layout, damit ich entscheiden kann, welches App-Layout verwendet wird. Setze es nicht als normalen Ablaufschritt um, sondern lege mir beide Layouts zur Entscheidung vor.

# Scalp Desk - konsolidierte Übergabe an Claude AI

**Revision 4 - 05.10.2026:** An 3.28.0-Zwischenstand abgeglichen. Vorhandene Gründe, DEMO-Trennung und Dienst 1.4.0 erhalten; verbleibende Aufgaben präzisiert. Gruppenfolge und Freigaben bleiben verbindlich.

## Zielbeschreibung und verbindliche Arbeitsgrundlage

Erweitere meine bestehende HTML-/JavaScript-Trading-App schrittweise. Erhalte ihre Funktionen, Nutzerdaten und ihr vorhandenes Standardlayout. Nutze gemeinsame Rechenfunktionen, Datenverträge und Einstellungen für App, Hintergrunddienst und historische Simulation. Die App soll auf iPhone, iPad und Computer schnell und zuverlässig bleiben.

Der gelieferte **3.28.0-Zwischenstand** liegt unverändert in `basis/wx-widget-3.28.0-zwischenstand.zip` (SHA-256 `37ced43e2b322ed3efa98207b9a8d9357a42537230ae1536c39c2e39e61b175e`). Laut Nutzer stammt er aus `claude/awesome-noether-qpypso` und ist noch nicht in `main`; das ZIP enthält keine Git-Metadaten zur unabhängigen Branchprüfung. `weather-widget-v2.html`, `server/scalpdesk-247.mjs` und `sw.js` sind die hier geprüfte Codebasis. Falls Claude eine neuere Fassung liefert, diese zuerst sichern und ihren Unterschied zu diesem Snapshot abgleichen. Alte Zeilennummern und Patches sind Suchhilfen, keine Überschreibanweisung.

**Bereits vorhanden:** Mehrfachgründe in sieben Gruppen mit `reasons: string[]` und `setup` als Kompatibilitätsfeld; getrennte ECHT/DEMO-Positionen und -Historien; Backup v7 mit DEMO-Feldern; Dienst 1.4.0 mit 20-Sekunden-Polling, Übernahmebestätigung, Diagnosehinweis und `--status`. Diese Funktionen bewahren und testen, nicht nochmals neu bauen. Gründe dokumentieren nur und sind niemals allein ein Handelssignal.

Dieses Dokument ist die verbindliche Arbeitsanweisung dieses Pakets. Der Prüfbericht erklärt Korrekturen; `05_ABGLEICH_3_28_ZWISCHENSTAND.md` belegt den neuen Codeabgleich. Die Dateien unter `code/` sind vollständige **Referenzmodule**, keine bereits zusammengefügte neue App. Vollständiger Eigen-Code steht zusätzlich in `03_CODE_ZUM_KOPIEREN.md`; Bibliothek und Lizenz liegen im Paket. Für den Einbau dieses ganze Paket verwenden; bei einer neueren Claude-Version deren Codebasis vorziehen. Ältere ZIPs nicht parallel als gleichrangige Aufträge abarbeiten.

## Vorrang, Begriffe und gemeinsame Verträge

- Spätere ausdrückliche Nutzerentscheidungen haben Vorrang: Trades-Bericht genau ein Bild; Sicherung und manuelle Trades-Berichte ohne Oracle; Standardlayout bleibt bestehende App; freiwilliger Trading-Bot ist eine begrenzte zusätzliche Funktion.
- Ein Score von 70 ist eine **Punktzahl**, keine Erfolgswahrscheinlichkeit von 70 %. „KI“ bezeichnet hier nachvollziehbare Regeln; keine kostenpflichtige LLM-API.
- Regelgüte eines Musters, historische Kursrichtung, TP-Trefferquote und persönliches Nettoergebnis sind verschiedene Kennzahlen. Jede erhält einen eigenen Namen und Nenner.
- Handelbare Märkte eindeutig identifizieren: Börse, Produkt, Instrument, Notierungswährung. Binance Spot, Binance Futures und Bitget USDT-Futures nicht vermischen.
- Zeitstempel intern UTC-Millisekunden; Kerzenende exklusiv. Sekunden ausschließlich am Chartadapter. `1m` = Minute, `1M` = Kalendermonat; `30d_fixed` = exakt 30 Tage. Lokale Datumsfilter als solche beschriften.
- Bestätigte Signale verwenden nur vollständig abgeschlossene und zum Entscheidungszeitpunkt bekannte Kerzen. Pivot-Zeit und spätere Bestätigungszeit getrennt speichern. Laufende Kerzen nur als vorläufige Ansicht.
- Fehlend, lädt, veraltet, fehlerhaft, ausgeschaltet und „kein Muster gefunden“ getrennt behandeln. Unbekannte Werte sind `null` mit Grund, nicht 0.
- Eine zentrale Datenpipeline; Cache mindestens nach Markt, Instrument, Intervall, Modell-/Einstellungsrevision. Veraltete Antworten nach Coin-/Intervallwechsel verwerfen. Keine mehrfachen Timer oder Abonnements je Layout.
- Geldbuchungen als Dezimaltexte/Ganzzahleinheiten; volle Präzision bis zur Anzeige behalten. Diagramm-/Indikatorrechnung darf endliche Fließkommazahlen verwenden. Preise/Mengen vor Orders an Börsenpräzision anpassen.
- Gemeinsame Einstellungen lokal speichern und für serverberechnete Signale **versioniert mit Oracle synchronisieren**. Gleicher Funktionscode mit unterschiedlichen Parametern liefert unterschiedliche Signale. Offline-Änderungen als noch nicht synchronisiert kennzeichnen.
- Keine Zugangsdaten in Quelltext, öffentliche GitHub-Dateien, Beispielcode, Screenshots oder Logs. Nur Platzhalter. Bitget-Schlüssel ausschließlich vom Nutzer selbst auf dem eigenen Dienst hinterlegen, und nur für den ausdrücklich aktivierten optionalen Bot.

Beispiel des gemeinsamen Fachkontexts:

```js
const scope = {
  venue: "bitget", product: "USDT-FUTURES", instrument: "BTCUSDT",
  quote: "USDT", timeframe: "1h", mode: "simulation",
  modelVersion: "<MODELLVERSION>", settingsRevision: 1,
  asOf: 0 // vom validierenden Adapter ersetzen; UTC-Millisekunden
};
// App und Oracle erhalten dieselbe bestätigte settingsRevision.
// Kein DOM, Fetch oder Telegram-Versand in einer reinen Score-Funktion.
```

## Ablaufübersicht

| Gruppe | Inhalt | Historische Punkte |
| --- | --- | --- |
| G01 | Ausgangsstand, Datenintegrität, vollständige Sicherung | 12, 14; vorhandene 3.28-Funktionen erhalten |
| G02 | Positionen, Aufstockung, Teilabschluss, korrektes Ergebnis | 3, 17, 24 |
| G03 | Kontostand, Korrekturen, Euroanzeige, Auswertung | 8, 21, 26, 27 |
| G04 | Mobile Bedienung, Vorauswahl, Indikatorzustände | 1, 2, 4, 5, 6, 7, 15, 29 |
| G05 | Telegram-Ziele, Schalter, Oracle und doppelte Alarme | 10, 30; spätere Alarmkorrektur |
| G06 | Abschlussbericht als ein einziges Telegram-Bild | 11, 30 |
| G07 | Mittelwert-Zonen, Analyseintervalle, Market Cap | 20, 22 |
| G08 | Bitcoin-Entkopplung aus allgemeinen Top 100 | 28, Schritte 1-4 |
| G09 | Mustererkennung, Lexikon, dauerhaftes Lernen | 9, 18, 25, 33 |
| G10 | Konfluenz-Score, KI-Signale, Quoten und Backtest | 31; Musteranbindung |
| G11 | Power of Three, FVG-Alarme und Signaljournal | 32 |
| G12 | Optionaler Trading-Bot mit Gewinn-/Verluststopp | spätere Bot-Freigabe |
| G13 | Zusammenführung, Migration und Gesamtprüfung | gemeinsame Abnahme |
| G14 | **Zwei Layouts vorlegen; Nutzer entscheidet** | 23 / dritte Übergabe |

Die früheren Vorschläge 13, 16 und 19 waren nicht beauftragt. Die ursprünglichen Punktnummern bleiben nur zur Zuordnung erhalten. G14 ist ausdrücklich eine Vorlage zur Entscheidung und keine automatische Umgestaltung.

---

## G01 - Verbindlicher Stand, Datenintegrität und vollständige Sicherung

**Ziel:** Eine sichere Grundlage, bevor Datenmodelle erweitert werden.

1. Gelieferten 3.28.0-Zwischenstand und, falls vorhanden, neuere Claude-Version inventarisieren: Dateien, Daten-/Backupschema, aktuelle Module, PWA-Service-Worker, Navigation, bereits erledigte Wünsche. Eine unveränderte Ausgangskopie und eine nachvollziehbare Änderungsliste erhalten.
2. In 3.28.0 nutzt `loadRecords()` weiterhin `v.map(load).filter(Boolean)`; dieser Punkt ist offen. Fehlerhafte Positionen/Trades beim Laden nicht durch `filter(Boolean)`, stilles Verwerfen oder Default-Nullwerte verlieren. Originaldaten erhalten, fehlerhafte Einträge separat anzeigen, Grund nennen und Korrektur/Export anbieten. Fehlerhafte Datensätze nicht unbemerkt in Summen einrechnen; Unvollständigkeit anzeigen. Wiederherstellung muss möglich bleiben.
3. Stabile fachliche IDs, Revisionen und `commandId` verwenden. Ein Import ist idempotent. **Konflikte werden vom Nutzer entschieden**, niemals durch „letztes Gerät“, höhere lokale Revision oder jüngere Gerätezeit. Bei gemeinsamer Basis und verschiedenen Änderungen beider Geräte einen Dialog „Änderungen vergleichen“ mit bisherigem bestätigtem Stand und lokalem/importiertem Entwurf zeigen, einschließlich der abweichenden Felder. „Bestätigten Stand behalten“, „Entwurf übernehmen“ oder „Später entscheiden“; keine Auswahl vorauswählen. Bis zur Entscheidung bleibt der bestätigte Stand wirksam, beide Fassungen bleiben erhalten. Tatsächlich erfolgte Handelsereignisse nicht durch Auswahl einer Einstellungsversion löschen: bei Aufstockung/Abschluss Menge und doppelte Ereignisse fachlich abgleichen.

   Für **dienstgeteilte Einstellungen** ist Oracle die Revisionsautorität: Änderung nur mit `expectedRevision` und stabiler `commandId` atomar annehmen, danach Serverrevision erhöhen. Veraltete Basis: `409 Conflict` mit aktuellem Stand; Übernahme des Entwurfs verlangt erneute bewusste Bestätigung gegen diese Basis. Wiederholte Command-ID liefert das bereits gespeicherte Ergebnis, keinen zweiten Commit. UTC-Zeiten dienen der Anzeige, nicht der Konfliktentscheidung. Persönliche Journal-/Backupimporte bleiben lokal: gleiche ID/Revision mit unterschiedlichem Inhalt ist ebenfalls Konflikt, nicht automatisch die „neuere“ Wahrheit. Dafür keine persönlichen Handelsdaten an Oracle hochladen.
4. Vorhandene Trennung `state.positions`/`state.trades` und `state.demoPositions`/`state.demoTrades` erhalten. DEMO darf keinen Hinweis, Ton, Browser-/Telegram-/Discord-Alarm, Dienstübergabe, Tages-Verlustlimit oder echte Summe auslösen. Signal-Simulation und Bitget-Börsendemo nochmals getrennt halten. Gründe dokumentieren nur; niemals aus `reasons`/`setup` allein Signale oder Orders ableiten. Neuen Rechen- und Sendecode auf ECHT/DEMO-Grenze prüfen.
5. **Immer vollständiges persönliches Backup:** offene Positionen, Lose, Teilabschlüsse, alle geschlossenen Trades, Kontostand und Kontrollstände, Alarme, Einstellungen, Reihenfolge, Journal-/Modellrevisionen, persönliche Signalaufzeichnungen und noch ungesichertes lokales Musterlernen. Keine Beschränkung auf das ausgewählte Jahr. Die Abfrage „Offene Positionen / Alarme / Komplett“ einschließlich ihrer alten Programmzweige entfernen. Hauptaktion: **„QR-Code erzeugen“**.
6. Zusätzlich **„Textcode anzeigen/kopieren“** und **„Textcode einfügen/importieren“**. Der Nutzer hat ausdrücklich einen vollständigen langen Textcode ohne Zusatzdienst gewählt. Er enthält dieselbe Sicherung; kein kurzer Abrufcode, keine Cloud-Ablage als Voraussetzung. Dateiexport/-import als vorhandenen Wiederherstellungsweg erhalten.
7. Gemeinsames versioniertes Format für QR, Text und Datei: Schema, Inhaltstyp, Byte-Länge, Prüfsumme, komprimierter Nutzinhalt. Prüfsumme schützt vor Übertragungsfehlern, nicht vor unbefugtem Lesen. **Höchstens 10 QR-Teile**, jeweils einzeln groß mit „Teil X von N“ anzeigen; kein Raster winziger Codes. Automatischer Wechsel in Endlosschleife, Standard 1 Sekunde pro Teil; Geschwindigkeit 0,5 / 1 / 1,5 / 2 Sekunden wählbar. Pause/Fortsetzen und manuell Vor/Zurück anbieten. Ausgelassene Teile können in der nächsten Runde eingelesen werden. Auf dem Empfänger Fortschritt „7 von 10 Teilen gelesen“ und fehlende Teilnummern zeigen. Ohne Rückkanal kennt der Absender diesen Empfangsfortschritt nicht und beendet den Wechsel nicht automatisch. Transfer-ID, Teilnummer, Gesamtzahl und Gesamtprüfsumme in jedem Teil; gleiche Teile idempotent sammeln, widersprüchliche Teile ablehnen. Erst vollständig validiert übernehmen.

   Lesbarkeitsgrenzen: Fehlerkorrektur mindestens M, QR-Version höchstens 20, mindestens 3 ganze CSS-Pixel pro Modul und 4 freie Module Rand auf jeder Seite; schwarz auf weiß, unabhängig vom App-Theme. Tatsächliche Encoderkapazität einschließlich UTF-8-/Base64- und Metadaten-Overhead prüfen. Der Bildschirm kann eine kleinere zulässige Version erzwingen. Passt die **vollständige** Sicherung unter diesen Grenzen nicht in 10 Teile, keine QR-Ausgabe erzeugen: „Sicherung zu groß für QR - Textcode oder Datei verwenden“. Niemals Trades weglassen, Fehlerkorrektur herabsetzen oder Codes kleiner skalieren. Vor dem Start tatsächliche komprimierte Größe und benötigte Teilzahl berechnen/anzeigen. Ob zehn Teile für einen Nutzer reichen, hängt vom Inhalt ab; bei umfangreichen Journalen keine pauschale Zusage. Bei mehr als zehn Teilen den vollständigen Text-/Dateiexport unmittelbar anbieten. Grenzen 10/11 Teile und reales iPhone/iPad prüfen.
8. Import begrenzen: komprimierte und entpackte Größe prüfen, Schema/IDs/Zeitstempel validieren, vollständige Vorschau und Sicherung des bisherigen Stands; erst dann atomar übernehmen. Bei Fehlern bisherigen Stand erhalten. Alte Backup-Versionen bewusst migrieren.
9. Gerätespezifische Installations-ID und laufende Sendesperren nicht auf ein anderes Gerät klonen. Fachliche Alarm-ID und Aktivierungs-ID dagegen erhalten, damit das iPad denselben Alarm nicht erneut auslöst.
10. Das gesamte öffentliche Musterarchiv gehört nicht in jedes Nutzerbackup. Bibliotheksreferenzen, Revisionen und ungesicherte neue Fälle gehören hinein; das Originalarchiv erhält eine separate dauerhafte Sicherung in G09.
11. Bitget-API-Geheimnisse werden niemals in QR/Text/Telegram-Backup exportiert. Private Telegram-Zugänge und Geräteautorisierungen nicht als Klartext in frei teilbare Codes aufnehmen. Vollständige Nutzdaten sind von gerätegebundenen Geheimnissen zu unterscheiden; für eine Schlüsselübernahme gegebenenfalls einen gesonderten verschlüsselten Weg festlegen. Import darf keinen Bot oder Nachrichtenversand eigenmächtig aktivieren.

**Code/Anschluss:** vorhandene Backup-/Importfunktionen von 3.28.0 (`backupPayload`, `PLAN_KINDS`, `SYNC_KEYS`) samt DEMO-Feldern erweitern. Die alte QR-Umfangswahl `qr-scope` ist noch vorhanden und bleibt ein offener Auftrag. `code/frontend/account-ledger.js` liefert strikte Validierung für sein eigenes Schema, ist aber kein vollständiger Importer. PO3-CSV und persönliche Backups sind verschiedene Formate.

**Prüfung vor Freigabe:** Gründe-Migration, DEMO-Trennung, Altbackup, großes Backup, beschädigter QR-Teil, doppelter Import, iPhone→PC per Text, iPhone→iPad mit derselben Alarm-ID, gleichzeitige Bearbeitung, DEMO-Trennung und Wiederherstellung nach Speicherfehler. Kein Nutzdatensatz darf still verschwinden.

**Zusätzliche Abnahmefälle (Revision 3):** Konflikt: iPhone und iPad ändern dieselbe Basisrevision offline, auch bei falscher Geräteuhr; Command-Retry erzeugt keinen zweiten Commit; 10/11 QR-Teile, fehlender/widersprüchlicher Teil, lesbare Einzelanzeige, automatische Wiederholung, Pause und variable Wechselgeschwindigkeit. Teilfolgen durcheinander oder mehrfach dürfen weder Daten verlieren noch einen vorzeitigen Import auslösen.

### Datenvertrag für vorhandene Gründe und DEMO

`normalizePosition()` spiegelt den ersten Grund in `setup`. Bei Abweichung ersetzt oder entfernt es `reasons[0]`. Das ist nur dann eindeutig richtig, wenn eine ältere App nachweislich genau diesen ersten Grund geändert hat. Ohne Provenienz beide Varianten sichern und den Konflikt aus G01.3 zeigen. `MAX_REASONS=20` und die 40-Zeichen-Grenze gelten für neue UI-Eingaben; importierte überschüssige Gründe dürfen nicht unbemerkt verschwinden. Echte und DEMO-Trades behalten getrennte Historien/CSVs; Grund-Analysen zählen pro Kategorie einmal, Gesamtsummen jeden Trade nur einmal.

## G02 - Positionen, Nachkäufe, Teilabschlüsse und Ergebnis

**Ziel:** Ein einziges korrektes Ergebnis für Karten, Kontostand, Oracle und Berichte.

1. Long: „Nachkaufen“. Short: „Short aufstocken“. Eine Short-Aufstockung ist ein weiterer Verkauf; ein Rückkauf reduziert den Short. Hier werden manuell ausgeführte Trades erfasst, keine Orders ausgelöst.
2. Jede Aufstockung als Los mit ID, Zeitpunkt, Menge, Ausführungspreis und bekannten Gebühren speichern und anzeigen. Gesamtmenge und gewichteten Einstieg anzeigen. Alte Positionen als einen nachvollziehbaren übernommenen Bestand migrieren; keine historische Losfolge erfinden. Symbol/Markt/Richtung, Hebel und Margin-Modus innerhalb des unterstützten Positionsmodells konsistent halten.
3. Für lineare USDT-Positionen gelten:

```text
Q = Summe(q_i)
E = Summe(q_i * p_i) / Q
d = +1 für Long, -1 für Short
offener Brutto-G/V = d * Q * (aktueller Kurs - E)
Teilabschluss Brutto-G/V = d * geschlossene Menge * (Ausstieg - E)
```

Den Hebel nicht nochmals auf mengenbasierten PnL multiplizieren. Gebühren/Funding getrennt genau einmal buchen. Q*E/Hebel ist eine rechnerische Margin, kein Beweis für verfügbares oder geschütztes Cross-Kapital.

4. Teilabschluss: Menge größer 0, höchstens offene Menge; vor Ausführung Preis, Richtung, geschlossene/restliche Menge und erwartetes Ergebnis anzeigen. Verlust und Gewinn sind gleichermaßen zulässig. Historie eines Teilabschlusses erhalten; verbleibende Menge darf nie negativ werden.
5. Verbindlich gewichtete Durchschnittskosten verwenden. Bei Teilabschluss Lose proportional reduzieren; historischen Losumfang und geschlossenen Anteil getrennt führen. **Restverteilung exakt festlegen:** Alle Mengen als ganzzahlige interne Mengeneinheiten führen, nicht als binäre JS-Fließkommazahlen; diese Einheit ist getrennt von der Order-Schrittweite der Börse. Für Abschlussmenge K und Gesamtmenge Q zunächst je Los `k_i = floor(K*q_i/Q)`. Die verbleibenden Einheiten `R = K - Summe(k_i)` jeweils einzeln an Lose mit positivem Divisionsrest verteilen: neuestes `openedAt` zuerst, bei gleicher Zeit stabile Los-ID aufsteigend. Je berechtigtem Los höchstens eine Zusatzeinheit. Damit exakt `Summe(k_i)=K` und stets `0<=k_i<=q_i`. Kein pauschaler Rest auf ein zu kleines letztes Los. Vollabschluss übernimmt alle noch offenen Einheiten exakt.

   **Kostenpool getrennt erhalten:** Gerundete Loszuordnung darf den verbleibenden Durchschnitt nicht verändern. Durchschnitt E als exaktes Dezimal-/Bruchverhältnis halten; Restkostenpool `C_rest = C_alt*(Q-K)/Q`, anteilige Kosten `C_geschlossen = C_alt-C_rest`. Nicht aus den gerundeten Losrestmengen und alten Einzelpreisen einen anderen Durchschnitt neu berechnen. Bei Geldbuchungen im Währungsraster „half-even“ runden; Rest durch Subtraktion zuordnen, beim letzten Abschluss den gesamten noch offenen Kostenrest verwenden. Neu hinzukommende Menge verändert nur den Durchschnitt der Restposition. Kosten-/Gebührenreste nachvollziehbar speichern, niemals als zusätzlichen Gewinn erzeugen.
6. Bereits realisierte Ergebnisse und bereits verbuchte Einstiegsgebühren nicht beim letzten Abschluss nochmals addieren/abziehen. Wird das endgültige Börsen-Nettoergebnis manuell eingegeben, seinen Geltungsbereich ausdrücklich festhalten: gesamte Position oder nur verbleibender Abschluss. Ein Gesamtresultat ersetzt die Positionsgesamtrechnung; für das Journal nur die Differenz zu schon verbuchten Teilergebnissen buchen.
7. App und Oracle für offene G/V-Alarme auf derselben bisherigen Brutto-Basis halten. Ein alarmierter Netto-Modus wäre eine ausdrückliche separate Änderung, kein einseitiger Wechsel.
8. Aufstockung/Teilabschluss aktualisiert Menge, Einstieg, Live-G/V, ROE, Marginanzeige, Chartmarken und Oracle-Snapshot. Gewinnsichernde Stops sind zulässig. Manuell eingetragener Liquidationskurs kann danach veraltet sein und muss sichtbar zur Prüfung stehen. Stops/TPs nicht heimlich verschieben.
9. Abschluss atomar speichern; Doppeltipp, Reload oder Import darf keinen zweiten Abschluss erzeugen. Historische Nacherfassung nicht als neuer aktueller Telegram-Abschluss melden. Einzelne Teilabschlüsse lösen standardmäßig keinen vollständigen Trades-Bericht aus; erst der komplette Positionsabschluss in G06.
10. Button nach **ungerundetem verfügbaren G/V** beschriften: positiv „Gewinn realisieren“, negativ „Verlust realisieren“, exakt null „Position schließen“. Fehlen verlässliche Daten, neutrale Beschriftung mit Datenhinweis; manuellen tatsächlich erfolgten Abschluss mit eigenem Preis trotzdem erfassbar halten.

**Rechenprobe:** 2 Stück zu 100 + 1 zu 130 ergeben 3 zu 110. Ein Stück Long bei 120 geschlossen = +10 brutto; Short bei 100 geschlossen = +10 brutto. Je 2 Stück zu 110 bleiben. Eine weitere Einheit zu 80 ergibt 3 Stück zu 100. Bereits realisierte +10 werden nicht in die neue offene PnL-Menge hineingerechnet.

**Code:** `code/confluence/confluence-core.mjs`: `netPnlUSDT` nur für konstante Menge und korrekt ausgewählte Funding-Abrechnungen; Mengenverläufe bei Teilabschlüssen separat abarbeiten. `code/frontend/account-ledger.js`: Ergebnisbuchungen und exakte Dezimaldarstellung. Neue Los-/Abschlussadapter im aktuellen App-Code ergänzen.

**Prüfung:** Long/Short spiegelbildlich, Nachkauf nach Teilabschluss, Gebühren nur einmal, vollständiges manuelles Nettoergebnis, unveränderter gewinnsichernder Stop, idempotente Buchungen und Abgleich zweier Geräte.

**Zusätzliche Abnahmefälle (Revision 2):** Restverteilung mit kleinstem neuen Los, gleichen Zeitstempeln, wiederholten Teilabschlüssen und Q=0 nach Vollabschluss; Summen und unveränderter Restdurchschnitt exakt prüfen.

## G03 - Kontostand, Korrekturen, Euroanzeige und klappbare Bereiche

1. „Mein Kontostand“ als Accordion direkt **über** „Meine Positionen“. Beim ersten Öffnen Startwert in USDT und Zeitpunkt manuell eingeben/speichern. Das Startkapital gilt nach allen bis dahin bereits enthaltenen Buchungen; diese nicht nochmals addieren. Die Jahresauswahl „Realisiert 2026“ filtert eine Auswertung, nicht die gesamte Kontostandsberechnung.
2. Gebuchter Kontostand = Startwert + danach gebuchte Netto-Trading-Ergebnisse + Geldbewegungen + abgeleitete Korrekturen. Gebühren/Funding nur addieren, soweit nicht bereits im Nettoereignis enthalten.
3. Live-Kontostand = gebucht + offener Brutto-G/V - bekannte noch ungebuchte Kosten. Beim Schließen muss das offene Ergebnis in gebuchtes Ergebnis übergehen, ohne Sprung durch doppelte Verrechnung. Fehlende Kosten/Kurse sichtbar machen; veralteten Livewert mit Zeit kennzeichnen.
4. **Jederzeit „Kontostand korrigieren“:** absoluten gebuchten Zielstand ohne offenen G/V speichern, mit Gültigkeitszeit und optionalem Grund. Vorher/Nachher/Differenz zeigen. Null ist erlaubt; leer ist kein Nullwert. Startwert nicht überschreiben.
5. Kontrollstände sind absolute Anker, keine dauerhaft festen Plus-/Minusbuchungen:

```text
gewöhnliche Buchungen bis einschließlich Kontrollzeitpunkt zuerst
Korrekturdifferenz = Zielstand - bis dahin berechneter Stand
Stand nach Kontrollpunkt = Zielstand
danach folgende Buchungen normal weiterrechnen
```

Beispiel: 1.000 +20 =1.020; Korrekturziel 1.050. Später vergessenen früheren Trade +30 nachtragen: Stand bleibt 1.050, abgeleitete Korrektur wird 0. Nachtrag nur +12: Korrektur bleibt +18. Danach neuer Trade -10: 1.040. Quelle und abgeleitete Korrektur nicht beide erneut als Buchung importieren.

6. Mehrere Kontrollstände chronologisch auswerten. Gleiche Zeit mit widersprüchlichem Zielwert ist ein Importkonflikt. Revisionsprüfung/idempotente Command-ID beim Speichern. Historische Korrektur vorschauen; Korrekturen nachvollziehbar ersetzen/zurücknehmen, nicht still löschen.
7. Bei unbekanntem Vorbestand Zielwert als neuen bestätigten Anker zulassen, Differenz „nicht bestimmbar“. Frühere fehlende Trades oder Verlaufskurven dadurch nicht erfinden. Eine Korrektur ist kein Trade, kein Gewinn, kein Signal und kein Telegram-Bericht.
8. Zeitraumfilter Heute, 7 Tage, 30 Tage, eigenes Datum. Heute/Grenzen mit sichtbarer Gerätezeitzone, Tagesende einschließlich gewählten Enddatums; 7/30 Tage als klar bezeichnete rollierende Zeiträume. Absolute und prozentuale **Kontostandsänderung** anzeigen; Ein-/Auszahlungen und Korrekturen getrennt vom Handelsergebnis. Bei Anfangsstand 0 oder unvollständiger Historie keine fiktive Prozentzahl.
9. Offenen G/V in der Kopfzeile zusätzlich daneben/darunter **in Euro in Klammern**, identische Live-FX-Daten wie Positionsübersicht. `usdtPerEur = USDT je 1 EUR`, somit `EUR=USDT/usdtPerEur`; keine mehrdeutige Kursrichtung „EUR/USDT“. USD und USDT nicht gleichsetzen. Fehlenden/veralteten Kurs mit Quelle/Zeit kennzeichnen.

   **Realisierte Euroergebnisse sind historische Werte:** je Netto-Buchungsereignis einschließlich Teilabschluss den damals gültigen FX-Kurs, Quelle, Kurszeit, Ereigniszeit, Umrechnungsrichtung und resultierenden Eurobetrag fest speichern. Historie und G06-Bild verwenden genau diese Werte. EUR-Gesamtergebnis einer mehrfach geschlossenen Position ist die Summe ihrer eingefrorenen Netto-Buchungen, nicht Gesamt-USDT geteilt durch den späteren letzten Kurs. Kosten nur einmal nach G02/G03 buchen. Offene Werte dürfen weiter Live-FX nutzen; realisierte Werte ändern sich dadurch nicht.

   FX-Gültigkeit: bekannter Kurszeitpunkt höchstens Ereigniszeit, Alter standardmäßig höchstens 5 Minuten, konfigurierbar und dokumentiert. Fehlt ein gültiger Kurs, Abschluss in USDT trotzdem speichern, `fxStatus="missing"` und Eurobetrag `null`; keinen späteren Livekurs rückdatieren. Nachtrag nur aus belegtem historischen Kurs als protokollierte Revision; Tagesdurchschnitt ausdrücklich als Näherung kennzeichnen. Beabsichtigte Korrekturen bleiben möglich, aber keine stille Neubewertung. Bei leerem FX zeigt das Trade-Bild „EUR zum Abschlusszeitpunkt nicht verfügbar“.
10. **„Auswertung“ vollständig klappbar**, inklusive Kapitalverlauf und Kennzahlen; Zustand und Jahreswahl erhalten.
11. **„Meine Positionen“ nur als Übersicht klappbar:** Überschrift bleibt erreichbar, Summen/Hinweise/Formular und Tagesverlustlimit gehören in den Klappbereich. Die darunter stehenden offenen Positionskarten bleiben **außerhalb** und sichtbar. Zugang zur Positionserfassung auch im eingeklappten Zustand über eine kompakte Aktion erhalten.
12. Accordion-Zustände pro Profil speichern; native `details/summary` oder zugängliche Schalter. Keine verschachtelten Buttons im Summary-Klick. Beide später angebotenen Layouts nutzen dieselben Commands und Daten.

**Code und Lücke:** `code/frontend/AccountBalanceWidget.js` und `account-ledger.js` enthalten Ersteinrichtung, gebuchte/Live-Werte und Filter. Sie enthalten noch **keinen Kontrollstand-Projektor und keinen Korrekturdialog**. Schema versioniert erweitern: der alte Validator lässt unbekannte Zusatzfelder nicht automatisch durch. Korrektur muss vor Freigabe dieser Gruppe eingebaut werden.

```js
// Fachlicher Command; keine echten Werte oder privaten Konto-IDs:
{
  command: "account:set-balance-checkpoint",
  commandId: "<AUFTRAGS-ID>", expectedRevision: 12,
  accountId: "<LOKALE-JOURNAL-ID>", mode: "live", currency: "USDT",
  checkpoint: { id: "<KONTROLLSTAND-ID>", at: "<UTC-MS>",
                targetBalance: "1050.00000000", reason: "Trade nachtragen" }
}
```

**Prüfung:** vergessener Gewinn/Verlust vor Korrektur, mehrere Anker, unbekannte Vorgeschichte, Nullstand, Reload/Backup, historischer Filter, FX-Ausfall. Eingeklappte Übersicht darf die offenen Karten nicht verstecken.

**Zusätzliche Abnahmefälle (Revision 2):** Realisierter EUR-Wert bleibt nach FX-Wechsel/Reload/Import gleich; unterschiedliche Teilabschlusskurse korrekt summieren; FX fehlt/veraltet/zukünftig; historischer Nachtrag erzeugt eine Revision.

## G04 - Mobile Bedienung, Vorauswahl und Datenzustände

1. Nicht berechenbare Indikatoren sichtbar grau sperren, mit Grund und tatsächlichem Kerzenbedarf; Tastatur/Klick wirklich blockieren. Gespeicherten Einschaltwunsch erhalten. Verfügbarkeit auch bei ausgeschaltetem/unsichtbarem Chart berechnen. Nach ausreichenden Daten automatisch freigeben. Abhängige Ebenen sinnvoll aktivierbar lassen.
2. Im Detail einer Vorauswahl-Kachel schmale Zeile „24h-Tief / 24h-Hoch“, **rollierende letzte 24 Stunden**, unabhängig vom sichtbaren Chart. Gleichen Markt wie Kachel verwenden, Preiswerte validieren, Cache/Anfragegeneration. `/api/v3/ticker/24hr` für Binance Spot, getrennten Futures-Weg verwenden; kein Spot-Ersatz unter Futures-Beschriftung.
3. Kryptowährungsfeld bei Fokus vollständig markieren, sodass Eingabe ersetzt; eine bewusst leere Suchansicht ist ebenfalls möglich. Aktuell geladener Coin bleibt bis bestätigter gültiger Auswahl erhalten. Abbrechen, leere Eingabe oder Tastaturwechsel dürfen keinen ungeplanten Marktwechsel auslösen.
4. Auf iOS Fokuszoom vermeiden: tatsächliche Input-/Select-Schrift auf mobilen Geräten mindestens 16 CSS-Pixel, keine verkleinernde Parent-Transformation. Vergrößerungsfreiheit erhalten.
5. Eigene App-/Chartvergrößerung beim Bereichswechsel gezielt zurücksetzen, soweit gewünscht. **Nativer Safari-Pinch-Zoom lässt sich nicht zuverlässig auf 100 % setzen**; `visualViewport.scale` ist schreibgeschützt. Kein `user-scalable=no` oder Viewport-Trick als angebliche vollständige Lösung. Chart-Zoom und Browser-Zoom unterscheiden.
6. Untere Navigation ohne kurzes Aus-/Einblenden beim Coinwechsel: DOM-Knoten beibehalten, feste Platzreserve, Safe-Area und Tastatur-/Viewportzustand berücksichtigen. Vollbild-Chart darf Bottom-Navigation ausblenden; Toolbar bleibt erreichbar/einklappbar. Konstante physische Größe beim nativen Browser-Pinch ist keine zugesicherte Browserfunktion.
7. Kurse/Live-G/V mit Quellzeit und festgelegter Frischegrenze anzeigen. Eine erfolgreiche HTTP-Antwort erneuert nicht den Zeitstempel alter Nutzdaten. Wenn ein Teil fehlt, keine scheinbar vollständige Gesamt-PnL. Neue Kursalarme/automatische Orders nicht auf unbrauchbaren Daten auslösen; tatsächliche manuelle Trades weiterhin erfassbar.
8. **Vorauswahl per langem Drücken umsortieren:** ungefähr 450 ms halten, anschließend in beide Richtungen im Raster ziehen. Vor Aktivierung Bewegung oberhalb kleiner Toleranz als Scrollen behandeln; danach Platzhalter/gezogene Kachel und Zielplatz anzeigen. Kurzer Tipp öffnet weiterhin das vorhandene Detail. Nach Drag keinen zusätzlichen Tipp auslösen.
9. Safari-Konflikt: nachträgliches Ändern von `touch-action` kann eine bereits begonnene Browsergeste nicht übernehmen. Pointer-/Touch-Verhalten auf echten Geräten testen; falls die ganze Kachel Scrollen nicht zuverlässig mit Drag kombinieren lässt, sichtbaren Sortiermodus/Griff im Bereich „Bearbeiten“ zusätzlich anbieten. Normales Scrollen und Pinch-Zoom erhalten.
10. Reihenfolge über stabile Asset-/Markt-IDs speichern und ins Backup aufnehmen. Livekurse nicht durch Neubau des Rasters aktualisieren; während Drag nicht automatisch sortieren. Neuzugänge am Ende, entfernte Elemente bereinigen. Tastaturbedienung und „nach oben/unten verschieben“ als zugängliche Alternative. Abbruch/Pointersperre/Orientierungswechsel hinterlässt keine verlorene Kachel.

**Code:** bestehende Standard-UI ergänzen; `code/frontend/DashboardView.js` liefert bereits stabile Komponenten für die alternative Ansicht, ersetzt diese Aufgaben im Standardlayout aber nicht.

**Prüfung:** echtes iPhone/iPad, PWA und Safari, Tastatur geöffnet, Pinch-Zoom, Vollbild, schneller Coinwechsel, 320 CSS-Pixel, Desktop-Maus/Tastatur, Reload nach Umsortieren. Chromium-Mobilvorschau ersetzt diesen Gerätetest nicht.

## G05 - Telegram-Chats, Schalter, Oracle und doppelte Alarme

**Verbindliches Routing:**

| Zweck | Ziel | Versandweg |
| --- | --- | --- |
| Preis-, Stop-/Ziel- und offene G/V-Alarme | @Nico_Alarm111_Bot / Kurs-Alarm | Oracle 24/7; Vordergrund-App nur mit exklusiver Ereignisfreigabe |
| Persönliche Sicherung | @Sicherung_111_IOS_bot | ausschließlich App → Telegram |
| Geschlossene manuelle Positionen | neues Ziel „Trades / Trade-Überblick“ | ausschließlich App → Telegram, G06 |
| Wichtige erkannte Chartmuster | eigenes konfiguriertes Muster-Ziel | bestehender Oracle-Dienst 24/7 |
| KI-Signale und PO3/FVG | dafür konfiguriertes Signal-Ziel | bestehender Dienst; bestehende Schalter beachten |

1. Ziel-Liste statt fest verdrahteter Empfänger: ID, Name, Zweck/Ereignistypen, aktiviert, server/app-Zuständigkeit und getrennte Secret-Referenz. Ein Zweck kann konfiguriert werden; Preis-/G/V-Alarme dürfen niemals zum Sicherungsbot ausweichen. Kein implizites Fallback auf irgendeinen vorhandenen Bot.
2. Im Menü „Telegram-Chats“ mit Name, Zweck, großem Ein/Aus-Schalter, „Alle an/aus“ und „2 von 3 aktiv“. Mindestens Sicherung, Kursalarm und Trades; Muster/Signale bei Einrichtung ergänzen. Nicht konfigurierte Ziele deutlich anzeigen und nicht als erfolgreich aktiv zählen.
3. **Master ist eine Sammelaktion**, wie im bisherigen Punkt 30 festgelegt: Sind alle vollständig eingerichteten Ziele an, werden alle ausgeschaltet; sonst werden alle vollständig eingerichteten Ziele eingeschaltet. Einzelwerte danach entsprechend anzeigen. Keine zusätzliche versteckte globale Sperre. Gemischten Zustand mit `indeterminate` einer Checkbox anzeigen, nicht als ungültigen gemischten `role="switch"`-Wert. Fachfilter, DEMO-Freigaben und Horizontschalter bleiben separat erhalten. Effektive Sendeberechtigung = Ziel AN UND zutreffende Fachfreigaben.
4. Für Oracle-Ziele persistenter Dienstzustand mit Revision, `enabledSince` und Epoch. Änderungs-Commands mit `expectedRevision`/`commandId` aus G01.3; alle Ziele einer Master-Aktion atomar prüfen und gemeinsam übernehmen oder vollständig ablehnen. Beim Umschalten Ladezustand; neuen Status erst nach bestätigtem Commit anzeigen. Bei verlorener Antwort Command-Ergebnis abfragen; vorherigen bestätigten Stand mit „Status unbestätigt“ zeigen, kein erfundener Rollback. Nach Restart erhalten; andere Geräte beziehen denselben bestätigten Stand.

   Offline-Schalteränderungen nur als Entwurf, nicht als wirksam darstellen und beim Wiederverbinden nicht ungefragt ausführen. Erst aktuelle Serverrevision lesen; Konflikt sichtbar auflösen und erneut bestätigen. Insbesondere kein altes „AN“ aus dem Offline-Puffer später wieder abspielen. `enabledSince` stammt vom tatsächlichen Servercommit. Bot-Start ist immer ein gesonderter bewusster Command, niemals Nebenwirkung eines Settings-Merge.
5. AUS verwirft neue und wartende Benachrichtigungen; AN sendet nur **ab jetzt neue**. Ein- und Ausschalten ändert die Epoch, sodass alte Warteschlangen nicht wiederbelebt werden. Prüfung unmittelbar vor Versand, nicht nur beim Erzeugen. Bereits an Telegram übergebene Anfrage kann nicht rückwirkend ungesendet werden.
6. **Vorhandener Stand:** Dienst 1.4.0 liest die angeheftete Übergabedatei etwa alle 20 Sekunden, bestätigt sie und meldet nach drei Minuten ohne Datei Bot/Chat-ID; die App prüft die Bestätigung. Das ist noch kein bestätigter Sofort-Commit der neuen Chat-Schalter und kein gemeinsamer Ereignis-Lock. Diese Diagnosefunktionen behalten. Steuerung über authentifizierten HTTPS-Endpunkt des **vorhandenen** Oracle-Dienstes. CORS auf die tatsächliche HTTPS-App-Origin begrenzen. Softwareupdate desselben Dienstes ist nötig; kein neuer Oracle-Rechner, keine erneute komplette Einrichtung pro Chat. Telegram-Minutenpolling ist keine sofortige Schalterbestätigung.
7. Sicherungsinhalt, Sicherungsbot-Token und manuelle Trades-Bilddaten gehen **nicht an Oracle**. Ein generischer Schalterstatus/Revision ohne private Nutzdaten darf über die zentrale Steuerung gelten. Backup- und Trades-Versand bleibt lokal; auch manuelle „Jetzt senden“-Aktionen beachten AUS.
8. **Doppelte Alarme beheben:** Ein fachliches Ereignis bekommt eine gemeinsame, dauerhafte ID aus Alarm-ID + Aktivierungs-ID + Ereignisart. Kein Preis, Empfangszeitpunkt oder Geräte-ID als neue Ereignisidentität. +20,16 und +20,51 können derselbe Schwellendurchbruch sein.
9. Oracle koordiniert atomar den einzigen Sender. Wenn App offen: Gerät meldet dasselbe Ereignis, erhält höchstens einmal eine exklusive Freigabe und sendet dann direkt an den Kursalarmbot. Andernfalls sendet Oracle. App-Präsenz/Heartbeat allein ist kein gegenseitiger Ausschluss. Zwei offene Geräte konkurrieren um dieselbe Freigabe.
10. Eine bereits ausgegebene Sendefreigabe bei Timeout nicht einfach an ein zweites Gerät übertragen: das erste kann spät noch senden. Zustände wie erkannt, reserviert, Sendung begonnen, bestätigt, unbestätigt, verworfen dauerhaft führen. Nach verlorener Telegram-Antwort „Zustellung unbestätigt“; kein blinder zweiter POST, kein `no-cors`-Retry. Telegram bietet hier keine eigene frei wählbare Idempotenz-ID. Sichere Dublettenvermeidung kann bei unklarem Netzstatus eine manuelle Prüfung erfordern; beides zusammen, garantierte Zustellung und exakt einmal, nicht versprechen.
11. Nach Appstart erst Dienstzustand/ausgelöste Aktivierungen abgleichen, dann Alarme auswerten. Backup auf iPad erzeugt keine neue Alarmaktivierung. Explizites erneutes Scharfschalten erzeugt eine neue Aktivierungs-ID. Für absichtlich wiederkehrende Alarme Hysterese/Cooldown und Episodenwechsel eindeutig festlegen.
12. Empfangsfehler mit vorhandenem `--status`, Installer-Kurzbefehl und journalctl diagnostizieren. Token/Chat-ID-Konfiguration und Bot-Identität prüfen, ohne Geheimnisse auszugeben. Der vermutete Bot-/Chat-ID-Mismatch ist eine Hypothese, keine nachgewiesene Ursache. Das Screenshot allein beweist nicht, welches Gerät oder Oracle gesendet hat. Protokolliert werden Ereignis-ID, Ziel-ID, Senderrolle und Status.
13. Für Muster/KI/PO3 im 24/7-Modus grundsätzlich Oracle als Sender verwenden. Die besondere Vordergrundfreigabe für Kursalarme nicht ungeprüft auf alle Nachrichtentypen oder Börsenorders übertragen.

**Einheitlicher Vertragsentwurf, kein fertiger Serverendpunkt:**

```js
const event = {
  eventId: "<ALARM-ID>:<AKTIVIERUNG>:price-cross",
  targetId: "course-alert", policyRevision: 7, epoch: 3,
  occurredAt: "<UTC-MS>", sender: "<oracle-oder-installation>"
};
// Atomare Reservation + Policy-Prüfung im dauerhaften Serverspeicher.
// Telegram-Geheimnisse stehen NICHT in diesem Ereignisobjekt.
```

**Prüfung:** App geschlossen; App offen; iPhone+iPad gleichzeitig; Start nach Oracle-Auslösung; ausgeschaltetes Ziel während Render/Retry; Neustart; Offline-Umschalten; verlorene Sendebestätigung; falsch zugeordnetes Token. Sicherung erhält keinen Kursalarm.

**Zusätzliche Abnahmefälle (Revision 2):** Zwei konkurrierende Schalter-Commands, verlorene Commitantwort, Offline-AN nach inzwischen bestätigtem AUS sowie atomare Master-Aktion.

## G06 - Geschlossene Position als genau ein Telegram-Bild

1. Erst den vollständigen Positionsabschluss dauerhaft und einmalig buchen, dann den Bericht erzeugen. Fehlgeschlagener Versand macht den Abschluss nicht rückgängig. Ziel aus G05, ausschließlich App → Telegram.
2. **Genau ein Foto ohne Caption, Begleittext oder zweites Chartfoto.** Angaben im Foto: Coin/Markt/Richtung, Eintritts-/Austrittszeit, Haltedauer, Einstieg/Ausstieg, Einsatz bzw. nachvollziehbare Modellmargin, Netto-G/V und optional Eurogegenwert **aus den eingefrorenen historischen Buchungen gemäß G03.9**. Auch beim verspäteten Rendern/Versenden keinen aktuellen FX-Kurs verwenden. Fehlende Eurobasis im Bild kenntlich machen. Bei Short „Einstieg (Verkauf) / Ausstieg (Rückkauf)“. DEMO nur ausdrücklich freigegeben und deutlich markiert.
3. Einen Kurschart für den **belegten Haltezeitraum** integrieren. Nachkäufe/Teilabschlüsse mit Marken und tatsächlichem gewichtetem Einstieg nachvollziehbar machen. Einen bereits manuell festgelegten Nettoabschluss aus dem Journal verwenden; keine zweite PnL-Rechnung für das Bild.
4. Eigene Canvas-Grafik aus Daten/Kerzen, etwa 1080×1440 Pixel; keine fremden Bildquellen, keine Bildschirmkopie der ganzen App. Hauptchart nicht umschalten. Sinnvoll verdichten, keine künstliche Kurve bei Historienlücken.
5. Fehlt Kursgeschichte, innerhalb des **einen Bildes** „Chartdaten nicht verfügbar“ mit Zeitraum. Fehlen echte Ausführungswerte, „nicht erfasst“; keinen aktuellen Kurs als historischen Ausstieg erfinden.
6. Scheitert das gesamte Rendern, lokalen Fehler und bewusste Wiederholung anbieten. Der früher erlaubte Textreport-Fallback wird durch den neueren Wunsch „reines Bild“ **ersetzt**. Kein automatischer Textreport. Persönliches Journal erhält den Trade ohnehin.
7. Als Blob/Datei via `sendPhoto` und `multipart/form-data` senden; keine `blob:`-URL als Telegram-URL. Unter API-Größenlimits bleiben, Caption weglassen. Auf iOS pausierter/geschlossener App kann der Upload nicht garantiert sofort enden. Noch zulässiger, noch nicht abgesendeter Auftrag darf beim Öffnen fortgesetzt werden; AUS verwirft ihn.
8. Epoch vor Rendering und direkt vor Versand prüfen. Bei AUS nicht einmal Kursgeschichte für das Bild nachladen. Nach unklarer Zustellung nicht automatisch doppelt senden. Automatisch nur echte neue Abschlussereignisse, keine Importe/Nacherfassungen.
9. Eine serverseitige echte Bot-Schließung bei geschlossener App ist ein anderer Ereignisweg: keine heimliche Ausnahme „Oracle sendet nun alle Trades-Bilder“. In G12 sichere Fill-Daten abgleichen; falls später auch solche Bilder gewünscht werden, Entscheidung über Verzögerung bis Appstart bzw. separaten Bot-Status klar von diesem persönlichen Bildbericht trennen.

**Code:** Renderer/Transportadapter im aktuellen App-Code ergänzen. Telegram-Listenmodell und genau-ein-Sender-Regeln wiederverwenden. Die bisherigen `chanSend`-Textfunktionen sind dafür allein nicht ausreichend.

**Prüfung:** Long, Short, Nachkäufe und Teilabschlüsse; nur eine Bildnachricht; keine Caption; endgültiger Journal-G/V identisch; fehlende Chartdaten; Canvas-/Netzfehler; App eingefroren; Ausschalten während Rendering; keine Nachlieferung aus AUS.

## G07 - Mittelwert-Zonen, eigene Analyseintervalle und Market Cap

### Analyseintervall und höhere Zonen

1. **4h als Anfangseinstellung** für „Mittelwert-Zonen & Marktindikatoren“. Begründung: weniger kurzfristiges Rauschen und langsamerer Kontext als 1m, dafür spätere Reaktion. Ein mathematisch universell bester oder profitabler Zeitraum ist nicht belegt. Bestehende Tages-EMA nicht bloß in „4h“ umbenennen.
2. Frei wählen: 1m, 30m, 1h, 4h, 12h, 1d und 30 Tage. Auswahl beider Bereiche gemeinsam, getrennt vom Chartintervall. Nach Reload und Backup erhalten; eine gültige bestehende Nutzerwahl nicht auf 4h zurücksetzen.
3. 30 Tage = feste nicht überlappende UTC-Blöcke aus je 30 vollständigen Tageskerzen, an 01.01.1970 UTC verankert; internes `30d_fixed`. Kein Binance-Parameter `30d` und keine Verwechslung mit `1M`. Unvollständige erste/laufende Blöcke nicht bestätigen.
4. EMA200 auf 30-Tage-Kerzen braucht schon mindestens 6.000 Tage instrumentenspezifische Historie. Fehlt sie: gesperrt mit Grund; keine Spot-Historie in Futures hineinverlängern, keine EMA-Periode heimlich kürzen.
5. Separate Analyseserie: EMA200 im Analyseintervall (optional extra ausdrücklich EMA200 1D), Bollinger SMA20 ±2 Populationsstandardabweichungen, RSI14/ATR14 nach Wilder, relatives Volumen letzte geschlossene Kerze / vorherige 20. Nullvarianz/Nullvolumen/ATR=0 definiert behandeln. Funding und Open Interest behalten ihre eigene tatsächliche Zeitbasis.
6. Volumen-Zentrum/POC und 70-%-Value-Area: Ausgangswahl 100 abgeschlossene Analysekerzen, 40 Preisstufen, deterministische Gleichstände. Kürzere Reihe nur ab ausreichendem Mindestumfang, sichtbar N/100; Kerzenvolumen-Verteilung als Näherung kennzeichnen. Chart-Panning darf diese festen Analysezonen nicht verschieben.
7. Bestätigte höhere Zonen als zuschaltbare Linien/Flächen im kleineren Chart, mit Intervall und Zeitpunkt. Nur ab wirklicher Verfügbarkeit zeichnen, nicht heutige Werte rückwärts in historische Entscheidungen projizieren.
8. Erklärbare Trendkontext-Anzeige, die Rohhinweise ergänzt:

```text
A = ATR14, S = (EMA50(t) - EMA50(t-3)) / A
Long:  C > EMA200 + 0,25*A UND EMA50 > EMA200 UND S > 0,05
Short: C < EMA200 - 0,25*A UND EMA50 < EMA200 UND S < -0,05
sonst neutral; fehlende Daten/A<=0: nicht bewertbar
```

Diese Startparameter sind keine optimierten Renditeversprechen. Gleiche/kleinere Analyseebene nicht als „übergeordnet“ ausgeben. Manuelle Buchungen und Schutz-/Preisalarme werden durch diesen Kontextfilter nicht verhindert.

### Umschalter Kurs / Marktkapitalisierung

9. Kompakter Toggle in der bestehenden Chart-Menüleiste. Kursansicht, Zoom/Intervall und Auswahl erhalten, beim Zurückwechseln korrekt herstellen.
10. Market Cap benötigt eigene historische Marktkapitalisierungsdaten und eine eindeutige providerbezogene Asset-ID. Zuerst die Fähigkeiten des vorhandenen CoinLore-Adapters anhand dokumentierter Antwortfelder prüfen. Sein derzeit dokumentierter 365-Tage-OHLCV-Endpunkt enthält Preise/Volumen, **keine historische Market Cap**. Aktuelle Cap und heutige Umlaufmenge schließen diese Lücke nicht. Daher historische Cap z. B. aus einem tatsächlich zugänglichen kostenlosen CoinGecko-Datenweg; kein pauschaler Anspruch auf jede Historienlänge. Kein vergangener Preis × heutiger Umlaufmenge als Ersatz. USD ausdrücklich als USD anzeigen. CoinLore- und CoinGecko-IDs über eindeutige Asset-Metadaten zuordnen, nicht nur gleichlautende Symbole. [CoinLore: dokumentierte Datenfelder](https://www.coinlore.com/cryptocurrency-data-api)
11. Eigene Linien-/Punktserie, Quelle, Zeitauflösung und Datenzeit anzeigen. Keine erfundenen Market-Cap-OHLC aus Preis-OHLC. Nicht verfügbare Intervalle verständlich sperren bzw. dokumentiert auf die native Auflösung wechseln; keine stille Gleichsetzung.
12. Preis-SL/TP, FVG, Formationen und preisabhängige Indikatoren nicht auf eine Market-Cap-Achse zeichnen. Ihr gespeicherter Zustand bleibt erhalten und gilt wieder in Kursansicht. Pattern-/KI-Befehle bei aktiver Cap-Ansicht erklären bzw. erst bewusst zur Kursansicht wechseln.
13. **Verbindlicher Cap-Cache in IndexedDB:** Schlüssel aus Provider, Asset-ID, Währung, nativer Auflösung, normalisiertem Zeitraum und Schema. Abgeschlossene Tageshistorie nach Abruf mindestens 24 Stunden lokal wiederverwenden; danach nur bei Bedarf revalidieren. Heutigen/unvollständigen Punkt separat halten, Cachefrist zunächst 5 Minuten und echten Datenstand zeigen. Chart-Zoom/Intervallwechsel liest vorhandene Historie; gleiche laufende Anfragen zusammenfassen. Nur für die sichtbare Cap-Ansicht laden, **keine 100 Cap-Historien durch den Scanner vorladen**. Rekonstruierbarer Cap-Cache maximal 10 MiB, älteste ungenutzte Einträge verdrängen; keine Trade-/Journal-/ungesicherten Musterdaten in diese Bereinigung einbeziehen.

   Zentrale Abrufsteuerung je Provider/Zugang, eine gleichzeitige Cap-Anfrage und konservativ zunächst höchstens 5 pro Minute als eigenes App-Budget; kleinere tatsächlich geltende Providergrenze gewinnt. Minuten- **und Monatsbudget**, mehrere Tabs/Geräte sowie Fehlversuche berücksichtigen. Bei geteiltem Zugang über den vorhandenen Dienst zentral begrenzen; lokale Zähler allein sind kein vollständiger Kontoverbrauch. Abgelaufene Cachewerte mit Datum weiter anzeigen, bei `429` `Retry-After` respektieren, sonst exponentielles Backoff mit Zufallsanteil; Reload/Toggle umgeht die Sperre nicht. Zugriffs-/Planfehler nicht endlos wiederholen.

   Nicht „30 Requests/Minute“ als ewige Gratisregel fest verdrahten: die am 05.10.2026 geprüfte Preisseite nennt für Demo 100/Minute und 10.000/Monat; alte Hilfetexte weichen ab. Das ist keine Zusage für schlüssellosen Zugang. Beim Einbau aktuell gültigen Tarif, Zugriff, CORS und Datenrechte verifizieren. Ein gegebenenfalls erforderlicher kostenloser Demo-Key gehört in den vorhandenen geschützten Dienstadapter, nie in GitHub-Pages. Ohne freigegebenen kostenlosen Datenweg „nicht verfügbar“; kein stiller Wechsel zu einem Bezahlplan. [CoinGecko: aktuelle Tarifgrenzen](https://www.coingecko.com/en/api/pricing)

**Code:** `code/frontend/market-cap.js` mit `validateMarketCap`, `coinGeckoMarketCapPoints` und `compactCap`. Datenauswahl/Abfragen und Standardchart-Anschluss fehlen im Referenzmodul; `DashboardView.js` demonstriert die Dateninjektion.

**Prüfung:** Chart 1m/Analyse 4h, abgeschlossene höhere Kerze erst nach Schluss, 30-Tage-Grenzen, EMA-Historienmangel, schneller Coin-/Metrikwechsel, USD-Beschriftung und unterdrückte Preisoverlays im Cap-Modus.

**Zusätzliche Abnahmefälle (Revision 2):** Mehrfach-Toggle erzeugt eine gemeinsame Anfrage; CoinLore-OHLCV nie als Cap einlesen; 24h-TTL versus laufender Tag, Cachegrenze, 429/Retry-After und Monatsbudget prüfen.

## G08 - Bitcoin-Entkopplung aus den allgemeinen Top 100

**Freigegebene Variante:** kostenlose Quellen; allgemeine Top 100 nach Marktkapitalisierung laut CoinLore, **anschließend Stablecoins entfernen, nicht auf 100 auffüllen**. BTC nur Referenz. Es ist ausdrücklich akzeptiert, dass nur eindeutig zugeordnete Binance-Spotmärkte auswertbar sind; fehlende Abdeckung anzeigen.

### Schritt 1: Daten und Berechnung

1. CoinLore-Rangliste gebündelt und zwischengespeichert laden (`tickers/?start=0&limit=100`); Marktkapitalisierungsrang, Anbieter-ID und Version erhalten. Stablecoins über gepflegte versionierte Asset-IDs klassifizieren, nicht über Preisnähe zu 1 USD oder ein „USD“ im Symbol. Neue ungeprüfte Assets separat markieren.
2. Aktive Binance-Spotpaare mit USDT-Quote eindeutig zuordnen; keine Symbolverwechslung oder stiller Futures-Ersatz. Coin und BTC aus derselben Quelle/Quote und vergleichbaren Anfangs-/Endzeiten.
3. Gebündelte rollierende Statistik für 1h, 4h, 24h, Anbieterparameter 24h→1d. Tatsächliche Zeiten prüfen; das Binance-Fenster kann durch Minutenrundung geringfügig länger sein. Die unterstützte Symbolanzahl und Request-Gewichte zum Einbauzeitpunkt prüfen.
4. C=Coin-Veränderung in %, B=BTC-Veränderung in %, D=C-B in **Prozentpunkten**. Stärke=|D| nur unter qualifizierten Treffern. Nicht C/B berechnen.
5. Standard: BTC seitwärts bei |B|<0,5 oder B=0; exakt +0,5 zählt als steigend, exakt -0,5 als fallend. Bullish: C>=+2 und BTC fällt/seitwärts. Bearish: C<=-2 und BTC steigt/seitwärts. Beide Schwellen einstellbar, ungerundet vergleichen.
6. Beispiel +3/-1 = bullish, +4 Prozentpunkte; +1/-5 ist trotz großer Abweichung kein Treffer; +2/+0,4 ist bullish; +2/+0,5 kein Treffer.
7. Fehlender BTC sperrt den Vergleich. Fehler, inaktive Märkte, Datenalter, Mapping- und Klassifikationslücken nicht als normale Nicht-Treffer zählen. Abdeckung z. B. „X von Y grundsätzlich geeigneten Coins auswertbar“ aus echten Daten bilden.
8. Korrelation optional, anfangs AUS: Pearson aus deckungsgleichen logarithmischen Kerzenrenditen, mindestens 30 Paare und positive Varianzen; fehlende Kerzen nicht mit Null füllen. BTC-Reihe teilen, nur bei Bedarf nachladen. Niedrige Korrelation ist keine Erfolgswahrscheinlichkeit.

### Schritt 2: Liste und Filter

9. Liste mit Name/Symbol, aktuellem Preis, Coin-%, BTC-%, Abweichung in Prozentpunkten, Datenzeit. Sortierung Stärke absteigend, Gleichstand Rang/Asset-ID. Filter Alle/Bullish/Bearish; Zeitraum 1h/4h/24h; Schwellen erreichbar.
10. Ladezustand, leerer Trefferbestand und Fehler unterscheiden. Alter Bestand darf bei Fehler mit „veraltet“ sichtbar bleiben. Abdeckung und Datenquelle nennen. Nur Signale, keine Kaufempfehlungen.

### Schritt 3: Vorhandenen Chart laden

11. Klick setzt den gewählten Coin und lädt ihn in den **vorhandenen** Chart, navigiert/scrollt aber **nicht automatisch** dahin. Aktueller Reiter bleibt. Kleine Bestätigung „Im Chart geladen“.
12. Chart bleibt frei bedienbar: Intervall, Zoom, Scrollen, Indikatoren. Der Scanner startet weder eine neue Chartinstanz noch eigene Handelssignale. Schnell auf A/B klicken: nur B darf zuletzt sichtbar werden. Scanner-Spotmarkt nicht mit gleichnamigem Futureschart verwechseln; Quellenwechsel bewusst behandeln.

### Schritt 4: Aktualisierung und Fehlerbehandlung

13. Solange Ansicht aktiv/sichtbar etwa alle 60 Sekunden, nie überlappend. Ein Scheduler, Abort bei Kontextwechsel, keine Anfrage pro Zeile. Ranking seltener aktualisieren als Kurse. Wiederkehr aus Hintergrund: genau einen fälligen Refresh, keine angesammelten Timer.
14. 429/`Retry-After`, Backoff, Netz-/CORS-Fehler und ungültige Daten unterscheiden. Kein `no-cors`, kein beliebiger offener Proxy. Browser-CORS am tatsächlich gehosteten Ursprung testen. Bei geschlossener App ist der Scanner kein 24/7-Timer.

**Code:** `code/entkopplung/scanner-refresh-policy.mjs` mit Tests enthält die Refresh-Regeln. Die vier Adapter-/UI-Schritte sind ein Integrationskonzept; im Paket kein fertiger Live-Top-100-Scanner. Quellen, Statusmodell und Abläufe aus dieser Gruppe vollständig anschließen.

**Prüfung:** Schwellen-Gleichheit, Null/negative Ausgangspreise, falsches Mapping, fehlender BTC, gleicher Symbolname, teilweise Top-100-Abdeckung, 429, iPhone-Hintergrund, kein Scrollsprung und keine Chart-Doppelinstanz.

## G09 - Mustererkennung, Erklärung und dauerhaftes Musterwissen

### A. KI-Button und lokale Erkennung

1. „KI“ in der Toolbar, auch Vollbild; funktioniert auf 1m, 5m, 15m, 1h, 4h, 1D, 1W, 1M. Ausschließlich regelbasiertes JavaScript auf vorhandenen OHLC-Daten, keine externe KI, keine API-Keys und kein externes Bild.
2. Auf Tipp sichtbare Kerzen analysieren, maximal etwa 300-500. Wenn mehr sichtbar, analysierten Ausschnitt nennen. Context-/Intervallwechsel entfernt alte Treffer; Berechnung bei Kerzenschluss oder Tipp, nicht bei jedem Tick. Worker und begrenzter Cache; laufende Kerze ausdrücklich vorläufig.
3. Candlestick-Umfang: Doji mit Dragonfly/Gravestone, Hammer, Inverted Hammer, Hanging Man, Shooting Star, Spinning Top, Marubozu in beiden Richtungen, Bullish/Bearish Engulfing und Harami, Piercing Line, Dark Cloud Cover, Tweezer Top/Bottom, Morning/Evening Star, Three White Soldiers/Black Crows.
4. Formationen: Doppel-/Dreifach-Top und -Boden, SKS/inverse SKS, auf-/absteigendes/symmetrisches Dreieck, Rising/Falling Wedge, bullish/bearish Flagge und Pennant, Rechteck/Range, auf-/absteigender Kanal, Cup & Handle. Vorhandener Katalog: **41 Einträge/Varianten**, alle mit eigenem SVG.
5. **Candlestick-Vortrend nach bestehendem Referenzcode explizit beibehalten:** N=8 vollständig abgeschlossene Schlusskurse direkt **vor der ersten Musterkerze**. Lineare Regression gegen Kerzenindex, Steigung b und Bestimmtheitsmaß R²; A=ATR14 der letzten Vorgängerkerze. Nur bei vollständigen Daten, A>0, R²>=0,35 und `abs(b*(N-1))>=0,75*A` ist ein Trend vorhanden; Vorzeichen von b ergibt aufwärts/abwärts, sonst neutral bzw. fehlende Daten. Keine Muster- oder Zukunftskerzen einbeziehen. Hammer/andere bullishe Umkehrfamilien benötigen den dazugehörigen Abwärtstrend, bearish spiegelbildlich; neutrale und Fortsetzungsfamilien behalten ihre eigenen Regeln. „Kurs unter EMA20“ allein genügt nicht und wird nicht als zusätzlicher undokumentierter Filter eingeführt. Das ist eine Heuristik, kein belegter Profitabilitätsnachweis.

   **Chartformationen** verwenden zusätzlich ihre eigene Struktur: ATR-normalisierte ZigZag-Schwelle und Pivotabstände; gleichartige Tops/Böden tolerieren, Standard min(2 % Preis, 0,6 ATR). Dreiecke/Keile/Kanäle brauchen genügend bestätigte Hoch-/Tief-Pivots. Wandernder Endpivot bestätigt nichts rückwirkend. Flagge/Pennant braucht vorherigen Mast, Cup einen gerundeten Boden. Ausbruch erst Schlusskurs außerhalb. Parameter/Algorithmen versionieren; nicht denselben Vortrendfilter pauschal auf alle 41 Familien anwenden.
6. Tradierte Candlestick-Gaps sind in durchgängigen Kryptomärkten oft nicht vorhanden. Implementierte kontinuierliche Krypto-Variante kenntlich machen; strenger Gap-Modus optional. ATR-/Vortrend-/Volumenregeln bleiben dokumentiert und versioniert.

### B. Panel, Info-Sheet, Chart und Vorauswahl

7. Mobiles Bottom-Sheet mit Name, Richtung/Farbe, **Regelgüte in %**, Zeitraum/Kerzen, Ein-Satz-Erklärung, Ausbruchslevel/Ziel/Invalidierung für Formationen. Filter alle/bullish/bearish und Mindestregelgüte standardmäßig 60. Leerzustand „Aktuell keine eindeutige Formation erkannt“. Hinweis „Automatische Mustererkennung, keine Anlageberatung.“
8. „Zuverlässigkeit“ darf keine erfundene statistische Trefferquote suggerieren. Prozentzahl hier ist erfüllte Regelgewichte / mögliche Gewichte, einschließlich unbekannter Regeln im Nenner. Erklären, welche Regeln erfüllt/nicht erfüllt/unbekannt sind.
9. Jeder Treffer und jedes Chartlabel mit „i“. Info-Sheet: Name/Richtung/Güte, **eigenes Inline-SVG**, echte gemessene Werte, Zeitraum/Intervall, einfache Erklärung, Bestätigungskriterium und Status, „Warum X %?“, „Im Chart zeigen“ und „Schließen“. Keine trading.de-Bilder/Hotlinks.
10. Kleine Labels für Candles, Linien/Zonen für Formationen; Auswahl hebt das Muster hervor. Eigener Info-Button zoomt bewusst zum Muster. Chart danach frei bedienbar. Infos und Daten sicher als Text ausgeben, keine fremden HTML-Fragmente.
11. Vorauswahl zeigt „Chartmuster erkannt“ samt Bezug. Tipp öffnet vorhandenen Chart und markiert tatsächliche Formation/rechnerische Projektion, mit Status und Intervall. Anders als der Scanner-Klick ist hier der Chartaufruf ausdrücklich gewünscht.
12. Zentrale Bibliothek enthält ID, deutschen Namen, Richtung, SVG, Erklärung und Bestätigungsregel. Optionales „Muster-Lexikon“ verwendet dieselben Daten. Automatischer Score benutzt die festen Signalebenen aus G10, **nicht** den zufällig verschobenen sichtbaren 1m-Ausschnitt.

### C. Erlernte Muster erhalten und historische Verläufe zeigen

13. Gemeinsames marktbezogenes Wissen getrennt von persönlichen Trades, Konten, Notizen und Geheimnissen speichern. App-Reset, Nutzerwechsel und Update löschen es nicht. Kein pauschales `localStorage.clear()`. Neue Nutzer bekommen den veröffentlichten gemeinsamen Bestand; private Daten bleiben privat.
14. Altbestand aus 3.27: `scalpdesk.zzpatterns.v1` und `data/muster-start.json`. Alte [Fallzahl, Treffer in Prognoserichtung]-Aggregate enthalten keine vollständigen Einzelkurse und keine verlässlichen absoluten Auf-/Abwärtszahlen. Als übernommene Statistik erhalten; nicht größere Fallzahl als verlustfreien Merge verwenden oder alte/neue Fälle ungeprüft addieren.
15. Neue Fälle mit stabiler ID, Markt/Symbol/Intervall, Erkennungs-/Bestätigungszeit, Modell, damaligen Regeln/Werten, Prognose und späterem Ergebnis speichern. Ergebnisse anhängen, ursprüngliche Prognose nicht rückwirkend ändern. Reimport und Geräteabgleich dürfen keinen Fall doppelt zählen.
16. Externes Originaljournal auf dem vorhandenen Dienst dauerhaft speichern, getrennt von Alarmkonfiguration; **zusätzlich unabhängige Sicherung** und getestete Wiederherstellung. Zustände „nur lokal“, „extern gespeichert“, „zusätzlich gesichert“, „veröffentlicht“ unterscheiden.
17. Synchronisation neuer anonymisierter Markt-Fälle über den versionierten HTTPS-Datenweg aus G05; nicht den persönlichen Sicherungsbot oder angeheftete Telegram-Konfiguration als neuen Datenbus zweckentfremden. Persönliche Sicherung bleibt ausschließlich lokal → Telegram.
18. GitHub/Pages erhält kleinen bereinigten Veröffentlichungsbestand: Manifest, Statistiken und bei Bedarf geladene Beispieldateien. GitHub ist kein direkt aus der PWA beschreibbarer Mehrgeräte-Datenspeicher. Veröffentlichung als Release-/Serverexport; keine Schreibschlüssel im Browser. Ohne eingerichteten Schreibweg letzte veröffentlichte Revision und Datum zeigen.
19. Budgets: Startmanifest höchstens 64 KiB; einzelne Index-/Statistik-/Beispieldatei höchstens 256 KiB unkomprimiert; rekonstruierbarer lokaler Cache höchstens 10 MiB; ungesicherte neue Fälle eigene Warteschlange zunächst 2 MiB; öffentlicher Bestand zunächst insgesamt 50 MiB, Originalarchiv separat. Volle Warteschlange stoppt **neues Lernen mit Hinweis**, löscht keine zugesagten Fälle.
20. Schlechte Ergebnisse sind keine schlechten Daten. Nur Dubletten/ersetzbare Caches automatisch entfernen. Fehlerhafte Rohdaten zuerst quarantänisieren, prüfen/reparieren; nachgewiesen irreparable Daten nur mit dokumentierter Begründung, Revision und erhaltener Prüfspur entfernen. Gültige alte/verlorene Fälle archivieren, nicht zur Quotenverbesserung löschen. Browserdatenlöschung durch den Nutzer kann eine PWA nicht verhindern; noch nie gesicherte lokale Daten sind dann nicht garantiert wiederherstellbar.
21. Getrennte **Kursrichtungsstatistik**: Startprofil nach Bestätigung `H=12` weitere Kerzen des Erkennungsintervalls, neutraler Bereich `epsilon=0,10 %`. R=100*(PH/P0-1). Aufwärts R>epsilon, abwärts R<−epsilon, sonst seitwärts. N=auf+ab+seitwärts. Offene Horizonte, fehlende Daten und Konflikte separat zählen. Profiländerung neu versionieren.
22. Nur vergleichbare Fälle desselben Markts, Coins, Intervalls und Modells; breitere Coinvergleiche explizit beschriften. Historisch rekonstruierte Fälle und damals live protokollierte Fälle getrennt. Ein Zieltreffer und „Kurs nach zwölf Kerzen höher“ sind unterschiedliche Auswertungen.
23. Button **„Vergangene Verläufe ansehen“**: Zahlen „X von N aufwärts, Y abwärts, Z seitwärts“, Zeitraum und Datenabdeckung. Standard historischer Vergleich in prozentual normierten Kursen, Median und 25.-75.-Perzentilband eines festen vollständigen Kollektivs; Band ist kein Prognoseintervall. Echter repräsentativer Einzelfall mit Datum/Quelle, keine erfundene Zukunftskurve.
24. Repräsentatives Beispiel deterministisch nach geringster Abweichung vom Median, nicht nur Gewinner zeigen; auch negative/neutrale Beispiele anbieten. Bei unvollständigem Chartbestand „Chart: X von N Fällen“. Bei altem Aggregat ohne Pfade dies sagen. Keine Originalarchive beim Appstart herunterladen.
25. Eigener Muster-Telegram-Chat für wichtige bestätigte Muster via bestehendem Oracle, auch bei geschlossener App. Bestehende Qualitäts-/Nachweisgrenzen aus dem aktuellen Stand erhalten und für regelbasierte/erlernte Muster kenntlich machen. Wiederholungen/Epoch/Chat-Aus aus G05 beachten; neuer Chat braucht keine neue VM.

**Code:** `code/muster/`: Candlestick-/Formationserkennung, Bibliothek mit 41 SVGs, Engine, Panel, Chartadapter, Worker, Integration und Score. `pattern-host-327.mjs` ist ein Adapter für 3.27: vor Einbau an die tatsächlichen 3.28-Globals, Chartzustände und DOM-Struktur anpassen. Kein blindes altes HTML-Patch. Die dauerhafte lernende Bibliothek samt Serverarchiv/Veröffentlichung ist **zusätzlicher Integrationsauftrag**, nicht bereits Bestandteil der lokalen Erkennungsengine.

**Prüfung:** alle 41 Katalogfälle, 8 Intervalle, echte Info-Werte, keine externen Bilder/LLMs, Coinwechsel/Worker-Abbruch, fehlende Daten, Reset ohne Wissensverlust, neuer Nutzer ohne private Daten, doppelte Importe, negative Fälle bleiben erhalten, Speicherbudgets und langsames iPhone.

**Zusätzliche Abnahmefälle (Revision 2):** Acht Vorgängerkerzen ohne Musterkerze; sieben reichen nicht; flach/zu kleine Bewegung bleibt neutral; Regressionsrichtung Long/Short und Grenzen von R²/ATR.

## G10 - Konfluenz-Score, KI-Signale und historische Quoten

### Signalbasis und Punkte

1. Öffentlich verfügbare **Bitget USDT-Futures** als konsistente Signalquelle. Keine private Kontoabfrage für diese Funktion. Vorgegebene Coinliste/Vorauswahl; Top-100-Scanner bleibt ein anderes Modul.
2. Kurzfristig: 1h als Basis, 4h als nächsthöherer Trend. Aufklappbar Scalping bis 1 Stunde / Daytrading bis 24 Stunden, ohne 1m/30m als Signalbasis. Längerfristig: Basis 4h, Kontext 1d, Haltedauer 2 Tage bis 3 Wochen. Zeitrahmen/Haltedauern einstellbar und versioniert.
3. Long und Short spiegelbildlich; ursprüngliche Maxima:

| Komponente | Max. | Regel |
| --- | ---: | --- |
| Trend | 25 | Long Kurs>EMA50>EMA200, Short Kurs<EMA50<EMA200; beide Ebenen passend 25, nur Basis passend 10 |
| Setup-Zone | 20 | Preis höchstens 0,5 ATR entfernt von passendem Support/Resistance, EMA50 oder Fib 0,618 |
| RSI | 20 | Long 30-45 steigend / Short 55-70 fallend: 15; zusätzlich passende bestätigte Divergenz: +5 |
| MACD | 15 | Histogramm innerhalb letzter 3 Kerzen in Richtung gedreht/gekreuzt, aktuell nicht wieder aufgehoben |
| Volumen | 10 | letzte abgeschlossene Kerze >1,5× Durchschnitt ihrer vorherigen 20 |
| Funding | 10 | Long unter +0,05 % / Short über −0,05 %, auf 8h normiert |

4. Indikatoren dokumentieren: EMA50/200 mit identischem Warm-up; RSI14/ATR14; bestätigte Strukturpivots mit je 2 Nachbarkerzen und ihrer Kenntniszeit. Fib aus abgeschlossener bestätigter gerichteter Strecke; Divergenz nur bestätigte passende Pivots, Standard-Alterslimit 3 Basiskerzen. Vorzeichen und Datenherkunft des Fundings prüfen.

   **MACD eindeutig:** `M=EMA12(Close)-EMA26(Close)`, `S=EMA9(M)`, `H=M-S`. Kein Faktor 2, kein vertauschtes Vorzeichen, kein SMA-Signal und keine Bibliotheksvoreinstellung ungeprüft übernehmen. EMA-Rekursion mit `alpha=2/(N+1)`; Startwert SMA der ersten N gültigen Eingangswerte. Die Signal-EMA beginnt erst mit 9 gültigen MACD-Werten. Keine Nullauffüllung fehlender Werte. App, Oracle und Backtest verwenden denselben gespeicherten Startanker/Zustand; nicht nach jedem Chart-Zoom neu initialisieren.

   „Gekreuzt“: Long `H[t-1]<=0 und H[t]>0`, Short spiegelbildlich. „Gedreht“: Long Differenz `H[t]-H[t-1]>0` bei vorheriger Differenz <=0, Short spiegelbildlich. Ein Ereignis in den letzten 3 geschlossenen Kerzen reicht nur, wenn es aktuell nicht wieder aufgehoben ist: Kreuzung weiterhin auf richtiger Nullseite oder Drehung mit aktuell richtiger Steigung. Das entspricht `macdInDirection` im Kern. Eine reine positive Skalierung um Faktor 2 verändert dessen Vorzeichen-/Drehtests zwar nicht; feste Normierung verhindert aber abweichende Anzeigen und spätere Amplitudenfilter. [TradingView: MACD-Rechenkonvention](https://www.tradingview.com/support/solutions/43000502344-moving-average-convergence-divergence-macd-indicator/)
5. Score >=70: Kandidat; 50-69 nur beobachten, keine Telegram-Nachricht; <50 kein Signal. Beide Trends eindeutig gegen die Richtung: harte Sperre auch bei hohem Score. Gleiche aktuelle Karte nicht alle Ticks neu erzeugen. Bei widersprüchlichen Long-/Short-Kandidaten Konflikt anzeigen.
6. Unbekannte notwendige Eingangsdaten bedeuten „nicht bewertbar“, keine optimistisch kleiner gerechnete Punktbasis. Fundingsatz auf damaliges tatsächliches Abrechnungsintervall normieren; keine pauschale Rückrechnung mit heutigem Intervall.

### Musterkomponente ohne 115-Punkte-Fehler

7. Mustergewicht W standardmäßig 15, einstellbar; bisherige 100-Punkte-Basis B auf 100−W skalieren. G10 verwendet `pattern-score.mjs`:

```text
Grundbeitrag = B * (100-W)/100
Einzelbeitrag = W * Regelgüte/100 * Zeitgewicht * Bestätigungsfaktor
Zeitgewicht: 1m .35, 5m .45, 15m .60, 1h .80, 4h/1D/1W/1M 1
Bestätigung: geschlossen bestätigt 1; in Bildung .5
Musterbeitrag = min(W, passende Beiträge) - min(W, Gegenbeiträge)
Gesamtscore = begrenze(Grundbeitrag + Musterbeitrag, 0, 100)
```

B=80, W=15, bestätigtes 1h-Muster mit 90 % Regelgüte: 68+10,8=78,8. Ohne Muster 68; das ist bewusst ein anderes Modell als die alte Basis 80. W=0 erhält den alten Score. Äquivalente überlappende Musterfamilien deduplizieren; Chips nicht blind zu bereits gedeckelten Komponenten addieren. Harte Trend-/Risikosperren bleiben bestehen.

8. Automatische Musteranalyse kurz 1h/4h, lang 4h/1D gemäß Einstellungen. Nur aktuelle geschlossene, zum Signalzeitpunkt bekannte Muster; geometrisch vorläufige ZigZag-Endpunkte geben keine Punkte. Änderung von Gewichten/Version verlangt getrennte Backtests, kein Mix mit alten Quoten.

### Risiko, Kosten und Cross

9. SL=Setupanker−d*ATR14*Faktor, Standard Faktor 1. Risiko=d*(Entry−SL)>0. TP=Entry+d*2*Risiko, mindestens 2R brutto; nach Tickrundung erneut prüfen. Zusätzlicher Kostenfilter: positive TP-Nettoschätzung / Betrag negativer SL-Nettoschätzung mindestens 1,5. Ein niedrigeres Bruttoziel darf nicht einfach „mindestens 2“ heißen.
10. Referenzeinstieg nach Entscheidungszeitpunkt; historisch nächster verfügbarer Kerzenbeginn mit offengelegtem Slippage-Modell, nicht rückwirkend vor Kenntnis des Signals. Sprünge jenseits ungültiger Levels ablehnen.
11. Einsatz frei durch mich, Margin-EUR-Feld zunächst leer. Hebel kurz 20 / lang 3 einstellbar. X=USDT je EUR: Positionswert=MarginEUR*X*Hebel, Menge=Positionswert/Entry. Ohne Einsatz/FX keine erfundenen Eurokosten; Signale/Preislevels weiterhin nutzbar.
12. Netto=d*q*(Exit−Entry) − q*Entry*GebührEin − q*Exit*GebührAus − Summe(d*q_k*Markpreis_k*Fundingrate_k). Standardgebühr 0,05 % je Seite ist eine veränderbare Modellannahme. Funding kann Gutschrift sein. Nur tatsächlich anfallende Abrechnungstermine während Haltedauer; nicht pauschal auf 8h-Blöcke aufrunden.
13. Künftiges Funding als Szenario, historisches Funding aus belegten Daten. Ratenintervall kann von 8h abweichen. Unvollständige Kosten nicht als „Netto nach allen Kosten“ ausgeben.
14. **Bitget Cross ohne private Kontodaten:** echter Liquidationspreis und Abstand sind nicht berechenbar; als `null` mit Erklärung darstellen. Ein manuell erfasster Kontostand ersetzt keine kompletten Börsendaten. Keine grüne 50-%-Abstandsfreigabe aus einer Isolated-Näherung. Score/Backtest dürfen mit diesem sichtbaren Limit weiter genutzt werden. Keine Zugangsdaten für normale Signale verlangen.

### Historische Quoten und Backtest

15. Pro Karte beide Quoten: kurz aus 90 Tagen, lang aus 2 Jahren, je Coin/Markt/Richtung/Horizont/Modell und ähnlichem Score ±10. Zusätzlich aktive Signal-Mindestgrenze beachten. Tatsächlich verfügbare Historie anzeigen; nicht 2Jahre behaupten, wenn jüngeres Listing oder Datenlücken.
16. Nur Fälle zählen, deren gesamte maximale Haltedauer zum Auswertungszeitpunkt bereits hätte ablaufen können. Keine bevorzugte Auswahl schneller bekannter Gewinner gegenüber noch offenen Fällen.
17. TP vor SL = TP-Erfolg. SL = kein TP-Erfolg. Timeout positiv/negativ/null bleibt im Nenner; positives Timeout ist weder TP-Treffer noch voller SL-Verlust. Unaufgelöste Datenlücken separat ausweisen. Treffen SL und TP in derselben nicht feiner auflösbaren Kerze zusammen, konservativ SL.
18. **Mindestens 30 auswertbare Fälle** für Prozentquote und signalbezogenen Euro-Erwartungswert. „49 % aus 17 Fällen“ wäre unzulässig. Unter 30 „zu wenig Daten (N)“. Immer N und Zeitraum nennen; „Historische Auswertung, keine Garantie.“
19. Erwartungswert aus allen tatsächlichen modellierten Nettoergebnissen: Mittelwert(Netto/anfänglicher Positionswert), mit selbst gewählter Modellgröße in EUR skaliert, soweit Kosten proportional. Nicht `1−TP-Quote` pauschal mit einem vollen Verlust multiplizieren. Gebühren nicht zweimal abziehen.
20. Unter 40 % bei R:R 1:2 gelb „Historisch schwach“ als Nutzerregel; dies ist keine allgemeine mathematische Gewinnschwelle.
21. Backtest zuletzt innerhalb dieser Gruppe anschließen: Schwellen 60/70/80 getrennt, Anzahl, Trefferquote, durchschnittliches R:R, Ergebnis nach Kosten und Drawdown. Alle Indikatoren/Pivots/Higher-Timeframe-Werte ohne Zukunftswissen. Parameterauswahl und spätere Prüfung trennen; kein angeblicher Marktvorteil ohne Datenbeleg.
22. Drawdown in R aus einer definierten Signalfolge benennen; Euro-/Prozent-Drawdown verlangt explizites Startkapital, Positionsgröße, Gleichzeitigkeit, Kosten und Kapitalbindung. Überlappende hypothetische Signale nicht ungeprüft als gleichzeitig finanzierbares Portfolio summieren.

### Bedienung, Telegram und Datenfluss

23. Reiter „KI-Signale“ neben „Preisalarme“ im Alarm-Bereich. Badge für neue ungelesene Signale am Alarmbutton; beim Öffnen des Reiters löschen. Neueste Karten zuerst, kurzfristig nach 1h / längerfristig nach 24h grau „abgelaufen“. Lebensdauer einer Nachricht ist keine automatische Schließung einer echten Position.
24. Karte: Coin, Richtung, Horizont, Score mit Einzelpunkten, Entry/SL/TP, R:R, Liquidationsstatus, Eurokosten soweit berechenbar, beide Quoten, Zeit und Muster-Chips. Chips öffnen dasselbe Info-Sheet aus G09.
25. „Im Chart zeigen“ öffnet denselben Coin/Markt und zeichnet nur Entry, rote SL-/grüne TP-Linie mit kleinen Randlabels. Keine Textboxen über dem Chart. Indikator-Schalter „KI-Signal“ standardmäßig AUS, bei AN Linien des aktuellsten passenden Signals. „Halten“-Chip zeigt Long/Short/Halten und öffnet diese Coin-Karte; bestehende Berechnungen nicht heimlich durch einen anderen Modelltyp ersetzen.
26. „KI-Signale an Telegram senden“ in Reiter und Einstellungen, optional kurze/lange Horizonte getrennt. Serverbestätigter Zustand, Fehler behält alten Status. AUS betrifft nur diese Signalweiterleitung; lokale Karten/Badge und Preisalarme bleiben.
27. Server sendet nur Score>=70 und bestandene Fachprüfungen; beide Quoten/N bzw. „zu wenig Daten“, Muster-Namen. Höchstens ein Signal je Coin/Horizont pro Stunde und gleiche Ereignis-ID niemals doppelt. AUS/erneutAN ohne Nachlieferung. Sperre/Drossel hat keinen Einfluss auf die korrekte historische Ergebniszählung.
28. `/ki_aus`, `/ki_an`, `/ki_status`: erlaubte Chat-ID **und** Absender-ID prüfen, kurze Bestätigung; keine beliebigen Gruppenteilnehmer autorisieren. Schalterbefehle sind keine Bot-Orderfreigabe.
29. Gemeinsamer Kern in App/Oracle/Backtest plus dieselbe bestätigte Parameterrevision. Öffentliche Historie in begrenzten Seiten/Jobs laden; kein schwerer 2-Jahres-Backtest auf dem iPhone-Hauptthread.

**Code:** `code/confluence/confluence-core.mjs` liefert Score, Level-/Größen-/PnL-Helfer und Kohortenaggregation. `code/muster/pattern-integration.mjs` verbindet bereits berechnete Basis-Scores mit Mustern. **Vollständiger historischer Feed, Positionssimulator, Karten-, Dienst- und Schalteradapter sind noch einzubauen.** Keine vorhandenen echten Erfolgszahlen werden behauptet.

**Prüfung:** Grenzwert69,999, Gegen-Trend-Sperre, fehlendes Funding, positive Timeouts, 29/30 Fälle, Quellen-/Parametergleichheit, keine Zukunftskerzen, Nettofilter, freier Einsatz, Cross-Nullstatus, Badge/Chartlinien und Telegram AUS bei geschlossener App.

**Zusätzliche Abnahmefälle (Revision 2):** MACD und Signal aus definierten EMA-Startwerten, Histogramm 0/Grenzkreuzung, Drehung und erneute Gegendrehung; identische Werte in App/Oracle/Backtest.

## G11 - Power of Three, FVG-Alarm, Ablauf und Journal

### Ebenen, Zeitraum und Algorithmus

1. Optionaler 4h-Kontext, 1h-Bias, 5m-Setup, 1m-Entry; Preset „Scalp“. Pro Ebene sind 1m/5m/15m/1h/4h wählbar. Hierarchie: Kontext >= Bias >= Setup >= Entry. Doppelte Zeitreihen gemeinsam verwenden. 4h ist nie Pflicht. UTC-Grenzen für 4h: 00/04/08/12/16/20 Uhr.
2. Zeitraum: Heute ab 00:00 UTC, letzte 4h, letzte 1h, eigener Start/Ende per Chart-Tipp oder Eingabe. Endgrenze exklusiv, keine zukünftigen Daten. **Ältere Kerzen sind vom Nutzer ausdrücklich nur zum Indikator-Warm-up erlaubt**; Box, Sweep und Einstieg bleiben innerhalb des Zeitraums. Kontext darf weiter zurückreichen. Reicht die Strukturhistorie nicht, Bias neutral/unvollständig statt still den Zeitraum zu erweitern.
3. Bias: bestätigte Hochs/Tiefs plus EMA50, Long/Short/neutral, analog optionaler Kontext. Wichtige Kontext-Hochs/-Tiefs und bestätigte FVGs speichern.
4. Akkumulation: vorherige mindestens 6 Setupkerzen, Boxhöhe <= 1,5 ATR14; Sweepkerze nicht in die Box einrechnen. Hoch AH / Tief AL; nach Sweep die Box einfrieren.
5. Manipulation: Docht durchbricht AL und Schluss zurück in der Box -> Long; AH spiegelbildlich Short. Beide Seiten in derselben Kerze -> mehrdeutig, kein Setup. Extrem speichern.
6. FVG aus 3 abgeschlossenen Setupkerzen nach dem Sweep: bullish H1 < L3, bearish L1 > H3. Retest erst nach Bestätigung, nicht rückwirkend auf dieselbe Kerze. Setup-FVG und größengeprüftes Alarm-FVG unterscheiden.
7. Entry: bestätigtes Swing-Tief/-Hoch und Gegenstruktur einfrieren, neuen Sweep abwarten, dann spätere Impulskerze mit Körper >= 1,5 × Mittel ihrer vorherigen 10 Körper und Strukturbruch. Close-Modell: Entry am Schluss der Bestätigung, ausdrücklich idealisierte Referenz; Exitprüfung erst ab Folgekerze. Echte Orders niemals rückwirkend zu diesem Schlusskurs garantieren.
8. Optional Limit bei 50 % der gesamten Impulskerzenspanne: (H+L)/2. Auftrag erst nach Kenntnis verfügbar. **Korrigierter Simulator:** Bei intrabar berührtem Limit ist TP derselben Minute nicht bewiesen, daher frühestens in der Folgeminute; SL bleibt konservativ vorrangig. War das Limit bereits am Open ausführbar, ist die Entry-Reihenfolge bekannt. Für Short spiegelbildlich.
9. SL hinter dem 1m-Sweep, mit Puffer von 0,1 ATR der Entryebene. „Eng“/„weit“ schaltet auf das Setup-Sweepextrem mit Setup-ATR. Nie 4h-Level als SL. Invalidierung vor Entry nur durch abgeschlossenen Entry-Schluss jenseits des richtigen Sweepextrems.
10. TP1 mindestens 2R, TP2 gegenüberliegende Boxseite, TP3 eine Boxhöhe über/unter TP2 projiziert; nächster Kontextbereich in Zielrichtung begrenzt TP3, falls näher. Liegt TP2 vor TP1 oder das gekappte TP3 vor TP2: Setup ablehnen, keine falsch sortierten Zielnummern.
11. Hebel 20 als Rechenstart; Guthaben und Risiko-% lokal manuell. Größe aus Verlustrisiko inklusive bekannter Gebühren und Marginbegrenzung; kein zweites Hebeln des PnL. Bitget Cross bleibt ohne Kontodaten unbekannt. Die gewünschte 30-%-Distanzprüfung kann deshalb keine sichere Freigabe geben; vereinfachtes Isolated-Modell nur als klar benannte Modelloption, kein Cross-Ersatz.

### Score, Chart und Signalkarten

12. Bedingungen Sweep + FVG-Retest + Entrybestätigung sind zwingend. Checkliste mit Bias/Box/Sweep/Retest/Bestätigung und verständlichem Wartestatus.
13. PO3-Punkte: Sweep 20, Retest 15, Bias 15, Impuls 15, Kontext-Bias 10, Setup im Kontext-FVG 10, Volumen 8, RSI 4 + Funding 3 = 100. Kontext AUS: erreichte Punkte / 80 × 100. Fehlendes Funding gibt keine Punkte und verkleinert nicht den Nenner. Mindestens 70 für ein Signal. Anders als in G10 ist Bias hier ein Punktkriterium, keine zusätzlich erfundene harte Trendblockade.
14. PO3 ist ein **eigenes Modell** im gemeinsamen KI-Reiter. Keine 15 Musterpunkte auf 100 addieren; der G10-Musteradapter erwartet eine andere Komponentenstruktur. PO3-Score nach dieser Tabelle führen. Weitergehende Muster-Neugewichtung nur als benannte Modelländerung nach Rückfrage.
15. Schalter „Power of Three“, Unterschalter „4h-Kontext“. Box A, Sweep M, Distribution D, FVGs, hervorgehobene Überlappung, Entry/SL/TP1-3; blasse Kontextflächen. Nur bei aktiviertem PO3 diese ausdrücklich gewünschten Extraoverlays; sie ändern nicht das Standardverhalten „nur drei Linien“ der normalen Konfluenzkarten.
16. Warnung bei großer Kontext-Gegenzone direkt vor Entry. Karte mit Richtung/Levels/R:R/Score; keine geschätzte Erfolgsquote. Toolbar im Vollbild einklappbar, AMOLED, mobil.

### Status und Journal

17. Aktiv = ungefüllter Limitauftrag, Offen = Entry erreicht, Verfallen, Ungültig, Abgeschlossen (TP/SL/Timeout). Ungefülltes Signal verfällt nach standardmäßig 20 Entrykerzen oder Invalidierung. Ein bereits eröffneter Trade verfällt nicht nach 20 Kerzen; dafür gilt die eigene maximale Haltedauer.
18. Graue gestrichelte Linien/Zonen und graue Karte bei Verfallen/Ungültig. Abschlusslinien enden an der Ausgangskerze, mit TP-/SL-Marker. Timeout klar benennen. Optionale Ablaufnachricht nur durch vorhandene Telegram-Freigaben.
19. Signaljournal automatisch: Zeit, Coin, Richtung, Ebenen, Entry, SL, TPs, R:R, Score, Kontextstatus, Modellversion, Status, R-/EUR-Ergebnis soweit berechenbar, Dauer. „Von mir gehandelt“ ist ein separates Flag, kein Beweis für eine Börsenausführung.
20. Empfohlenes transparentes Startmodell: **vollständig bei TP1 schließen**. Optional drei Drittel. Dies ist die fachliche Empfehlung auf „Was empfiehlst du?“, keine behauptete Nutzerentscheidung für ein Drittelmodell. Gewähltes Modell pro Signal einfrieren. Ein Drittel +2R, zwei Drittel -1R ergibt 0R brutto, nach Gebühren negativ.
21. Folgekerzen 1m, SL vor TP bei Konflikt, Stop-Gap zum schlechteren Open, Datenlücken nachladen/markieren. Beim Appstart offene Fälle historisch nachbewerten, idempotent. Alte Signalversionen beibehalten; nach Rechenregeländerung neue Modell-ID und getrennte Replays.
22. Quote = Fälle mit mindestens TP1 / abgeschlossene Fälle; ab 30 anzeigen. TP1 erreicht ist nicht automatisch Gesamtnettogewinn. Verfallen/Ungültig separat, keine Gewinnerquote aus nur erfolgreichen Abschlüssen.
23. Filter: 7 Tage / 30 Tage / alle, Coin, Richtung, Score, Kontext; Summe R, abgeschlossene/offene/verfallene Fälle. Journalquote neben Backtestquote **derselben Konfiguration und desselben Zeitraums**. Unter 30: „zu wenig Daten“.
24. IndexedDB mit klarer Fallbackgrenze, CSV-Export/-Import einschließlich vollständigem versioniertem Datensatz, geprüfte Löschfunktion für das Signaljournal. Diese Löschung entfernt nicht die erlernte Musterbibliothek aus G09. Nutzerdaten beim Speicherlimit nicht still abschneiden.

### FVG-Überlappung, Historie und Laufzeit

25. Auf aktiven Ebenen bestätigte, ungefüllte FVGs >= 0,5 ATR. Überlappung = echte Preisschnittmenge gleicher Richtung aus mindestens den ausgewählten verschiedenen Ebenen, z. B. 5m+1h. Ein Grenzpunkt ohne Breite genügt nicht.
26. Stufe 1 Vorwarnung bei Annäherung (Abstand einstellbar) oder Eintritt; Stufe 2 zusätzlich Sweep + Entrybestätigung mit Levels. Je Zone **einmal pro Stufe**; eine einzige Zonen-ID ohne Stufe würde das spätere Signal unterdrücken. Cooldown je Coin/Stufe und Chat-Epoch.
27. Nachricht: Coin, Richtung, Ebenen, Zone von/bis, Kurs, Invalidierung, gegebenenfalls „4h bestätigt“. Nur Kerzenschluss; bestehender KI-/Chat-Schalter und Oracle-Sender.
28. Historie für Scalp/Daytrade/Swing mit/ohne Kontext getrennt. Backtest „Überlappung“ vs. „einzelnes FVG“ aus derselben Definition. Kein Repainting oder zukünftige Pivots.
29. Referenzcache/maximal 100.000 Minuten pro Lauf reicht nicht für beliebige Jahresreplays. Große Historien auf dem Dienst gestreamt bzw. in Abschnitten mit Zustandsfortsetzung und begrenztem Browserergebnis verarbeiten; Abschnitte dürfen ihre offenen Signale nicht vergessen.
30. Im beigefügten PO3-Journal sind R-Ergebnisse **nach Gebühren, vor Funding**. Diese sichtbare Grenze erhalten, bis Funding vollständig ergänzt ist. Solche Werte nicht als vollständiges Netto in den Live-Bot-Grenzkern geben.

**Code:** `code/po3/` enthält Core, Datenadapter, Worker, App-/Chart-/Store-/Telegram-/Serveradapter und View, synthetische Vorschau und Tests. Neue Engineversion `2-limit-entry-order` schließt die Limit/TP-Reihenfolgelücke. Alte Modelljournale sind weiter exportierbar; offene Altfälle nicht still mit neuen Regeln weitersimulieren. Migration bzw. getrennte Auswertung kenntlich machen.

**Prüfung:** Regelreihenfolge Long/Short, UTC/Warm-up, optionaler Kontext, Zielgeometrie, intrabar Limit+TP/SL, Verfall nur vor Entry, Journalwiederherstellung, Modellmigration, FVG-Stufe 1 -> 2 trotz Cooldown, Gebühren-/Fundingkennzeichnung und begrenzter Speicher.

## G12 - Optionaler Trading-Bot mit Gewinn-/Verluststopp

1. Separater Reiter „Trading-Bot“. Funktion standardmäßig deaktiviert, automatische Trades ebenfalls AUS. Erst ausdrückliche Aktivierung und separater Start. Simulation, Bitget-Demo und Echtgeld sichtbar getrennt; **kein automatischer Übergang nach Echtgeld**.
2. Die frühere Regel „keine Kontoverbindung“ gilt für normale App, Signale und Kontostand weiter. Der später ausdrücklich beauftragte optionale Bot benötigt eine vom Nutzer selbst eingerichtete private API-Verbindung zum eigenen Dienst. Kein Bitget-Loginpasswort erfragen. Wer keine API-Anbindung einrichten will, kann lokal simulieren.
3. API-Anleitung: Kontotyp Classic/UTA, USDT-Futures, Cross und Einweg-/Hedge-Modus feststellen; aktuelle passende API-Version verwenden. API-Key/Secret/Passphrase nur auf Oracle, IP-Bindung auf die Serveradresse, keine Auszahlungs-/Transferrechte. Eigenes API-fähiges Unterkonto empfohlen. Demo braucht separaten Zugang und korrekten Demo-Modus laut Bitget.
4. Einstellungen: Strategie/Signalmodell, Coins, Richtung, selbst gewählter Einsatz oder Risiko, Hebel, maximale gleichzeitige Positionen/Exposition, Mindestscore, Stop-/TP-Regeln, Cooldown und erlaubter Modus. Pflichtangaben nicht mit erfundenen Geldbeträgen ausfüllen. Fehlende Signal-, Kosten-, Markt- oder Kontodaten sperren neue Einstiege.
5. **Stoppen ab Gewinn** und **Stoppen ab Verlust**, getrennte Beträge in USDT/EUR/% und getrennte Aktion:
   - „Keine neuen Einstiege“: offener Bestand bleibt, Schutzorders weiter betreuen.
   - „Bot-Positionen schließen“: offene Entryorders stornieren, eigene Positionen reduzierend schließen, Fills bestätigen.
   Die Wirkung muss sichtbar sein. Ein Live-Verlustlimit ist Pflicht.
6. Grenzen gelten zunächst pro gestartetem Bot-Lauf. Netto-Laufergebnis enthält Bot-realisiert + Bot-offen - Gebühren + Rabatte - vorzeichenbehaftetes Funding - geschätzte Schließgebühren, abzüglich gespeichertem Start-Snapshot. Einzahlungen, manuelle Kontostandkorrekturen und fremde Trades gehören nicht dazu.
7. Eurogrenze mit beim Start festgehaltenem EUR/USDT-Referenzkurs; Prozent mit festem Startbezugsbetrag. Neue Einzahlung verschiebt das Risikolimit nicht. Eine tägliche zusätzliche Grenze braucht eigene Persistenz, Zeitzone und Tageswechsel; der beigefügte Lauf-Kern implementiert dies noch nicht.
8. Grenzberührung löst einschließlich Gleichheit aus. Stoppsperre dauerhaft verriegeln; Kursrückkehr, Reload oder Neustart hebt sie nicht auf. Nur mein bewusster neuer Lauf setzt eine neue Basis. Datenfehler pausiert neue Einstiege, nicht bereits bekannte Schutzmaßnahmen.
9. **Oracle ist einziger Orderausführer.** App/iPad sind Steueroberflächen mit serverbestätigten Commands, Revision und ID. Keine Browser-Bitget-Schlüssel, kein zweiter Executor auf dem Telefon.
10. Orderstatus: Annahme ist kein Fill. Stabiler Auftrag/clientOid, persistente Absicht, Status-/Fillabgleich vor Retry, teilweise Fills, Mengen-/Tickgrenzen, reduce-only und Positionsmodus berücksichtigen. Nach Neustart bestehende Orders abgleichen, keine Kopie erneut senden.
11. Eine clientOid ist keine ewige Idempotenzgarantie. Schließaufträge pro Position serialisieren; tatsächlichen abgeglichenen Restbestand verwenden. Manuelle und Bot-Mengen im selben Netting-Kontrakt sind nicht durch das Label „Bot“ trennbar. Fremden Anfangsbestand nicht still übernehmen. **Sicherheitsveto vor jedem Orderversand:** erwartete Menge aus bestätigten Bot-Fills und geschlossener Anfangsbasis gegen die gesamte Börsenposition abgleichen, nicht gegen nur „verfügbare“/durch Orders ungebundene Menge. Markt, Konto, Modus, Richtung/Leg und Einheiten müssen identisch sein. Dezimale Mengeneinheiten exakt vergleichen, kein Float-Epsilon und keine tolerierte echte Mengendifferenz.

   Erste Abweichung oder unvollständiger Datenstand -> sofort `RECONCILING` mit sichtbarem Status „Bestandsprüfung - neue Orders gesperrt“, keine neuen Einstiege und keine neu veranlassten automatischen Schließungen. Veto im Server unter derselben Sperre wie die Orderausführung prüfen; wartende Absichten mit veralteter Zustandsrevision ablehnen. Bereits übermittelte Orders können noch ausführen, ihre Fills weiter abgleichen. Eindeutig eigene offene Entryorders kontrolliert stornieren. Positions- und Fillmeldungen können zeitversetzt sein: vollständigen Fill-/Orderabgleich mit dem passenden bestätigten Positionsstand herstellen, nicht jede erste Meldung schon als manuellen Eingriff ausgeben. Bei ungeklärter Abweichung **oder nicht binnen 10 Sekunden beweisbarem Abgleich** -> dauerhaft `PAUSED_RECONCILIATION_REQUIRED`. Warnung groß im Bot-Reiter und globaler Statusanzeige: „Bestand weicht ab - Bot pausiert“, mit erwartet/tatsächlich, Datenzeit und Handlungsgrund. Logs erhalten; Telegram nur soweit freigegeben, niemals alleiniger Warnweg.

   In dieser Störung neue automatische Positionsschließungen, Mengenanpassungen und „Ausgleichsorders“ blockieren, auch wenn Gewinn-/Verlustlimit schließt. Keine Order gegen eine vermutete Differenz schicken. **Bereits an der Börse liegende Schutzorders bleiben grundsätzlich bestehen und können weiterhin auslösen**; kein pauschales Cancel-All. Unklare Schutzorder-Zuordnung melden und von mir prüfen lassen. Bot-Pause garantiert deshalb nicht, dass die Börse keine bestehende Order mehr ausführt. Ein bekannter fremder Fill/Order-/Moduseingriff löst das Veto auch aus, wenn die Gesamtmenge zufällig gleich geblieben ist.

   Ein automatisch vollständig aufgeklärter eigener Teilfill darf `RECONCILING` innerhalb der Frist beenden, jedoch niemals eine ausgelöste Gewinn-/Verlustsperre aufheben. Die verriegelte Störung verlangt meinen bewussten serverbestätigten Wiederanlauf nach überprüftem Bestand, Historie und Schutzorders; Neustart/gleiche spätere Menge allein reicht nicht. Für noch nicht verriegeltes `RECONCILING` nach Prozessneustart ebenfalls zunächst gesperrt bleiben und den vollständigen Abgleich neu durchführen. Normales „Keine neuen Einstiege“ ohne Bestandskonflikt betreut bekannte Schutzmaßnahmen weiter. Eigenes Bot-Unterkonto verhindert viele Konflikte, ersetzt diese Prüfung aber nicht.
12. Cross-Liquidationsprüfung im Bot nur mit vollständigen belegten Börsendaten. Diese eng begrenzte API-Nutzung ändert nicht die öffentliche Signalansicht aus G10. Gebühren, Funding und Slippage können ein Limit überschreiten lassen; der Stopp ist eine Reaktion, keine garantierte exakte Endsumme.
13. Vor Echtgeld eine funktionierende Börsendemo sowie Neustart, Verbindungsabbrüche, Teilfills und Schutzorderfehler prüfen. Grenzstopp auch bei UI-Absturz persistieren. Telegram deaktivieren schaltet Trading niemals unbemerkt an/aus und ist kein Ersatz für Bot-Aus.

**Code und tatsächlicher Stand:** `code/bot/code/bot-limits.mjs` enthält einen getesteten reinen Grenz-/Zustandskern mit Dezimalrechnung; `trading-bot-view.mjs`/CSS und `demo.html` sind die Bedienreferenz. **Bitget-Orderexecutor, private API-Verbindung, Fill-Ledger und produktive Oracle-Persistenz sind nicht implementiert.** `entriesAllowedByLimits` ist nur ein Teilfilter und allein niemals eine Orderfreigabe. Demo-/Live-Modus in der Referenz bleiben deshalb gesperrt.

**Prüfung:** exakte Grenzberührung, Gewinn-/Verlustaktion getrennt, offenes Ergebnis beim Schließen nicht doppelt, veralteter/falscher Snapshot, persistente Sperre, iPhone+iPad, Neustart vor Orderantwort, Teilfills, manuelle Nettingposition, Modustrennung. Für die reale Einrichtung `BITGET_EINRICHTUNG.md` verwenden und am Montagsstand verifizieren.

**Zusätzliche Abnahmefälle (Revision 2):** Verspäteter eigener Teilfill versus echter manueller Eingriff, unveränderte Menge trotz Fremdfill, Störung über Neustart, weiterhin liegende Schutzorder und Gewinnstopp während Bestandskonflikt.

## G13 - Zusammenführung, Migration und Gesamtprüfung

1. Alle zuvor einzeln freigegebenen Gruppen im aktuellen Stand zusammenführen. Gemeinsame Marktfeeds, Alarme, Kontobuchungen und Settings nicht mehrfach anlegen. Ein Signal besitzt Quelle/Strategie, Modellversion, Datenrevision und stabile ID.
2. PWA-Cacheliste/Service-Worker um lokale Module, Worker und SVG-Katalog ergänzen. HTML und JS nicht in inkompatiblen Versionen mischen; Updates mit gesicherten Daten und Rückfallweg. Kein zwangsweises Löschen aller Appdaten.
3. Vorhandene Funktionen prüfen: Chart, Indikatoren, Rechner, Alarmtypen, Telegram-Sicherung, Eingabe/Import/Export, Positionen, Jahresauswertung und DEMO. Neue Navigation braucht Button **und** aktive Tab-/Sichtbarkeitslogik; alte Vier-Tab-CSS nicht für neue Reiter unbesehen weiterverwenden.
4. Testdaten nur klar als Simulation in Vorschauen. Keine privaten Zugänge ins Liefer-ZIP, kein Produktiv-Reset durch Demoskripte. Fremdbibliothek mit Version/Lizenz, keine unnötige Framework-Neuinstallation.
5. Leistung auf realem Handy prüfen: Startbytes, Requests, begrenzte Caches, schwere Berechnung im Worker/Server, keine ständigen Ganzseiten-Renderings, Chart-/Observer-/Timer-Cleanup bei Wechsel. Große Listen begrenzen oder virtualisieren.
6. Echte HTTPS-PWA/iOS-Safari, iPad, Desktop; Tastatur/Pinch/Rotation/Vollbild/Safe-Area, Offline/429/CORS, geschlossene App, Oracle-Neustart, mehrere Geräte. Layoutverschiebungen bei Laden/Kursupdates minimieren; beabsichtigtes Aufklappen bleibt möglich.
7. Gemeinsame Backtest-/Signalfixtures auf App und Server vergleichen. Alarme bei AUS, Dublettensperre, Restore alter Backups, Kontostandkorrekturen und Short-Teilabschlüsse erneut als Integrationsprüfungen.
8. Jede Lieferung enthält aktualisiertes Programm und nötige Serverdateien, Versionskennung, kurze Änderungsliste, Testnachweis, offene Punkte und Einbau-/Updateanleitung. Kein „fertig“, wenn nur eine View ohne Produktionsadapter existiert.

**Vorliegender Nachweis:** 211 automatisierte Tests des konsolidierten Referenzpakets bestanden; Muster- und PO3-Browservorschauen zusätzlich unter Chromium auf Desktop/Mobil/Tablet geprüft. Dies beweist weder Safari-Kompatibilität noch produktive Oracle-/Telegram-/Bitget-Integration. Die 3.28-App ist mit diesen Modulen noch nicht zusammengebaut. Der 3.28-Dienst-Selbsttest besteht 16/16 mit beschreibbarem Test-Tempverzeichnis; m48/m49/unit-247b liegen nicht im ZIP und sind hier nicht reproduziert.

## G14 - Letzter Punkt: Standardlayout und Alternative zur Entscheidung vorlegen

**Dieser Punkt ist kein normaler automatischer Implementierungsschritt.**

1. **Layout 1 ist Claudes tatsächlich vorhandenes Standardlayout** der dann aktuellen App, einschließlich freigegebener funktionaler Ergänzungen.
2. **Layout 2 ist das alternative Codex-Dashboard** aus `code/frontend/DashboardView.js`. Es ersetzt das Standardlayout nicht. Kein neu erfundenes „Standardlayout“ als Vergleich bauen.
3. Beide Ansichten mit derselben Datenlage auf Handy und Desktop vorlegen, gern als bedienbare Vorschau und Screenshots. Mich entscheiden lassen, welche Ansicht standardmäßig verwendet werden soll. Bis dahin das alte Standardlayout beibehalten.
4. Gewünschte Wahlmöglichkeit über `LayoutSwitcher.js` vorbereiten. Erst nach Vorlage und meiner Entscheidung den gewünschten Umschalter im Produktivstand freigeben. Werte `standard`/`dashboard`, Präferenz dauerhaft pro Profil; fehlende/ungültige Präferenz -> Standard.
5. Eine gemeinsame fachliche Store-/Command-Schicht. Beide Layouts erzeugen keine eigenen Backups, Alarme, Kurs-Abos, Signalberechnungen oder Orders. Standardroot nicht kopieren/neumounten; Alternative bei Bedarf laden, unsichtbare Ansicht inert, Fokus vor Wechsel erhalten.
6. Alternative enthält Portfolio-Wert, Watchlist, offene Positionen, interaktiven Chart und Kontostand-Widget. Funktionen/Status aus G01-G13 anbinden. Kein renderseitiges Neuberechnen realisierter Ergebnisse.
7. Chartadapter wiederverwenden. Standardchart bleibt der bestehende Chart. Die Alternative verwendet die mitgelieferte Lightweight-Charts-Bibliothek; keine zweite Fachpipeline. Preis/Market Cap und Overlayregeln prüfen. Die bisherigen sechs Chartintervalle der Referenz um Woche/Monat erweitern, damit die acht gewünschten Musterintervalle auch hier erreichbar sind. Freigegebene Bedienung in beiden Ansichten konsistent.
8. Theme über `--sd-bg`, `--sd-surface`, `--sd-surface-raised`, `--sd-text`, `--sd-muted`, `--sd-border`, `--sd-accent`, `--sd-positive`, `--sd-negative`, `--sd-warning` im Viewhost; vorhandene Modulvariablen gezielt abbilden. Kein Tailwind-/React-Zwang: Stack ist HTML/CSS/JS mit Web Components.
9. Zustandsmanager liefert konsistente Snapshots mit `loading/ready/stale/error/empty`, Quellzeiten, Revision, Markt/Instrument, Anzeigepräzision, FX, Leerzuständen und bestätigten Commands. Feste Platzhalterhöhen, tabellarische Ziffern, dezente Farbänderung bei Kursupdates; `prefers-reduced-motion` beachten.
10. Schlussabnahme nach meiner Layoutwahl: reale Standardansicht weiter erreichbar, keine Doppeltimer, keine verlorenen Eingaben beim Wechsel, Formular-/Chartzustand bleibt erhalten, responsive 320/390/768/1440 Pixel, zugängliche 48px-Schalter, AMOLED und vorhandene Light-Theme-Option.

## Codebeilagen und Anschlussreihenfolge

| Ordner | Zweck | Integrationsgrenze |
| --- | --- | --- |
| `code/frontend/` | Dashboard, Kontowidget, Ledger, Cap-Validator, Layoutwahl, lokale Chartbibliothek | Alternative; neue Kontrollstände noch anschließen |
| `code/entkopplung/` | Refresh-/Backoff-Regeln und Tests | vollständigen Scanner separat integrieren |
| `code/muster/` | 41 Muster/SVGs, lokale Erkennung, Panel, Chart, Worker, Score-Anbindung | Archiv/Lernen und Montags-Hostadapter ergänzen |
| `code/confluence/` | Score, Risiko, PnL, Kohortenaggregation | Feed, kompletter Backtester, App-/Serveranschluss ergänzen |
| `code/po3/` | Strategie, Simulation, Journal, Overlay/Worker/Adapter | Funding-Vollkosten, große Historie und aktueller Host |
| `code/bot/` | Stopplimits, Bedienreferenz, Simulation | kein implementierter Börsenexecutor |

Einbauanleitungen stehen in `CODE_EINBAU.md` und `BITGET_EINRICHTUNG.md`. Vollständiger Eigen-Code steht zusätzlich nach Modulen in `03_CODE_ZUM_KOPIEREN.md`; Tests und Drittbibliothek im ZIP. Demos/Fixtures nicht als Produktivdaten importieren.

## Offene Entscheidungen erst in der betroffenen Gruppe klären

- Falls eine neuere Claude-Version kommt: Delta zu 3.28.0 und ihre tatsächliche Serversteuerung. Gründe/DEMO/1.4.0 sind im jetzigen Snapshot vorhanden.
- Bestehender GitHub-Veröffentlichungsweg für bereinigtes Musterwissen; kein Schreibrecht voraussetzen.
- G10/G11: tatsächliche öffentliche Historien-/Fundingabdeckung je Kontrakt; fehlende Daten offen zeigen.
- G12: vor privater API-Anbindung konkreter Bitget-Kontotyp, Positionsmodus, selbst gewählter Einsatz/Risikogrenzen und Schließaktion; vorher Simulation. Keine Zugangsdaten im Chat verlangen.
- G14: meine Layoutentscheidung. Die Alternative wird vorher nicht zum Standard.

Diese Punkte sind keine Aufforderung, jetzt alle Angaben erneut abzufragen. Erst den aktuellen Code und vorhandene Entscheidungen nutzen; konkrete verbleibende Unklarheit in der jeweiligen Gruppe mit Optionen vorlegen.

## Arbeitsanweisung an Claude

Arbeite Gruppe für Gruppe ab.
Schicke mir nach jeder Gruppe das aktualisierte Programm zur Prüfung.
Mach erst nach meiner Freigabe mit der nächsten Gruppe weiter.
Frag bei Unklarheiten nach, statt zu raten.
