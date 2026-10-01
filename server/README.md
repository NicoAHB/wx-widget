# Scalp Desk – 24/7-Dienst

Kleines Programm für einen eigenen Server, der rund um die Uhr läuft (z. B. kostenlos bei Oracle Cloud, „Always Free“). Es meldet per Telegram, auf Wunsch zusätzlich per Discord, auch wenn die App überall geschlossen ist:
- Kurs-Alarme,
- Stop-Loss/Take-Profit offener Positionen,
- wichtige Wirtschaftstermine,
- den BTC-Puls (ab Version 1.1): ungewöhnlich starke Bitcoin-Bewegung in 5 oder 15 Minuten,
- den Gewinn-/Verlust-Alarm am Live-Ergebnis der offenen Positionen (ab Version 1.2).

Ab Version 1.3 prüft er, ob Telegram jede Meldung angenommen hat. Wenn nicht, versucht er es erneut und meldet eine Störung.

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

## Selbsttest
`node selbsttest.mjs` im Ordner `server` prüft den Dienst ohne Netz und ohne Konten: Telegram und Binance sind darin nachgebaut. Geprüft werden vor allem die Zustellung (Ablehnung, Wiederholen mit wachsender Pause, Neustart, Nachstellen mit Vermerk, Störung nach einer Minute ohne Telegram, Verwerfen nach 24 Stunden) und die gleichzeitigen Kursabfragen. Am Ende steht „… von … bestanden“.

## Dateien und Sicherheit
- `/opt/scalpdesk-247/scalpdesk-247.mjs` ist das Programm: ohne Abhängigkeiten, Node.js ab 18.
- `/etc/scalpdesk-247.json` enthält Bot-Token, Chat-ID und den optionalen Discord-Webhook. Sie ist nur für root und den Dienst-Benutzer `scalpdesk` lesbar.
- `/var/lib/scalpdesk-247/state.json` enthält die zuletzt übernommene Datei, die schon gesendeten Meldungen und den Ausgang (noch nicht zugestellte Meldungen).
- Der Dienst läuft als eigener Benutzer ohne Anmeldung, mit schreibgeschütztem System (`ProtectSystem=strict`). Er startet mit dem Server und nach Fehlern von selbst neu.
- Den Token schreibt er nie ins Protokoll.
