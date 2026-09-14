#!/usr/bin/env bash
# Put API keys where the tooling expects them, without ever writing one
# into a tracked file. The bash sibling of set-keys.ps1; same rules.
#
#   ./scripts/set-keys.sh                 # prompts, typing hidden
#   ./scripts/set-keys.sh --gemini "$KEY" # non-interactive
#
# There is no placeholder to edit, on purpose: this file is tracked, so a
# key left in it is one `git add -A` away from being published.
set -euo pipefail

GEMINI=""; GSC=""; FORCE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --gemini) GEMINI="${2:-}"; shift 2 ;;
    --gsc)    GSC="${2:-}";    shift 2 ;;
    --force)  FORCE=1;         shift 1 ;;
    *) echo "unknown option: $1" >&2; exit 1 ;;
  esac
done

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="$root/.env.local"

mask() { local v="$1"; local n=${#v}
  if [ "$n" -le 8 ]; then printf '%*s' "$n" '' | tr ' ' '*'
  else printf '%s%s%s' "${v:0:4}" "$(printf '%*s' $((n-8)) '' | tr ' ' '*')" "${v: -4}"; fi; }

echo; echo "  repository: $root"; echo "  target:     .env.local"; echo

if [ -z "$GEMINI" ] && [ -t 0 ]; then
  echo "  Gemini API key — writes the outreach observations."
  echo "  Leave blank to skip. Typing is hidden."
  read -rsp "  GEMINI_API_KEY: " GEMINI; echo; echo
fi
if [ -z "$GSC" ] && [ -t 0 ]; then
  echo "  Search Console token — verifies the site. Optional, blank to skip."
  read -rsp "  GSC_VERIFICATION: " GSC; echo; echo
fi

[ -z "$GEMINI" ] && [ -z "$GSC" ] && { echo "  Nothing given, nothing written."; echo; exit 1; }

# A Google key has a recognisable shape. Say so now rather than let a
# typo surface as a 400 three minutes into a run.
if [ -n "$GEMINI" ] && ! printf '%s' "$GEMINI" | grep -Eq '^AIza[0-9A-Za-z_-]{30,}$'; then
  echo "  WARNING: that does not look like a Google API key."
  echo "           They normally begin 'AIza' and run about 39 characters."
  if [ -t 0 ]; then
    read -rp "           Write it anyway? (y/N) " a
    [ "$a" = "y" ] || { echo "  Stopped, nothing written."; exit 1; }
  elif [ "$FORCE" -ne 1 ]; then
    # No terminal to ask at. Refuse rather than silently install a typo
    # that will fail three minutes into a run; --force to override.
    echo "           Refusing without a terminal to confirm at. Pass --force to override." >&2
    exit 1
  fi
fi

# Confirm the target really is ignored BEFORE writing a secret to it.
cd "$root"
if ! git check-ignore -q .env.local 2>/dev/null; then
  echo "  STOP: .env.local is not gitignored in this checkout." >&2
  echo "        Writing a key there could commit it. Add '.env.local' to .gitignore first." >&2
  exit 1
fi

upsert() { # name value — replace the line if present, append if not
  local name="$1" value="$2"
  touch "$env_file"
  if grep -Eq "^[[:space:]]*${name}[[:space:]]*=" "$env_file"; then
    local tmp; tmp="$(mktemp)"
    awk -v n="$name" -v v="$value" \
      'BEGIN{FS=OFS="="} $0 ~ "^[[:space:]]*"n"[[:space:]]*=" {print n"="v; done=1; next} {print} END{if(!done&&0)print}' \
      "$env_file" > "$tmp"
    mv "$tmp" "$env_file"
    echo "  $(printf '%-18s' "$name") $(mask "$value")  updated"
  else
    printf '%s=%s\n' "$name" "$value" >> "$env_file"
    echo "  $(printf '%-18s' "$name") $(mask "$value")  added"
  fi
}

[ -n "$GEMINI" ] && upsert GEMINI_API_KEY   "$GEMINI"
[ -n "$GSC" ]    && upsert GSC_VERIFICATION "$GSC"

chmod 600 "$env_file" 2>/dev/null || true

cat <<'MSG'

  Written to .env.local.

  Confirm it is picked up, without spending a request:
    npm run sourcing:write:dry

  Then the real run:
    npm run sourcing:write

  If a key ever leaks, revoke it at aistudio.google.com/apikey and run
  this again. Nothing in the repo depends on the old value.

MSG
