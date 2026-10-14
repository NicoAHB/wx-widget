# ChatGPT richtet mit dir Oracle ein – Chartmuster-Karten, 24/7-Dienst, monatliche Bereinigung

Mit dieser Anleitung führt dich ChatGPT Schritt für Schritt durch die Einrichtung auf deinem kostenlosen Oracle-Cloud-Server, auch vom iPad oder iPhone aus.

**Wichtig vorab:**

- **ChatGPT hat keinen Zugang zu deinem Server.** Du tippst bzw. kopierst die Befehle selbst, in die Oracle **Cloud Shell** oder eine SSH-App. ChatGPT erklärt jeden Schritt, prüft die Ausgabe, die du zurückkopierst, und hilft bei Fehlern.
- **Gib ChatGPT niemals** dein Bot-Token, deine Chat-IDs, den Zugangsschlüssel des 24/7-Dienstes, Börsenzugänge oder private SSH-Schlüssel.
  - Die Befehle fragen Token und Chat-ID **unsichtbar** direkt am Server ab.
  - Fragt ChatGPT danach, antworte: „Nein, das gebe ich nur am Server ein.“
- Alles ist **kostenlos**: Oracle „Always Free“, Node.js, die Schrift (fonts-inter) und der Kartenrenderer (resvg). Wähle bei Oracle nur Angebote mit „Always Free eligible“.

## Was eingerichtet wird

| Baustein | Wozu | Server-Programm |
|---|---|---|
| **Oracle-Musterdienst** | sendet Chartmuster als **Trading-Karte** (Bild) an deinen Muster-Chat, auch wenn die App zu ist | `server/patterns-247.mjs` (Dienst `scalpdesk-patterns`) |
| **Monatliche Bereinigung** | löscht am 1. jedes Monats um 03:00 Uhr die gespeicherten Daten bereits gesendeter Nachrichten auf dem Server; die Nachrichten im Telegram-Chat bleiben | Timer `scalpdesk-patterns-bereinigung` |
| **24/7-Dienst** (optional) | Kurs-Alarme, Stop/Ziel, Termine, BTC-Puls … bei geschlossener App; Chartmuster ebenfalls als Karte | `server/scalpdesk-247.mjs` (Installer `install.sh`) |

Musterdienst und 24/7-Dienst dürfen **nicht gleichzeitig denselben Muster-Chat** beliefern, sonst kommt jedes Muster doppelt. Entweder der Musterdienst sendet die Chartmuster (in der App „Oracle ist der einzige Mustersender“ einschalten) oder der 24/7-Dienst (Ziel „Chartmuster“ in der App).

## So startest du

1. **ChatGPT öffnen.** Am besten ein Modell mit Internet bzw. GitHub-Zugriff.
   - Mit verbundener **GitHub-App** (Einstellungen → Apps/Connectors → GitHub, Repository `NicoAHB/wx-widget` freigeben) liest ChatGPT die Anleitungen direkt.
   - Ohne Verbindung den Link der jeweiligen Anleitung in den Chat geben oder ihren Text hineinkopieren.
2. **Vorbereiten:**
   - In der App die Coin-Auswahl für Oracle herunterladen: Alarme aufs Smartphone → Chartmuster → **„Coin-Auswahl für Oracle herunterladen“**.
   - Den Muster-Bot in Telegram einmal mit **Start** anschreiben.
3. **Starttext unten** als erste Nachricht in ChatGPT einfügen.
4. **Den Anweisungen folgen:**
   - Nach jedem Befehl die Ausgabe zurück in den Chat kopieren.
   - Bitte vorher Token-ähnliche Zeichenfolgen schwärzen. Die Programme selbst geben keine aus.

## Starttext für ChatGPT

```
Du bist mein Einrichtungs-Assistent für meinen kostenlosen Oracle-Cloud-Server (Always Free, Ubuntu). Ziel:
1) den Oracle-Musterdienst einrichten bzw. aktualisieren, der Chartmuster als Trading-Karte (PNG) an meinen Telegram-Muster-Chat sendet,
2) die monatliche Bereinigung gesendeter Nachrichten (systemd-Timer, 1. des Monats 03:00 Europe/Berlin) einrichten,
3) optional den 24/7-Dienst installieren bzw. aktualisieren (ebenfalls mit Trading-Karten).

Maßgeblich sind diese Anleitungen im Repository NicoAHB/wx-widget (Branch main) – lies sie zuerst vollständig:
- https://github.com/NicoAHB/wx-widget/blob/main/docs/ORACLE_24-7.md (Musterdienst: Abschnitte 1–7, besonders 6 „Trading-Karten“ und „Monatliche Bereinigung“)
- https://github.com/NicoAHB/wx-widget/blob/main/server/ANLEITUNG-ORACLE.md und https://github.com/NicoAHB/wx-widget/blob/main/server/README.md (24/7-Dienst)
- https://github.com/NicoAHB/wx-widget/blob/main/ANLEITUNG-CHATGPT-ORACLE.md (diese Regeln und Prüfpunkte)
Erfinde keine Befehle, die dort nicht stehen; wenn sich ein Menü bei Oracle anders nennt, beschreibe den sinngemäßen Eintrag.

Regeln:
- Du hast keinen Zugang zum Server. Gib mir immer genau EINEN Schritt (Befehlsblock zum Kopieren + was ich danach sehen sollte),
  warte auf meine Ausgabe, prüfe sie und erkläre Fehler, bevor es weitergeht.
- Frage mich NIE nach Bot-Token, Chat-ID, Zugangsschlüssel, Börsenzugängen oder privaten Schlüsseln. Diese gebe ich ausschließlich
  am Server in die unsichtbaren Eingaben (read -rsp) bzw. in den Installer ein. Sollte ich dir versehentlich etwas Geheimes schicken,
  sag mir, dass ich es in Telegram/BotFather neu erzeugen soll.
- Nur Always-Free-Angebote verwenden; keine kostenpflichtigen Volumes, Backups oder Shapes vorschlagen.
- Ich nutze ein iPad/iPhone: Befehle kurz halten, Cloud Shell oder SSH-App (z. B. Termius) erklären, wenn ich danach frage.
- Halte dich an die Prüfpunkte aus ANLEITUNG-CHATGPT-ORACLE.md und bestätige jeden erreichten Prüfpunkt ausdrücklich.

Beginne mit Frage 1: Habe ich schon eine Oracle-VM mit dem Musterdienst (dann aktualisieren) oder fange ich neu an (dann VM anlegen)?
Und Frage 2: Soll zusätzlich der 24/7-Dienst laufen – und wer sendet die Chartmuster (Musterdienst oder 24/7-Dienst)?
```

## Prüfpunkte (für dich und ChatGPT)

Nach jedem Teil muss die genannte Ausgabe erscheinen. Erst dann geht es weiter.

### A. Server bereit

| Prüfpunkt | Befehl | Erwartet |
|---|---|---|
| VM läuft, SSH klappt | `ssh … ubuntu@DEINE_VM_IP` | Eingabeaufforderung `ubuntu@…:~$` |
| Zeitzone | `timedatectl` | `Time zone: Europe/Berlin` |
| Node.js | `node --version` | `v22…` oder neuer |

### B. Oracle-Musterdienst mit Trading-Karten

| Prüfpunkt | Befehl (Kurzform; vollständig in `docs/ORACLE_24-7.md`) | Erwartet |
|---|---|---|
| Programm aktuell | `sudo git -C /opt/scalpdesk-patterns pull --ff-only` (Neu: `git clone …`) | `Already up to date.` oder Liste geänderter Dateien |
| Schrift und Renderer | `sudo apt-get install -y fonts-inter fonts-dejavu-core` und `cd /opt/scalpdesk-patterns/server && sudo npm ci --omit=dev --no-audit --no-fund` | `added … packages` ohne Fehler |
| Beispielkarte | `sudo -u scalpdesk-patterns /usr/bin/node /opt/scalpdesk-patterns/server/patterns-247.mjs --karte-beispiel /var/lib/scalpdesk-patterns/karte-beispiel.png` | `Beispielkarte 1024 × 1536 gespeichert: …` |
| Zugangsdaten (nur bei Neueinrichtung) | die `read`-Zeilen (Token und Chat-ID unsichtbar, Thema-ID sichtbar) und `printf … \| sudo tee /etc/scalpdesk-patterns.env` aus Abschnitt 4 | keine Ausgabe (die Eingaben sind unsichtbar) |
| Testnachricht | `sudo -u scalpdesk-patterns /usr/bin/node /opt/scalpdesk-patterns/server/patterns-247.mjs --test` | `Testnachricht zugestellt` und im Muster-Chat „CHARTMUSTER · Test erfolgreich“ |
| Dienst läuft | `sudo systemctl restart scalpdesk-patterns && sudo systemctl status scalpdesk-patterns --no-pager` | `active (running)` |
| Startzeile | `sudo tail -n 5 /var/log/scalpdesk-patterns/service.log` | `Chartmusterdienst 1.2.0 gestartet … Meldungen als Trading-Karte (Text als Ersatz)` |

Steht in der Startzeile „Text – Kartenrenderer fehlt“, fehlt der Schritt „Schrift und Renderer“. Der Dienst sendet dann trotzdem, nur als Text.

### C. Monatliche Bereinigung

| Prüfpunkt | Befehl | Erwartet |
|---|---|---|
| Timer installiert | `sudo install -m 644 /opt/scalpdesk-patterns/server/scalpdesk-patterns-bereinigung.{service,timer} /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now scalpdesk-patterns-bereinigung.timer` | keine Fehlermeldung |
| Nächster Termin | `systemctl list-timers scalpdesk-patterns-bereinigung.timer --no-pager` | `NEXT` am 1. des nächsten Monats, 03:00 deutscher Zeit (in UTC 01:00 im Sommer bzw. 02:00 im Winter) |
| Probelauf (ändert nichts) | `sudo -u scalpdesk-patterns /usr/bin/node /opt/scalpdesk-patterns/server/patterns-247.mjs --probelauf` | `Probelauf – nichts gelöscht. Stichtag: 01.MM.JJJJ, 00:00 Uhr (Europe/Berlin)` und Anzahlen, **keine** Nachrichteninhalte |
| Optional: sofort bereinigen | `sudo systemctl start scalpdesk-patterns-bereinigung.service && sudo tail -n 5 /var/log/scalpdesk-patterns/bereinigung.log` | `Bereinigung abgeschlossen …`; danach läuft der Musterdienst wieder (`active (running)`) |

Gelöscht wird nur, was **vor dem Monatsbeginn nachweislich gesendet** wurde. Wartende, unbestätigte und abgelehnte Nachrichten bleiben, ebenso Zugangsdaten, Coin-Auswahl, Lernbestand und Statistik. Die Nachrichten in Telegram bleiben. Backups, die du selbst bei Oracle angelegt hast, werden nicht bereinigt.

### D. 24/7-Dienst mit Trading-Karten (optional)

| Prüfpunkt | Befehl | Erwartet |
|---|---|---|
| Installieren/aktualisieren | `curl -fsSL https://raw.githubusercontent.com/NicoAHB/wx-widget/main/server/install.sh \| sudo bash` | Schritte 1/7 bis 7/7 mit ✓, dazu die Zeile `Chartmuster als Trading-Karte (Bild)` |
| Status | `sudo scalpdesk-247 status` | `✓ Bot … Token gültig`, `• Chartmuster: als Trading-Karte (Bild), Text als Ersatz` |
| Zugang für die App | `sudo scalpdesk-247 zugang` | Adresse und Zugangsschlüssel. Den Schlüssel **nur in die App** eintragen, nicht in ChatGPT. |

Steht dort „als Text (resvg konnte nicht geladen werden …)“, den Installer später noch einmal ausführen. Bis dahin kommen die Chartmuster als Text.

## Häufige Probleme

| Meldung | Bedeutung | Abhilfe |
|---|---|---|
| `Out of capacity` beim Anlegen der VM | Oracle hat gerade keine freie Always-Free-Maschine in der Zone | andere Availability Domain wählen oder später erneut versuchen; keine kostenpflichtige Shape nehmen |
| `Permission denied (publickey)` | falscher Schlüssel oder Benutzer | Benutzer `ubuntu`, privaten Schlüssel aus der VM-Erstellung verwenden |
| `Unauthorized` / HTTP 401 | Bot-Token falsch | Token am Server unsichtbar neu eingeben (Musterdienst: `.env`; 24/7: Installer mit `--neu`) |
| `chat not found` / HTTP 400 | Chat-ID falsch oder Bot nie gestartet | Bot in Telegram mit **Start** anschreiben, Chat-ID prüfen, bei Gruppen Schreibrecht geben |
| Startzeile „Text – Kartenrenderer fehlt“ | resvg nicht installiert | Schritt „Schrift und Renderer“ wiederholen, dann `sudo systemctl restart scalpdesk-patterns` |
| `Bereinigung abgebrochen: Chartmusterdienst läuft` | `--bereinigen` von Hand bei laufendem Dienst | Bereinigung über den Timer starten: `sudo systemctl start scalpdesk-patterns-bereinigung.service` (hält den Dienst kurz an) |
| Muster kommen doppelt | zwei Sender für denselben Muster-Chat | nur **einen** Sender verwenden (siehe oben) |
| Keine Muster | normal, solange keine neue Formation den Qualitätsfilter besteht | Testnachricht und `active (running)` prüfen. Ausbleibende Muster sind kein Fehler. |

## Was ChatGPT nicht tun soll

- **Keine Geheimnisse:** Es fragt weder nach Token, Chat-IDs, Schlüsseln oder Passwörtern, noch speichert es sie.
- **Nichts Kostenpflichtiges:** Es schlägt keine kostenpflichtigen Oracle-Angebote vor, keine „Upgrade to paid“-Schritte und keine Backups.
- **Keine Abkürzungen:**
  - Es lässt keine Befehle mit `curl … | sudo bash` aus fremden Quellen ausführen. Erlaubt ist nur der Installer aus diesem Repository.
  - Es schaltet keine Prüfungen ab (TLS, Signaturen) und öffnet keine weiteren Ports als 22 bzw. für den 24/7-Dienst 80/443.
- **Nichts Neues erfinden:** Es ändert keine Programmdateien auf dem Server. Updates kommen nur per `git pull` bzw. Installer.
