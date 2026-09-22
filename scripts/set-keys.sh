#!/usr/bin/env bash
# Put API keys where the tooling expects them, without ever writing one
# into a tracked file. The bash sibling of set-keys.ps1; same rules.
#
#   ./scripts/set-keys.sh                     # prompts for each, typing hidden
#   ./scripts/set-keys.sh --companies-house   # prompts for just that one
#   ./scripts/set-keys.sh --gemini "$KEY"     # non-interactive
#
# A flag with no value after it means "ask me for only this one"; a flag
# with a value sets it without asking.
#
# There is no placeholder to edit, on purpose: this file is tracked, so a
# key left in it is one `git add -A` away from being published.
set -euo pipefail

GEMINI=""; GSC=""; CH=""; DISC=""; FORCE=0; ONLY=""
# The next argument is a value only if there is one and it is not a flag.
# Without this check, `--companies-house` on its own would `shift 2` past
# the end of the list and set -e would end the script with no message.
has_value() { [ -n "${1:-}" ] && [ "${1#--}" = "$1" ]; }
while [ $# -gt 0 ]; do
  case "$1" in
    --gemini)           if has_value "${2:-}"; then GEMINI="$2"; shift 2; else ONLY="$ONLY gemini";    shift; fi ;;
    --gsc)              if has_value "${2:-}"; then GSC="$2";    shift 2; else ONLY="$ONLY gsc";       shift; fi ;;
    --companies-house)  if has_value "${2:-}"; then CH="$2";     shift 2; else ONLY="$ONLY ch";        shift; fi ;;
    --gemini-discovery) if has_value "${2:-}"; then DISC="$2";   shift 2; else ONLY="$ONLY discovery"; shift; fi ;;
    --force)  FORCE=1;         shift 1 ;;
    *) echo "unknown option: $1" >&2; exit 1 ;;
  esac
done
# Ask about a key only if nothing narrowed the run, or it was named.
want() { [ -z "$ONLY" ] && return 0; case " $ONLY " in *" $1 "*) return 0 ;; *) return 1 ;; esac; }

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="$root/.env.local"

mask() { local v="$1"; local n=${#v}
  if [ "$n" -le 8 ]; then printf '%*s' "$n" '' | tr ' ' '*'
  else printf '%s%s%s' "${v:0:4}" "$(printf '%*s' $((n-8)) '' | tr ' ' '*')" "${v: -4}"; fi; }

echo; echo "  repository: $root"; echo "  target:     .env.local"; echo

if [ -z "$GEMINI" ] && [ -t 0 ] && want gemini; then
  echo "  Gemini API key — writes the outreach observations."
  echo "  Leave blank to skip. Typing is hidden."
  read -rsp "  GEMINI_API_KEY: " GEMINI; echo; echo
fi
if [ -z "$GSC" ] && [ -t 0 ] && want gsc; then
  echo "  Search Console token — verifies the site. Optional, blank to skip."
  read -rsp "  GSC_VERIFICATION: " GSC; echo; echo
fi
if [ -z "$CH" ] && [ -t 0 ] && want ch; then
  echo "  Companies House REST key — the lead puller. Blank to skip."
  echo "  developer.company-information.service.gov.uk → Your applications → a REST key, Live."
  read -rsp "  COMPANIES_HOUSE_API_KEY: " CH; echo; echo
fi
if [ -z "$DISC" ] && [ -t 0 ] && want discovery; then
  echo "  A SECOND Google project's key — the puller's prospector only. Blank to skip."
  echo "  Not your GEMINI_API_KEY: a separate project is a separate quota pool."
  read -rsp "  GEMINI_DISCOVERY_API_KEY: " DISC; echo; echo
fi

[ -z "$GEMINI" ] && [ -z "$GSC" ] && [ -z "$CH" ] && [ -z "$DISC" ] && { echo "  Nothing given, nothing written."; echo; exit 1; }

# A Google key has a recognisable shape. Say so now rather than let a
# typo surface as a 400 three minutes into a run.
check_google_shape() { # name value
  printf '%s' "$2" | grep -Eq '^AIza[0-9A-Za-z_-]{30,}$' && return 0
  echo "  WARNING: $1 does not look like a Google API key."
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
}
[ -n "$GEMINI" ] && check_google_shape GEMINI_API_KEY "$GEMINI"
[ -n "$DISC" ]   && check_google_shape GEMINI_DISCOVERY_API_KEY "$DISC"

# The same key twice defeats the point of the second project: both would
# spend one quota pool. Refuse rather than write it.
if [ -n "$DISC" ]; then
  existing_gemini="$GEMINI"
  if [ -z "$existing_gemini" ] && [ -f "$env_file" ]; then
    existing_gemini="$(grep -E '^[[:space:]]*GEMINI_API_KEY[[:space:]]*=' "$env_file" | tail -1 | cut -d= -f2- || true)"
  fi
  if [ -n "$existing_gemini" ] && [ "$existing_gemini" = "$DISC" ]; then
    echo "  STOP: GEMINI_DISCOVERY_API_KEY is the same key as GEMINI_API_KEY." >&2
    echo "        It has to come from a different Google project, or it shares the writer's quota." >&2
    exit 1
  fi
fi

# Companies House keys have no published shape, so none is enforced — a
# guessed format that rejected a real key would be worse than no check.

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
    echo "  $(printf '%-24s' "$name") $(mask "$value")  updated"
  else
    printf '%s=%s\n' "$name" "$value" >> "$env_file"
    echo "  $(printf '%-24s' "$name") $(mask "$value")  added"
  fi
}

[ -n "$GEMINI" ] && upsert GEMINI_API_KEY           "$GEMINI"
[ -n "$GSC" ]    && upsert GSC_VERIFICATION         "$GSC"
[ -n "$CH" ]     && upsert COMPANIES_HOUSE_API_KEY  "$CH"
[ -n "$DISC" ]   && upsert GEMINI_DISCOVERY_API_KEY "$DISC"

chmod 600 "$env_file" 2>/dev/null || true

cat <<'MSG'

  Written to .env.local.

  Confirm it is picked up, without spending a request:
    npm run sourcing:write:dry                              (the writer)
    npm run sourcing:pull:dry -- --location Nottingham      (the lead puller)

  Then the real run:
    npm run sourcing:write
    npm run sourcing:pull -- --location Nottingham --sic 432

  If a key ever leaks, revoke it at aistudio.google.com/apikey and run
  this again. Nothing in the repo depends on the old value.

MSG
