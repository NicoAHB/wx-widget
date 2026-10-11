# Verschlüsselte GitHub-Sicherung

1. **Privates Daten-Repository anlegen.** Im Browser bei GitHub anmelden → Profilmenü → **Your repositories** → **New**. Name `wx-widget-daten`, Besitzer `nicoahb`, **Private** wählen und **Add a README file** einschalten → **Create repository**. Dadurch existiert der Branch `main`. Dieses Repository ist getrennt vom öffentlichen App-Code.
2. **Fine-grained Token erstellen.** Profilmenü → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**. Namen vergeben, Ablaufdatum wählen, **Resource owner** auf den Repository-Besitzer setzen. Unter **Repository access → Only select repositories** ausschließlich `wx-widget-daten` wählen. Unter **Repository permissions → Contents**: **Read and write**. **Metadata: Read-only** bleibt automatisch erlaubt. Token erzeugen und kopieren. Diesen Token niemals in GitHub-Dateien, Nachrichten oder Screenshots einfügen.
3. **Auf dem ersten Gerät sichern.** Scalp Desk → **Einstellungen → Datensicherung → Verschlüsselt mit GitHub sichern → GitHub einrichten**. Owner, Repository, Branch `main`, Datei `backup.json` und eigenen Gerätenamen prüfen; den Token im Passwortfeld einfügen. Die Felder speichern sofort lokal. **Auf GitHub sichern** antippen und eine lange, eigene Passphrase eingeben. **Verschlüsseln & sichern** bestätigen. Datum und Gerätename erscheinen nach Erfolg. Die Passphrase sicher außerhalb der App aufbewahren; sie lässt sich nicht zurücksetzen.
4. **Auf dem zweiten Gerät testen.** App dort öffnen, dieselben Repository-Angaben und einen passenden Token lokal eintragen, einen anderen Gerätenamen vergeben. **Von GitHub laden** antippen. Datum und Quellgerät prüfen, dieselbe Passphrase eingeben und **Bestätigen & laden** wählen. Persönliche Trades, Vorauswahl und Einstellungen vergleichen. **Rückgängig · Stand vor GitHub-Laden** stellt den vorherigen lokalen Stand wieder her. Beim nächsten App-Start zeigt ein neuerer GitHub-Stand nur einen Hinweis; geladen wird erst nach deiner Bestätigung.

## Welche Daten werden übertragen?

Der persönliche Vollstand umfasst offene Positionen, persönliche Trades aller Jahre, Geldbewegungen, Kontostand-Anker, Alarme, Gründe/Setups, Vorauswahl, Importkonflikte/Prüfliste sowie eigenes Musterlernen. Zusätzlich werden die bekannten persönlichen Anzeige- und Analysepräferenzen, einschließlich Arbeitsbereich, Hintergrund, 2h-Auswahl und Muster-Bot-Einstellungen, sowie Konfluenz-Originale und PO3-Journal verschlüsselt übertragen. Unterschiedliche Fassungen desselben persönlichen Eintrags werden wie beim bestehenden Dateiimport zur Entscheidung erhalten. Es gibt kein heimliches Überschreiben von Konflikten.

Wie bisher bleiben **Übungs-/Demo-Trades und laufende Bots lokal**. Zugangsdaten, Geräte-Sendesperren, laufende Dienststeuerung, Browser-Dateiberechtigungen und neu ladbare Kurs-/Referenzcaches werden nicht übertragen. Telegram-Bots und Oracle werden auf jedem Gerät bewusst eingerichtet. GitHub-Token, Passphrase und API-Schlüssel sind niemals Bestandteil der Nutzlast; bekannte Geheimnisfelder werden auch verschachtelt entfernt. Neue Speicherarten dürfen erst nach einer Prüfung in die ausdrückliche Liste übertragbarer Einstellungen aufgenommen werden.

## Schutz und Dateiformat

- Der Token steht ausschließlich im Geräteeinstellungsfeld und im lokalen Schlüssel `scalpdesk-github-device.v1`. Der App-Speicher spiegelt diesen Schlüssel nicht in seine IndexedDB. Zum Entfernen das Tokenfeld leeren.
- Jede Sicherung verwendet **AES-GCM mit 256 Bit**, einen zufälligen 16-Byte-Salt und einen neuen 12-Byte-IV. Der Schlüssel entsteht im Browser aus der Passphrase mittels **PBKDF2/SHA-256 mit 600.000 Iterationen**. Die Passphrase wird weder gespeichert noch gesendet.
- Die äußere Datei enthält `{version, savedAt, device, salt, iv, data}`. Nur Datum und Gerätename sind lesbar; auch diese Metadaten werden bei der Entschlüsselung auf Manipulation geprüft. Die persönlichen Daten stehen ausschließlich im Ciphertext `data`.
- Contents-API-Abrufe verwenden den angegebenen Branch und keinen Browser-Cache. Beim ersten PUT entfällt die SHA; spätere PUTs verwenden die aktuelle Datei-SHA. Bei 409/422 wird die SHA einmal neu geladen und der Upload einmal wiederholt. Vorher prüft die App, dass das Repository privat ist.
- Vor einem Import wird eine **lokale Notfallkopie** dauerhaft gespeichert. Scheitert die Übernahme, wird die Kopie wiederhergestellt bzw. bleibt für „Rückgängig“ erhalten. Diese Kopie wird selbst nicht auf GitHub hochgeladen. „Rückgängig“ entfernt auch Änderungen, die nach dem betreffenden Import vorgenommen wurden.
- Die Sicherung ist auf 30 MiB entschlüsselte Daten begrenzt, damit Mobilgeräte nicht durch unbegrenzte Dateien blockiert werden. Größere Bestände weiterhin als Datei sichern.

## Häufige Fehler

| Anzeige | Was tun? |
|---|---|
| Token ungültig (401) | Ablaufdatum kontrollieren, neuen Fine-grained Token erstellen und lokal eintragen. |
| Rechte/API-Limit (403) | Zugriff auf genau dieses Repository und Contents-Schreibrecht prüfen; bei Limit später wiederholen. |
| Repository/Datei/Branch nicht gefunden (404) | Namen, `main` und Token-Auswahl prüfen. Auf einem neuen Repository zuerst mit README den Branch anlegen und vom ersten Gerät sichern. Private Repositorys liefern bei fehlendem Token-Zugriff ebenfalls 404. |
| Falsche Passphrase/beschädigte Sicherung | Die ursprüngliche Passphrase genau eingeben. Groß-/Kleinschreibung und Leerzeichen zählen; die lokalen Daten bleiben erhalten. |
| Kein Internet/keine Antwort | Verbindung prüfen und später erneut starten. Es gibt keinen automatischen Upload und keine automatische Übernahme. |
| Speichern nicht möglich | Browser-Speicher prüfen. Ohne gespeicherte Notfallkopie startet kein Import. |

Die technische Abnahme nutzt öffentliche API-Attrappen und zwei getrennte Geräteprofile. Einen echten privaten Token hinterlegt nur der Nutzer auf seinen Geräten.
