# Scalp Desk 24/7-Dienst bei Oracle Cloud – Schritt für Schritt

Mit dem 24/7-Dienst kommen deine Meldungen per Telegram auch dann, wenn die App überall geschlossen ist:

- Kurs-Alarme
- Stop-Loss und Take-Profit deiner offenen Positionen
- Warnungen vor wichtigen Wirtschaftsterminen
- der BTC-Puls (ab Version 1.1)
- der Gewinn-/Verlust-Alarm am Live-Ergebnis (ab Version 1.2)

**Neu in Version 1.3:** Der Dienst prüft, ob Telegram jede Meldung angenommen hat. Wenn nicht, versucht er es erneut und zeigt eine Störung an, statt die Meldung stillschweigend als erledigt abzuhaken.

Der Dienst ist ein kleines Programm auf einem eigenen Server, der rund um die Uhr läuft. Bei Oracle Cloud gibt es dafür einen dauerhaft kostenlosen Server („Always Free“).

**Kosten:** 0 €. Oracle prüft bei der Anmeldung eine Kreditkarte, belastet sie aber nicht, solange du nur Always-Free-Angebote nutzt.
**Dauer:** etwa 20–30 Minuten.
**Du brauchst:**
- einen Computer oder ein iPad mit Browser,
- die App mit eingerichtetem Telegram („Kursalarm“),
- eine Kreditkarte für die Prüfung bei Oracle.

---

## Du hast den Dienst schon? Auf Version 2.0 aktualisieren (10 Minuten)

**Neu in Version 2.0 (zur App ab 3.33.0):** Die App steuert den Dienst direkt über eine gesicherte HTTPS-Adresse:
- **Chat-Schalter:** Kursalarm, Sicherung und Trades lassen sich in der App unter **🔔 Hinweise → „Telegram-Chats“** ein- und ausschalten. Ein Schalter gilt erst, wenn der Dienst ihn bestätigt hat, und auf allen Geräten gleich. AUS verwirft auch Meldungen, die noch warten.
- **Keine doppelten Alarme:** Jeder Alarm wird genau einmal gesendet – von der geöffneten App oder vom Dienst, je nachdem, wer ihn zuerst erkannt hat. Zwei offene Geräte bekommen nie beide die Freigabe.
- **Ehrliche Zustellung:** Geht die Antwort von Telegram verloren, steht „Zustellung unbestätigt“ da. Ein blinder zweiter Versuch, der doppelt zustellen könnte, unterbleibt.

Dafür braucht der Server zwei offene Ports (80 für das Zertifikat, 443 für die Steuerung). Den Rest erledigt der Installer: Er richtet **Caddy** ein, holt ein kostenloses Zertifikat für eine Adresse wie `130-61-1-2.sslip.io` (eigene Domain oder Konto nicht nötig) und öffnet die Firewall des Servers. Die Freigabe in der Oracle-Konsole machst du einmal selbst (Schritt 2).

Token, Chat und Einstellungen bleiben erhalten.

1. **Aktualisieren:** Auf [cloud.oracle.com](https://cloud.oracle.com) anmelden, die **Cloud Shell** öffnen (oben rechts unter „Developer tools“, Symbol `</>` bzw. `>_`) und mit dem Server verbinden. Ersetze `IP` durch die öffentliche IP deines Servers (Konsole → Compute → Instances → dein Server → „Public IP address“):
   ```
   ssh -i ssh-key-*.key ubuntu@IP
   curl -fsSL https://raw.githubusercontent.com/NicoAHB/wx-widget/main/server/install.sh | sudo bash
   ```
   Der Installer zeigt `2/7 Programm 2.0.0 …`, `5/7 Dienst läuft ✓` und dann `6/7 HTTPS-Steuerung für https://…sslip.io …`. Beim ersten Mal steht dort meist „Von außen noch nicht erreichbar“ – das ist Schritt 2.
2. **Ports in der Oracle-Konsole freigeben (einmalig):**
   1. Konsole → Menü ☰ → **Networking → Virtual cloud networks** → dein Netz (`vcn-…`).
   2. Reiter **„Security“** (in älteren Ansichten links „Security Lists“) → **„Default Security List for vcn-…“** → **„Add Ingress Rules“**.
   3. **Source CIDR** `0.0.0.0/0` · **IP Protocol** `TCP` · **Destination Port Range** `80,443` → **„Add Ingress Rules“**.
3. **Prüfen:** am Server
   ```
   sudo scalpdesk-247 https
   ```
   Nach höchstens einer halben Minute: `✓ https://…sslip.io erreichbar`, darunter **Adresse** und **Zugangsschlüssel**. Den Zugang zeigt jederzeit wieder: `sudo scalpdesk-247 zugang`.
4. **In der App eintragen:** **🔔 Hinweise → „Telegram / Discord einrichten“ → 🌙 24/7-Dienst** → „Adresse“ und „Zugangsschlüssel“ einfügen → **„Verbindung prüfen“**. Dort steht dann „✓ Verbunden · Dienst 2.0.0“. Auf jedem Gerät, auf dem du die App nutzt, einmal eintragen.
5. **Kontrolle:** `sudo scalpdesk-247 status` endet mit „Ergebnis: alles in Ordnung.“ und zeigt unter anderem `✓ Von außen erreichbar: https://…`, die Schalter (`Ziele (Revision …): Kursalarm an seit …`) und die letzten Ereignisse mit Ziel, Sender und Zustand.

**Den Schlüssel nicht weitergeben:** Wer ihn kennt, kann deine Chat-Schalter umstellen. Sicherungen, Trades und Telegram-Token gehen nie an den Dienst. Ohne HTTPS-Steuerung (wie bis 1.4) läuft alles weiter wie bisher: `… | sudo bash -s -- --ohne-https`.

<details><summary>Was die Versionen 1.2 bis 1.4 brachten</summary>

- **1.2:** Gewinn-/Verlust-Alarm bei geschlossener App.
- **1.3:** Prüft, ob Telegram jede Meldung angenommen hat; sonst neuer Versuch und „Störung“.
- **1.4:** Bestätigt jede neue Übergabe lautlos im Chat („✅ 24/7-Dienst hat übernommen …“). Findet er keine Datei der App, sagt er das im Protokoll und per Telegram – meist ist am Server ein anderer Bot oder eine andere Chat-ID eingetragen als in der App unter „Kursalarm“. `sudo scalpdesk-247 status` prüft den ganzen Weg.

</details>

---

## Neu einrichten

### Schritt 1 – Telegram in der App (falls noch nicht geschehen)

In der App unter **🔔 Hinweise → „Telegram / Discord einrichten“** im Bereich **Kursalarm** Bot-Token und Chat-ID eintragen und „Test senden“ tippen. Die Anleitung dafür steht direkt in der App.

Genau diese beiden Werte (Token und Chat-ID des **Kursalarm**-Bots) gibst du später am Server ein. Den Sicherungs-Bot brauchst du dafür nicht. Den Token zeigt dir in Telegram auch @BotFather mit `/mybots` → dein Bot → „API Token“.

### Schritt 2 – Oracle-Konto anlegen

1. Auf [oracle.com/cloud/free](https://www.oracle.com/cloud/free/) „Start for free“ wählen und das Formular ausfüllen.
2. **Heimatregion: „Germany Central (Frankfurt)“.**
   - Die Heimatregion lässt sich später nicht mehr ändern, und die kostenlosen Server gibt es nur dort.
   - Keine US-Region wählen: Von US-Servern aus sperrt Binance den Zugriff, dann funktionieren keine Kurs-Prüfungen.
3. Kreditkarte zur Prüfung angeben. Oracle reserviert eventuell einen kleinen Betrag und gibt ihn wieder frei.
4. Nach der Bestätigungs-E-Mail (kann einige Minuten dauern) auf [cloud.oracle.com](https://cloud.oracle.com) anmelden.

### Schritt 3 – Server anlegen

1. Auf der Startseite der Konsole **„Create a VM instance“** wählen (oder Menü ☰ → Compute → Instances → „Create instance“).
2. **Name:** zum Beispiel `scalpdesk`.
3. **Image:** auf „Change image“ tippen und **Canonical Ubuntu 24.04** wählen (nicht die „Minimal“-Variante). 22.04 geht auch.
4. **Shape:** eine Größe mit dem Hinweis **„Always Free-eligible“** wählen.
   - Empfohlen: **VM.Standard.E2.1.Micro** (unter „Change shape“ → „Virtual machine“ → „Specialty and previous generation“). Sie reicht für den Dienst völlig und ist fast immer verfügbar.
   - „VM.Standard.A1.Flex“ (Ampere) ist stärker, meldet aber oft „Out of capacity“.
5. **Netzwerk:** die Vorgaben lassen (neues virtuelles Netz mit öffentlichem Subnetz, „Assign a public IPv4 address“ eingeschaltet).
6. **SSH-Schlüssel:** „Generate a key pair for me“ wählen und **„Save private key“** tippen.
   - Diese Datei (`ssh-key-….key`) ist der Schlüssel zu deinem Server. Gut aufbewahren und nicht weitergeben.
   - Ohne sie kommst du nicht mehr auf den Server.
7. **Speicher (Boot volume):** Vorgabe lassen.
8. **„Create“** tippen.

Nach 1–2 Minuten steht der Server auf **„Running“**. Notiere die **„Public IP address“** auf der Seite des Servers, zum Beispiel `130.61.12.34`.

> Oracle ändert die Konsole gelegentlich. Reihenfolge und Aussehen der Felder können abweichen, die Begriffe bleiben meist gleich.

### Schritt 4 – Mit dem Server verbinden

Am einfachsten geht das mit der **Cloud Shell**, einem Terminal direkt im Browser. Sie funktioniert auch am iPad.

1. In der Konsole oben rechts „Developer tools“ (`</>`) → **„Cloud Shell“** öffnen. Unten erscheint ein schwarzes Fenster; der erste Start dauert etwa eine Minute.
2. Im Menü des Cloud-Shell-Fensters (Zahnrad bzw. ☰ oben links im Fenster) **„Upload“** wählen und die Schlüsseldatei aus Schritt 3 hochladen.
3. Diesen Befehl eingeben. Ersetze `IP` durch die öffentliche IP deines Servers:
   ```
   chmod 600 ssh-key-*.key && ssh -i ssh-key-*.key ubuntu@IP
   ```
4. Die Frage `Are you sure you want to continue connecting` mit **`yes`** beantworten.

Du bist auf dem Server, wenn die Eingabezeile mit `ubuntu@scalpdesk:~$` beginnt.

Alternativ geht es auch von deinem Computer aus: Am Mac im Programm „Terminal“, unter Windows in der „PowerShell“, jeweils mit demselben `ssh`-Befehl im Ordner, in dem die Schlüsseldatei liegt.

### Schritt 5 – Dienst installieren

Auf dem Server eingeben:

```
curl -fsSL https://raw.githubusercontent.com/NicoAHB/wx-widget/main/server/install.sh | sudo bash
```

Der Installer arbeitet sieben Schritte ab:

1. **Node.js** installieren (bei einem neuen Server 1–3 Minuten)
2. **Programm** laden: zeigt `Programm 2.0.0`
3. **Einstellungen** abfragen:
   - **Bot-Token:** einfügen und Enter. Die Eingabe bleibt aus Sicherheitsgründen unsichtbar.
   - **Chat-ID:** zum Beispiel `987654321`, bei Gruppen mit Minus davor
   - **Discord-Webhook:** optional, sonst einfach Enter
4. **Prüfung:** Bot, Chat und Binance. Dabei kommt in Telegram die Nachricht **„✅ Scalp Desk 24/7-Dienst ist eingerichtet …“**.
5. **Dienst starten:** `5/7 Dienst läuft ✓`
6. **HTTPS-Steuerung:** Caddy, Zertifikat für `…sslip.io`, Firewall des Servers. Beim ersten Mal steht dort meist „Von außen noch nicht erreichbar“: Dann die Ports wie in **[Auf Version 2.0 aktualisieren](#du-hast-den-dienst-schon-auf-version-20-aktualisieren-10-minuten)**, Schritt 2, in der Oracle-Konsole freigeben und `sudo scalpdesk-247 https` ausführen.
7. **Kurzbefehl** `sudo scalpdesk-247` anlegen.

Der Dienst startet ab jetzt mit dem Server und nach Fehlern von selbst neu. Du kannst das Cloud-Shell-Fenster schließen.

### Schritt 6 – In der App übergeben

1. In der App: **🔔 Hinweise → „Telegram / Discord einrichten“ → 🌙 24/7-Dienst** → **„An den 24/7-Dienst übergeben“** einschalten.
2. Nach höchstens einer Minute (meist 20–30 Sekunden) steht dort **„Übergeben ✓ vom Dienst bestätigt“**.
   - In Telegram kommt lautlos **„✅ 24/7-Dienst hat übernommen“** mit deinen Alarmen.
   - Oben im Chat ist **„📌 Scalp Desk · 24/7-Dienst“** angeheftet. **Diese Nachricht nicht löschen** – über sie tauschen App und Dienst den aktuellen Stand aus.
   - Bleibt es bei „wartet auf die Bestätigung“, siehe [Wenn etwas nicht klappt](#wenn-etwas-nicht-klappt).
3. Nur auf **einem** Gerät einschalten: dem, auf dem du Alarme und Positionen pflegst.
4. **Ab App 3.33.0:** Darunter „Adresse“ und „Zugangsschlüssel“ eintragen (`sudo scalpdesk-247 zugang`) und „Verbindung prüfen“ – auf jedem Gerät. Erst damit gibt es die Chat-Schalter mit Bestätigung und die Sendefreigabe gegen doppelte Alarme.

### Schritt 7 – Ausprobieren (empfohlen)

**Kurs-Alarm:**
1. In der App einen Alarm knapp über oder unter dem aktuellen Kurs setzen.
2. Die App schließen, auf allen Geräten.
3. Sobald der Kurs die Marke erreicht, kommt in Telegram der Alarm mit **„· 24/7-Dienst“** am Ende.

**Gewinn-/Verlust-Alarm** (braucht eine offene Position in der App):
1. Oben rechts auf das Live-Ergebnis **„Offen“** tippen.
2. Bei „Benachrichtigung bei Gewinn“ einen Betrag knapp über dem aktuellen Live-Ergebnis eintragen (oder bei „Verlust“ knapp darunter) und **„Speichern“** tippen. Darunter erscheint „✓ Auch bei geschlossener App …“.
3. Die App schließen.
4. Erreicht das Live-Ergebnis die Grenze, kommt etwa 10 Sekunden später zum Beispiel:
   ```
   📈 Gewinn-Alarm
   Live-Ergebnis +106,20 USDT (2 offene Positionen) · Schwelle ≥ +100,00 USDT erreicht
   14:32:05 Uhr · 24/7-Dienst
   ```
5. Öffnest du die App danach, steht die Grenze auf **„ausgelöst um … (Meldung vom 24/7-Dienst)“**. Es kommt keine zweite Nachricht. Mit **„Wieder aktivieren“** meldet sie sich erneut; der Dienst übernimmt das innerhalb einer Minute.

Bleibt die App dabei geöffnet, meldet sie die Grenze selbst, sofort und ohne „· 24/7-Dienst“ am Ende. Der Dienst schweigt dann (siehe unten).

---

## Gut zu wissen

**Was der Dienst von dir bekommt**
- Die App legt den Stand als Datei `scalpdesk-247.json` in deinen Telegram-Chat:
  - aktive Kurs-Alarme,
  - Stop-/Ziel-Marken offener Positionen,
  - Termin- und Puls-Einstellungen.
- **Einstiegskurse und Mengen** deiner offenen Positionen stehen nur darin, **solange ein Gewinn- oder Verlust-Alarm aktiv ist**. Der Dienst braucht sie, um das Live-Ergebnis zu rechnen.
- Trades, Notizen und deine Geldbewegungen bleiben in der App.
- Den Bot-Token gibst du nur am Server ein. Er steht in `/etc/scalpdesk-247.json`, lesbar nur für den Dienst. Die App schickt ihn weiterhin nur an Telegram.

**Wie oft der Dienst prüft**
- Alle **15 Sekunden**.
- **Kurs-Alarme** und Stop/Ziel prüft er mit den 1-Minuten-Kerzen von Binance. Auch kurze Dochte zählen.
- Den **Gewinn-/Verlust-Alarm** rechnet er mit dem jeweils aktuellen Kurs. Eine Spitze, die kürzer als 15 Sekunden dauert, kann er übersehen. Die geöffnete App prüft zusätzlich laufend.
- Erreicht das Ergebnis eine Grenze, wartet er etwa **10 Sekunden** und liest die Datei der App neu. Hat die geöffnete App die Grenze in der Zeit selbst gemeldet, schweigt er. Bei geschlossener App kommt seine Meldung also etwa 10 Sekunden nach dem Erreichen.
- Jede Grenze meldet er **einmal**. Danach erst wieder nach „Wieder aktivieren“ in der App.
- Das **Tages-Verlustlimit** meldet weiterhin nur die geöffnete App.

**Keine doppelten Nachrichten**
- **Kurs-Alarme, Stop/Ziel, Termin-Warnungen, BTC-Puls:** Solange der Dienst aktiv ist und den aktuellen Stand bestätigt hat, sendet die App sie nicht zusätzlich. Sie zeigt sie aber mit Ton und Hinweis an.
- **Gewinn-/Verlust-Alarm:** Ist die App geöffnet, meldet sie ihn selbst, sofort und auch bei kurzen Spitzen, und vermerkt das in ihrer Datei. Der Dienst meldet ihn nur, wenn die App das nicht getan hat, also vor allem bei geschlossener App.
- Meldet sich der Dienst 20 Minuten nicht, sendet die geöffnete App wieder selbst.
- Ein ausgelöster Kurs-Alarm bleibt noch 3 Minuten in der Datei. So meldet ihn der Dienst sicher, auch wenn die App ihn zuerst gesehen hat.

**Zustellung (ab Version 1.3)**
- Jede Meldung gilt erst als zugestellt, wenn Telegram sie angenommen hat. Sonst versucht der Dienst es erneut: nach 15 und 30 Sekunden, nach 1 und 2 Minuten, dann alle 5 Minuten, höchstens einen Tag lang. Das übersteht auch einen Neustart.
- Kommt eine Meldung über 2 Minuten zu spät an, trägt sie die Uhrzeit des Auslösens und den Vermerk „verspätet zugestellt um …“ mit dem Grund.
- Lehnt Telegram ab oder ist es länger als eine Minute nicht erreichbar, steht in der App „⚠ Der Dienst meldet eine Störung: Telegram-Nachricht nicht zustellbar seit …“. Die geöffnete App sendet dann wieder selbst. Eine Meldung kann so doppelt ankommen: sofort von der App, später verspätet vom Dienst.
- Unter „Status prüfen“ steht, wann der Dienst zuletzt etwas zugestellt hat und was.

**Ältere Dienste**
- Version 1.0 kennt den BTC-Puls nicht, Version 1.1 den Gewinn-/Verlust-Alarm nicht. Diese Meldungen sendet dann nur die geöffnete App.
- Version 1.2 prüft die Zustellung nicht: Lehnt Telegram eine Meldung ab, geht sie verloren, und der Dienst meldet weiter „aktiv“.
- Die App zeigt das unter „Status prüfen“ an. Abhilfe: [aktualisieren](#du-hast-den-dienst-schon-auf-version-13-aktualisieren-5-minuten).

---

## Oracle: den Server nicht „einschlafen“ lassen

Oracle darf kostenlose Server anhalten, die 7 Tage lang kaum ausgelastet sind (Prozessor und Netz unter 20 %). Der Dienst braucht sehr wenig, das kann also passieren. Du bekommst dann eine E-Mail von Oracle, und bis zum Neustart kommen bei geschlossener App keine Meldungen.

- **Dauerhafte Abhilfe:** Das Konto auf **„Pay As You Go“** umstellen (Konsole → ☰ → Billing & Cost Management → „Upgrade and Manage Payment“). Nach Oracles Regeln werden Always-Free-Server dann nicht mehr angehalten. Es bleibt kostenlos, solange du nur Always-Free-Angebote nutzt.
- **Zur Sicherheit:** Unter Billing & Cost Management → **Budgets** ein Budget von zum Beispiel 1 € mit E-Mail-Benachrichtigung anlegen. Dann merkst du sofort, falls doch etwas Kostenpflichtiges entsteht.
- **Ohne Umstellung:** Nach einer E-Mail von Oracle den Server in der Konsole (Compute → Instances → dein Server) mit **„Start“** wieder starten. Der Dienst startet mit.

---

## Befehle am Server

Zuerst wie in [Schritt 4](#schritt-4--mit-dem-server-verbinden) verbinden.

| Was | Befehl |
|---|---|
| Alles prüfen (ab 1.4): Bot, Chat, angeheftete Datei, Bestätigung, Alarme, Binance; ab 2.0 auch HTTPS-Steuerung, Schalter und letzte Ereignisse | `sudo scalpdesk-247 status` |
| Adresse und Zugangsschlüssel für die App (ab 2.0) | `sudo scalpdesk-247 zugang` |
| HTTPS-Steuerung erneut prüfen, z. B. nach dem Freigeben der Ports (ab 2.0) | `sudo scalpdesk-247 https` |
| Läuft der Dienst? | `systemctl status scalpdesk-247` |
| Protokoll: die letzten 60 Zeilen | `sudo scalpdesk-247 protokoll` |
| Protokoll live ansehen (beenden mit Strg+C) | `sudo scalpdesk-247 live` oder `journalctl -u scalpdesk-247 -f` |
| Deutsche Uhrzeit im Protokoll (einmalig) | `sudo timedatectl set-timezone Europe/Berlin` |
| Aktualisieren | den Installationsbefehl aus Schritt 5 erneut ausführen |
| Token/Chat neu eingeben | `curl -fsSL https://raw.githubusercontent.com/NicoAHB/wx-widget/main/server/install.sh \| sudo bash -s -- --neu` |
| Server neu starten | `sudo reboot` (der Dienst startet von selbst wieder) |
| Dienst entfernen | `sudo bash /opt/scalpdesk-247/install.sh --remove` |

Im Protokoll steht beim Start zum Beispiel `Scalp Desk 24/7-Dienst 2.0.0 gestartet · Bot @dein_bot (ID 123456789) · Chat 987654321 · …`. Danach folgt bei jeder Übergabe:

- `Übergabe erhalten: Nachricht #501 · App 01.10. 17:08 · Safari, iPhone · #ab12`
- `Alarme geladen: 1 Alarm, 0 Positionen – Kurs-Alarm BTC auf/über 65.000,00 USDT`
- `Kursprüfung: … noch 0,08 % entfernt`
- `Bestätigung eingetragen: …`

Löst etwas aus, kommen `Alarm ausgelöst: …` und `Telegram gesendet: …`. Alle 10 Minuten steht eine Übersicht („Lebenszeichen: aktiv · …“) im Protokoll. Ohne Datei der App steht dort alle 10 Minuten `Warte auf die Übergabe der App: …`, mit Bot und Chat-ID zum Vergleich.

---

## Wenn etwas nicht klappt

| Meldung / Problem | Lösung |
|---|---|
| „Out of capacity“ beim Anlegen | Andere Größe wählen (VM.Standard.E2.1.Micro) oder eine andere „Availability domain“ (AD-1/2/3) probieren. |
| VM.Standard.E2.1.Micro wird nicht angezeigt | Unter „Change shape“ → „Virtual machine“ → „Specialty and previous generation“ nachsehen. |
| `Permission denied (publickey)` | Falsche Schlüsseldatei oder falscher Benutzer: Bei Ubuntu heißt er `ubuntu`, bei Oracle Linux `opc`. Vorher `chmod 600 ssh-key-*.key`. |
| `Connection timed out` | IP prüfen und ob der Server auf „Running“ steht. |
| Installer: „Prüfung fehlgeschlagen“ | Die Zeilen darüber nennen den Grund. Falscher Token oder falsche Chat-ID: mit `--neu` neu eingeben (siehe Tabelle oben). |
| „chat not found“ | Dem Bot in Telegram einmal `/start` schreiben. In einer Gruppe muss der Bot Mitglied sein. |
| Binance nicht erreichbar | Läuft der Server in einer US-Region? Dann sperrt Binance. Ein neues Konto mit Heimatregion Frankfurt ist nötig. |
| App: „Anheften nicht erlaubt“ | In einer Gruppe braucht der Bot das Admin-Recht „Nachrichten anheften“. |
| App bleibt bei „… wartet auf den 24/7-Dienst“ / „wartet auf die Bestätigung“ oder zeigt „⚠ … hat nicht bestätigt“, obwohl der Dienst läuft | **Häufigste Ursache: Am Server steht ein anderer Bot oder eine andere Chat-ID als in der App unter „Kursalarm“**, zum Beispiel der Sicherungs-Bot. Jeder Bot hat seinen eigenen Chat und sieht die angeheftete Datei der App nicht. So prüfst du: `sudo scalpdesk-247 status`. Bei „✗ Keine Datei der App angeheftet“ nennt die Ausgabe den Bot des Servers; die App nennt ihren unter „wartet …“. Sind sie verschieden: Token und Chat-ID aus der App (Kursalarm) am Server neu eingeben mit `curl -fsSL https://raw.githubusercontent.com/NicoAHB/wx-widget/main/server/install.sh \| sudo bash -s -- --neu`. Der Dienst 1.4 schickt in diesem Fall nach 3 Minuten auch selbst „⏳ … wartet auf die Übergabe der App“ – in den Chat des am Server eingetragenen Bots. |
| App: „⚠ Der Dienst hat sich seit … nicht gemeldet“ | Am Server `systemctl status scalpdesk-247` prüfen. Steht er nicht auf „active (running)“, den Installationsbefehl erneut ausführen. Hat Oracle den Server angehalten: in der Konsole starten. |
| App: „⚠ Der Dienst meldet eine Störung: Kurse nicht abrufbar …“ | Der Server erreicht Binance nicht. Das Protokoll zeigt den Grund: `journalctl -u scalpdesk-247 -n 50`. |
| App: „⚠ Der Dienst meldet eine Störung: Telegram-Nachricht nicht zustellbar seit …“ | Telegram nimmt die Meldungen des Dienstes nicht an; der Grund steht in Klammern. „chat not found“: dem Bot `/start` schreiben bzw. ihn wieder in die Gruppe aufnehmen. „Unauthorized“: Token geändert – mit `--neu` neu eingeben (siehe Tabelle oben). War Telegram nur kurz nicht erreichbar, verschwindet die Störung mit der nächsten Zustellung von selbst; bis dahin sendet die geöffnete App. |
| App: „Der Dienst kann ihn erst ab Version 1.2“ oder „… prüft der Dienst erst ab Version 1.3“ | Dienst aktualisieren (siehe oben). |
| Installer bzw. `sudo scalpdesk-247 https`: „Von außen noch nicht erreichbar“ (ab 2.0) | Ports 80 und 443 in der Oracle-Konsole freigeben (siehe [Auf Version 2.0 aktualisieren](#du-hast-den-dienst-schon-auf-version-20-aktualisieren-10-minuten), Schritt 2). Danach `sudo scalpdesk-247 https`. Läuft Caddy? `sudo systemctl status caddy`. |
| App: „Zugangsschlüssel falsch“ (ab 2.0) | Mit `sudo scalpdesk-247 zugang` anzeigen und in der App neu einfügen (ohne Leerzeichen). |
| App: „Dienst nicht erreichbar“ bei „Verbindung prüfen“ (ab 2.0) | Adresse prüfen (`https://…sslip.io`, ohne Pfad). Am Server `sudo scalpdesk-247 status` – die Zeilen „Steuerung lauscht“ und „Von außen erreichbar“ nennen den Grund. |
| Protokoll: „Ereignis … · Ziel course-alert · Sender … · Zustellung unbestätigt“ (ab 2.0) | Telegram hat auf eine Meldung nicht geantwortet. Ob sie angekommen ist, siehst du im Chat. Der Dienst sendet sie bewusst nicht ein zweites Mal, damit sie nicht doppelt ankommt. |
| Angeheftete Nachricht gelöscht | In der App „An den 24/7-Dienst übergeben“ aus- und wieder einschalten; die App legt die Datei neu an. Sonst passiert das bei der nächsten Änderung von selbst. |

---

## Andere Rechner

Der Dienst läuft auf jedem Linux-Rechner mit Internet und systemd, zum Beispiel einem Raspberry Pi oder einem anderen Server. Dort genügt derselbe Installationsbefehl aus Schritt 5. Wichtig ist nur: Der Rechner steht nicht in den USA und ist rund um die Uhr an.
