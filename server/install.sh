#!/usr/bin/env bash
# Scalp Desk – 24/7-Dienst einrichten oder aktualisieren (Ubuntu/Debian, Raspberry Pi OS, Oracle Linux/Fedora).
# Aufruf auf dem Server:
#   curl -fsSL https://raw.githubusercontent.com/NicoAHB/wx-widget/main/server/install.sh | sudo bash
# Erneut ausführen = aktualisieren (Einstellungen bleiben). Entfernen: sudo bash /opt/scalpdesk-247/install.sh --remove
#
# Was passiert:
#  1. Node.js ab Version 18 (fehlt es, kommt Node 22 von NodeSource)
#  2. Programm nach /opt/scalpdesk-247
#  3. Einstellungen /etc/scalpdesk-247.json: Bot-Token, Chat-ID, optional Discord-Webhook (nur für den Dienst lesbar)
#  4. Prüfung: Bot, Testnachricht an deinen Chat, Binance erreichbar
#  5. Dienst „scalpdesk-247“ (systemd): startet mit dem Server und nach Fehlern von selbst neu
#  6. Kurzbefehl „sudo scalpdesk-247 status | protokoll | live | neustart“ (ab 1.4)
set -euo pipefail
SRC="${SCALPDESK_SRC:-https://raw.githubusercontent.com/NicoAHB/wx-widget/main/server}"
DIR="${SCALPDESK_DIR:-/opt/scalpdesk-247}" CONF="${SCALPDESK_CONF:-/etc/scalpdesk-247.json}" UNIT="${SCALPDESK_UNIT:-/etc/systemd/system/scalpdesk-247.service}"
STATE="${SCALPDESK_STATE:-/var/lib/scalpdesk-247}" TTY="${SCALPDESK_TTY:-/dev/tty}" USR=scalpdesk   # Pfade und Eingabe nur für Tests änderbar
BIN="${SCALPDESK_BIN:-/usr/local/bin/scalpdesk-247}"
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die() { printf '\n\033[31mFehler: %s\033[0m\n' "$*" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || die "Bitte mit sudo ausführen: curl -fsSL $SRC/install.sh | sudo bash"
command -v systemctl >/dev/null || die "Dieser Rechner hat kein systemd – bitte Ubuntu, Debian, Raspberry Pi OS oder Oracle Linux verwenden."

if [ "${1:-}" = "--remove" ]; then
  say "Entferne den Scalp Desk 24/7-Dienst …"
  systemctl disable --now scalpdesk-247 2>/dev/null || true
  rm -rf "$DIR" "$CONF" "$UNIT" "$STATE" "$BIN"
  systemctl daemon-reload
  id "$USR" >/dev/null 2>&1 && userdel "$USR" 2>/dev/null || true
  say "Entfernt. In der App „An den 24/7-Dienst übergeben“ ausschalten."
  exit 0
fi

# ---- 1. Node.js ----
node_ok() { command -v node >/dev/null && [ "$(node -p 'Number(process.versions.node.split(".")[0])')" -ge 18 ]; }
if ! node_ok; then
  say "1/5 Installiere Node.js 22 …"
  if command -v apt-get >/dev/null; then
    apt-get update -qq && apt-get install -y -qq ca-certificates curl >/dev/null
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null && apt-get install -y -qq nodejs >/dev/null
  elif command -v dnf >/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - >/dev/null && dnf install -y -q nodejs >/dev/null
  else die "Node.js ab Version 18 bitte selbst installieren und das Skript erneut starten."; fi
  node_ok || die "Node.js konnte nicht installiert werden."
fi
say "1/5 Node.js $(node -v) ✓"

# ---- 2. Programm ----
mkdir -p "$DIR"
curl -fsSL "$SRC/scalpdesk-247.mjs" -o "$DIR/scalpdesk-247.new.mjs" || die "Programm konnte nicht geladen werden ($SRC)."
node --check "$DIR/scalpdesk-247.new.mjs" || die "Geladenes Programm ist beschädigt."   # Endung .mjs: als ES-Modul prüfen
mv "$DIR/scalpdesk-247.new.mjs" "$DIR/scalpdesk-247.mjs"
curl -fsSL "$SRC/install.sh" -o "$DIR/install.sh" 2>/dev/null || true
say "2/5 Programm $(node "$DIR/scalpdesk-247.mjs" --version) nach $DIR ✓"

# ---- 3. Einstellungen ----
id "$USR" >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin "$USR"
if [ ! -s "$CONF" ] || [ "${1:-}" = "--neu" ]; then
  say "3/5 Einstellungen – beides steht in der App unter 🔔 Hinweise → „Telegram / Discord einrichten“:"
  exec 3<"$TTY" || die "Keine Eingabe möglich. Bitte in einem Terminal ausführen (nicht über einen Dienst oder Cron)."
  TOKEN="" CHAT="" DC=""
  while ! [[ "$TOKEN" =~ ^[0-9]{5,15}:[A-Za-z0-9_-]{30,80}$ ]]; do
    read -r -s -u 3 -p "  Bot-Token (123456789:AA…, Eingabe bleibt unsichtbar): " TOKEN || die "Eingabe abgebrochen."; echo
    TOKEN="$(printf '%s' "$TOKEN" | tr -d '[:space:]')"
    [[ "$TOKEN" =~ ^[0-9]{5,15}:[A-Za-z0-9_-]{30,80}$ ]] || echo "  Das sieht nicht wie ein Bot-Token aus – bitte erneut (Format 123456789:AA…)."
  done
  while ! [[ "$CHAT" =~ ^(-?[0-9]{1,20}|@[A-Za-z][A-Za-z0-9_]{4,31})$ ]]; do
    read -r -u 3 -p "  Chat-ID (z. B. 987654321): " CHAT || die "Eingabe abgebrochen."
    CHAT="$(printf '%s' "$CHAT" | tr -d '[:space:]')"
  done
  read -r -u 3 -p "  Discord-Webhook (optional, Enter = keiner): " DC || DC=""; DC="$(printf '%s' "$DC" | tr -d '[:space:]')"
  exec 3<&-
  ( umask 077; TOKEN="$TOKEN" CHAT="$CHAT" DC="$DC" node -e 'const e=process.env;process.stdout.write(JSON.stringify({token:e.TOKEN,chat:e.CHAT,discord:e.DC},null,1)+"\n")' > "$CONF.new" )
  mv "$CONF.new" "$CONF"
else
  say "3/5 Einstellungen aus $CONF übernommen (neu eingeben: … | sudo bash -s -- --neu)"
fi
chown root:"$USR" "$CONF" && chmod 640 "$CONF"

# ---- 4. Prüfung (sendet eine Testnachricht) ----
say "4/5 Prüfe Bot, Telegram-Chat und Binance …"
runuser -u "$USR" -- node "$DIR/scalpdesk-247.mjs" --config "$CONF" --check || die "Prüfung fehlgeschlagen – Hinweise oben. Einstellungen neu eingeben: curl -fsSL $SRC/install.sh | sudo bash -s -- --neu"

# ---- 5. Dienst ----
cat > "$UNIT" <<EOF
[Unit]
Description=Scalp Desk 24/7-Dienst (Kurs-Alarme per Telegram)
After=network-online.target
Wants=network-online.target

[Service]
User=$USR
ExecStart=$(command -v node) $DIR/scalpdesk-247.mjs --config $CONF --state $STATE/state.json
Restart=always
RestartSec=10
StateDirectory=scalpdesk-247
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable scalpdesk-247 >/dev/null 2>&1
systemctl restart scalpdesk-247
sleep 3
systemctl is-active --quiet scalpdesk-247 || { journalctl -u scalpdesk-247 -n 20 --no-pager; die "Der Dienst läuft nicht – Protokoll oben."; }
say "5/5 Dienst läuft ✓"

# ---- 6. Kurzbefehl für die Fehlersuche (ab 1.4) ----
cat > "$BIN" <<EOF
#!/usr/bin/env bash
# Scalp Desk 24/7-Dienst – Kurzbefehle: sudo scalpdesk-247 status | protokoll | live | neustart
case "\${1:-status}" in
  status)    runuser -u $USR -- $(command -v node) $DIR/scalpdesk-247.mjs --config $CONF --state $STATE/state.json --status; echo; systemctl status scalpdesk-247 --no-pager -n 0 2>/dev/null | sed -n '1,3p' ;;
  protokoll) journalctl -u scalpdesk-247 -n "\${2:-60}" --no-pager ;;
  live)      echo 'Protokoll live – beenden mit Strg+C'; journalctl -u scalpdesk-247 -f -n 20 ;;
  neustart)  systemctl restart scalpdesk-247 && echo 'Dienst neu gestartet.' ;;
  *)        echo 'Befehle: sudo scalpdesk-247 status | protokoll | live | neustart' ;;
esac
EOF
chmod 755 "$BIN"
cat <<'EOF'

Fertig. Jetzt in der App: 🔔 Hinweise → „Telegram / Discord einrichten“ → „An den 24/7-Dienst übergeben“ einschalten.
Nach spätestens einer Minute steht dort „Übergeben ✓ vom Dienst bestätigt“, und in Telegram kommt „✅ 24/7-Dienst hat übernommen“.
Wichtig: In der App unter „Kursalarm“ müssen derselbe Bot und dieselbe Chat-ID stehen wie hier am Server.

Nützlich:
  Alles prüfen:  sudo scalpdesk-247 status
  Protokoll:     sudo scalpdesk-247 protokoll     (live: sudo scalpdesk-247 live)
  Aktualisieren: denselben Befehl wie bei der Einrichtung erneut ausführen
  Entfernen:     sudo bash /opt/scalpdesk-247/install.sh --remove
EOF
