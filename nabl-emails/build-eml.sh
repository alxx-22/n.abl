#!/usr/bin/env bash
# Build .eml (MIME multipart/alternative) files from the existing .html + .txt
# Each opens directly in Outlook / Apple Mail / Thunderbird with full branding.
set -e
cd "$(dirname "$0")"

subject_for() {
  case "$1" in
    general)  echo "A quick update from n.abl" ;;
    alert)    echo "Action Required - n.abl" ;;
    meeting)  echo "Your meeting with n.abl is confirmed" ;;
    proposal) echo "Your proposal from n.abl" ;;
    welcome)  echo "Welcome to n.abl" ;;
    update)   echo "Project update from n.abl" ;;
  esac
}

# Normalise any text to CRLF line endings (email standard)
to_crlf() { perl -pe 's/\r?\n/\r\n/' "$1"; }

for n in general alert meeting proposal welcome update; do
  subj="$(subject_for "$n")"
  boundary="=_nabl_$(date +%s)_${n}_part"
  out="email-${n}.eml"
  {
    printf 'From: n.abl <hello@nabl.co>\r\n'
    printf 'Subject: %s\r\n' "$subj"
    printf 'MIME-Version: 1.0\r\n'
    printf 'X-Unsent: 1\r\n'
    printf 'Content-Type: multipart/alternative; boundary="%s"\r\n' "$boundary"
    printf '\r\n'
    printf 'This is a multi-part message in MIME format.\r\n'
    printf -- '--%s\r\n' "$boundary"
    printf 'Content-Type: text/plain; charset="utf-8"\r\n'
    printf 'Content-Transfer-Encoding: 8bit\r\n'
    printf '\r\n'
    to_crlf "email-${n}.txt"
    printf '\r\n'
    printf -- '--%s\r\n' "$boundary"
    printf 'Content-Type: text/html; charset="utf-8"\r\n'
    printf 'Content-Transfer-Encoding: 8bit\r\n'
    printf '\r\n'
    to_crlf "email-${n}.html"
    printf '\r\n'
    printf -- '--%s--\r\n' "$boundary"
  } > "$out"
  echo "wrote $out"
done
