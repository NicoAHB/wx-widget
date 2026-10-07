# ChatGPT mit GitHub verbinden – und weiterarbeiten lassen

Diese Anleitung beschreibt, wie ChatGPT das Repository `NicoAHB/wx-widget` direkt bearbeitet (Änderungen machen, testen, Pull Request
öffnen). Menünamen bei ChatGPT und GitHub ändern sich gelegentlich – wenn ein Name abweicht, nach dem sinngemäßen Eintrag suchen.

## A. Direkt bearbeiten: ChatGPT Codex (empfohlen)
Codex ist der Programmier-Agent in ChatGPT. Er arbeitet in einer eigenen Cloud-Umgebung mit einer Kopie des Repositorys, führt Befehle
und Tests aus und schlägt die Änderungen als Pull Request vor. Du prüfst und führst den Pull Request zusammen – erst dann ist es live.
Voraussetzung: ein ChatGPT-Tarif mit Codex (z. B. Plus, Pro oder Team).

1. **Codex öffnen:** in ChatGPT links „Codex“ wählen oder `https://chatgpt.com/codex` aufrufen.
2. **GitHub verbinden:** „GitHub verbinden“ (bzw. „Connect to GitHub“) antippen und bei GitHub anmelden.
3. **Zugriff erlauben:** GitHub fragt, ob die ChatGPT-/Codex-App installiert werden darf. „Only select repositories“ wählen und
   **`NicoAHB/wx-widget`** auswählen, dann bestätigen. (Später änderbar unter GitHub → Settings → Applications → Installed GitHub Apps.)
4. **Umgebung anlegen:** In Codex eine Umgebung (Environment) für `NicoAHB/wx-widget` erstellen.
   - **Setup-Skript** (damit Tests laufen):
     ```
     cd tests && npm install && npm install --no-save playwright && npx playwright install --with-deps chromium
     npm install -g eslint@9 globals
     ```
   - **Internetzugang** der Umgebung erlauben, falls Codex danach fragt (für die Installation nötig; die Tests selbst laufen gegen einen nachgebauten Test-Server).
5. **Aufgabe starten:** In Codex das Repository wählen, als Ziel-Branch `main` lassen und den **Startprompt** unten einfügen.
6. **Ergebnis prüfen:** Codex zeigt die Änderungen und die Testausgabe. Mit „Pull Request erstellen“ (Create PR) landet alles als Pull Request auf GitHub.
7. **Live stellen:** Auf GitHub den Pull Request ansehen und „Merge pull request“ wählen. GitHub Pages veröffentlicht die neue Version nach 1–2 Minuten unter
   `https://nicoahb.github.io/wx-widget/`. Am iPhone die App einmal neu laden.

**Hinweise**
- Ein kompletter Testlauf dauert rund 2,5 Stunden. Für einzelne Schritte reicht der passende Test (z. B. `node tests/m59.js`); vor einem Release den Gesamtlauf `bash tests/run-all.sh` verlangen.
- Gib Codex **nie** Telegram-Token, den Schlüssel des 24/7-Dienstes oder Börsen-Zugänge. Die braucht es für die Entwicklung nicht.
- Den 24/7-Dienst auf der Oracle-VM aktualisierst du selbst (Anleitung in `server/README.md`); Codex hat keinen Zugang zur VM.

## B. Nur lesen und besprechen: GitHub-Verbindung im normalen Chat
In ChatGPT unter **Einstellungen → Apps/Connectors → GitHub** verbinden und das Repository freigeben. Dann kann ChatGPT im normalen Chat
(auch mit „Deep Research“) Dateien lesen und Fragen zum Code beantworten. Bearbeiten und Pull Requests gehen damit in der Regel nicht – dafür Codex (A) nutzen.

## C. Ohne Verbindung (Notlösung)
Das ZIP des aktuellen Stands und `HANDOVER.md` in den Chat hochladen. ChatGPT liefert dann geänderte Dateien, die du selbst auf GitHub hochlädst
(Repository → „Add file“ → „Upload files“ → Commit). Das ist fehleranfälliger; Variante A ist deutlich besser.

## Startprompt
Diesen Text in Codex (oder im Chat) als erste Nachricht einfügen:

```
Du übernimmst die Weiterentwicklung von „Scalp Desk“ im Repository NicoAHB/wx-widget (Single-File-PWA weather-widget-v2.html,
24/7-Dienst server/scalpdesk-247.mjs, Tests in tests/).

1. Lies zuerst HANDOVER.md vollständig, dann docs/VORGABE-G01-G14.md (vor allem G09 C6b und G10–G14) und tests/README.md.
2. Arbeite die offenen Schritte in der Reihenfolge aus HANDOVER.md Abschnitt 3 ab. Frage mich vor dem Start, ob zuerst G09 C6b oder
   direkt G10 kommen soll. G10 in kleinen Schritten (a)–(e) wie dort beschrieben.
3. Halte die Arbeitsregeln aus HANDOVER.md Abschnitt 4 ein: nichts Fertiges umbauen, Deutsch, keine Zugangsdaten, zu jeder Änderung
   Tests im vorhandenen Stil, vor einem Release lint (0 Fehler) und Gesamtlauf, APP_VERSION und sw.js-VERSION gemeinsam erhöhen,
   kleine Commits, Pull Request mit Inhalt/Tests/Offenem. Bekannte Stolpersteine stehen in Abschnitt 5.
4. Aktualisiere HANDOVER.md nach jedem Schritt (Stand, erledigt, offen).
5. Melde dich nach jeder Gruppe mit einer kurzen Zusammenfassung (fertig, getestet, offen) und warte auf meine Freigabe.
   Bei Unklarheiten frage mit konkreten Optionen nach, statt zu raten.
Die in der Vorgabe genannten Code-Beilagen (code/confluence, code/po3, code/bot, code/frontend) liegen nicht im Repository – sag mir
Bescheid, wenn du sie brauchst, oder schreibe die Teile neu.
```
