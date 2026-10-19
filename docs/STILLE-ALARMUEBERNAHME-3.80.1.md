# Alarmübernahme ohne Telegram-Nachricht

App 3.80.1 · 24/7-Dienst 2.15.2

Der Dienst verschickt keine zusätzliche Nachricht „Dienst hat übernommen“ mehr. Das gilt beim ersten Übernehmen, bei neuen/geänderten Alarmen, erneuter täglicher Übergabe, Ein-/Ausschalten und Neustart. Auch eine alte ausstehende Bestätigung wird nur lokal abgeschlossen.

Die Übernahme bleibt im Protokoll, in der angehefteten Statusnachricht und als „Übergeben ✓ vom Dienst bestätigt“ in der App sichtbar. Der vorhandene Kurs-Alarm wird unverändert erst beim Erreichen der eingestellten Marke gesendet, einschließlich bisheriger Docht-/Schlusskurs-Regeln, Bildkarte und Duplikatschutz. Stop/Ziel, Gewinn-/Verlust-Alarm und andere eingerichtete Meldungsarten bleiben unverändert. Die Fehlerhilfe bei fehlender Übergabedatei bleibt erhalten.

## Geänderte Stellen

- `server/scalpdesk-247.mjs`: keine Anforderung einer Telegram-Übernahmebestätigung; `sendAck()` schließt Altzustände ausschließlich lokal ab. Kursprüfung, Auslösung, Versand und Heartbeat unverändert.
- `weather-widget-v2.html`, `server/ANLEITUNG-ORACLE.md`: Anleitung beschreibt stille Übernahme und die notwendige Dienstversion.
- Neue Regression `tests/unit-handover-silent.js`: sieben virtuelle Tage, neue/geänderte Marken, Ein-/Ausschalten und Neustarts für obere/untere Kursmarken mit und ohne HTTPS-Koordination. Bis zur Marke keine Nachricht, bei exaktem Erreichen ein echtes PNG, danach kein Duplikat.
- Bestehende Übernahme-Erwartungen in `unit-247b`, `unit-pnl-photo-only` und `m49` an das gewünschte stille Verhalten angepasst. Die Prüfungen des tatsächlich ausgelösten Alarms bleiben bestehen.
- App-/PWA-Bündel 3.80.1 und vollständige Dienst-Lieferliste 2.15.2. Frühere Bündel bleiben unverändert.

## Auf dem laufenden 24/7-Server aktivieren

Eine aktualisierte Webseite tauscht das bereits auf deinem Server laufende Programm nicht aus. Auf diesem Server einmal den bestehenden Aktualisierungsbefehl ausführen:

```sh
curl -fsSL https://raw.githubusercontent.com/NicoAHB/wx-widget/main/server/install.sh | sudo bash
```

Bestehende Einstellungen und Zustandsdaten bleiben erhalten. Der Installer führt weiterhin seinen einmaligen Einrichtungstest mit Testnachricht aus; wiederkehrende Übernahmebestätigungen entfallen ab Dienst 2.15.2. Der Programmstand ist mit `sudo scalpdesk-247 status` prüfbar. Auf dem privaten Server wurde aus dieser Entwicklungsumgebung kein Update ausgeführt, weil hier kein Serverzugang eingerichtet ist.

## Test im Alltag

1. Neue Kursmarke setzen oder ändern: Status bestätigt die Übernahme, ohne zusätzliche Telegram-Nachricht.
2. App schließen: Der Dienst überwacht die Marke weiter.
3. Erreicht der Kurs die Marke, kommt der bisherige Kurs-Alarm genau einmal.
4. Ein Neustart oder erneutes Übergeben darf keine Übernahme-Nachricht nachschicken.

Alle automatischen Telegram-/Börsenprüfungen verwenden lokale Attrappen und keine echten Nachrichten.
