# Scalp Desk – 24/7-Dienst

Kleines Programm für einen eigenen Server, der rund um die Uhr läuft (z. B. kostenlos bei Oracle Cloud, „Always Free“). Es meldet per Telegram, auf Wunsch zusätzlich per Discord, auch wenn die App überall geschlossen ist:
- Kurs-Alarme,
- Stop-Loss/Take-Profit offener Positionen,
- wichtige Wirtschaftstermine.

## So arbeitet er mit der App zusammen
- **Übergabe:**
  - Die App legt die aktiven Alarme und die Stop-/Ziel-Marken ihrer Positionen als Datei `scalpdesk-247.json` in deinen Telegram-Chat und heftet sie an.
  - Mengen, Einstiege, Trades und Notizen zu Positionen bleiben in der App.
- **Bestätigung:**
  - Der Dienst liest die Datei mit demselben Bot jede Minute.
  - Er prüft alle 15 Sekunden die 1m-Kerzen bei Binance; auch kurze Dochte zählen.
  - Er bestätigt in der angehefteten Nachricht („Dienst: aktiv …“).
- **Keine doppelten Nachrichten:** Solange die Bestätigung frisch ist, sendet die App diese Meldungen nicht zusätzlich.
- **Netz:** Der Server braucht nur ausgehende Verbindungen (Telegram, Binance, GitHub): keine offenen Ports, keine Domain.

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

**Wichtig:** Serverregion in der EU wählen (z. B. Frankfurt). Von US-Servern aus sperrt Binance den Zugriff.

## Betrieb
- Status: `systemctl status scalpdesk-247`
- Protokoll: `journalctl -u scalpdesk-247 -f`
- Aktualisieren: den Installationsbefehl erneut ausführen (Einstellungen bleiben)
- Einstellungen neu eingeben: `curl -fsSL …/install.sh | sudo bash -s -- --neu`
- Entfernen: `sudo bash /opt/scalpdesk-247/install.sh --remove`

## Dateien und Sicherheit
- `/opt/scalpdesk-247/scalpdesk-247.mjs` ist das Programm: ohne Abhängigkeiten, Node.js ab 18.
- `/etc/scalpdesk-247.json` enthält Bot-Token, Chat-ID und den optionalen Discord-Webhook. Sie ist nur für root und den Dienst-Benutzer `scalpdesk` lesbar.
- `/var/lib/scalpdesk-247/state.json` enthält die zuletzt übernommene Datei und die schon gesendeten Meldungen.
- Der Dienst läuft als eigener Benutzer ohne Anmeldung, mit schreibgeschütztem System (`ProtectSystem=strict`). Er startet mit dem Server und nach Fehlern von selbst neu.
- Den Token schreibt er nie ins Protokoll.
