# Scalp Desk – 24/7-Dienst bei Oracle einrichten

Diese Anleitung führt durch die komplette Einrichtung des 24/7-Dienstes (Version 2.3.0) auf einem kostenlosen Oracle-Server: Konto, Server, Installation, Übergabe in der App, HTTPS-Steuerung, Aktualisierung und Fehlerhilfe. Dauer beim ersten Mal: etwa 45 Minuten, davon viel Warten.

**Was der Dienst bringt:** Kurs-Alarme, Stop/Ziel, Gewinn-/Verlust-Alarme und der BTC-Puls kommen per Telegram auch dann, wenn die App auf allen Geräten geschlossen ist. Mit HTTPS-Steuerung kommt jeder Alarm genau einmal, die Chat-Schalter gelten auf allen Geräten, und das Muster-Archiv wird am Server gesichert.

**Wichtig:** Bot-Token, Zugangsschlüssel, Oracle-Passwort und die SSH-Schlüsseldatei gibst du niemandem weiter – auch keinem Chat-Assistenten.

## Teil A – Bereits eingerichtet? Nur aktualisieren

Läuft der Dienst schon, reichen diese Schritte:

1. Mit dem Server verbinden (Teil B, Schritt 4).
2. Aktualisieren:
   ```
   curl -fsSL https://raw.githubusercontent.com/NicoAHB/wx-widget/main/server/install.sh | sudo bash
   ```
3. Wenn noch nicht geschehen: HTTPS-Steuerung einrichten (Teil C).
4. Kontrolle: `sudo scalpdesk-247 status` endet mit „Ergebnis: alles in Ordnung.“

## Teil B – Neu einrichten

### Schritt 1 – Telegram in der App
1. In der App **🔔 Hinweise → „Telegram / Discord einrichten“** öffnen.
2. Im Bereich **Kursalarm** Bot-Token und Chat-ID eintragen und **„Test senden“** tippen. Die Anleitung zum Bot steht in der App.
3. Diese beiden Werte (Token und Chat-ID des Kursalarm-Bots) brauchst du gleich am Server. Den Token zeigt auch @BotFather mit `/mybots` → dein Bot → „API Token“.

### Schritt 2 – Oracle-Konto anlegen
1. Auf **oracle.com/cloud/free** „Start for free“ wählen und das Formular ausfüllen.
2. **Heimatregion: „Germany Central (Frankfurt)“** wählen. Sie lässt sich später nicht ändern.
3. Eine Kreditkarte wird zur Prüfung verlangt. Always-Free-Angebote kosten nichts.
4. Nach der Bestätigungs-E-Mail (kann einige Minuten dauern) auf **cloud.oracle.com** anmelden.

### Schritt 3 – Server anlegen
1. Konsole → Menü ☰ → **Compute → Instances → „Create instance“**.
2. **Name:** zum Beispiel `scalpdesk`.
3. **Image:** „Change image“ → **Canonical Ubuntu 24.04** (nicht „Minimal“). 22.04 geht auch.
4. **Shape:** eine Größe mit dem Hinweis **„Always Free-eligible“**.
5. **Netzwerk:** Vorgaben lassen (neues Netz mit öffentlichem Subnetz, „Assign a public IPv4 address“ an).
6. **SSH-Schlüssel:** „Generate a key pair for me“ → **„Save private key“**. Die Datei `ssh-key-….key` gut aufbewahren – ohne sie kommst du nicht auf den Server.
7. Speicher: Vorgabe lassen → **„Create“**.
8. Nach 1–2 Minuten steht der Server auf „Running“. Die **Public IP address** notieren.

### Schritt 4 – Mit dem Server verbinden
1. In der Konsole oben rechts „Developer tools“ (`</>`) → **„Cloud Shell“** öffnen. Unten erscheint ein schwarzes Fenster; der erste Start dauert etwa eine Minute.
2. Im Menü des Cloud-Shell-Fensters (Zahnrad bzw. ☰) **„Upload“** wählen und die Schlüsseldatei aus Schritt 3 hochladen (nur beim ersten Mal).
3. Verbinden – `IP` durch die öffentliche IP ersetzen:
   ```
   chmod 600 ssh-key-*.key && ssh -i ssh-key-*.key ubuntu@IP
   ```
4. Die Frage `Are you sure you want to continue connecting` mit **`yes`** beantworten.
5. Du bist auf dem Server, wenn die Zeile mit `ubuntu@scalpdesk:~$` beginnt.

### Schritt 5 – Dienst installieren
1. Auf dem Server eingeben:
   ```
   curl -fsSL https://raw.githubusercontent.com/NicoAHB/wx-widget/main/server/install.sh | sudo bash
   ```
2. Der Installer fragt:
   - **Bot-Token:** einfügen und Enter (die Eingabe bleibt unsichtbar).
   - **Chat-ID:** zum Beispiel `987654321`, bei Gruppen mit Minus davor.
   - **Discord-Webhook:** optional, sonst einfach Enter.
3. In Telegram kommt **„✅ Scalp Desk 24/7-Dienst ist eingerichtet …“**, danach zeigt der Installer **„Dienst läuft ✓“**.
4. Bei „HTTPS-Steuerung … Von außen noch nicht erreichbar“ weiter mit Teil C – das ist beim ersten Mal normal.

### Schritt 6 – In der App übergeben
1. In der App: **🔔 Hinweise → „Telegram / Discord einrichten“ → 🌙 24/7-Dienst** → **„An den 24/7-Dienst übergeben“** einschalten – nur auf **einem** Gerät (dem, auf dem du Alarme und Positionen pflegst).
2. Nach höchstens einer Minute steht dort **„Übergeben ✓ vom Dienst bestätigt“**. In Telegram kommt lautlos „✅ 24/7-Dienst hat übernommen“.
3. Oben im Telegram-Chat ist **„📌 Scalp Desk · 24/7-Dienst“** angeheftet. **Diese Nachricht nicht löschen** – über sie tauschen App und Dienst den Stand aus.

## Teil C – HTTPS-Steuerung einrichten

**Was du davon hast:**

- Jeder Alarm kommt **genau einmal**, auch wenn App, Dienst und mehrere Geräte gleichzeitig aktiv sind (Sendefreigabe).
- **Chat-Schalter gelten auf allen Geräten**, vom Dienst bestätigt (z. B. „Kursalarm“ oder „Chartmuster“ aus).
- Muster-Archiv mit Sicherung am Server, Chartmuster-Meldungen ohne Doppel, Alarm bei Kerzenschluss auch bei geschlossener App.

### Schritt 1 – Ports 80 und 443 freigeben (einmalig)
1. Oracle-Konsole → Menü ☰ → **Networking → Virtual cloud networks** → dein Netz `vcn-…`.
2. Reiter **„Security“** (ältere Ansicht: „Security Lists“) → **„Default Security List for vcn-…“** → **„Add Ingress Rules“**.
3. **Source CIDR** `0.0.0.0/0` · **IP Protocol** `TCP` · **Destination Port Range** `80,443` → **„Add Ingress Rules“**.

### Schritt 2 – HTTPS prüfen
1. Am Server (Cloud Shell, verbunden wie in Teil B, Schritt 4):
   ```
   sudo scalpdesk-247 https
   ```
2. Nach höchstens einer halben Minute: **„✓ https://…sslip.io erreichbar“**, darunter **Adresse** und **Zugangsschlüssel**.
3. Den Zugang zeigt jederzeit wieder:
   ```
   sudo scalpdesk-247 zugang
   ```

### Schritt 3 – In der App eintragen (auf jedem Gerät einmal)
1. **🔔 Hinweise → „Telegram / Discord einrichten“** → Bereich **„Steuerung über HTTPS“**.
2. **Adresse** einfügen, z. B. `https://130-61-1-2.sslip.io` (ohne Pfad, ohne Schrägstrich am Ende).
3. **Zugangsschlüssel** einfügen (43 Zeichen, ohne Leerzeichen).
4. **„Verbindung prüfen“** → es erscheint **„✓ Verbunden · Dienst 2.3.0 …“**.

### Schritt 4 – Kontrolle
```
sudo scalpdesk-247 status
```
Am Ende steht „Ergebnis: alles in Ordnung.“, darunter „✓ Von außen erreichbar“ und die Ziel-Schalter.

## Teil D – Optionale Ergänzungen

### Chartmuster-Chat
In der App unter **„Telegram / Discord einrichten“ → 📐 Chartmuster** eine eigene Chat-ID eintragen (Bot leer = derselbe wie Kursalarm). Gemeldet werden wichtige, frisch bestätigte Formationen aus „KI“, solange die App offen ist.

### Muster-Archiv auf einem zweiten Laufwerk sichern
Standard: Sicherung in `muster-sicherung/` neben dem Zustand. Für ein anderes Volume:

1. `sudo systemctl edit scalpdesk-247` und eintragen:
   ```
   [Service]
   Environment=SCALPDESK_PATTERN_BACKUP=/pfad/auf/anderem/volume
   ReadWritePaths=/pfad/auf/anderem/volume
   ```
2. `sudo systemctl restart scalpdesk-247`

### Server nicht „einschlafen“ lassen
Oracle darf kostenlose Server anhalten, die 7 Tage kaum ausgelastet sind.

- **Dauerhaft:** Konto auf **„Pay As You Go“** umstellen (☰ → Billing & Cost Management → „Upgrade and Manage Payment“). Always-Free-Server bleiben kostenlos und werden nicht mehr angehalten.
- **Zur Sicherheit:** unter Billing & Cost Management → **Budgets** ein Budget von z. B. 1 € mit E-Mail-Benachrichtigung anlegen.
- **Ohne Umstellung:** nach einer E-Mail von Oracle den Server unter Compute → Instances mit **„Start“** wieder starten; der Dienst startet mit.

## Teil E – Befehle am Server

| Zweck | Befehl |
|---|---|
| Alles prüfen | `sudo scalpdesk-247 status` |
| Adresse und Zugangsschlüssel | `sudo scalpdesk-247 zugang` |
| HTTPS erneut prüfen | `sudo scalpdesk-247 https` |
| Aktualisieren | Installationsbefehl aus Teil B, Schritt 5 erneut |
| Token/Chat neu eingeben | Installationsbefehl mit Zusatz `--neu` (siehe unten) |
| Dienst entfernen | `sudo bash /opt/scalpdesk-247/install.sh --remove` |

Token oder Chat-ID neu eingeben:

```
curl -fsSL https://raw.githubusercontent.com/NicoAHB/wx-widget/main/server/install.sh | sudo bash -s -- --neu
```

## Teil F – Wenn etwas nicht klappt

- **„Von außen noch nicht erreichbar“:** Ports 80 und 443 freigeben (Teil C, Schritt 1), dann `sudo scalpdesk-247 https`.
- **App: „Dienst nicht erreichbar“:** Adresse prüfen (`https://…sslip.io`, ohne Pfad); am Server `sudo scalpdesk-247 status`.
- **App: „Zugangsschlüssel falsch“:** mit `sudo scalpdesk-247 zugang` anzeigen und neu einfügen (ohne Leerzeichen).
- **App bleibt bei „wartet auf die Bestätigung“:** Am Server stehen meist ein anderer Bot oder eine andere Chat-ID als in der App unter „Kursalarm“. `sudo scalpdesk-247 status` nennt den Grund; neu eingeben mit `--neu` (Teil E).
- **Keine Alarme bei geschlossener App:** Läuft der Server (Oracle-Konsole „Running“)? Ist „An den 24/7-Dienst übergeben“ an? Ist der Schalter „Kursalarm“ in „💬 Telegram-Chats“ an?

## Teil G – Mit ChatGPT einrichten

ChatGPT kann sich **nicht selbst** auf deinen Oracle-Server oder in dein Oracle-Konto einloggen – und sollte es auch nicht: Dafür bräuchte es deine Passwörter und Schlüssel. ChatGPT kann dich aber Schritt für Schritt durch diese Anleitung führen und Fehlermeldungen erklären.

1. Diese Anleitung (PDF oder `docs/ORACLE-EINRICHTUNG.md`) in den Chat hochladen.
2. Diesen Text senden:
   ```
   Führe mich Schritt für Schritt durch diese Anleitung zur Einrichtung des Scalp-Desk-24/7-Dienstes bei Oracle.
   Gib mir immer nur einen Schritt, warte auf meine Rückmeldung und erkläre kurz, was ich sehen sollte.
   Wenn ich dir eine Ausgabe vom Server schicke, sag mir, ob sie in Ordnung ist und was als Nächstes kommt.
   Frag mich nie nach Passwörtern, Bot-Token, Zugangsschlüssel oder der SSH-Schlüsseldatei.
   Ich bin bei Teil … (A = nur aktualisieren, B = neu einrichten, C = nur HTTPS-Steuerung).
   ```
3. Ausgaben vom Server kannst du einfügen – **vorher Token und Zugangsschlüssel unkenntlich machen** (z. B. durch `***` ersetzen).
