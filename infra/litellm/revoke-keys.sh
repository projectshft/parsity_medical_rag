#!/usr/bin/env bash
# Revoke every key listed in one or more keys-*.csv files. Use after a leak.
#   ./revoke-keys.sh keys-cohort-4.csv keys-canary.csv keys-class-sat.csv
# Reads LITELLM_MASTER_KEY / PROXY_URL from ./.env. Prints status codes only,
# never key values. Then run ./bootstrap-cohort.sh to mint replacements.
set -euo pipefail
cd "$(dirname "$0")"
[ "$#" -ge 1 ] || { echo "Usage: ./revoke-keys.sh <keys.csv> [more.csv ...]" >&2; exit 1; }
[ -f .env ] || { echo "No .env here (needs LITELLM_MASTER_KEY)." >&2; exit 1; }
source ./.env
PROXY_URL="${PROXY_URL:-https://parsity-litellm.fly.dev}"
if [ -z "${LITELLM_MASTER_KEY:-}" ] || [ "$LITELLM_MASTER_KEY" = "sk-..." ]; then
  echo "LITELLM_MASTER_KEY is empty or the placeholder; use ./bootstrap-cohort.sh --rotate first." >&2; exit 1
fi
fail=0
for f in "$@"; do
  [ -f "$f" ] || { echo "skip $f (not found)"; continue; }
  while IFS=, read -r student key _; do
    [ "$student" = "student" ] && continue
    case "$key" in sk-*) ;; *) echo "  skip   $student (no usable key)"; continue ;; esac
    code=$(curl -s -o /dev/null -m 30 -w '%{http_code}' -X POST "$PROXY_URL/key/delete" \
      -H "Authorization: Bearer $LITELLM_MASTER_KEY" -H 'Content-Type: application/json' \
      -d "{\"keys\":[\"$key\"]}" || true)
    if [ "$code" = "200" ]; then echo "  revoked $student"; else echo "  FAILED  $student (HTTP $code)"; fail=1; fi
  done < "$f"
done
exit "$fail"
