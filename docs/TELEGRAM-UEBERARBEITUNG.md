# Telegram, Chartmuster-Dienst und Muster-Bot – Arbeitsstand 3.63.0

Der Nutzer beauftragt am 11.10.2026 alle vier Aufgaben gemeinsam; vollständige Fehler-/Releaseprüfung und Veröffentlichung erst nach der Umsetzung. Ausnahme: Die Einstellungen werden ausdrücklich vor dem Oracle-Teil gezielt getestet. Bisheriger öffentlicher Stand 3.62.0.

## Gefundene Nachrichtenwege

| Ort | Nachrichten und Transport |
|---|---|
| `weather-widget-v2.html`: `fireAlert`, `fireAlarm`, Tageslimit, `econNotify`, `pnlNotify`, `pulseNotify` | Kurs-, Stop-/Ziel-, Tageslimit-, Termin-, Gewinn-/Verlust- und BTC-Puls-Meldungen; `notifyChannels` → `chanSend` → bestehender Live-Worker |
| App: `patTgText`, `patNotify` | Gerade bestätigte Live-Formationen ≥ 80 %, bestehende Fall-ID und Dienstfreigabe |
| App: `chanTest`, `chanTestAll`, `chanTestTarget` | Testnachrichten, jetzt auch einzeln je Chat/Bot |
| App: `sendTgBackup`, `sendS247`, `tgPost` | Sicherungsdatei und separate Alarm-Dienstübergabe, Versand/Ersetzen/Anheften |
| App: `timgDraw`, `timgPost` | Journalbild je vollständig abgeschlossener Position; nur App |
| `server/scalpdesk-247.mjs`: Alarmprüfung, `posText`, `pnlText`, `pulseText`, `econText`, `ackText`, `hintText`, Ausgang und Dienstbestätigung | Servermeldungen und Statusnachrichten, bestehende Freigaben/Epochen/Originalarchive |
| `server/pattern-monitor.mjs`: `patternText` | Identische erzeugte Musterengine und archivbasierter Meldungstext |
| Server-KI-/PO3-Monitor | Bestehende Konfluenz-/PO3-Signale und KI-Schalterbestätigungen |

## Einstellungen: Ursache und Korrektur

Die Felder wurden erst bei `change` oder teilweise `blur` gespeichert. Ein Neuladen während der Eingabe verlor den neuen Wert: im reproduzierten Fall blieb Trades-Chat `1003` statt `9003`. Ein alter Tab konnte außerdem den gesamten Zugangszustand übernehmen und das geöffnete Formular neu befüllen: der gerade eingegebene Sicherungschat wurde dadurch wieder leer. Es gab zusätzlich eine alte Migration, die einen fehlenden Sicherungschat mit dem Kursalarm-Chat füllte, und eine automatische Übernahme des bisherigen Bot-Tokens bei Botwechsel.

Jetzt speichern sämtliche zwölf Telegram-Felder bereits auf `input`. Gespeicherte Werte und Formular bleiben exakt wie eingegeben; die Zielauflösung bereinigt Leerzeichen erst beim Senden. Felder erhalten einzelne Änderungsstände und werden beim Tab-Abgleich einzeln zusammengeführt. Ein älterer Tab-Schalterstand überschreibt keine neuere Zugangseingabe. Die beiden automatischen Ergänzungen entfallen. Bereits ausdrücklich gespeicherte gleiche Chat-IDs werden erhalten, weil sie bei privaten Chats verschiedener Bots korrekt sein können.

Leere Sicherungs-Chat-ID bedeutet weiterhin keine Sicherung. Nur der Bot-Token fällt beim Senden zurück: Sicherung → Kursalarm, Trades → Sicherung → Kursalarm, Chartmuster → Kursalarm. Die Rückfallwerte werden nie in das Formular oder die gespeicherten Felder geschrieben. Der HTTPS-Dienst verändert ausschließlich bestätigte Dienstmetadaten, keine Bot-Tokens. Jeder Bereich hat einen unabhängigen „Test in diesem Chat“-Button.

Gezielte native Prüfung `tests/m87.js`: **22/22**, alle zwölf Werte, vier unabhängige Bots/Chats/Themen, identische private Chat-ID, alle Token-Rückfälle, kein Sicherungs-Chat-Rückfall, eigener Musterbot ohne Kursalarm-Token, Neuladen ohne Blur, älterer Tab beim Bearbeiten, Schalterabgleich, unveränderte Leerzeichen und App-Neustart. Ausschließlich lokale Attrappen; keine echten Bot-Zugänge oder Nachrichten. Erstdiagnose außerhalb des Repositories: `telegram-settings-before.log`.

## Offen

Zentrale HTML-Nachrichten und Klartext-Rückfall, Chartmuster-Dienst/Oracle-Anleitung, gemeinsame Intervalle/2h, eigener Muster-Bot, vollständige Endprüfung und gemeinsame Veröffentlichung.
