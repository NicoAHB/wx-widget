# Regeln für alle KI-Assistenten (Codex/ChatGPT, Claude) – Scalp Desk

An diesem Repository arbeiten abwechselnd mehrere KI-Assistenten. Diese Regeln verhindern, dass einer still kaputt macht,
was der andere gebaut hat. Ausführliche Übergabe: `HANDOVER.md` (neueste Abschnitte oben).

## Aufbau
- `weather-widget-v2.html`: die App (eine Datei, deutsche Oberfläche).
- `shared/*.mjs`: gemeinsame ES-Module für Browser, Worker und Dienst.
- `bundles/<Version>/`: eingefrorene Kopie je Release, von der App importiert.
- `server/scalpdesk-247.mjs`: 24/7-Dienst auf dem Oracle-Server (Installer `server/install.sh`).
- `sw.js`: Service Worker. `manifest.json` und `server/release-manifest.json` werden von `tools/build-release.mjs` erzeugt.
- `tests/`: Testserver `mock-binance.js`, Browser-Tests `m*.js`, Einheitentests `unit-*.js`.

## Vor jedem Pull Request (Pflicht)
1. `bash tests/lint.sh` – 0 Fehler (3 bekannte Warnungen sind in Ordnung).
2. `node tools/build-release.mjs --check` – Lieferlisten und Bündel stimmen.
3. `bash tests/run-unit.sh` – alle Einheitentests grün (rund 5 Minuten).
4. Die Browser-Tests des geänderten Bereichs einzeln ausführen. Sie laufen immer nacheinander, nie parallel, weil der Testserver einen festen Port nutzt.

Dieselben drei ersten Schritte laufen automatisch bei jedem PR (`.github/workflows/ci.yml`). **Ein roter Haken heißt: nicht
zusammenführen, erst reparieren.** Der komplette Lauf `tests/run-all.sh` (rund 2,5 h) läuft jede Nacht
(`.github/workflows/nachtlauf.yml`). Ein roter Nachtlauf ist der erste Arbeitsauftrag des nächsten Tages.

## Tests
- Jeder neue Test (`m*.js`, `unit-*.js`) wird **im selben Commit** in `tests/run-all.sh` eingetragen. Einheitentests laufen über `run-unit.sh` automatisch mit.
- Ändert sich eine Anzeige oder ein Verhalten, werden die betroffenen Tests im selben Commit angepasst. Ein Test wird nie gelöscht oder übersprungen, damit es grün wird.
- Tests, die Code aus der App ausschneiden (z. B. `unit-wl.js`, `unit-zzp.js`), hängen an Kommentar-Marken. Diese Marken nicht umbenennen, ohne den Test anzupassen.
- Zeitabhängige Tests bekommen eine feste Uhr oder schieben regelmäßige Abrufe aus dem Messfenster.

## Speicherschlüssel
- Neue Schlüssel für localStorage oder IndexedDB werden in der **zentralen Liste `STORE_KEYS`** in `weather-widget-v2.html` eingetragen: in Sicherung? zwischen Tabs abgleichen? GitHub-Abgleich? optional ab welcher Version?
- Daraus entstehen `PREF_KEYS`, `SYNC_KEYS`, `GH_PREF_KEYS` und `GH_OPTIONAL_KEYS`. Diese Listen nicht mehr von Hand ergänzen.

## Release
- `APP_VERSION` erhöhen und alle Importpfade `./bundles/<alt>/` auf `./bundles/<neu>/` umstellen. Danach `node tools/build-release.mjs` ausführen; das erzeugt das Bündel, `sw.js` und die Lieferlisten.
- Eine Dienständerung erhöht `VERSION` in `server/scalpdesk-247.mjs`. Der Nutzer muss auf dem Server den Installer erneut ausführen; im PR immer erwähnen.
- Doku: `docs/<Version>-AENDERUNGEN.md` (oder passendes Dokument), einen Abschnitt oben in `HANDOVER.md` und einen Eintrag in `tests/README.md`.

## Sicherheit und Daten
- **Bot-Tokens und Chat-IDs nie in Code, Tests, Doku oder Commits schreiben.** In Tests nur die vorhandenen Platzhalter verwenden.
- Externe Texte (Börse, Telegram, Coin-Namen, Notizen) per `textContent` einsetzen, nie per `innerHTML`.
- Nur abgeschlossene Kerzen für Signale, Rücktests und Lernen verwenden; kein Vorgriff auf zukünftige Kerzen.
- Anzeigezeit ist Europe/Berlin (MEZ/MESZ); Börsenzeitstempel bleiben UTC.
- Ändert sich die Logik eines Lernmodells, wird seine Lernversion erhöht. Alte Lernstände werden dann nicht mit neuen Regeln vermischt.

## Stil
- Oberfläche, Kommentare, Commit-Texte und Doku auf Deutsch, kurz und verständlich für Nicht-Programmierer.
- Neuer Code in `shared/` lesbar formatieren (eine Anweisung pro Zeile, keine Einzeiler mit mehreren hundert Zeichen).
- Keine Modellnamen von KI-Assistenten in Code, Commits oder Doku.
