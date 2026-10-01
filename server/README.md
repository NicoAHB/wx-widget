# Scalp Desk – 24/7-Dienst

Kleines Programm für einen eigenen Server, der rund um die Uhr läuft (z. B. kostenlos bei Oracle Cloud, „Always Free“). Es meldet per Telegram, auf Wunsch zusätzlich per Discord, auch wenn die App überall geschlossen ist:
- Kurs-Alarme,
- Stop-Loss/Take-Profit offener Positionen,
- wichtige Wirtschaftstermine,
- den BTC-Puls (ab Version 1.1): ungewöhnlich starke Bitcoin-Bewegung in 5 oder 15 Minuten,
- den Gewinn-/Verlust-Alarm am Live-Ergebnis der offenen Positionen (ab Version 1.2).

**Schritt-für-Schritt-Anleitung für Oracle Cloud (Neueinrichtung, Aktualisieren, Fehlerhilfe): [ANLEITUNG-ORACLE.md](ANLEITUNG-ORACLE.md)**

## So arbeitet er mit der App zusammen
- **Übergabe:**
  - Die App legt die aktiven Alarme und die Stop-/Ziel-Marken ihrer Positionen als Datei `scalpdesk-247.json` in deinen Telegram-Chat und heftet sie an.
  - Einstiege und Mengen offener Positionen stehen nur darin, solange ein Gewinn- oder Verlust-Alarm aktiv ist (ab 1.2): Der Dienst braucht sie für das Live-Ergebnis.
  - Trades und Notizen bleiben in der App.
- **Bestätigung:**
  - Der Dienst liest die Datei mit demselben Bot jede Minute.
  - Er prüft alle 15 Sekunden die 1m-Kerzen bei Binance; auch kurze Dochte zählen.
  - Er bestätigt in der angehefteten Nachricht („Dienst: aktiv …“).
- **Keine doppelten Nachrichten:** Solange die Bestätigung frisch ist, sendet die App diese Meldungen nicht zusätzlich.
- **BTC-Puls (ab 1.1):**
  - Die App berechnet aus den BTC-Kerzen der letzten 35 Tage, welche Bewegung um welche Uhrzeit ungewöhnlich ist (99 % der üblichen, je Stunde und Tagesart), und legt diese Schwellen mit in die Datei.
  - Der Dienst prüft damit alle 15 Sekunden die Bewegung der letzten 5 und 15 Minuten (mindestens 0,5 % bzw. 0,8 %).
  - Je Richtung höchstens eine Nachricht in 30 Minuten, außer die Bewegung legt deutlich zu; nachts (22–7 Uhr) lautlos.
  - In seiner Bestätigung steht dann „· Puls“; erst dann sendet die App den Puls nicht mehr selbst. Ein älterer Dienst (1.0) kennt den Puls nicht – dann sendet ihn weiter die geöffnete App. Aktualisieren: den Installationsbefehl erneut ausführen.
- **Gewinn-/Verlust-Alarm (ab 1.2):**
  - Die App übergibt die Grenzen (z. B. „ab +100 USDT“) zusammen mit Einstieg, Menge, Richtung und Markt jeder offenen Position.
  - Der Dienst rechnet alle 15 Sekunden mit dem aktuellen Kurs das Live-Ergebnis und meldet jede Grenze einmal. Eine Spitze, die kürzer als 15 Sekunden dauert, kann er übersehen.
  - In seiner Bestätigung steht dann „· GV“, und in der angehefteten Nachricht eine Zeile „GV: Gewinn-Alarm ausgelöst …“. Die App übernimmt die Grenze danach als „ausgelöst“ und sendet nicht zusätzlich. Erst nach „Wieder aktivieren“ in der App meldet sie sich erneut.
  - Ein älterer Dienst (bis 1.1) kann es nicht. Dann prüft weiter nur die geöffnete App. Das Tages-Verlustlimit meldet immer die App.
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

Bot-Token und Chat-ID sind dieselben wie in der App unter „Kursalarm“, nicht die des Sicherungs-Bots.

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
