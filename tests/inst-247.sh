#!/bin/bash
# Test des Installers server/install.sh ohne echten Server: systemd, useradd, runuser und chown sind nachgebaut, Telegram und
# Binance kommen aus der Attrappe (mock-binance.js). Geprüft: Ersteinrichtung mit Eingaben (falscher Token wird abgelehnt),
# Einstellungsdatei, Prüfung mit Testnachricht, Dienst-Datei und systemctl-Aufrufe, Aktualisieren ohne Rückfragen, falsche
# Chat-ID bricht vor dem Dienst ab, Entfernen. Aufruf: bash inst-247.sh
cd "$(dirname "$0")"; REPO="$(cd .. && pwd)"
pass=0; fail=0; ok() { if eval "$2"; then echo "  ✓ $1"; pass=$((pass+1)); else echo "  ✗ $1${3:+ — $3}"; fail=$((fail+1)); fi; }
T=$(mktemp -d); SHIM=$T/bin; mkdir -p "$SHIM"; export SHIM_LOG=$T/calls.log; : > "$SHIM_LOG"
for c in systemctl useradd userdel chown journalctl; do printf '#!/bin/bash\necho "%s $*" >> "$SHIM_LOG"\nexit 0\n' "$c" > "$SHIM/$c"; done
printf '#!/bin/bash\necho "runuser $*" >> "$SHIM_LOG"\nwhile [ "$1" != "--" ]; do shift; done; shift\nexec "$@"\n' > "$SHIM/runuser"
chmod +x "$SHIM"/*
node mock-binance.js > "$T/mock.log" 2>&1 & MOCK=$!
for i in $(seq 1 50); do grep -q "mock ready" "$T/mock.log" 2>/dev/null && break; sleep 0.2; done
curl -s http://127.0.0.1:8790/tgreset > /dev/null
export PATH="$SHIM:$PATH" SCALPDESK_SRC="file://$REPO/server" SCALPDESK_DIR="$T/opt" SCALPDESK_CONF="$T/etc/scalpdesk-247.json" SCALPDESK_UNIT="$T/etc/scalpdesk-247.service" SCALPDESK_STATE="$T/state" SCALPDESK_BIN="$T/bin-scalpdesk-247"
export NODE_TLS_REJECT_UNAUTHORIZED=0 NODE_NO_WARNINGS=1 SCALPDESK_TG_API=https://127.0.0.1/_h/api.telegram.org SCALPDESK_SPOT_API=https://127.0.0.1/_h/data-api.binance.vision SCALPDESK_FUT_API=https://127.0.0.1/_h/fapi.binance.com
unset HTTPS_PROXY https_proxy HTTP_PROXY http_proxy ALL_PROXY all_proxy
mkdir -p "$T/etc"
TOKEN=123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw
echo "== Ersteinrichtung"
printf 'kein-token\n%s\n987654321\n\n' "$TOKEN" > "$T/answers"
SCALPDESK_TTY="$T/answers" bash "$REPO/server/install.sh" > "$T/out1.log" 2>&1; rc=$?
ok "Läuft durch (Exit 0)" "[ $rc -eq 0 ]" "$(tail -5 "$T/out1.log")"
ok "Falscher Token wird abgelehnt und erneut gefragt" "grep -q 'sieht nicht wie ein Bot-Token aus' '$T/out1.log'"
ok "Programm installiert und lauffähig" "[ -s '$T/opt/scalpdesk-247.mjs' ] && node '$T/opt/scalpdesk-247.mjs' --version | grep -q '^1\.'"
ok "Einstellungen: Token, Chat-ID, kein Discord; nur für Besitzer und Gruppe lesbar (640)" "node -e 'const j=require(\"$T/etc/scalpdesk-247.json\");process.exit(j.token===\"$TOKEN\"&&j.chat===\"987654321\"&&j.discord===\"\"?0:1)' && [ \"\$(stat -c %a '$T/etc/scalpdesk-247.json')\" = 640 ]"
ok "Token erscheint nicht in der Ausgabe" "! grep -q '$TOKEN' '$T/out1.log'"
ok "Prüfung: Bot, Testnachricht, Binance Spot und Futures" "grep -q '✓ Bot @test_kursalarm_bot (ID 123456789) erreichbar' '$T/out1.log' && grep -q '✓ Testnachricht an deinen Telegram-Chat gesendet' '$T/out1.log' && grep -q '✓ Binance Spot erreichbar' '$T/out1.log' && grep -q '✓ Binance Futures erreichbar' '$T/out1.log'"
ok "Testnachricht kam in Telegram an" "curl -s http://127.0.0.1:8790/sent | grep -q 'Scalp Desk 24/7-Dienst ist eingerichtet'"
ok "Prüfung lief als eigener Benutzer „scalpdesk“" "grep -q 'runuser -u scalpdesk -- node' '$SHIM_LOG' && grep -q 'useradd --system --no-create-home --shell /usr/sbin/nologin scalpdesk' '$SHIM_LOG'"
ok "Dienst-Datei: Benutzer, Programm, Einstellungen, Zustand, Neustart, Schutz" "grep -q '^User=scalpdesk$' '$T/etc/scalpdesk-247.service' && grep -q \"^ExecStart=.*node $T/opt/scalpdesk-247.mjs --config $T/etc/scalpdesk-247.json --state $T/state/state.json$\" '$T/etc/scalpdesk-247.service' && grep -q '^Restart=always$' '$T/etc/scalpdesk-247.service' && grep -q '^ProtectSystem=strict$' '$T/etc/scalpdesk-247.service'"
ok "systemd: neu laden, aktivieren, starten" "grep -q 'systemctl daemon-reload' '$SHIM_LOG' && grep -q 'systemctl enable scalpdesk-247' '$SHIM_LOG' && grep -q 'systemctl restart scalpdesk-247' '$SHIM_LOG'"
ok "Hinweis zum Schluss: in der App übergeben" "grep -q 'An den 24/7-Dienst übergeben' '$T/out1.log'"
# 1.4: Prüfung nennt Bot und Chat-ID zum Vergleich mit der App; Kurzbefehl „sudo scalpdesk-247 status“
ok "1.4: Prüfung nennt Bot und Chat-ID, die in der App unter Kursalarm stehen müssen" "grep -q 'Wichtig: In der App unter Kursalarm müssen derselbe Bot (@test_kursalarm_bot) und dieselbe Chat-ID (987654321) stehen' '$T/out1.log'"
ok "1.4: Kurzbefehl angelegt (ausführbar; status, protokoll, live, neustart)" "[ -x '$T/bin-scalpdesk-247' ] && grep -q -- '--status' '$T/bin-scalpdesk-247' && grep -q 'journalctl -u scalpdesk-247 -n' '$T/bin-scalpdesk-247' && grep -q 'systemctl restart scalpdesk-247' '$T/bin-scalpdesk-247' && grep -q 'sudo scalpdesk-247 status' '$T/out1.log'"
bash "$T/bin-scalpdesk-247" status > "$T/status.log" 2>&1
ok "1.4: „scalpdesk-247 status“ läuft als Dienst-Benutzer und zeigt Bot, Chat und fehlende Datei der App" "grep -q 'runuser -u scalpdesk -- .*--status' '$SHIM_LOG' && grep -q '✓ Bot @test_kursalarm_bot (ID 123456789) – Token gültig' '$T/status.log' && grep -q '✗ Keine Datei der App angeheftet' '$T/status.log'" "$(head -6 "$T/status.log")"
echo "== Aktualisieren (Einstellungen bleiben, keine Fragen)"
: > "$SHIM_LOG"; SCALPDESK_TTY=/nonexistent bash "$REPO/server/install.sh" > "$T/out2.log" 2>&1; rc=$?
ok "Läuft ohne Eingaben durch" "[ $rc -eq 0 ] && grep -q 'Einstellungen aus .* übernommen' '$T/out2.log'" "$(tail -3 "$T/out2.log")"
echo "== Falsche Chat-ID"
node -e "require('fs').writeFileSync('$T/etc/scalpdesk-247.json', JSON.stringify({token:'$TOKEN',chat:'111',discord:''}))"; rm -f "$T/etc/scalpdesk-247.service"; : > "$SHIM_LOG"
SCALPDESK_TTY=/nonexistent bash "$REPO/server/install.sh" > "$T/out3.log" 2>&1; rc=$?
ok "Bricht mit Hinweis ab, bevor der Dienst eingerichtet wird" "[ $rc -ne 0 ] && grep -q 'Chat nicht gefunden' '$T/out3.log' && [ ! -f '$T/etc/scalpdesk-247.service' ] && ! grep -q 'systemctl restart' '$SHIM_LOG'" "$(tail -3 "$T/out3.log")"
echo "== Entfernen"
: > "$SHIM_LOG"; bash "$REPO/server/install.sh" --remove > "$T/out4.log" 2>&1; rc=$?
ok "Entfernt Programm, Einstellungen, Dienst und Kurzbefehl" "[ $rc -eq 0 ] && [ ! -e '$T/opt' ] && [ ! -e '$T/etc/scalpdesk-247.json' ] && [ ! -e '$T/bin-scalpdesk-247' ] && grep -q 'systemctl disable --now scalpdesk-247' '$SHIM_LOG'"
kill $MOCK 2>/dev/null; rm -rf "$T"
echo; echo "$pass/$((pass+fail)) bestanden"; [ $fail -eq 0 ]
