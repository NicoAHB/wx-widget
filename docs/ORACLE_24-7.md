# Oracle: ausschließlich Chartmuster rund um die Uhr

Diese Anleitung ist für Safari auf iPad/iPhone geschrieben. Der neue Dienst `server/patterns-247.mjs` verwendet **dieselbe pat-1-Erkennung und dieselben Muster-IDs wie die App**: gerade bestätigte Formationen, Regelgüte mindestens 80 %, abgeschlossene Kerzen. Einzelkerzen, „in Bildung“, Sicherungen, persönliche Trades und echte Orders werden von diesem Dienst nicht gesendet. Der bestehende umfassende HTTPS-Dienst bleibt ein eigener, anderer Dienst.

## 1. Konto und kostenlose Grenzen

1. Öffne https://www.oracle.com/cloud/free/ und tippe **Start for free / Kostenlos starten**.
2. Registriere dich, bestätige die E-Mail und wähle als **Home Region / Heimatregion „Germany Central (Frankfurt)“**. Die Heimatregion lässt sich später nicht einfach wechseln.
3. Oracle verlangt in der Regel eine geeignete Kredit-/Debitkarte zur Identitätsprüfung. Eine vorübergehende Verifizierungsbuchung kann auftreten. Prüfe Oracles angezeigte Bedingungen; eine kostenlose Registrierung ist keine Zustimmung zu einem kostenpflichtigen Upgrade.
4. Öffne https://cloud.oracle.com/ und melde dich an. Wähle rechts oben Frankfurt.
5. Nutze nur Angebote, die in deiner Konsole **Always Free eligible** heißen. Wähle keine zusätzlichen kostenpflichtigen Volumes/Backups.

Stand der am **11.10.2026** geprüften [Oracle-Dokumentation](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm): bis zu zwei `VM.Standard.E2.1.Micro` (je 1 GB RAM, 1/8 OCPU). Für Ampere A1 nennt die aktuelle Seite **1.500 OCPU-Stunden und 9.000 GB-Stunden monatlich**, entsprechend **2 OCPU/12 GB** für Always-Free-Tenancies. Alte Anleitungen mit 4 OCPU/24 GB sind deshalb hier keine Zusage. Entscheidend sind deine aktuellen Grenzen unter **☰ → Governance & Administration → Limits, Quotas and Usage** sowie die „Always Free“-Kennzeichnung vor dem Erstellen.

## 2. SSH-Schlüssel und VM erstellen

1. Tippe rechts oben auf das **Terminal-Symbol → Cloud Shell**. Es öffnet sich ein Terminal im Browser. Wähle die Heimatregion Frankfurt.
2. Erzeuge einen Schlüssel. Der private Schlüssel bleibt in Cloud Shell; gib ihn niemandem weiter:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/scalpdesk-oracle -C scalpdesk-oracle
cat ~/.ssh/scalpdesk-oracle.pub
```

Beim ersten Befehl kannst du eine eigene Passphrase wählen. Beim zweiten wird ausschließlich der **öffentliche** Schlüssel angezeigt. Kopiere die komplette Zeile, die mit `ssh-ed25519` beginnt.

3. Öffne **☰ → Compute → Instances → Create instance**. Name: `scalpdesk-patterns`.
4. **Image and shape → Change image → Ubuntu → Canonical Ubuntu 24.04**. **Change shape → Ampere → VM.Standard.A1.Flex**, beispielsweise **1 OCPU, 6 GB**; nur erstellen, wenn als Always Free gekennzeichnet und innerhalb deines Restkontingents.
5. Bei **Out of capacity**: anderes verfügbares Availability Domain versuchen. Alternativ **AMD → VM.Standard.E2.1.Micro** (1 GB, Always Free) wählen; bei Bedarf warten. Keine kostenpflichtige Shape als automatische Ausweichlösung wählen.
6. **Networking**: neues Virtual Cloud Network und öffentliches Subnetz erstellen; **Assign a public IPv4 address** einschalten. Ein Internet Gateway/Standardroute muss vorhanden sein; der Assistent erstellt sie normalerweise.
7. **Add SSH keys → Paste public keys**: die kopierte `ssh-ed25519`-Zeile einsetzen. **Create**. Warte auf **Running** und notiere **Public IP address**.
8. Auf der Instanzseite: **Primary VNIC → Subnet → Security Lists → Default Security List → Ingress Rules**. Für TCP braucht dieser Dienst nur **Destination port 22**. Am besten deine eigene IP als Quelle `/32`; für Cloud Shell mit wechselnder Adresse ggf. eine passende Quelle bzw. vorübergehend `0.0.0.0/0`. SSH bleibt mit Schlüssel gesichert. Öffne **keine** Ports 80, 443 oder 8247 für diesen Dienst. Ausgehend müssen DNS und HTTPS zu GitHub, Binance und Telegram möglich sein (Standard-Egress normalerweise vorhanden).

## 3. Vom iPad verbinden und Node installieren

Cloud Shell hat nicht automatisch öffentliches Internet. Im Cloud-Shell-Bereich **Network / Netzwerk → Public Network** wählen. Fehlt das, benötigt der Kontoadministrator unter **☰ → Identity & Security → Policies → Create Policy** eine Richtlinie für die tatsächlich vorhandene Administratorgruppe, zum Beispiel:

```text
allow group Administrators to use cloud-shell-public-network in tenancy
```

Bei Identity Domains die tatsächliche Gruppe mit Domain verwenden (zum Beispiel `'Default'/'Administrators'`). Anschließend **Cloud Shell → Actions → Restart** und Public Network erneut wählen. Oracle weist darauf hin, dass Änderungen sonst bis zu 24 Stunden brauchen können. [Offizielle Netzwerk-Anleitung](https://docs.oracle.com/en-us/iaas/Content/API/Concepts/cloudshellintro_topic-Cloud_Shell_Networking.htm).

Ersetze `DEINE_VM_IP` in den folgenden Befehlen durch die öffentliche VM-IP. Diese Platzhalter sind keine Zugangsdaten.

```bash
ssh -i ~/.ssh/scalpdesk-oracle ubuntu@DEINE_VM_IP
```

Die Server-Fingerabdruckfrage beim ersten Verbindungsaufbau bestätigen, nachdem die Adresse geprüft ist. Ab jetzt werden Befehle **in der VM** ausgeführt:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl git
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/scalpdesk-node-setup.sh
sudo bash /tmp/scalpdesk-node-setup.sh
sudo apt install -y nodejs
node --version
sudo timedatectl set-timezone Europe/Berlin
```

`node --version` muss `v22…` oder neuer anzeigen. TLS-/APT-Signaturprüfung nicht abschalten. Alternativ nutze eine SSH-App wie Termius oder Blink: Host = VM-IP, Benutzer = `ubuntu`, Port = `22`, den eigenen privaten SSH-Schlüssel sicher importieren. Den öffentlichen `.pub`-Schlüssel kann die App nicht zum Anmelden benutzen. Bewahre einen sicheren Schlüssel-Backup auf; Cloud-Shell-Heimatregion-Speicher kann nach langer Nichtbenutzung gelöscht werden.

## 4. App-Auswahl und Server-Einrichtung

### In der App

1. Richte im Dialog **Alarme aufs Smartphone → Chartmuster** den gewünschten Bot/Chat ein. Starte jeden benutzten Bot zuerst in Telegram mit **Start**. Ein eigener Muster-Token ist optional; auf dem Server wird der tatsächlich verwendete Token benötigt.
2. Wähle oben die gewünschten Coins und den Zeitraum der Vorauswahl. Warte, bis die Kacheln geladen sind.
3. Öffne **Oracle: nur Chartmuster, ohne HTTPS-Steuerung → Coin-Auswahl für Oracle herunterladen**. Speichere `scalpdesk-patterns-watch.json` in Dateien. Der Export enthält **keinen Token und keine Chat-ID**. Er übernimmt Spot/Futures und das Intervall der vorhandenen Vorauswahl.
4. Ein bisheriger Muster-Dienst muss zuerst gestoppt bzw. dessen Ziel **Chartmuster** ausgeschaltet werden. Danach aktiviere **Oracle ist der einzige Mustersender** auf **jedem App-Gerät**, das du benutzt. Damit sendet die offene App keine zusätzlichen Muster-Meldungen. Die Option allein startet keine VM.

### In Cloud Shell: Auswahl hochladen

Öffne **Cloud Shell → Actions → Upload**, wähle die gespeicherte JSON-Datei und bestätige **Upload**. Verlasse ggf. die SSH-Verbindung mit `exit`, damit du in **Cloud Shell** bist. Übertrage die Datei:

```bash
scp -i ~/.ssh/scalpdesk-oracle ~/scalpdesk-patterns-watch.json ubuntu@DEINE_VM_IP:~/scalpdesk-patterns-watch.json
ssh -i ~/.ssh/scalpdesk-oracle ubuntu@DEINE_VM_IP
```

### In der VM: Programm und private .env-Datei

```bash
sudo git clone https://github.com/NicoAHB/wx-widget.git /opt/scalpdesk-patterns
sudo useradd --system --home /var/lib/scalpdesk-patterns --shell /usr/sbin/nologin scalpdesk-patterns
sudo install -d -o scalpdesk-patterns -g scalpdesk-patterns -m 700 /var/lib/scalpdesk-patterns /var/log/scalpdesk-patterns
sudo install -o scalpdesk-patterns -g scalpdesk-patterns -m 600 ~/scalpdesk-patterns-watch.json /etc/scalpdesk-patterns-watch.json
```

Falls der Dienstbenutzer bereits existiert, überspringe ausschließlich `useradd`. Die Coins-Datei kann jederzeit erneut mit `install` ersetzt werden.

Die nächsten Befehle fragen die Geheimnisse **unsichtbar** ab; sie stehen dadurch nicht als eingegebener Befehl im Shell-Verlauf. Den tatsächlichen Token bei BotFather und die Chat-ID aus deinen Telegram-Einstellungen verwenden. Niemals hier im Chat oder GitHub posten.

```bash
read -rsp 'Chartmuster-Bot-Token: ' scalp_pattern_token; echo
read -rsp 'Chartmuster-Chat-ID: ' scalp_pattern_chat; echo
read -rp 'Thema-ID (leer ohne Thema): ' scalp_pattern_thread
sudo install -o scalpdesk-patterns -g scalpdesk-patterns -m 600 /dev/null /etc/scalpdesk-patterns.env
printf 'PATTERN_BOT_TOKEN=%s\nPATTERN_CHAT_ID=%s\nPATTERN_THREAD_ID=%s\n' "$scalp_pattern_token" "$scalp_pattern_chat" "$scalp_pattern_thread" | sudo tee /etc/scalpdesk-patterns.env >/dev/null
unset scalp_pattern_token scalp_pattern_chat scalp_pattern_thread
sudo install -m 644 /opt/scalpdesk-patterns/server/scalpdesk-patterns.service /etc/systemd/system/scalpdesk-patterns.service
sudo systemctl daemon-reload
```

Die echten Werte stehen ausschließlich in `/etc/scalpdesk-patterns.env`, außerhalb des Git-Repos, nur für den Dienstbenutzer lesbar. Keine .env-Datei in Git aufnehmen und nicht mit `cat` in ein geteiltes Terminal ausgeben.

## 5. Test, Autostart und App schließen

```bash
sudo -u scalpdesk-patterns /usr/bin/node /opt/scalpdesk-patterns/server/patterns-247.mjs --test
sudo systemctl enable --now scalpdesk-patterns
sudo systemctl status scalpdesk-patterns --no-pager
sudo tail -n 30 /var/log/scalpdesk-patterns/service.log
```

Zuerst muss **„CHARTMUSTER · Test erfolgreich“** im richtigen Muster-Bot/Chat ankommen. Danach muss der Status **active (running)** zeigen. `enable` richtet Autostart ein; bei einem Absturz startet systemd nach 10 Sekunden neu. Europe/Berlin ist im Dienst ausdrücklich gesetzt.

Schließe anschließend die App komplett. Der Server prüft weiter. Ein echtes Muster kommt **erst**, wenn eine neue Formation mit mindestens 80 % Regelgüte bestätigt wird; ausbleibende Meldungen während eines Tests sind kein Beweis für einen Fehler. Es werden keine alten Muster nach dem Erststart nachgesendet. Die Datei `state.json` enthält Muster-IDs und Versandstatus, keine Telegram-Geheimnisse. Sie verhindert Wiederholungen nach Neustart. Bei einer verlorenen Antwort bleibt „unbestätigt“ stehen, statt eine mögliche Doppelmeldung zu senden. Für die exklusive Zustellung muss der Oracle-Modus auf allen parallel verwendeten App-Geräten aktiv sein; ein zweiter unabhängig installierter Dienst darf nicht gleichzeitig denselben Chat beliefern.

## 6. Updates, Logs, neue Coins und Stoppen

Update in der VM:

```bash
sudo systemctl stop scalpdesk-patterns
sudo git -C /opt/scalpdesk-patterns pull --ff-only
sudo systemctl restart scalpdesk-patterns
sudo systemctl status scalpdesk-patterns --no-pager
```

Nach einem Update des Unit-Files erneut `sudo install …` und `sudo systemctl daemon-reload` aus Abschnitt 4 ausführen. Coin-Auswahl ändern: erneut exportieren/hochladen, mit `sudo install -o scalpdesk-patterns -g scalpdesk-patterns -m 600 … /etc/scalpdesk-patterns-watch.json` ersetzen und den Dienst neu starten. Neu übernommene Einstellungen gelten ab diesem Zeitpunkt; keine historischen Alarmwellen.

### Qualitätsfilter (ab Musterdienst 1.1.0, App 3.69.0)

Seit 1.1.0 meldet der Dienst nur noch Chartmuster, die den Qualitätsfilter bestehen: K.O.-Kriterien, Signalscore ≥ 70, Anti-Spam. Beschreibung: [CHARTMUSTER-QUALITAETSFILTER.md](CHARTMUSTER-QUALITAETSFILTER.md).
- **Schwellen:** in der App einstellen (Telegram einrichten → Chartmuster → Qualitätsfilter). Danach die Coin-Auswahl **neu exportieren** und wie oben ersetzen; die Datei enthält das Feld `filter`. Eine ältere Datei ohne `filter` gilt mit dem Preset „Normal“.
- **Gefilterte Signale** gehen nicht an Telegram. Sie stehen im Protokoll als „Chartmuster gefiltert: Coin · Zeitrahmen · Muster · Score – Grund“, gesendete als „Chartmuster gesendet: …“.
- **Statistik** je Muster, Zeitrahmen und Coin (Signale, gesendet, gefiltert, Ziel, Ungültig, Timeout nach 48 Kerzen):

```bash
sudo -u scalpdesk-patterns /usr/bin/node /opt/scalpdesk-patterns/server/patterns-247.mjs --statistik
```

Nach dem Update auf 1.1.0 ist ein Neustart nötig (Befehle oben). Der Testbefehl `--test` nennt Preset, Mindestscore und Chance/Risiko.

```bash
sudo tail -f /var/log/scalpdesk-patterns/service.log
sudo journalctl -u scalpdesk-patterns -n 50 --no-pager
sudo systemctl stop scalpdesk-patterns
sudo systemctl disable scalpdesk-patterns
```

`tail -f` mit **Strg+C** beenden (in einer SSH-App ggf. die Ctrl-Taste einblenden). `stop` hält jetzt an, `disable` verhindert den nächsten Autostart. Erst **nach** dem Stoppen den Oracle-Schalter in der App deaktivieren, wenn wieder die App Muster senden soll.

Logrotation einrichten, damit der Speicher nicht voll wird:

```bash
sudo tee /etc/logrotate.d/scalpdesk-patterns >/dev/null <<'EOF'
/var/log/scalpdesk-patterns/service.log {
  weekly
  rotate 4
  compress
  missingok
  notifempty
  copytruncate
  su scalpdesk-patterns scalpdesk-patterns
}
EOF
```

## 7. Häufige Fehler und Rücknahme kostenloser VMs

- **SSH Permission denied:** Benutzer `ubuntu`, richtige VM-IP, zum hinterlegten öffentlichen Schlüssel passender privater Schlüssel; Passphrase korrekt.
- **SSH Timeout:** VM Running, öffentlicher IPv4-Zugang/Internet Gateway/Route vorhanden, Security List bzw. Network Security Group erlaubt TCP 22 von deiner Quelle. Bei Cloud Shell Public Network und dessen Richtlinie prüfen.
- **Unauthorized / HTTP 401:** Token in der .env-Datei falsch; erneut unsichtbar eingeben, Dienst neu starten. **400/403:** Bot in Telegram starten, Chat-/Thema-ID prüfen, bei Gruppen Schreibberechtigung erteilen. Identische private Chat-IDs für unterschiedliche Bots sind erlaubt.
- **Test kommt im Kursalarm an:** Server-.env auf den tatsächlich gewünschten Muster-Bot und Muster-Chat einstellen. Der Server liest keine Bot-Fallbacks aus der App und kopiert keine Chat-ID in deren Felder.
- **Keine Muster:** Testnachricht und Running-Status prüfen; Coinliste korrekt, Kerzen erreichbar? Die 80-%-Grenze und neue Bestätigung müssen erfüllt sein. Nicht allein wegen ausbleibender Trades echte Orders hinzufügen.
- **Binance blockiert/rate-limited:** Logs zeigen pausierte Kerzenprüfung; erneuter Versuch nach einer Minute. Spot verwendet vorhandene öffentliche Binance-Fallbacks; Futures hat seine eigene API. Das ist kein Grund, Schlüssel ins Repo einzutragen.
- **Beschädigter Zustand / Speicher voll:** Dienst stoppen, Datei und Logs separat sichern, Speicherproblem beheben. `state.json` nicht blind löschen: sonst geht der dauerhafte Duplikat-Nachweis verloren.
- **Doppelmeldungen:** Nur ein Muster-Dienst, Oracle-Schalter auf allen geöffneten App-Geräten. Den bisherigen umfassenden Dienst nicht parallel für dieselben Muster aktiv lassen.

Oracle darf **wenig genutzte Always-Free-VMs zurücknehmen**. Nach aktueller offizieller Seite gilt eine Instanz als idle, wenn über **7 Tage alle** Bedingungen erfüllt sind: CPU-Auslastung im 95. Perzentil unter 20 %, Netzwerknutzung unter 20 %; bei **A1 zusätzlich** Speichernutzung unter 20 %. Der kleine Chartmusterdienst kann darunter liegen. Ein Lebenszeichen oder ein laufender systemd-Dienst verhindert das **nicht garantiert**.

Prüfe **Compute → Instances → deine VM → Metrics** und E-Mails von Oracle. Nutze eine passend kleine VM für die tatsächliche Arbeit. Sichere die Coin-Auswahl, die private .env-Datei und `/var/lib/scalpdesk-patterns` unabhängig und verschlüsselt, damit du bei Rücknahme auf einer neuen VM wiederherstellen kannst. **Keine künstlichen CPU-/Netzwerk-Lastschleifen** erzeugen. Wenn ununterbrochene Verfügbarkeit entscheidend ist, nutze eine bewusst kostenpflichtige passende VM oder einen Anbieter mit zugesicherter Verfügbarkeit; prüfe Gebühren/Quoten vorher. Ein Pay-As-You-Go-Upgrade allein wird hier nicht als garantierter Schutz vor Rücknahme versprochen. Die Always-Free-Dokumentation nennt dafür keine solche Garantie.

Die reale Oracle-/Telegram-Einrichtung und der Test bei geschlossener App können erst mit deiner eigenen VM durchgeführt werden. Repository- und lokale Tests ersetzen diesen privaten Abnahmeschritt nicht.
