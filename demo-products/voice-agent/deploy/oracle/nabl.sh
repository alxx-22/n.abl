#!/usr/bin/env bash
# n.abl Reception on an Oracle Cloud Always Free server (Canonical Ubuntu 24.04, Arm).
#
#   sudo nabl install   first boot (cloud-init runs it): Docker, Caddy, the firewall,
#                       the app, and a check every five minutes for new code
#   sudo nabl update    fetch the branch; build and swap in the app if it moved
#   sudo nabl deploy    build and swap in the app now (after changing a setting)
#   sudo nabl status    what is running, and the end of its log
#   sudo nabl logs      follow the app's log
#
# Settings live in /opt/nabl/secrets.env (root only), written by cloud-init
# (deploy/oracle/cloud-init.yaml). Guide: deploy/oracle/README.md.
set -euo pipefail

DIR=${NABL_DIR:-/opt/nabl}
SRC=$DIR/src
APP=$SRC/demo-products/voice-agent
REPO=https://github.com/alxx-22/n.abl.git
NAME=nabl-reception
SELF=/usr/local/bin/nabl
PORT=8787
CADDYFILE=${NABL_CADDYFILE:-/etc/caddy/Caddyfile}

log() { echo "[$(date -u '+%F %T')] $*"; }
die() { log "ERROR: $*"; exit 1; }

# A value from secrets.env, without spaces or quotes round it; $2 if unset.
setting() {
  local v
  v=$(grep -E "^[[:space:]]*$1[[:space:]]*=" "$DIR/secrets.env" 2>/dev/null | tail -1 | cut -d= -f2- || true)
  v=$(printf '%s' "$v" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/")
  printf '%s' "${v:-${2:-}}"
}

check_settings() {
  [ -f "$DIR/secrets.env" ] || die "$DIR/secrets.env is missing."
  local k v
  for k in GEMINI_API_KEY DATABASE_URL CONSOLE_PASSWORD DEMO_PROXY_SECRET; do
    v=$(setting "$k")
    case "$v" in ''|PASTE*|paste*) die "Fill in $k in $DIR/secrets.env, then run: sudo nabl deploy" ;; esac
  done
  case "$(setting DATABASE_URL)" in postgres://*|postgresql://*) ;; *) die "DATABASE_URL should start postgresql:// (Supabase → Connect → Session pooler)." ;; esac
}

# The app's environment: secrets.env (quotes removed), plus what this deploy decides.
write_env() {
  [ -s "$DIR/session.secret" ] || (umask 077 && openssl rand -hex 32 > "$DIR/session.secret")
  local tmp k
  tmp=$(mktemp "$DIR/app.env.XXXXXX")
  {
    grep -E '^[[:space:]]*[A-Z_][A-Z0-9_]*[[:space:]]*=' "$DIR/secrets.env" | cut -d= -f1 | tr -d ' \t' | sort -u | while read -r k; do
      case "$k" in ORIGIN_HOST|DEPLOY_BRANCH) continue ;; esac
      printf '%s=%s\n' "$k" "$(setting "$k")"
    done
    [ -n "$(setting SESSION_SECRET)" ] || echo "SESSION_SECRET=$(cat "$DIR/session.secret")"
    # Caddy writes X-Real-IP on every request; a visitor cannot.
    echo "CLIENT_IP_HEADER=x-real-ip"
    [ -n "$(setting MAX_CONCURRENT_CALLS)" ] || echo "MAX_CONCURRENT_CALLS=3"
  } > "$tmp"
  chmod 600 "$tmp"
  mv -f "$tmp" "$DIR/app.env"
}

install_packages() {
  # shellcheck disable=SC1091
  . /etc/os-release
  [ "${ID:-}" = ubuntu ] || die "This expects Canonical Ubuntu 24.04; this server runs ${PRETTY_NAME:-something else}."
  export DEBIAN_FRONTEND=noninteractive
  log "Installing Docker, Caddy and git"
  # On a first boot the system's own updates often hold apt's lock for a few minutes.
  local apt=(apt-get -q -o DPkg::Lock::Timeout=900)
  "${apt[@]}" update
  "${apt[@]}" install -y docker.io caddy git curl openssl
  "${apt[@]}" install -y docker-buildx >/dev/null 2>&1 || log "No docker-buildx package: the classic builder will do."
  systemctl enable --now docker
}

# Oracle's Ubuntu images refuse everything but SSH. Let the web in (Caddy
# answers on 80 and 443; the app itself listens on localhost only).
open_ports() {
  local rules=/etc/iptables/rules.v4 p
  for p in 443 80; do
    iptables -C INPUT -p tcp --dport "$p" -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport "$p" -j ACCEPT
    if [ -f "$rules" ] && ! grep -q -- "--dport $p -j ACCEPT" "$rules"; then
      sed -i "/--dport 22 -j ACCEPT/a -A INPUT -p tcp -m state --state NEW -m tcp --dport $p -j ACCEPT" "$rules"
    fi
  done
}

# The app never needs the server's metadata service, which holds the
# cloud-init settings. The website reader refuses such addresses already;
# this makes sure. DNS (port 53 on the same address) is left alone.
guard_metadata() {
  iptables -L DOCKER-USER -n >/dev/null 2>&1 || iptables -N DOCKER-USER
  iptables -C DOCKER-USER -d 169.254.169.254/32 -p tcp -m multiport --dports 80,443 -j REJECT 2>/dev/null \
    || iptables -I DOCKER-USER 1 -d 169.254.169.254/32 -p tcp -m multiport --dports 80,443 -j REJECT
}

write_units() {
  cat > /etc/systemd/system/nabl-guard.service <<'UNIT'
[Unit]
Description=n.abl Reception: keep containers off the metadata service
After=docker.service
PartOf=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/bin/nabl guard

[Install]
WantedBy=docker.service
UNIT
  cat > /etc/systemd/system/nabl-update.service <<'UNIT'
[Unit]
Description=n.abl Reception: deploy new code from GitHub
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/nabl update
UNIT
  cat > /etc/systemd/system/nabl-update.timer <<'UNIT'
[Unit]
Description=n.abl Reception: look for new code every five minutes

[Timer]
OnBootSec=3min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
UNIT
  systemctl daemon-reload
}

write_caddy() {
  local host
  host=$(setting ORIGIN_HOST demo-origin.nabl.agency)
  cat > "$CADDYFILE" <<CADDY
# n.abl Reception: HTTPS for $host (a Let's Encrypt certificate, once the
# DNS record points here), passed to the app on localhost. Written by nabl.sh.
$host {
	reverse_proxy 127.0.0.1:$PORT {
		# The visitor's address, which a client cannot set (CLIENT_IP_HEADER).
		header_up X-Real-IP {remote_host}
		# The site's Worker says which host the visitor used (nabl.agency): keep it.
		header_up X-Forwarded-Host {http.request.header.X-Forwarded-Host}
	}
}
CADDY
  caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null
  systemctl enable caddy >/dev/null 2>&1
  systemctl reload-or-restart caddy
}

fetch_code() {
  local branch
  branch=$(setting DEPLOY_BRANCH voice-agent-DEV)
  if [ ! -d "$SRC/.git" ]; then
    log "Fetching the code ($branch)"
    # Only the demo's folder: the whole repository is large.
    git clone --quiet --depth 1 --filter=blob:none --sparse --branch "$branch" "$REPO" "$SRC"
    git -C "$SRC" sparse-checkout set demo-products/voice-agent
  else
    git -C "$SRC" fetch --quiet --depth 1 origin "$branch"
    git -C "$SRC" reset --quiet --hard FETCH_HEAD
  fi
}

# This script, from the code just fetched, so fixes to it arrive the same way.
install_self() {
  local new="$APP/deploy/oracle/nabl.sh"
  [ -f "$new" ] || return 0
  if ! cmp -s "$new" "$SELF"; then
    command install -m 755 "$new" "$SELF.new"
    mv -f "$SELF.new" "$SELF"
    "$SELF" units
  fi
}

health() { curl -fsS --max-time 5 "http://127.0.0.1:$PORT/demo/healthz" 2>/dev/null || true; }
calls_now() { health | sed -n 's/.*"calls":\([0-9]*\).*/\1/p'; }

wait_healthy() {
  local i
  for i in $(seq 1 45); do
    health | grep -q '"ok":true' && return 0
    sleep 2
  done
  return 1
}

run_image() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker run -d --name "$NAME" --restart unless-stopped \
    --env-file "$DIR/app.env" -e "APP_VERSION=$2" \
    -p "127.0.0.1:$PORT:$PORT" --memory 8g \
    --log-opt max-size=20m --log-opt max-file=5 \
    "$1" >/dev/null
}

cmd_deploy() {
  check_settings
  write_env
  local rev previous i n
  rev=$(git -C "$SRC" rev-parse --short HEAD)
  log "Building $rev"
  if ! docker build --quiet -t "$NAME:$rev" "$APP" >/dev/null; then
    echo "$rev" > "$DIR/failed"
    die "The build of $rev failed; the running version is unchanged."
  fi
  # A call in progress is let finish (the longest is 12 minutes).
  for i in $(seq 1 90); do
    n=$(calls_now)
    if [ -z "$n" ] || [ "$n" = 0 ]; then break; fi
    [ "$i" = 1 ] && log "Waiting for $n call(s) to end"
    sleep 10
  done
  previous=$(docker inspect --format '{{.Config.Image}}' "$NAME" 2>/dev/null || true)
  run_image "$NAME:$rev" "$rev"
  if wait_healthy; then
    echo "$rev" > "$DIR/deployed"
    rm -f "$DIR/failed"
    log "Running $rev"
    # Keep the last three builds, for going back by hand.
    docker images "$NAME" --format '{{.Tag}}' | tail -n +4 | while read -r t; do docker rmi "$NAME:$t" >/dev/null 2>&1 || true; done
    docker image prune -f >/dev/null 2>&1 || true
  else
    log "$rev did not come up healthy:"
    docker logs --tail 40 "$NAME" 2>&1 || true
    echo "$rev" > "$DIR/failed"
    if [ -n "$previous" ] && [ "$previous" != "$NAME:$rev" ]; then
      log "Putting $previous back"
      run_image "$previous" "${previous##*:}"
      wait_healthy || log "$previous is not healthy either: check secrets.env, then sudo nabl deploy"
    fi
    return 1
  fi
}

cmd_update() {
  [ -d "$SRC/.git" ] || die "Not installed yet: sudo nabl install"
  fetch_code
  install_self
  local rev
  rev=$(git -C "$SRC" rev-parse --short HEAD)
  # Already running, or already tried and failed: nothing to do until the code moves.
  if [ "$rev" = "$(cat "$DIR/deployed" 2>/dev/null)" ] && [ -n "$(docker ps -q --filter "name=^$NAME\$")" ]; then return 0; fi
  [ "$rev" = "$(cat "$DIR/failed" 2>/dev/null)" ] && return 0
  cmd_deploy
}

cmd_install() {
  check_settings
  install_packages
  open_ports
  fetch_code
  command install -m 755 "$APP/deploy/oracle/nabl.sh" "$SELF"
  write_units
  write_caddy
  systemctl enable --now nabl-guard.service || log "Could not guard the metadata service yet: it is retried whenever Docker starts."
  systemctl enable --now nabl-update.timer
  cmd_deploy
  log "Installed. Once the DNS record points here, https://$(setting ORIGIN_HOST demo-origin.nabl.agency)/demo/healthz answers."
}

status() {
  echo "Running:  $(cat "$DIR/deployed" 2>/dev/null || echo nothing yet)"
  echo "Code:     $(git -C "$SRC" log -1 --format='%h %s (%cr)' 2>/dev/null || echo 'not fetched')"
  [ -f "$DIR/failed" ] && echo "Failed:   $(cat "$DIR/failed") (left out until the code moves on)"
  echo "App:      $(docker ps -a --filter "name=^$NAME\$" --format '{{.Status}}' 2>/dev/null)"
  echo "Health:   $(health)"
  echo "Caddy:    $(systemctl is-active caddy 2>/dev/null || true)"
  echo "Updates:  $(systemctl show nabl-update.timer -p NextElapseUSecRealtime --value 2>/dev/null || true)"
  echo
  docker logs --tail 15 "$NAME" 2>&1 || true
}

main() {
  case "${1:-}" in
    install|update|deploy)
      [ "$(id -u)" = 0 ] || die "Run it with sudo."
      mkdir -p "$DIR"
      # One at a time: the five-minute check skips while anything else runs.
      exec 9>"$DIR/.lock"
      if [ "$1" = update ]; then flock -n 9 || exit 0; else flock 9; fi
      if [ "$1" = deploy ]; then [ -d "$SRC/.git" ] || die "Not installed yet: sudo nabl install"; fi
      "cmd_$1"
      ;;
    units) write_units ;;
    guard) guard_metadata ;;
    status) status ;;
    logs) exec docker logs -f --tail 100 "$NAME" ;;
    *) sed -n '2,12p' "$0"; exit 1 ;;
  esac
}

# Sourced by the tests (NABL_TEST=1) for its functions alone.
[ "${NABL_TEST:-}" = 1 ] || main "$@"
