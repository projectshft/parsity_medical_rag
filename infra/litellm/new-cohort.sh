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
source "$(dirname "$0")/.env"
PROXY_URL="${PROXY_URL:-http://localhost:4000}"

OUT="keys-${COHORT}.csv"
umask 077
echo "student,api_key,budget_usd,expires_days" > "$OUT"

echo "==> Minting keys for cohort '$COHORT' ($BUDGET USD per student, ${DAYS}d lifetime)"

while IFS= read -r STUDENT; do
  [ -z "$STUDENT" ] && continue
  RESP=$(curl -s -X POST "$PROXY_URL/key/generate" \
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
  KEY=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('key','ERROR'))")
  echo "${STUDENT},${KEY},${BUDGET},${DAYS}" >> "$OUT"
  echo "    $STUDENT -> $KEY"
done < "$ROSTER"

echo ""
echo "==> Done. Keys saved to $OUT"
echo "==> Students set: OPENAI_API_KEY=<their key>, OPENAI_BASE_URL=$PROXY_URL"
