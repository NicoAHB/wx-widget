#!/bin/bash
# Test des Installers server/install.sh ohne echten Server: systemd, useradd, runuser und chown sind nachgebaut, Telegram und
# Binance kommen aus der Attrappe (mock-binance.js). Geprüft: Ersteinrichtung mit Eingaben (falscher Token wird abgelehnt),
# Einstellungsdatei, Prüfung mit Testnachricht, Dienst-Datei und systemctl-Aufrufe, Aktualisieren ohne Rückfragen, falsche
# Chat-ID bricht vor dem Dienst ab, Entfernen. 2.0: Zugangsschlüssel (bleibt beim Aktualisieren), öffentliche Adresse, Caddy-Teil,
# Standard-Caddyfile ersetzt, Ports 80/443 in iptables, Hinweis auf die Oracle-Konsole, Kurzbefehl „zugang“, --ohne-https,
# Entfernen des Caddy-Teils. Aufruf: bash inst-247.sh
cd "$(dirname "$0")"; REPO="$(cd .. && pwd)"
pass=0; fail=0; ok() { if eval "$2"; then echo "  ✓ $1"; pass=$((pass+1)); else echo "  ✗ $1${3:+ — $3}"; fail=$((fail+1)); fi; }
T=$(mktemp -d); SHIM=$T/bin; mkdir -p "$SHIM"; export SHIM_LOG=$T/calls.log; : > "$SHIM_LOG"
for c in systemctl useradd userdel chown journalctl caddy netfilter-persistent; do printf '#!/bin/bash\necho "%s $*" >> "$SHIM_LOG"\nexit 0\n' "$c" > "$SHIM/$c"; done
# Root-Prüfung ebenso nachbauen: dieser Installer-Test verändert keine echten Benutzer/Dienste und läuft auch als Nicht-root.
printf '#!/bin/bash\nif [ "$*" = "-u" ]; then echo "${TEST_INSTALLER_UID:-0}"; else exec /usr/bin/id "$@"; fi\n' > "$SHIM/id"
# 2.0: iptables wie auf Oracle-Ubuntu – die Kette INPUT endet mit REJECT; -C (gibt es die Regel schon?) findet nichts
printf '#!/bin/bash\necho "iptables $*" >> "$SHIM_LOG"\ncase "$*" in *-S*) echo "-A INPUT -j REJECT --reject-with icmp-host-prohibited";; *-C*) exit 1;; esac\nexit 0\n' > "$SHIM/iptables"
printf '#!/bin/bash\necho "runuser $*" >> "$SHIM_LOG"\nwhile [ "$1" != "--" ]; do shift; done; shift\nexec "$@"\n' > "$SHIM/runuser"
chmod +x "$SHIM"/*
node mock-binance.js > "$T/mock.log" 2>&1 & MOCK=$!
for i in $(seq 1 50); do grep -q "mock ready" "$T/mock.log" 2>/dev/null && break; sleep 0.2; done
curl -s http://127.0.0.1:8790/tgreset > /dev/null
export PATH="$SHIM:$PATH" SCALPDESK_SRC="file://$REPO/server" SCALPDESK_DIR="$T/opt" SCALPDESK_CONF="$T/etc/scalpdesk-247.json" SCALPDESK_UNIT="$T/etc/scalpdesk-247.service" SCALPDESK_STATE="$T/state" SCALPDESK_BIN="$T/bin-scalpdesk-247"
export NODE_TLS_REJECT_UNAUTHORIZED=0 NODE_NO_WARNINGS=1 SCALPDESK_TG_API=https://127.0.0.1/_h/api.telegram.org SCALPDESK_SPOT_API=https://127.0.0.1/_h/data-api.binance.vision SCALPDESK_FUT_API=https://127.0.0.1/_h/fapi.binance.com
unset HTTPS_PROXY https_proxy HTTP_PROXY http_proxy ALL_PROXY all_proxy
mkdir -p "$T/etc" "$T/caddy"; printf ':80 {\n\troot * /usr/share/caddy\n\tfile_server\n}\n' > "$T/caddy/Caddyfile"
export SCALPDESK_CADDYFILE="$T/caddy/Caddyfile" SCALPDESK_HOST=130-61-1-2.sslip.io SCALPDESK_HTTPS_WAIT=1
TOKEN=123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw
echo "== Ersteinrichtung"
TEST_INSTALLER_UID=1000 SCALPDESK_TTY=/nonexistent bash "$REPO/server/install.sh" > "$T/no-root.log" 2>&1; rc=$?
ok "Ohne nachgebautes Rootrecht wird die echte Root-Prüfung abgelehnt" "[ $rc -ne 0 ] && grep -q 'Bitte mit sudo ausführen' '$T/no-root.log' && [ ! -e '$T/opt/scalpdesk-247.mjs' ]"
printf 'kein-token\n%s\n987654321\n\n' "$TOKEN" > "$T/answers"
SCALPDESK_TTY="$T/answers" bash "$REPO/server/install.sh" > "$T/out1.log" 2>&1; rc=$?
ok "Läuft durch (Exit 0)" "[ $rc -eq 0 ]" "$(tail -5 "$T/out1.log")"
ok "Falscher Token wird abgelehnt und erneut gefragt" "grep -q 'sieht nicht wie ein Bot-Token aus' '$T/out1.log'"
ok "Programm installiert und lauffähig" "[ -s '$T/opt/scalpdesk-247.mjs' ] && node '$T/opt/scalpdesk-247.mjs' --version | grep -q '^2\.'"
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
# 2.0: HTTPS-Steuerung
KEY0=$(node -p "require('$T/etc/scalpdesk-247.json').key")
ok "2.0: Zugangsschlüssel erzeugt (43 Zeichen), Herkunft der App, lokale Adresse und öffentliche Adresse eingetragen" "node -e 'const j=require(\"$T/etc/scalpdesk-247.json\");process.exit(/^[A-Za-z0-9_-]{43}$/.test(j.key)&&j.origin===\"https://nicoahb.github.io\"&&j.listen===\"127.0.0.1:8247\"&&j.host===\"130-61-1-2.sslip.io\"?0:1)'"
ok "2.0: Schlüssel steht nicht in der Ausgabe des Installers (nur über „sudo scalpdesk-247 zugang“)" "! grep -q -- '$KEY0' '$T/out1.log' && grep -q 'sudo scalpdesk-247 zugang' '$T/out1.log'"
ok "2.0: Caddy-Teil mit der Adresse und Weiterleitung an 127.0.0.1:8247; Standard-Caddyfile durch den Import ersetzt" "grep -q '^130-61-1-2.sslip.io {' '$T/caddy/scalpdesk-247.caddy' && grep -q 'reverse_proxy 127.0.0.1:8247' '$T/caddy/scalpdesk-247.caddy' && [ \"\$(cat '$T/caddy/Caddyfile')\" = 'import scalpdesk-247.caddy' ]"
ok "2.0: Ports 80 und 443 in iptables vor der REJECT-Regel geöffnet und gespeichert, Caddy geprüft und neu gestartet" "grep -q 'iptables -I INPUT 1 -p tcp -m state --state NEW --dport 80 -j ACCEPT' '$SHIM_LOG' && grep -q 'iptables -I INPUT 1 -p tcp -m state --state NEW --dport 443 -j ACCEPT' '$SHIM_LOG' && grep -q 'netfilter-persistent save' '$SHIM_LOG' && grep -q 'caddy validate' '$SHIM_LOG' && grep -q 'systemctl restart caddy' '$SHIM_LOG'"
ok "2.0: Von außen nicht erreichbar → Hinweis auf die Freigabe der Ports in der Oracle-Konsole und „sudo scalpdesk-247 https“" "grep -q 'Von außen noch nicht erreichbar: https://130-61-1-2.sslip.io' '$T/out1.log' && grep -q 'Destination Port Range 80,443' '$T/out1.log' && grep -q 'sudo scalpdesk-247 https' '$T/out1.log'"
bash "$T/bin-scalpdesk-247" zugang > "$T/zugang.log" 2>&1
ok "2.0: „scalpdesk-247 zugang“ zeigt Adresse und Zugangsschlüssel für die App" "grep -q '^Adresse: *https://130-61-1-2.sslip.io$' '$T/zugang.log' && grep -q \"^Zugangsschlüssel: *$KEY0\$\" '$T/zugang.log'" "$(cat "$T/zugang.log")"
echo "== Aktualisieren (Einstellungen bleiben, keine Fragen)"
ok "2.4: Muster-Engine und Marktvertrag installiert und importierbar" "[ -s '$T/opt/pattern-engine.mjs' ] && [ -s '$T/opt/pattern-monitor.mjs' ] && node --input-type=module -e \"const e=await import('file://$T/opt/pattern-engine.mjs');process.exit(e.patEngine().VER==='pat-1'?0:1)\""
: > "$SHIM_LOG"; SCALPDESK_TTY=/nonexistent bash "$REPO/server/install.sh" > "$T/out2.log" 2>&1; rc=$?
ok "Läuft ohne Eingaben durch" "[ $rc -eq 0 ] && grep -q 'Einstellungen aus .* übernommen' '$T/out2.log'" "$(tail -3 "$T/out2.log")"
ok "2.0: Aktualisieren behält den Zugangsschlüssel; eigene Caddyfile-Zeilen bleiben" "[ \"\$(node -p \"require('$T/etc/scalpdesk-247.json').key\")\" = '$KEY0' ] && grep -c 'import scalpdesk-247.caddy' '$T/caddy/Caddyfile' | grep -q '^1$'"
: > "$SHIM_LOG"; SCALPDESK_TTY=/nonexistent bash "$REPO/server/install.sh" --ohne-https > "$T/out2b.log" 2>&1; rc=$?
ok "2.0: --ohne-https: kein Caddy, keine Firewall, Hinweis im Schritt 6" "[ $rc -eq 0 ] && ! grep -q 'caddy\\|iptables' '$SHIM_LOG' && grep -q 'HTTPS-Steuerung nicht eingerichtet (--ohne-https)' '$T/out2b.log'"
echo "== Falsche Chat-ID"
node -e "require('fs').writeFileSync('$T/etc/scalpdesk-247.json', JSON.stringify({token:'$TOKEN',chat:'111',discord:''}))"; rm -f "$T/etc/scalpdesk-247.service"; : > "$SHIM_LOG"
SCALPDESK_TTY=/nonexistent bash "$REPO/server/install.sh" > "$T/out3.log" 2>&1; rc=$?
ok "Bricht mit Hinweis ab, bevor der Dienst eingerichtet wird" "[ $rc -ne 0 ] && grep -q 'Chat nicht gefunden' '$T/out3.log' && [ ! -f '$T/etc/scalpdesk-247.service' ] && ! grep -q 'systemctl restart' '$SHIM_LOG'" "$(tail -3 "$T/out3.log")"
echo "== Entfernen"
: > "$SHIM_LOG"; bash "$REPO/server/install.sh" --remove > "$T/out4.log" 2>&1; rc=$?
ok "Entfernt Programm, Einstellungen, Dienst und Kurzbefehl" "[ $rc -eq 0 ] && [ ! -e '$T/opt' ] && [ ! -e '$T/etc/scalpdesk-247.json' ] && [ ! -e '$T/bin-scalpdesk-247' ] && grep -q 'systemctl disable --now scalpdesk-247' '$SHIM_LOG'"
ok "2.0: Entfernen nimmt den Caddy-Teil und die Import-Zeile heraus" "[ ! -e '$T/caddy/scalpdesk-247.caddy' ] && ! grep -q 'scalpdesk-247' '$T/caddy/Caddyfile' && grep -q 'systemctl reload caddy' '$SHIM_LOG'"
kill $MOCK 2>/dev/null; rm -rf "$T"
echo; echo "$pass/$((pass+fail)) bestanden"; [ $fail -eq 0 ]
