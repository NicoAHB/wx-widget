# Sicherung übertragen – QR und kompakte Datei (3.59.0)

Unter **Positionen → Datensicherung → Kompakte Datei übertragen** gibt es eine vollständige persönliche Sicherung ohne die QR-Teilgrenze. Optional ein Passwort mit mindestens sechs Zeichen eingeben, dann **Kompakte Datei vorbereiten**. Anschließend **Datei teilen** (wenn der Browser Dateien teilen kann) oder **Datei herunterladen**. Auf dem anderen Gerät die Datei unter **Datensicherung → Backup einspielen** auswählen, bei Verschlüsselung das Passwort eingeben, die Vorschau prüfen und ausdrücklich übernehmen. Beide Apps vorher aktualisieren.

Die `.txt`-Datei enthält den bestehenden langen Sicherungscode (`SDB1:….`), komprimiert und mit Prüfsumme, bei Passwort zusätzlich AES-256-GCM. AirDrop, die Dateien-App, ein Messenger oder eine eigene Notiz können den Code übertragen. Es wird kein Zusatzserver eingerichtet und kein kurzer Cloud-Abrufcode verwendet. Ohne Passwort kann ein Empfänger die Handelsdaten lesen. Das Teilen-Menü öffnet sich bewusst erst beim zweiten Tippen nach der Vorbereitung: Safari benötigt dafür eine unmittelbare Nutzergeste.

Die persönliche Sicherung enthält weiterhin alle Jahre, Positionen/Trades/Demo, Geldbewegungen/Kontrollstände, Alarme, Einstellungen samt Abstammung, persönliche Orderflow-Bücher, Löschungen, Konflikte, Prüfliste und eigenes Lernen. Es wird nichts gekürzt. Zugangsdaten und gerätegebundene Sendefreigaben bleiben ausgeschlossen. Die bestehenden separaten KI-/PO3-/Bot-Originalarchive unter „KI-/Bot-Originale zusätzlich sichern“ bleiben separat; Serverarchive weiterhin am Server sichern.

## Weshalb die QR-Anzahl steigen kann

Ein vollständiges Journal wächst. Außerdem unterstützten ältere Safari-Versionen zwar `deflate` und `gzip`, aber noch kein `deflate-raw`. Die bisherige App ging bei fehlendem `deflate-raw` still auf ungepackte Daten über. Nun wird kompatibles Deflate verwendet. Der Ersatz hat nur sechs zusätzliche Rahmenbytes; die Einsparung gegenüber ungepackten Daten kann erheblich sein. Eine feste Testpackung mit 40 Trades, Präferenzen und Lernen brauchte bei QR-Version 20 **49 Teile ungepackt, 4 Teile komprimiert**. Das ist ein Testbeispiel, keine Zusage für beliebige Journale oder reale Geräte.

Format 1 mit Raw-Deflate bleibt unverändert. Nur der Deflate-Ersatz verwendet ausdrücklich Format 2; ältere Apps fordern dann zum Update auf. Die neue App liest auch alte Raw-Deflate-Codes in Safari ohne Raw-Deflate: ein Gzip-Rahmen mit vorhandener Länge und CRC wird ergänzt, anschließend weiterhin begrenzt entpackt und vollständig geprüft. Ohne jegliche Browserkompression bleibt der ungepackte Weg erhalten, mit sichtbarem Hinweis. Beschädigte/unvollständige Codes, falsche Passwörter und übergroße Inhalte werden vor einer Übernahme abgewiesen.

Die QR-Lesbarkeitsgrenzen bleiben **höchstens 10 Teile, Version 20, Fehlerkorrektur M, mindestens 3 ganze CSS-Pixel je Modul und 4 freie Randmodule**. Auf kleinen Bildschirmen sind gegebenenfalls kleinere Versionen nötig. Größere/dichtere Codes lösen das grundsätzliche Kapazitätsproblem nicht zuverlässig. Die Datei umgeht die QR-Teilgrenze; die bestehenden allgemeinen Sicherungs-/Importgrößengrenzen gelten weiterhin.

Eine erzeugte QR-Packung bereitet zugleich dieselbe kompakte Datei vor. Auch im Übergrößenhinweis speichert „Backup herunterladen“ diese Packung mit dem **QR-Passwort**, nicht versehentlich mit einem anderen Dateipasswort. „Textcode anzeigen“ übernimmt ebenfalls das QR-Passwort. Eine Passwortänderung verwirft die vorbereitete Datei. Nach neuen Daten die Datei erneut vorbereiten; das Speichern eines älteren Stands markiert neuere Änderungen ausdrücklich nicht als gesichert.

Der Scanner wird aus dem aktuellen hashgeprüften PWA-Bündel geladen; damit funktioniert ein frischer Offline-Start nach vollständiger PWA-Installation auch ohne die früher fest eingetragene Scannerdatei aus 3.51.0.

## Kurzer Gerätetest

1. Auf beiden Geräten App 3.59.0 oder neuer öffnen. Persönliche Sicherung zusätzlich als bisherige JSON-Datei behalten.
2. „Kompakte Datei übertragen“ öffnen, Passwort setzen, vorbereiten. Teilen-Menü/Download prüfen. Datei auf dem Zielgerät importieren; erst Vorschau und Passwortabfrage, keine stille Übernahme.
3. Nach Übernahme Positionen, sämtliche Tradejahre, Notizen und Lernen vergleichen. Gleiche Datei erneut einspielen: keine Duplikate. „Letzten Import rückgängig machen“ bleibt verfügbar.
4. Ein falsches Passwort testen: bisherigen Stand erhalten. Passwort im Sender ändern: zuvor vorbereitete Datei nicht mehr angeboten. Nach Vorbereitung eine Notiz ändern und alte Datei speichern: neuer Stand weiterhin ungesichert, Hinweis zur erneuten Vorbereitung.
5. Kleine Sicherung per QR scannen, Pause/Vor/Zurück und fehlende Teile prüfen. Bei mehr als zehn Teilen Datei verwenden; kein Verkleinern der Codes.
6. Nach vollständiger PWA-Installation ohne Netz neu öffnen: kompakte Sicherung vorbereiten und herunterladen; Scanner laden. Die tatsächliche Kamera-/AirDrop-/Dateien-App-Abnahme auf iPhone/iPad bleibt zusätzlich zu den automatisierten Tests nötig.

Automatisierter neuer Test: `node tests/m83.js`. Bestehende vollständige Sicherungs-/QR-/Importprüfungen bleiben in m50, ui, m7 und m29 erhalten. Keine Handelsberechnung oder Strategie geändert.
