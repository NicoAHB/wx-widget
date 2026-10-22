# Dienst 2.18.0 / Chartmusterdienst 1.4.0 – „0 von 30 Fällen“ bei den Chartmuster-Meldungen (Claude)

Ausgangspunkt: `main` e932a37 (App 3.94.0, Dienst 2.17.0). Rückmeldung des Nutzers: Auf Telegram stehen weiterhin viele Chartmuster mit „0 von 30 Fällen“, z. B. bei der bärischen Flagge. Bitte prüfen und berichtigen.
**Die App bleibt unverändert (3.94.0).** Geändert sind nur die Dienste; zum Einspielen den Installer auf dem Server erneut ausführen.

## 1. Befund: Das Zählen war richtig, das Archiv war leer

Die Zeile „Erlernt“ zählt je Muster, Zeitrahmen und Richtung über alle Coins (2.17.0). „noch nicht bewertet (0/30 Fälle dieses Musters)“ heißt: Im Archiv des Dienstes liegt **kein einziger abgeschlossener Fall** dieses Musters in diesem Zeitrahmen. Das war keine Zählfehler-, sondern eine Datenlücke im Dienst:

1. **Das Lernarchiv füllte sich nur von außen.** Der Dienst legte ein Muster nur ab, wenn er es **gesendet** hatte. Gefilterte Muster (die meisten) kamen nicht ins Archiv; im Chartmusterdienst nur in dessen Zustand.
2. **Der Dienst wertete seine eigenen Fälle nie aus.** Ein Fall zählt erst, wenn 12 Kerzen später das Ergebnis feststeht („auf“, „ab“, „seitwärts“). Das Ergebnis trug nur die App ein – und die kannte nur die Zeitrahmen und Coins, die der Nutzer selbst im Chart angesehen hatte.
3. **Keine Vorgeschichte.** Der Dienst lädt je Markt rund 540 Kerzen, nutzte sie aber nur, um **frische** Muster zu finden – nie, um zu zählen, wie es bei den früheren ausging.

Zusammen ergab das für die meisten Kombinationen aus Muster und Zeitrahmen **0 Fälle** – genau wie schon vorher „0/10 je Coin“. Das Umstellen auf „je Muster“ allein konnte das nicht heilen, weil das Archiv selbst leer war.

## 2. Was jetzt anders ist

- **Verlauf „als ob live“ (`patternHistory`):** Der Dienst setzt das Ende des Kerzenfensters Kerze für Kerze zurück. Die Engine sieht jeweils nur die Daten bis dahin – **kein Blick in die Zukunft** – und es zählt, was der Dienst damals genauso gemeldet hätte (frisch bestätigte Formation, Regelgüte ≥ 80 %, Ausbruch). Das Ergebnis nach 12 Kerzen kommt wie bei Live-Fällen (Schluss gegen ±0,10 %). Quelle: „rekonstruiert“. Einmal je 12 Stunden und Markt; gleiche Fall-ID zählt einmal (Test: gleiche Formation erscheint nie doppelt).
  Gerade dieser Weg findet auch **frühere Wiederholungen** einer Formation – ein einzelner Durchlauf über das ganze Fenster fand höchstens die jüngste (am festen Katalog geprüft: drei bis vier Flaggen statt keiner).
- **Eigene Fälle werden ausgewertet:** Offene Fälle eines Marktes bekommen nach 12 Kerzen ihr Ergebnis (`PatternArchive.resolve`, nur anhängend im Journal).
- **Auch gefilterte Fälle** kommen ins Lernarchiv (nicht nur die gesendeten); sie zählen mit Ergebnis nach 12 Kerzen.
- **Archivstatus** (`GET /v1/patterns/status`) nennt jetzt je Muster, Zeitrahmen und Richtung die Zahl der Fälle und der Fälle mit Ergebnis – so ist sichtbar, wie weit jede Kombination von den 30 Fällen entfernt ist.
- Chartmusterdienst (eigene Einheit, 1.4.0): derselbe Verlauf im Lernbestand seines Zustands.
- Rechenzeit: rund 0,3 ms je Prüfschritt, etwa 0,1–0,3 s je Markt und 12 Stunden; keine zusätzlichen Börsenabrufe (es werden die ohnehin geladenen Kerzen genutzt).

## 3. Was das bewirkt – und was nicht (bitte beachten)

- Aus „0/30“ wird die **tatsächliche Zahl der bekannten Fälle** („noch nicht bewertet (7/30 …)“), sobald der Dienst die erste Runde durch hat; ab 30 Fällen erscheint die Quote mit Bereich.
- **Ob 30 erreicht werden, hängt von der Häufigkeit des Musters ab.** Je Coin und rund 540 Kerzen kommen die meisten Formationen nur null- bis einmal vor (bei einer Zufallsreihe: 0,01 bis 0,2 je Formation; echte Kurse haben mehr Struktur, ich konnte hier aber nicht mit echten Börsendaten messen). Mit sechs beobachteten Coins werden seltene Muster (Flaggen, Dreiecke) in einem Zeitrahmen deshalb **auf längere Zeit unter 30 bleiben**, häufige (Doppel-Top/-Boden) früher. Die Anzeige bleibt dann ehrlich „x/30“.
- Hebel dagegen, falls gewünscht (jeweils eigene Entscheidung): (a) **mehr Coins** nur fürs Lernen (ein „Lernuniversum“ aus den größten Coins, getrennt von den Meldungen), (b) die **Mindestzahl senken** (z. B. 20; der Bereich bleibt ehrlich breit), (c) **längere Vorgeschichte** (mehrere Abrufe je Markt), (d) die Zeile bei zu wenig Fällen **ausblenden**.

## 4. Geänderte Dateien

- `server/pattern-monitor.mjs`: neu `patternHistory`, `patternOutcome`.
- `server/scalpdesk-247.mjs`: VERSION 2.18.0; `PatternArchive` (offene Fälle, `resolve`, Status je Muster); `Watcher.learnPatterns`; Aufruf im Prüflauf; alle frischen Fälle (auch gefilterte) ins Archiv.
- `server/patterns-247.mjs`: PATTERNS_VERSION 1.4.0; `learn` im Prüflauf.
- `server/README.md`, `server/release-manifest.json` (Dienstdateien, App 3.94.0 unverändert).
- Tests: neu `unit-pattern-history` (17: Verlauf findet wiederholte Formationen, kein Blick in die Zukunft, Ergebnisregel, keine Doppelten, offene Fälle werden ausgewertet, Neustart, Chartmusterdienst, Archivstatus, Wirkung auf die Meldung); `unit-vwap-explainer` (Dienstversion).

## 5. Einspielen

Auf dem Server den Installer erneut ausführen (Anleitung: `server/ANLEITUNG-ORACLE.md`). Danach füllt sich das Archiv innerhalb der ersten Prüfrunden; im Protokoll steht je Markt „Muster-Archiv: n Fälle aus dem Kerzenverlauf“.
