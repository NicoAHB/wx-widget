# Analyse-Signale unter Telegram-Chats

App 3.81.1 · Dienst 2.15.3

Der bereits eingerichtete Analyse-Chat erscheint jetzt als fünfter Eintrag unter **Telegram-Chats → Analyse-Signale**. Bot-Token, Chat-ID und optionales Thema werden aus der bestehenden Einrichtung gelesen. Die vier bisherigen Chats und ihre Zugangsdaten bleiben erhalten.

## In der App

1. Die App aktualisieren und „Telegram-Chats“ öffnen.
2. „Analyse-Signale“ einschalten oder ausschalten. Der Sammelschalter berücksichtigt diesen Chat ebenfalls.
3. Zusätzlich müssen die Telegram-Freigabe des Analysemodells, die globale Coin-Freigabe und die Coin-Freigabe dieses Modells eingeschaltet sein. Diese Einstellungen bleiben unverändert erhalten.

„Aus“ verhindert Analyse-Fotos, Testkarten und Ergebnis-Antworten. Wird während des Bildaufbaus aus- und wieder eingeschaltet, wird das alte Foto verworfen. Nach erneutem Einschalten werden ältere Einstiege nicht nachträglich verschickt. Berechnung, Lernstand und Chart-Anzeige werden durch diesen Telegram-Schalter nicht ausgeschaltet.

## Gemeinsamen Schalter auf Oracle aktivieren

Für den geräteübergreifenden, vom 24/7-Dienst bestätigten Schalter braucht der bereits laufende Oracle-Dienst einmal das Update auf **2.15.3**. Eine aktualisierte Webseite allein aktualisiert den Server nicht. Auf dem bestehenden Oracle-Server ausführen:

```sh
curl -fsSL https://raw.githubusercontent.com/NicoAHB/wx-widget/main/server/install.sh | sudo bash
```

Ohne `--neu` aktualisieren: bestehende Servereinstellungen, Zugangsschlüssel und Zustandsdaten bleiben erhalten. Der Installer hat weiterhin seinen einmaligen Einrichtungstest; tägliche Alarm-Übernahmebestätigungen bleiben abgeschaltet. Danach in der App die Dienstverbindung prüfen und „Telegram-Chats“ erneut öffnen. Der Eintrag nennt dann den bestätigten Zustand des Dienstes.

Mit einem älteren Dienst ist der neue Schalter zunächst nur lokal wirksam. Genau das steht in der Zeile, einschließlich Update-Hinweis. Bei einer nicht erreichbaren eingerichteten Steuerung bleibt der zuletzt bestätigte Stand sichtbar; Änderungen sind zunächst nur Entwürfe und werden nach Wiederverbindung erst nach ausdrücklichem Anwenden wirksam.

**Dieses Update ergänzt die gemeinsame Sendefreigabe. Die Analyseberechnung und der Analyseversand laufen weiterhin aus der aktiven App. Es aktiviert keinen Analyse- oder Lernbetrieb bei geschlossener App auf Oracle.** Die Analyse-Bot-Zugangsdaten werden mit Schalterbefehlen nicht an den Server übertragen. Diese Entwicklungsumgebung hat keinen Zugang zum privaten Oracle-Server; das Serverupdate wurde dort nicht ausgeführt.

## Geänderte Stellen

- `weather-widget-v2.html`: fünfter Chat, gespeicherter Zustand, bestätigte/lokale Statusanzeige, Freigaben für Analyse-Fotos und Testkarten.
- `shared/analysis-channel.mjs`: gemeinsame reine Zustandsprüfung einschließlich Aktivierungszeit und Schaltepochen.
- `server/scalpdesk-247.mjs`: Ziel „analysis“ in der vorhandenen Policy, Migration und persistente geräteübergreifende Schalter; Analyse-Laufzeit ausdrücklich als nicht verfügbar gekennzeichnet.
- `server/install.sh`: begrenzte Dateianzahl auf 200 angehoben, damit das vollständige Bündel mit 153 Dateien installierbar ist; Pfad-, Größen- und Hashprüfungen unverändert.
- `sw.js`, `bundles/3.81.1/`, `server/release-manifest.json`: vollständiger geprüfter Lieferstand, alte Bündel unverändert.
- Tests: neue reine Zustands-/Dienstprüfung und native Touch-/Mehrgeräteprüfung; vorhandene Chat-Zählungen von vier auf fünf angepasst.

## Am iPhone/iPad testen

1. Unter „Telegram-Chats“ alle fünf Einträge prüfen. „Analyse-Signale“ nutzt die schon eingetragenen Zugangsdaten.
2. Analyse ausschalten: keine Analyse-Testkarte senden; bisherige Kursalarm-/Trade-/Musterfreigaben bleiben gleich.
3. Wieder einschalten und bewusst eine Testkarte senden: genau ein Foto im Analyse-Chat.
4. Mit Dienst 2.15.3 auf einem zweiten Gerät den bestätigten Zustand abgleichen.
5. App neu öffnen: Zustand, Token, Chat-IDs und Coin-Schalter bleiben erhalten.

Automatische Versandprüfungen verwenden ausschließlich lokale Telegram-/Börsen-Attrappen. Browserprüfungen ersetzen keinen Test auf einem physischen iPhone.
