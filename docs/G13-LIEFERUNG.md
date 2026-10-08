# G13 – Zusammenführung, Sicherung und Update

Arbeitsstand **App/Service Worker 3.50.0, Dienstquelle 2.8.0**. Die Freigabe reicht bis G13; Standardlayout bleibt erhalten, G14 noch nicht begonnen. Öffentliche Konfluenz-/PO3-Signale und Bot-Laufsimulation teilen Fachmodule; bestehende Binance-Feeds, Kontobuchungen und Alarmwege bleiben bestehen. Oracle ist der einzige Telegram-Signalsender nach bestätigter Übernahme. Kein privater Börsenexecutor und keine automatischen Strategie-Fills.

## Sicherung vor Update

1. Vorhandenes **persönliches Backup** herunterladen: Positionen/Journal, Einstellungen, Alarme und G09-Musterlernen, weiterhin Schema 8 mit bisherigen Konflikt-/Importregeln. Alte Backups bleiben lesbar.
2. Unter Datensicherung → **KI-/Bot-Originale zusätzlich sichern** das lokale Archiv herunterladen. Enthält Konfluenz-Originalbeobachtungen, vollständige versionierte PO3-Fälle und lokale Bot-Laufsimulation. Quell-/Modell-/Datenrevisionen, IDs, Start-FX, Laufbasis und Stopps bleiben erhalten. Maximal 32 MiB; keine privaten Zugänge.
3. Auf Oracle die geschützte Konfiguration und Zustandsdateien am Server separat sichern: `state.json`, Musterarchiv, `ki-public.json`, `ki-history-public.json`, `po3-public.json`, `bot-simulation.json`. Sie sind keine Bestandteile des öffentlichen Lieferpakets. Private Dateien nicht im Chat/Git teilen.

Archivimport führt Originale ohne stilles Überschreiben zusammen. Quelle/ID/Modell/Preisplan werden geprüft, Konflikte vor Änderungen gemeldet. Alte PO3-Modelle bleiben erhalten. Persönliche Positionsdaten werden nicht berührt. Bot-Import nur ausdrücklich in leerem Browserprofil und **deaktiviert**, mit unveränderten Stopps/Basis/Command-Ledger. Auch die separate JSON-Sicherung aus dem Bot-Reiter wird erkannt. Keine Reaktivierung von Demo/Echtgeld. Preis-/Referenzcaches, Karten und abgeleitete Quoten sind neu ladbar, kein Originalersatz.

Mehrere native Datenbanken haben keine gemeinsame atomare Transaktion: jede Phase ist atomar, Fehler nennen bereits bestätigte Phasen. Originaldatei behalten und Import wiederholen; Dubletten werden verhindert. Es wird kein bestehender Bot-Lauf durch eine Datei überschrieben.

## PWA-Update und Rückfall

HTML importiert aus `bundles/3.50.0/`; Worker und dessen relative Module verwenden dieselbe immutable Adresse. Ein älterer Service Worker kann deshalb neues HTML liefern, ohne neue Module mit alten unversionierten Modulen zu mischen. Im neuen Worker wird jeder Lieferteil samt HTML anhand SHA-256/Bytezahl geprüft. Fehlt ein Teil oder stimmt ein Hash nicht, bleibt der bisherige Worker aktiv; kein teilweiser Programmstand wird freigegeben.

Vollständige Bündel werden gemeinsam aktiviert. Aktueller und ein vorheriger **Programmcache** bleiben; öffentliche kleine Datendateien separat höchstens 64 × 256 KiB. Kein Löschen von IndexedDB/localStorage. Geöffnete vorherige HTML-Versionen behalten ihre eigenen Moduladressen. Die App zeigt einen Hinweis auf den vollständig geladenen Folgestand; nach Sicherung bewusst neu laden. Ein laufender alter Tab wird nicht zwangsweise neu gestartet.

Rückfall: vorherigen vollständigen Quellstand bereitstellen (HTML, `sw.js`, seine immutable Module und Lieferliste zusammen), dann PWA schließen/neu öffnen und Dienst getrennt zurücksetzen. Die vorherige Moduladresse beim Update weiterhin ausliefern. Persönliche und KI-/Bot-Sicherungen sowie Originaldatenbanken erhalten; niemals zur Fehlerbehebung pauschal „alle Appdaten löschen“. Ein alter Programmstand kennt neue Modelle gegebenenfalls nicht, deren Daten bleiben im eigenen Speicher exportierbar.

## Dienst aktualisieren und zurücksetzen

Den bisherigen Installer erneut ausführen. Er lädt zuerst den vollständigen Stand anhand `server/release-manifest.json`, prüft Syntax, Hashes und tatsächliche Modulimporte. Fehler vor der Umschaltung erhalten das bisherige Programm. Neue Dateien liegen in einem eigenen Releaseverzeichnis; `current` wird erst nach erfolgreicher Prüfung umgeschaltet. Node löst den Einstieg auf den realen Releasepfad auf, alle relativen Imports bleiben im selben Stand. Konfiguration/Zustandsdateien außerhalb des Programmverzeichnisses bleiben erhalten. Ein bisheriger Installerstand wird bei Erstumstellung als Rückfall kopiert; ausschließlich dessen CLI-Pfadvergleich wird für Symlinks kompatibel gemacht, seine Fach-/Zustandslogik bleibt erhalten. Zwei Programmstände werden behalten.

Ein vorhandener `previous`-Zeiger ermöglicht den Programm-Rückfall auf der eigenen VM:

```bash
cd /opt/scalpdesk-247
sudo ln -s "$(readlink previous)" current.rollback
sudo mv -Tf current.rollback current
sudo systemctl restart scalpdesk-247
sudo scalpdesk-247 status
```

Vorher prüfen, dass `previous` auf den gewünschten vollständigen Stand zeigt. Ein Programm-Rückfall ersetzt keine Datensicherung und verändert keine Stoppsperre. GitHub Pages aktualisiert die eigene Oracle-VM nicht automatisch.

## Prüfung und praktische Grenzen

Gezielte tatsächliche Browser-/IDB-/HTTP-/Workerprüfung umfasst Update 3.45 → 3.50, fehlerhaften Folgeteil, erfolgreiche Wiederholung, Cachegrenze, bewussten Reload, frischen Offline-Appstart, Originalimporte und gleiche Bot-Sperren am Server. Installerprüfung enthält fehlenden Teil/falschen Hash, vollständigen Folgegraph und Rückfall mit erhaltener Konfiguration/Zustand. Gesamtprüfbericht folgt vor Veröffentlichung.

34 PWA-Lieferdateien, zusammen 1.934.325 unkomprimierte Bytes (einschließlich HTML, Icons, Bibliothek/Lizenz und Module; keine Aussage über komprimierte Netzbytes). Schwere öffentliche Auswertung weiter im gemeinsamen Worker/Server; Listen und Archive begrenzt, Originale bei Grenze erhalten. Chromium unter 320/390/768/1440 Pixel ist geprüft; **echte iPhone-/iPad-/iOS-Safari-/Pinch-/Rotation-/Safe-Area-/Leistungsabnahme, echte Bitget-Browser-CORS sowie private Oracle-VM/mehrere echte Geräte bleiben offen**. Lokale HTTP-/Neustart-/429-/Offline-Prüfungen ersetzen diese Abnahme nicht.

G12 ist eine Simulation ohne privaten API-/Orderadapter. Classic/UTA, Einweg/Hedge, eigene Risikoeinrichtung und tatsächliche Börsendemo vor privater Implementierung klären: [BITGET_EINRICHTUNG.md](BITGET_EINRICHTUNG.md). PO3 bleibt nach Gebühren **vor Funding**; nicht als vollständiges Bot-Netto verwenden. Fehlende historische Fundingankündigungen bleiben gemäß Nutzerentscheidung nicht bewertbar. Keine erfundene Quote und kein Ersatz durch heutige Eingaben.

## Lieferstand erzeugen

Nach Änderungen an HTML/Modulen/Installer und gemeinsamer Version:

```bash
node tools/build-release.mjs
node tools/build-release.mjs --check
bash tests/lint.sh
bash tests/run-all.sh
```

Der Generator erzeugt öffentliche Modulkopien und Prüflisten, keine Fachlogik-Kopie von Hand bearbeiten. Versionierte bereits veröffentlichte Bündel nicht nachträglich verändern. Lizenz der bestehenden jsQR-Bibliothek bleibt enthalten. Keine neue Produktionsabhängigkeit. ZIP nur aus eingecheckten Programm-/Server-/Dokumentations-/Testdateien, ohne `.git`, Zugangsdaten, native Zustände, Testzertifikate und `node_modules`; Version/Änderungen/Testnachweis/offene Abnahmen dazulegen.
