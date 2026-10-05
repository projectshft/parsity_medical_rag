#!/usr/bin/env bash
# =============================================================
# PER-COHORT SCRIPT: run every time a new cohort starts.
#
# Usage:
#   ./new-cohort.sh <cohort-name> <roster.txt> [budget] [days]
#
# Example:
#   ./new-cohort.sh 2026-q3 roster.txt 10 90
#
# roster.txt = one student email (or name) per line.
# budget     = total $ per student for the cohort (default 10)
# days       = key lifetime in days (default 90)
#
# Output: keys-<cohort-name>.csv (student, key) — gitignored.
# =============================================================
set -euo pipefail

COHORT="${1:?Usage: ./new-cohort.sh <cohort-name> <roster.txt> [budget] [days]}"
ROSTER="${2:?Provide a roster file (one student per line)}"
BUDGET="${3:-10}"
DAYS="${4:-90}"

# Load env (needs LITELLM_MASTER_KEY and PROXY_URL)
ENV_FILE="$(dirname "$0")/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE does not exist. Copy .env.example to .env and fill it in." >&2
  exit 1
fi
source "$ENV_FILE"
PROXY_URL="${PROXY_URL:-http://localhost:4000}"

# `cp .env.example .env` leaves placeholders behind, and the placeholder master
# key authenticates against nothing. Catch it here rather than after a roster of
# failed mints.
if [ -z "${LITELLM_MASTER_KEY:-}" ] || [ "$LITELLM_MASTER_KEY" = "sk-..." ]; then
  echo "ERROR: LITELLM_MASTER_KEY in $ENV_FILE is empty or still the placeholder." >&2
  echo "       It is the admin key the proxy was deployed with. Fly cannot show it" >&2
  echo "       back to you (\`fly secrets list\` prints digests only), so take it from" >&2
  echo "       wherever you stored it. If it is lost, rotate:" >&2
  echo "         fly secrets set LITELLM_MASTER_KEY=sk-\$(openssl rand -hex 32) -a parsity-litellm" >&2
  echo "       Rotating is safe: already-minted keys live in Postgres and still work." >&2
  exit 1
fi

OUT="keys-${COHORT}.csv"
umask 077
# Write to a temp file and move it into place only on success, so a failed run
# never leaves a CSV that looks like a result.
TMP_OUT="$(mktemp "${OUT}.XXXXXX")"
trap 'rm -f "$TMP_OUT"' EXIT
echo "student,api_key,budget_usd,expires_days" > "$TMP_OUT"

echo "==> Minting keys for cohort '$COHORT' ($BUDGET USD per student, ${DAYS}d lifetime)"

while IFS= read -r STUDENT; do
  [ -z "$STUDENT" ] && continue
  RESP=$(curl -s -w $'\n%{http_code}' -X POST "$PROXY_URL/key/generate" \
    -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"key_alias\": \"${COHORT}-${STUDENT}\",
      \"max_budget\": ${BUDGET},
      \"duration\": \"${DAYS}d\",
      \"metadata\": {\"cohort\": \"${COHORT}\", \"student\": \"${STUDENT}\"}
    }")
    # NOTE: no "models" key = student may use ANY model the proxy serves
    # (all OpenAI models via the wildcard route + the Bedrock gpt-5.x models).
    # To restrict, add e.g. "models": ["gpt-4o-mini","text-embedding-3-small"].
  HTTP_CODE="$(printf '%s' "$RESP" | tail -n1)"
  BODY="$(printf '%s' "$RESP" | sed '$d')"

  # Fail LOUDLY and immediately. The old version wrote the string "ERROR" into
  # the CSV for every student and still printed "Done", which looks like success
  # in a scrollback and hands out a file full of unusable keys.
  if [ "$HTTP_CODE" != "200" ]; then
    echo "" >&2
    echo "ERROR: $PROXY_URL/key/generate returned HTTP $HTTP_CODE for $STUDENT." >&2
    echo "       $BODY" >&2
    echo "       401 here means LITELLM_MASTER_KEY is wrong. Nothing was minted." >&2
    exit 1
  fi

  KEY=$(printf '%s' "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('key',''))")
  if [ -z "$KEY" ]; then
    echo "" >&2
    echo "ERROR: HTTP 200 but no 'key' in the response for $STUDENT:" >&2
    echo "       $BODY" >&2
    exit 1
  fi

  echo "${STUDENT},${KEY},${BUDGET},${DAYS}" >> "$TMP_OUT"
  echo "    $STUDENT -> $KEY"
done < "$ROSTER"

mv "$TMP_OUT" "$OUT"
trap - EXIT
chmod 600 "$OUT"

echo ""
echo "==> Done. Keys saved to $OUT"
echo "==> Each student sets FOUR lines (the key is the same value twice —"
echo "    the Jev judge in week 5 rides the same proxy, see RUNBOOK.md):"
echo "      OPENAI_API_KEY=<their key>"
echo "      OPENAI_BASE_URL=$PROXY_URL"
echo "      TYPESAFE_API_KEY=<their key>"
echo "      TYPESAFE_BASE_URL=$PROXY_URL"
