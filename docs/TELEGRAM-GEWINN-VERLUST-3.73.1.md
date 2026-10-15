# Gewinn-/Verlust-Alarme als einzelne Bildnachricht

App 3.73.1 · 24/7-Dienst 2.15.1

Der zusätzliche Text im gemeldeten Beispiel ist eine Dienstübergabe-Bestätigung. Der Dienst hat Gewinn-/Verlust-Grenzen wie neue Kursmarken behandelt und dafür unabhängig vom Alarmbild eine Nachricht gesendet.

Gewinn-/Verlust-Grenzen werden jetzt still übernommen: Speichern, Quittieren, Änderung und erneutes Aktivieren erzeugen keinen zusätzlichen Übergabetext. Das gilt auch beim ersten Start mit ausschließlich diesen Grenzen und bei gespeicherten Bestätigungen aus 2.15.0. Die Übernahme steht weiterhin in der vorhandenen angepinnten Nachricht. Kursmarken, Stop-/Ziel-Marken und bewusstes Ein-/Ausschalten der gesamten Dienstübergabe behalten ihre eigenen Bestätigungen.

App und Dienst senden den Gewinn-/Verlust-Alarm als ein Foto mit der bisherigen kurzen Bildunterschrift in derselben Nachricht. Für diese Alarmart gibt es keinen Text-Ersatz: Der Dienst hält ein nicht erzeugbares/ausdrücklich abgelehntes Bild für einen späteren Versuch im Ausgang. Die App zeigt bei einem Bildfehler den Versandfehler. Nach verlorener Telegram-Antwort folgt kein zweiter Versand. Alarmgrenzen, Werte, Positionsberechnung, Auslösemerker und Senderfreigabe bleiben erhalten. Die ausführlichen Texte für abgeschlossene Trades bleiben erhalten.

## Installation

GitHub Pages aktualisiert die App und veröffentlicht das Dienstpaket, aktualisiert jedoch keine private Oracle-VM. Auf dem bestehenden Server den bekannten Installationsbefehl erneut ausführen; Einstellungen bleiben erhalten:

```sh
curl -fsSL https://raw.githubusercontent.com/NicoAHB/wx-widget/main/server/install.sh | sudo bash
```

Danach `sudo scalpdesk-247 status` oder den Dienststatus in der App prüfen: Version **2.15.1**. Der Statusbefehl versendet keine Nachricht. Hier ist kein Zugang zur privaten VM konfiguriert; deren Aktualisierung ist nicht als ausgeführt bestätigt.

## Prüfung

Neue isolierte Prüfung `unit-pnl-photo-only`: echte Dienst-Konfigurationsübernahme und PNG-Renderer; Gewinn/Verlust mit HTTPS-Koordinator und ohne; neue Grenzen neben bestätigten Kursmarken; Quittierung, Wiederaktivierung, Neustart und Altzustand; Rendererfehler, ausdrückliche Bildablehnung, Wiederaufnahme und verlorene Antwort; Original-App-Versandfunktion einschließlich fehlender Bilddaten. Alle Telegram-Aufrufe sind Attrappen.

Die bestehenden Browserabläufe `m40` und `m46` prüfen zusätzlich tatsächliche `sendPhoto`-Aufrufe und das Ausbleiben einer Dienstbestätigung mit Gewinn-/Verlust-Grenzen. Betroffene Dienst-, Format-, Karten-, Trade-Caption- und Offline-/Releaseprüfungen laufen seriell. **Abschließend 520/520 Einzelprüfungen in 15 Programmen bestanden**, Lint 0 Fehler / 3 bekannte Warnungen; reproduzierbarer Lieferstand (86 PWA-/98 Dienstdateien). Isolierte Freigabeprüfung mit 320/390 px: Start ohne JavaScript-Fehler, Modellwahl/Altbericht, Journalrahmen und Ja/Nein-Ausrichtung erhalten, kein horizontaler Überlauf. Öffentlicher Liefernachweis im Release-PR; kein neuer vollständiger Gesamtlauf.

Der neue zusätzliche `m40`-Fotoassert wurde zunächst nach dem bestehenden Telegram-Mockreset platziert und erwartete dort beide bereits gelöschten Testfälle. Die Prüfung steht jetzt vor dem Reset, nach Gewinn- und Verlustfall; abschließend 41/41. Keine App-Änderung für diesen Testaufbau nötig.

## iPhone-Kontrolle

- App neu laden; Version 3.73.1 kontrollieren. Dienst muss 2.15.1 melden.
- Gewinn- und Verlustgrenze bei noch nicht erreichter Schwelle speichern: keine separate „Dienst hat übernommen“-Nachricht für diese Grenzen.
- Je eine Grenze erreichen lassen: ein Foto mit passendem Betrag und Positionen, kein zusätzlicher Text.
- Erneut aktivieren, danach einmal mit geöffneter und einmal mit geschlossener App prüfen; keine Dubletten beim erneuten Öffnen.
- Abgeschlossenen Trade teilen: der bisher gewünschte ausführliche Text bleibt am Trade-Bild erhalten.
