# Scalp Desk – 24/7-Dienst

Kleines Programm für einen eigenen Server, der rund um die Uhr läuft (z. B. kostenlos bei Oracle Cloud, „Always Free“). Es meldet per Telegram, auf Wunsch zusätzlich per Discord, auch wenn die App überall geschlossen ist:
- Kurs-Alarme,
- Stop-Loss/Take-Profit offener Positionen,
- wichtige Wirtschaftstermine,
- den BTC-Puls (ab Version 1.1): ungewöhnlich starke Bitcoin-Bewegung in 5 oder 15 Minuten,
- den Gewinn-/Verlust-Alarm am Live-Ergebnis der offenen Positionen (ab Version 1.2).

Ab Version 1.3 prüft er, ob Telegram jede Meldung angenommen hat. Wenn nicht, versucht er es erneut und meldet eine Störung.
Ab Version 1.4 bestätigt er jede neue Übergabe lautlos im Chat, sagt selbst, wenn er keine Datei der App findet (meist ein anderer Bot oder eine andere Chat-ID am Server), und zeigt mit `sudo scalpdesk-247 status` den ganzen Weg auf einen Blick.
Ab Version 2.0 steuert die App ihn über eine gesicherte HTTPS-Adresse: Chat-Schalter mit Bestätigung und eine Sendefreigabe, damit jeder Alarm genau einmal kommt (siehe „HTTPS-Steuerung“).

**Schritt-für-Schritt-Anleitung für Oracle Cloud (Neueinrichtung, Aktualisieren, Fehlerhilfe): [ANLEITUNG-ORACLE.md](ANLEITUNG-ORACLE.md)**

## So arbeitet er mit der App zusammen
- **Übergabe:**
  - Die App legt die aktiven Alarme und die Stop-/Ziel-Marken ihrer Positionen als Datei `scalpdesk-247.json` in deinen Telegram-Chat und heftet sie an.
  - Einstiege und Mengen offener Positionen stehen nur darin, solange ein Gewinn- oder Verlust-Alarm aktiv ist (ab 1.2): Der Dienst braucht sie für das Live-Ergebnis.
  - Trades und Notizen bleiben in der App.
- **Bestätigung:**
  - Der Dienst liest die Datei mit demselben Bot alle 20 Sekunden (bis 1.3 jede Minute).
  - Er prüft alle 15 Sekunden die 1m-Kerzen bei Binance; auch kurze Dochte zählen.
  - Er bestätigt in der angehefteten Nachricht („Dienst: aktiv · … · v1.4.0 · #… übernommen“). Die App zeigt dann „Übergeben ✓ vom Dienst bestätigt“, meist 20–30 Sekunden nach dem Einschalten.
  - Ab 1.4 schickt er außerdem lautlos „✅ 24/7-Dienst hat übernommen (17:09 Uhr)“ mit den neu beobachteten Alarmen und Marken in den Chat – bei jeder Übergabe, die etwas Neues bringt, höchstens einmal je Minute (nicht beim bloßen Entfernen und nicht nach einem Neustart). Wird die Übergabe in der App ausgeschaltet, kommt „⏸ … ausgeschaltet“.
- **Derselbe Bot, dieselbe Chat-ID (wichtig):**
  - Der Dienst sieht die Datei nur, wenn am Server derselbe Bot und dieselbe Chat-ID eingetragen sind wie in der App unter „Kursalarm“. Ein anderer Bot (z. B. der Sicherungs-Bot) hat einen eigenen Chat und sieht die angeheftete Datei nicht. Dann wartete der Dienst bis 1.3 still, und die App zeigte dauerhaft „wartet auf den 24/7-Dienst“.
  - Ab 1.4: Protokollzeile „Warte auf die Übergabe der App: Im Chat … ist für @… keine Datei … angeheftet …“ alle 10 Minuten; nach 3 Minuten ein Hinweis per Telegram („⏳ … wartet auf die Übergabe der App“, höchstens einmal am Tag) – er landet im Chat des Bots, der am Server eingetragen ist, daran sieht man die Verwechslung sofort. Die App nennt nach 90 Sekunden ohne Bestätigung ihren Bot und ihre Chat-ID zum Vergleich.
- **Keine doppelten Nachrichten:** Solange die Bestätigung frisch ist, sendet die App Kurs-Alarme, Stop/Ziel, Termin-Warnungen und den BTC-Puls nicht zusätzlich.
- **Zustellung (ab 1.3):**
  - Jede Meldung kommt erst in einen Ausgang. Als zugestellt gilt sie, wenn Telegram sie angenommen hat. Sonst folgt ein neuer Versuch nach 15 und 30 Sekunden, nach 1 und 2 Minuten, dann alle 5 Minuten; bei „Too Many Requests“ nach Telegrams Vorgabe.
  - Der Ausgang übersteht einen Neustart. Was nach 24 Stunden noch nicht angenommen ist, verwirft der Dienst mit einer Zeile im Protokoll.
  - Eine verspätete Meldung (über 2 Minuten) trägt die Uhrzeit des Auslösens und den Vermerk „verspätet zugestellt um … – Telegram war nicht erreichbar“ (bzw. „hatte gebremst“, „hatte sie zuerst abgelehnt“).
  - Lehnt Telegram ab (z. B. „chat not found“) oder ist es länger als eine Minute nicht erreichbar, steht in der angehefteten Nachricht „Dienst: Störung · … · Telegram-Nachricht nicht zustellbar seit …“. Dann sendet die geöffnete App wieder selbst. Eine Meldung kann dabei doppelt ankommen: sofort von der App und später verspätet vom Dienst.
  - Darunter steht „Zustellung: zuletzt 01.10. 14:32 · Kurs-Alarm BTC“, vor der ersten Meldung „Zustellung: geprüft, noch keine Meldung“. Die App zeigt das unter „Status prüfen“.
  - Bis 1.2 galt eine Meldung schon vor dem Senden als erledigt. Lehnte Telegram sie ab, ging sie verloren, und der Dienst meldete weiter „aktiv“.
  - Kurse fragt er für bis zu 4 Kürzel gleichzeitig ab. Ein langsames Kürzel hält die anderen nicht auf, ein Fehler betrifft nur dieses Kürzel.
- **BTC-Puls (ab 1.1):**
  - Die App berechnet aus den BTC-Kerzen der letzten 35 Tage, welche Bewegung um welche Uhrzeit ungewöhnlich ist (99 % der üblichen, je Stunde und Tagesart), und legt diese Schwellen mit in die Datei.
  - Der Dienst prüft damit alle 15 Sekunden die Bewegung der letzten 5 und 15 Minuten (mindestens 0,5 % bzw. 0,8 %).
  - Je Richtung höchstens eine Nachricht in 30 Minuten, außer die Bewegung legt deutlich zu; nachts (22–7 Uhr) lautlos.
  - In seiner Bestätigung steht dann „· Puls“; erst dann sendet die App den Puls nicht mehr selbst. Ein älterer Dienst (1.0) kennt den Puls nicht – dann sendet ihn weiter die geöffnete App. Aktualisieren: den Installationsbefehl erneut ausführen.
- **Gewinn-/Verlust-Alarm (ab 1.2):**
  - Die App übergibt die Grenzen (z. B. „ab +100 USDT“) zusammen mit Einstieg, Menge, Richtung und Markt jeder offenen Position.
  - Der Dienst rechnet alle 15 Sekunden mit dem aktuellen Kurs das Live-Ergebnis. Eine Spitze, die kürzer als 15 Sekunden dauert, kann er übersehen.
  - Erreicht es eine Grenze, wartet er etwa 10 Sekunden und liest die Datei der App neu. Die geöffnete App meldet die Grenze selbst (sofort, auch kurze Spitzen) und vermerkt das in ihrer Datei; dann schweigt der Dienst. Sonst meldet er, einmal je Grenze.
  - Er bestätigt mit „· GV“ und vermerkt eigene Meldungen in der angehefteten Nachricht („GV: Gewinn-Alarm ausgelöst …“). Die App übernimmt die Grenze beim Öffnen als „ausgelöst“. Erst nach „Wieder aktivieren“ in der App meldet sie sich erneut.
  - Ein älterer Dienst (bis 1.1) kann es nicht. Dann prüft weiter nur die geöffnete App. Das Tages-Verlustlimit meldet immer die App.
- **Netz:** Ohne HTTPS-Steuerung braucht der Server nur ausgehende Verbindungen (Telegram, Binance, GitHub). Mit HTTPS-Steuerung (ab 2.0) zusätzlich die Ports 80 und 443 (siehe unten); eine eigene Domain ist nicht nötig.

## HTTPS-Steuerung (ab 2.0)
- **Aufbau:** Der Dienst lauscht nur lokal auf `127.0.0.1:8247`. Davor steht **Caddy**, der für eine Adresse wie `130-61-1-2.sslip.io` (die IP des Servers mit Bindestrichen) ein kostenloses Let's-Encrypt-Zertifikat holt und erneuert. Der Installer richtet beides ein und öffnet die Ports 80 und 443 in der Firewall des Servers; in der Oracle-Konsole gibst du sie einmal selbst frei ([Anleitung](ANLEITUNG-ORACLE.md#du-hast-den-dienst-schon-auf-version-20-aktualisieren-10-minuten)).
- **Zugang:** Ein zufälliger Zugangsschlüssel (43 Zeichen) steht in `/etc/scalpdesk-247.json` und gilt für jede Anfrage („Authorization: Bearer …“). `sudo scalpdesk-247 zugang` zeigt ihn mit der Adresse; in der App unter 🌙 24/7-Dienst eintragen. Falsche Schlüssel: höchstens 20 Versuche je Minute. Anfragen anderer Webseiten lehnt der Dienst ab (CORS nur für `https://nicoahb.github.io`).
- **Was darüber läuft – und was nicht:** Schalterstände (Kursalarm, Sicherung, Trades) und Ereignis-Freigaben. Sicherungen, Trade-Bilder und Telegram-Token der App gehen nie an den Dienst.
- **Schalter:**
  - **Gespeichert am Dienst:** je Ziel an/aus, Einschaltzeit und Epoche, dazu eine gemeinsame Revision.
  - **Aufträge:** Die App sendet einen Auftrag mit Auftrags-ID und erwarteter Revision. Passt die Revision nicht (ein anderes Gerät war schneller), lehnt der Dienst ab und nennt den aktuellen Stand. Alle Ziele eines Auftrags (auch „Alle an/aus“) gelten gemeinsam oder gar nicht. Bestätigt wird erst nach dem dauerhaften Speichern.
  - **Verlorene Antwort:** Das Ergebnis eines Auftrags lässt sich abfragen (`GET /v1/commands/<ID>`).
  - **AUS und AN:** AUS verwirft auch wartende Meldungen. AN meldet nur, was ab jetzt passiert. Vor jedem Senden prüft der Dienst Schalter und Epoche erneut.
- **Ereignis-Freigaben (keine doppelten Alarme):**
  - **Feste Ereignis-ID:** Jeder Kurs-Alarm, jede Stop-/Ziel-Berührung und jede Gewinn-/Verlust-Grenze hat eine ID aus Alarm, Aktivierung und Art, z. B. `al42:mux1a2b3:price-cross`. Eine Sicherung oder ein Abgleich ändert sie nicht; erst „Erneut aktivieren“ ergibt eine neue.
  - **Genau ein Sender:** Wer das Ereignis zuerst reserviert (die geöffnete App oder der Dienst), sendet es. Zwei Geräte bekommen nie beide die Freigabe. Eine ausgegebene Freigabe wandert nie an einen anderen Sender; meldet ein Gerät nach 5 Minuten kein Ergebnis, steht „unbestätigt“.
  - **Zustände** (dauerhaft): reserviert, wird gesendet, zugestellt, unbestätigt, fehlgeschlagen, verworfen.
  - **Stop/Ziel wiederkehrend:** Eine neue Episode beginnt erst, wenn der Kurs die Marke um mindestens 0,1 % verlassen hat und die letzte Meldung mindestens 5 Minuten zurückliegt.
- **Zustellung:** Bekommt der Dienst von Telegram keine Antwort (Zeitüberschreitung, Verbindung abgerissen), gilt die Meldung als „Zustellung unbestätigt“ – ohne zweiten Versuch, der sie doppelt zustellen könnte. Kam die Anfrage nachweislich nie an (keine Verbindung), versucht er es wie bisher erneut. Garantierte Zustellung und „genau einmal“ zugleich kann niemand versprechen.
- **Protokoll:** je Ereignis eine Zeile mit Ereignis-ID, Ziel, Sender und Zustand, z. B. `Ereignis al42:mux1a2b3:price-cross · Ziel course-alert · Sender oracle · zugestellt`.

## Einrichten
Auf dem Server (Ubuntu/Debian, Raspberry Pi OS oder Oracle Linux):

```
curl -fsSL https://raw.githubusercontent.com/NicoAHB/wx-widget/main/server/install.sh | sudo bash
```

Der Installer:
1. installiert bei Bedarf Node.js 22;
2. fragt Bot-Token und Chat-ID ab (stehen in der App unter 🔔 Hinweise → „Telegram / Discord einrichten“);
3. prüft Bot, Chat und Binance und schickt eine Testnachricht;
4. richtet den systemd-Dienst `scalpdesk-247` ein.

Danach in der App „An den 24/7-Dienst übergeben“ einschalten.

Bot-Token und Chat-ID sind dieselben wie in der App unter „Kursalarm“, nicht die des Sicherungs-Bots.

**Wichtig:** Serverregion in der EU wählen (z. B. Frankfurt). Von US-Servern aus sperrt Binance den Zugriff.

## Betrieb
- Alles prüfen (ab 1.4): `sudo scalpdesk-247 status` – Bot, Chat, angeheftete Datei, Bestätigung, beobachtete Marken, letzte Zustellung, Binance, ab 2.0 auch HTTPS-Steuerung, Schalter und letzte Ereignisse; ohne eine Nachricht zu senden
- Zugang für die App (ab 2.0): `sudo scalpdesk-247 zugang`; HTTPS erneut prüfen: `sudo scalpdesk-247 https`
- Protokoll: `sudo scalpdesk-247 protokoll` (die letzten 60 Zeilen), live: `sudo scalpdesk-247 live` (beenden mit Strg+C) – oder wie bisher `journalctl -u scalpdesk-247 -f`
- Neu starten: `sudo scalpdesk-247 neustart`; Status von systemd: `systemctl status scalpdesk-247`
- Aktualisieren: den Installationsbefehl erneut ausführen (Einstellungen bleiben)
- Einstellungen neu eingeben: `curl -fsSL …/install.sh | sudo bash -s -- --neu`
- Entfernen: `sudo bash /opt/scalpdesk-247/install.sh --remove`

## Protokoll lesen (ab 1.4)
Typische Zeilen, in dieser Reihenfolge:
```
Scalp Desk 24/7-Dienst 1.4.0 gestartet · Bot @dein_bot (ID 123456789) · Chat 987654321 · Node 22.… · prüft die Übergabe alle 20 s, die Kurse alle 15 s
Übergabe erhalten: Nachricht #501 · App 01.10. 17:08 · Safari, iPhone · #ab12
Alarme geladen: 1 Alarm, 0 Positionen – Kurs-Alarm BTC auf/über 65.000,00 USDT
Bestätigung an Telegram gesendet: 1 Marke beobachtet, neu: Kurs-Alarm BTC auf/über 65.000,00 USDT (Nachricht #612)
Kursprüfung: Kurs-Alarm BTC auf/über 65.000,00 – Kurs 64.950,00, noch 0,08 % entfernt
Bestätigung eingetragen: angeheftete Nachricht zeigt „aktiv · #ab12 übernommen“ – die App zeigt „Übergeben ✓ vom Dienst bestätigt“
Alarm ausgelöst: Kurs-Alarm BTC auf/über 65.000,00 (Kurs 65.020,00)
Telegram gesendet: Kurs-Alarm BTC (Nachricht #613)
Lebenszeichen: aktiv · 1 Marke beobachtet · 40 Kursprüfungen seit der letzten Übersicht · BTC 65.020,00
```
Die Zeitstempel davor setzt journalctl in der Zeitzone des Servers (bei Oracle meist UTC, im Sommer 2 Stunden hinter der deutschen Zeit). Auf die Alarme hat das keinen Einfluss: Der Dienst rechnet mit Zeitpunkten unabhängig von Zeitzonen und schreibt die Uhrzeiten in den Meldungen in der Zeitzone der App. Deutsche Zeit im Protokoll: `sudo timedatectl set-timezone Europe/Berlin`.

## Selbsttest
`node selbsttest.mjs` im Ordner `server` prüft den Dienst ohne Netz und ohne Konten: Telegram und Binance sind darin nachgebaut. Geprüft werden vor allem die Zustellung (Ablehnung, Wiederholen mit wachsender Pause, Neustart, Nachstellen mit Vermerk, Störung nach einer Minute ohne Telegram, Verwerfen nach 24 Stunden), die gleichzeitigen Kursabfragen und ab 1.4 Bestätigung, Hinweis bei fehlender Datei und `--status`. Am Ende steht „… von … bestanden“.

## Dateien und Sicherheit
- `/opt/scalpdesk-247/scalpdesk-247.mjs` ist das Programm: ohne Abhängigkeiten, Node.js ab 18.
- `/etc/scalpdesk-247.json` enthält Bot-Token, Chat-ID und den optionalen Discord-Webhook. Sie ist nur für root und den Dienst-Benutzer `scalpdesk` lesbar.
- `/var/lib/scalpdesk-247/state.json` enthält die zuletzt übernommene Datei, die schon gesendeten Meldungen, den Ausgang (noch nicht zugestellte Meldungen) und ab 1.4 den zuletzt bestätigten Stand und den Zeitpunkt des letzten Hinweises. Die App liest diese Datei nie; sie ist nur das Gedächtnis des Dienstes über Neustarts hinweg.
- `/usr/local/bin/scalpdesk-247` (ab 1.4) ist der Kurzbefehl für `status`, `protokoll`, `live` und `neustart`.
- Der Dienst läuft als eigener Benutzer ohne Anmeldung, mit schreibgeschütztem System (`ProtectSystem=strict`). Er startet mit dem Server und nach Fehlern von selbst neu.
- Den Token schreibt er nie ins Protokoll.

## Muster-Archiv (ab Dienst 2.1.0, App 3.39.0)
- **Was:** Die App überträgt bestätigte Chartmuster-Fälle (nur Marktdaten: Coin, Intervall, Muster, Zeitpunkte, Kurs, Prognose, Ergebnis) über den bestehenden HTTPS-Weg mit dem Zugangsschlüssel. Telegram und der Sicherungsbot sind daran nicht beteiligt.
- **Wo:** `patterns-journal.jsonl` neben der Zustandsdatei, nur anhängend. Getrennt von Alarmkonfiguration und Zustand. Fehlerhafte Zeilen werden zusätzlich nach `patterns-journal.jsonl.quarantine` kopiert; gelöscht wird nichts.
- **Sicherung:** wenige Sekunden nach jeder Änderung eine geprüfte Kopie (Prüfsumme nach dem Zurücklesen) in `muster-sicherung/` neben der Zustandsdatei.
  - **Anderes Volume:** Für eine wirklich unabhängige Sicherung `SCALPDESK_PATTERN_BACKUP=/pfad/auf/anderem/volume` in der Umgebung des Dienstes setzen.
    Der Dienst läuft mit schreibgeschütztem System (`ProtectSystem=strict`), deshalb den Pfad in der Unit zusätzlich unter `ReadWritePaths=` eintragen (`sudo systemctl edit scalpdesk-247`).
  - **Wiederherstellung:** Fehlt das Journal beim Start, stellt der Dienst es aus der Sicherung wieder her.
  - **Kopie aufs Gerät:** In der App zusätzlich „Archiv vom Dienst als Datei sichern“ (Info-Sheet eines Musters → „Vergangene Verläufe ansehen“).
- **Aufrufe** (mit Zugangsschlüssel): `POST /v1/patterns/cases`, `GET /v1/patterns/status`, `GET /v1/patterns/export`.

## Veröffentlichung des Musterwissens (App 3.39.0)
- **Was:** Ein kleiner, bereinigter Stand für alle Nutzer auf GitHub Pages: nur Zählungen je Markt|Coin|Intervall|Muster (live und rekonstruiert getrennt), keine Einzelkurse, keine persönlichen Daten.
- **So geht's:**
  1. In der App „Archiv vom Dienst als Datei sichern“ (oder `GET /v1/patterns/export` mit Zugangsschlüssel) → `muster-archiv-JJJJ-MM-TT.json`.
  2. Im Repository: `node server/muster-export.mjs muster-archiv-JJJJ-MM-TT.json data/muster` → schreibt `data/muster/manifest.json` (höchstens 64 KiB) und `stats-<n>.json` (je höchstens 256 KiB); die Revision zählt hoch.
  3. Committen und pushen (Pull Request). Nach dem Pages-Build zeigt die App unter „Vergangene Verläufe ansehen“ „Veröffentlicht: Revision R vom …“ mit der Zählung der Auswahl.
- **Sicherheit:** Die App liest nur (GET); sie braucht und kennt keinen Schreibschlüssel. Ohne Veröffentlichung steht dort „noch keine Veröffentlichung“.

## Ziel „Chartmuster“ (ab Dienst 2.2.0, App 3.40.0)
- **Was:** ein viertes Ziel in „Telegram-Chats“ für wichtige bestätigte Formationen aus „KI“ (live, Regelgüte ≥ 80 %, auf der letzten oder vorletzten abgeschlossenen Kerze bestätigt).
- **Wer sendet:** nur die App, solange sie offen ist. Der Dienst führt Schalter und Epoche und vergibt je Fall eine Sendefreigabe (Ereignis `pat:<Fall-ID>`), damit von mehreren Geräten genau eins meldet.
- **Älterer Dienst (vor 2.2.0):** Er kennt das Ziel nicht; der Schalter gilt dann nur im Browser, und die App meldet ohne Freigabe (je Fall einmal pro Browser).
- **Bei geschlossener App:** noch nicht – dafür bräuchte der Dienst die Mustererkennung selbst (offener Schritt G09 C6b).

