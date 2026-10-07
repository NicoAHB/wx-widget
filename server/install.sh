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
#  6. HTTPS-Steuerung (ab 2.0): Zugangsschlüssel, öffentliche Adresse <IP>.sslip.io, Caddy mit kostenlosem Zertifikat,
#     Ports 80/443 in der Server-Firewall (in der Oracle-Konsole gibst du sie einmal selbst frei – siehe Anleitung)
#  7. Kurzbefehl „sudo scalpdesk-247 status | zugang | https | protokoll | live | neustart“
# Ohne HTTPS-Steuerung (wie bis 1.4): … | sudo bash -s -- --ohne-https
set -euo pipefail
SRC="${SCALPDESK_SRC:-https://raw.githubusercontent.com/NicoAHB/wx-widget/main/server}"
DIR="${SCALPDESK_DIR:-/opt/scalpdesk-247}" CONF="${SCALPDESK_CONF:-/etc/scalpdesk-247.json}" UNIT="${SCALPDESK_UNIT:-/etc/systemd/system/scalpdesk-247.service}"
STATE="${SCALPDESK_STATE:-/var/lib/scalpdesk-247}" TTY="${SCALPDESK_TTY:-/dev/tty}" USR=scalpdesk   # Pfade und Eingabe nur für Tests änderbar
BIN="${SCALPDESK_BIN:-/usr/local/bin/scalpdesk-247}"
CADDYFILE="${SCALPDESK_CADDYFILE:-/etc/caddy/Caddyfile}" HOST_IN="${SCALPDESK_HOST:-}" HTTPS_WAIT="${SCALPDESK_HTTPS_WAIT:-18}"   # nur für Tests änderbar
HTTPS=1; for a in "$@"; do [ "$a" = "--ohne-https" ] && HTTPS=0; done
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die() { printf '\n\033[31mFehler: %s\033[0m\n' "$*" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || die "Bitte mit sudo ausführen: curl -fsSL $SRC/install.sh | sudo bash"
command -v systemctl >/dev/null || die "Dieser Rechner hat kein systemd – bitte Ubuntu, Debian, Raspberry Pi OS oder Oracle Linux verwenden."

if [ "${1:-}" = "--remove" ]; then
  say "Entferne den Scalp Desk 24/7-Dienst …"
  systemctl disable --now scalpdesk-247 2>/dev/null || true
  rm -rf "$DIR" "$CONF" "$UNIT" "$STATE" "$BIN"
  # 2.0: eigenen Caddy-Teil entfernen (Caddy selbst bleibt installiert)
  if [ -f "$(dirname "$CADDYFILE")/scalpdesk-247.caddy" ]; then rm -f "$(dirname "$CADDYFILE")/scalpdesk-247.caddy"; [ -f "$CADDYFILE" ] && sed -i '/^import scalpdesk-247.caddy$/d' "$CADDYFILE"; systemctl reload caddy 2>/dev/null || true; fi
  systemctl daemon-reload
  id "$USR" >/dev/null 2>&1 && userdel "$USR" 2>/dev/null || true
  say "Entfernt. In der App „An den 24/7-Dienst übergeben“ ausschalten."
  exit 0
fi

# ---- 1. Node.js ----
node_ok() { command -v node >/dev/null && [ "$(node -p 'Number(process.versions.node.split(".")[0])')" -ge 18 ]; }
if ! node_ok; then
  say "1/7 Installiere Node.js 22 …"
  if command -v apt-get >/dev/null; then
    apt-get update -qq && apt-get install -y -qq ca-certificates curl >/dev/null
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null && apt-get install -y -qq nodejs >/dev/null
  elif command -v dnf >/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - >/dev/null && dnf install -y -q nodejs >/dev/null
  else die "Node.js ab Version 18 bitte selbst installieren und das Skript erneut starten."; fi
  node_ok || die "Node.js konnte nicht installiert werden."
fi
say "1/7 Node.js $(node -v) ✓"

# ---- 2. Programm ----
mkdir -p "$DIR"
curl -fsSL "$SRC/scalpdesk-247.mjs" -o "$DIR/scalpdesk-247.new.mjs" || die "Programm konnte nicht geladen werden ($SRC)."
node --check "$DIR/scalpdesk-247.new.mjs" || die "Geladenes Programm ist beschädigt."   # Endung .mjs: als ES-Modul prüfen
# 2.4.0 (G09 C6b): Engine und Marktvertrag vor dem Programmwechsel laden/prüfen.
for part in pattern-engine pattern-monitor; do
  curl -fsSL "$SRC/$part.mjs" -o "$DIR/$part.new.mjs" || die "Muster-Modul $part konnte nicht geladen werden."
  node --check "$DIR/$part.new.mjs" || die "Muster-Modul $part ist beschädigt."
done
for part in pattern-engine pattern-monitor; do mv "$DIR/$part.new.mjs" "$DIR/$part.mjs"; done
mv "$DIR/scalpdesk-247.new.mjs" "$DIR/scalpdesk-247.mjs"
curl -fsSL "$SRC/install.sh" -o "$DIR/install.sh" 2>/dev/null || true
say "2/7 Programm $(node "$DIR/scalpdesk-247.mjs" --version) nach $DIR ✓"

# ---- 3. Einstellungen ----
id "$USR" >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin "$USR"
if [ ! -s "$CONF" ] || [ "${1:-}" = "--neu" ]; then
  say "3/7 Einstellungen – beides steht in der App unter 🔔 Hinweise → „Telegram / Discord einrichten“:"
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
  say "3/7 Einstellungen aus $CONF übernommen (neu eingeben: … | sudo bash -s -- --neu)"
fi
# 2.0: Zugangsschlüssel (einmal erzeugt, bleibt beim Aktualisieren), Herkunft der App, lokale Adresse, öffentliche Adresse
HOST="$HOST_IN"
if [ "$HTTPS" = 1 ] && [ -z "$HOST" ]; then
  HOST="$(node -e 'try{const j=require(process.argv[1]);process.stdout.write(j.host||"")}catch{}' "$CONF")"
  if [ -z "$HOST" ]; then
    for u in https://api.ipify.org https://ifconfig.me/ip https://icanhazip.com; do
      IP="$(curl -fsS --max-time 6 "$u" 2>/dev/null | tr -d '[:space:]')" || IP=""
      [[ "$IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] && { HOST="${IP//./-}.sslip.io"; break; }
    done
  fi
fi
( umask 077; CONF="$CONF" HOST="$HOST" node -e 'const fs=require("fs"),c=require("crypto"),e=process.env,j=JSON.parse(fs.readFileSync(e.CONF,"utf8"));if(!/^[A-Za-z0-9_-]{32,64}$/.test(j.key||""))j.key=c.randomBytes(32).toString("base64url");j.origin=j.origin||"https://nicoahb.github.io";j.listen=j.listen||"127.0.0.1:8247";if(e.HOST)j.host=e.HOST;fs.writeFileSync(e.CONF+".new",JSON.stringify(j,null,1)+"\n")' ) && mv "$CONF.new" "$CONF"
chown root:"$USR" "$CONF" && chmod 640 "$CONF"

# ---- 4. Prüfung (sendet eine Testnachricht) ----
say "4/7 Prüfe Bot, Telegram-Chat und Binance …"
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
say "5/7 Dienst läuft ✓"

# ---- 6. HTTPS-Steuerung (ab 2.0): Caddy holt ein kostenloses Zertifikat für <IP>.sslip.io und leitet an 127.0.0.1:8247 ----
https_ok() { curl -fsS --max-time 8 "https://$HOST/v1/health" 2>/dev/null | grep -q '"ok":true'; }
oracle_hint() {
  echo
  echo "  Von außen noch nicht erreichbar: https://$HOST"
  echo "  Meist fehlt die einmalige Freigabe der Ports 80 und 443 in der Oracle-Konsole:"
  echo "    1. cloud.oracle.com → Menü ☰ → Networking → Virtual cloud networks → dein Netz (vcn-…)"
  echo "    2. Reiter „Security“ (bzw. „Security Lists“) → „Default Security List for vcn-…“ → „Add Ingress Rules“"
  echo "    3. Source CIDR 0.0.0.0/0 · IP Protocol TCP · Destination Port Range 80,443 → „Add Ingress Rules“"
  echo "  Danach hier am Server prüfen: sudo scalpdesk-247 https"
}
if [ "$HTTPS" = 1 ] && [ -n "$HOST" ]; then
  say "6/7 HTTPS-Steuerung für https://$HOST …"
  if ! command -v caddy >/dev/null; then
    echo "  Installiere Caddy (Webserver mit automatischem Zertifikat) …"
    if command -v apt-get >/dev/null; then
      { apt-get update -qq && apt-get install -y -qq caddy; } >/dev/null 2>&1 || {
        apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https gnupg >/dev/null 2>&1
        curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
        curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
        apt-get update -qq >/dev/null && apt-get install -y -qq caddy >/dev/null; }
    elif command -v dnf >/dev/null; then dnf install -y -q 'dnf-command(copr)' >/dev/null 2>&1; dnf copr enable -y @caddy/caddy >/dev/null 2>&1; dnf install -y -q caddy >/dev/null 2>&1; fi
  fi
  if ! command -v caddy >/dev/null; then echo "  Caddy ließ sich nicht installieren – der Dienst läuft ohne HTTPS-Steuerung weiter (Kurs-Alarme wie bisher)."; else
    mkdir -p "$(dirname "$CADDYFILE")"
    printf '# Scalp Desk 24/7-Dienst – HTTPS-Steuerung (vom Installer geschrieben, wird beim Aktualisieren erneuert)\n%s {\n\treverse_proxy 127.0.0.1:8247\n}\n' "$HOST" > "$(dirname "$CADDYFILE")/scalpdesk-247.caddy"
    # Standarddatei des Pakets (zeigt nur die Begrüßungsseite) ersetzen, eine eigene nur ergänzen
    if [ ! -s "$CADDYFILE" ] || grep -q '/usr/share/caddy' "$CADDYFILE"; then printf 'import scalpdesk-247.caddy\n' > "$CADDYFILE"
    elif ! grep -q '^import scalpdesk-247.caddy$' "$CADDYFILE"; then printf '\nimport scalpdesk-247.caddy\n' >> "$CADDYFILE"; fi
    caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null 2>&1 || echo "  Achtung: Caddy meldet einen Fehler in $CADDYFILE – bitte prüfen: caddy validate --config $CADDYFILE"
    # Ports 80 (Zertifikat) und 443 (Steuerung) in der Firewall des Servers öffnen: ufw, firewalld oder iptables (Oracle-Ubuntu)
    for p in 80 443; do
      if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q 'Status: active'; then ufw allow "$p/tcp" >/dev/null 2>&1 || true; fi
      if command -v firewall-cmd >/dev/null && firewall-cmd --state >/dev/null 2>&1; then firewall-cmd --permanent --add-port="$p/tcp" >/dev/null 2>&1 || true; fi
      if command -v iptables >/dev/null && iptables -S INPUT 2>/dev/null | grep -q -- '-j REJECT'; then iptables -C INPUT -p tcp -m state --state NEW --dport "$p" -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp -m state --state NEW --dport "$p" -j ACCEPT; fi
    done
    if command -v firewall-cmd >/dev/null && firewall-cmd --state >/dev/null 2>&1; then firewall-cmd --reload >/dev/null 2>&1 || true; fi
    if command -v netfilter-persistent >/dev/null; then netfilter-persistent save >/dev/null 2>&1 || true; fi
    systemctl enable caddy >/dev/null 2>&1 || true; systemctl restart caddy || true
    echo "  Warte auf das Zertifikat (bis zu $((HTTPS_WAIT * 5)) Sekunden) …"
    OKH=0; for i in $(seq 1 "$HTTPS_WAIT"); do if https_ok; then OKH=1; break; fi; sleep 5; done
    if [ "$OKH" = 1 ]; then say "6/7 HTTPS-Steuerung erreichbar: https://$HOST ✓"; else oracle_hint; fi
  fi
elif [ "$HTTPS" = 1 ]; then
  say "6/7 HTTPS-Steuerung übersprungen: öffentliche Adresse nicht ermittelbar – später den Installationsbefehl erneut ausführen"
else
  say "6/7 HTTPS-Steuerung nicht eingerichtet (--ohne-https) – Kurs-Alarme wie bisher, ohne Chat-Schalter und Sendefreigabe"
fi

# ---- 7. Kurzbefehl für die Fehlersuche (ab 1.4; zugang und https ab 2.0) ----
cat > "$BIN" <<EOF
#!/usr/bin/env bash
# Scalp Desk 24/7-Dienst – Kurzbefehle: sudo scalpdesk-247 status | zugang | https | protokoll | live | neustart
case "\${1:-status}" in
  status)    runuser -u $USR -- $(command -v node) $DIR/scalpdesk-247.mjs --config $CONF --state $STATE/state.json --status; echo; systemctl status scalpdesk-247 --no-pager -n 0 2>/dev/null | sed -n '1,3p' ;;
  zugang)    $(command -v node) $DIR/scalpdesk-247.mjs --config $CONF --zugang ;;
  https)     systemctl restart caddy 2>/dev/null; H=\$($(command -v node) -e 'process.stdout.write(require(process.argv[1]).host||"")' $CONF)
             for i in 1 2 3 4 5 6; do if curl -fsS --max-time 8 "https://\$H/v1/health" 2>/dev/null | grep -q '"ok":true'; then echo "✓ https://\$H erreichbar"; echo; $(command -v node) $DIR/scalpdesk-247.mjs --config $CONF --zugang; exit 0; fi; sleep 5; done
             echo "✗ https://\$H nicht erreichbar – Ports 80 und 443 in der Oracle-Konsole freigeben (siehe Anleitung) und Caddy prüfen: sudo systemctl status caddy"; exit 1 ;;
  protokoll) journalctl -u scalpdesk-247 -n "\${2:-60}" --no-pager ;;
  live)      echo 'Protokoll live – beenden mit Strg+C'; journalctl -u scalpdesk-247 -f -n 20 ;;
  neustart)  systemctl restart scalpdesk-247 && echo 'Dienst neu gestartet.' ;;
  *)        echo 'Befehle: sudo scalpdesk-247 status | zugang | https | protokoll | live | neustart' ;;
esac
EOF
chmod 755 "$BIN"
cat <<'EOF'

Fertig. Jetzt in der App: 🔔 Hinweise → „Telegram / Discord einrichten“ → „An den 24/7-Dienst übergeben“ einschalten.
Für die Chat-Schalter und die Sendefreigabe (ab App 3.33.0) dort unter „24/7-Dienst“ Adresse und Zugangsschlüssel eintragen:
  sudo scalpdesk-247 zugang
Nach spätestens einer Minute steht dort „Übergeben ✓ vom Dienst bestätigt“, und in Telegram kommt „✅ 24/7-Dienst hat übernommen“.
Wichtig: In der App unter „Kursalarm“ müssen derselbe Bot und dieselbe Chat-ID stehen wie hier am Server.

Nützlich:
  Alles prüfen:  sudo scalpdesk-247 status
  Zugang (App):  sudo scalpdesk-247 zugang       (HTTPS erneut prüfen: sudo scalpdesk-247 https)
  Protokoll:     sudo scalpdesk-247 protokoll     (live: sudo scalpdesk-247 live)
  Aktualisieren: denselben Befehl wie bei der Einrichtung erneut ausführen
  Entfernen:     sudo bash /opt/scalpdesk-247/install.sh --remove
EOF
