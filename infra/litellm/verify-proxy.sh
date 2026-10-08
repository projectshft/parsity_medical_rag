#!/usr/bin/env bash
# =============================================================
# Verify the proxy works for a student. READ-ONLY — mints nothing,
# changes nothing. Safe to run any time, including mid-cohort.
#
#   ./verify-proxy.sh                 # uses the canary key from keys-canary.csv
#   ./verify-proxy.sh sk-abc123...    # or check one specific student's key
#
# Use this instead of bootstrap-cohort.sh once keys exist — bootstrap MINTS,
# so re-running it gives you a second set of keys and a confusing CSV.
# =============================================================
set -uo pipefail

cd "$(dirname "$0")"
PROXY_URL="${PROXY_URL:-https://parsity-litellm.fly.dev}"
[ -f .env ] && PROXY_URL=$(grep -E '^PROXY_URL=' .env 2>/dev/null | cut -d= -f2- || echo "$PROXY_URL")
PROXY_URL="${PROXY_URL:-https://parsity-litellm.fly.dev}"

KEY="${1:-}"
if [ -z "$KEY" ]; then
  if [ -f keys-canary.csv ]; then
    KEY=$(tail -n1 keys-canary.csv | cut -d, -f2)
    echo "Using the canary key from keys-canary.csv"
  else
    echo "No key given and no keys-canary.csv here." >&2
    echo "Usage: ./verify-proxy.sh [sk-...]   (or run from infra/litellm with keys-canary.csv present)" >&2
    exit 1
  fi
fi
case "$KEY" in
  sk-*) ;;
  *) echo "That doesn't look like a LiteLLM key (expected sk-...). Got: ${KEY:0:6}…" >&2; exit 1 ;;
esac

FAILED=0
pass() { printf '  \033[32mPASS\033[0m  %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; FAILED=1; }

echo
echo "Proxy: $PROXY_URL"
echo

# 1 ---------------------------------------------------------------- liveness
code=$(curl -s -o /dev/null -m 20 -w '%{http_code}' "$PROXY_URL/health/readiness")
[ "$code" = "200" ] && pass "proxy is up (readiness 200)" \
  || fail "readiness returned $code — check 'fly status -a parsity-litellm'"

# 2 ----------------------------------------------- the guard on the Jev route
# Runs BEFORE the keyed checks: if this one is wrong, the key is being spent by
# strangers and that matters more than whether your own calls work.
code=$(curl -s -o /dev/null -m 25 -w '%{http_code}' "$PROXY_URL/v1/systemone" \
  -H 'Content-Type: application/json' -d '{}')
case "$code" in
  401|403) pass "/v1/systemone rejects unauthenticated callers ($code)" ;;
  404) fail "/v1/systemone is 404 — the deployed image predates the Jev route; fly deploy --no-cache" ;;
  422) fail "OPEN RELAY: 422 means the request reached TypeSafe, so auth is NOT enforced. Rotate TYPESAFE_API_KEY and restore 'auth: true'." ;;
  2*)  fail "OPEN RELAY on /v1/systemone — anyone can spend our TypeSafe key. Rotate it now." ;;
  *)   fail "/v1/systemone returned $code unauthenticated — not a leak, but the proxy is unwell" ;;
esac

# 3 ------------------------------------------------- the three student routes
code=$(curl -s -o /dev/null -m 60 -w '%{http_code}' "$PROXY_URL/v1/chat/completions" \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"ping"}],"max_tokens":1}')
[ "$code" = "200" ] && pass "chat/completions (gpt-4o-mini)" || fail "chat/completions -> $code"

code=$(curl -s -o /dev/null -m 60 -w '%{http_code}' "$PROXY_URL/v1/embeddings" \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"model":"text-embedding-3-small","input":"ping"}')
[ "$code" = "200" ] && pass "embeddings (text-embedding-3-small) — week 1 depends on this" \
  || fail "embeddings -> $code"

RESP=$(curl -s -m 90 -w $'\n%{http_code}' "$PROXY_URL/v1/systemone" \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"model":"jev-latest","state":{"text":"The patient is doing well and reports no pain."},
       "questions":{"positive":{"type":"noul","instructions":"Is the tone of the text positive?"}}}')
code=$(printf '%s' "$RESP" | tail -n1)
body=$(printf '%s' "$RESP" | sed '$d' | tr -d '\n')
if [ "$code" = "200" ]; then
  pass "Jev judge (week 5) — $(printf '%s' "$body" | cut -c1-100)"
else
  fail "Jev -> $code — $(printf '%s' "$body" | head -c 160)"
fi

echo
if [ "$FAILED" = "0" ]; then
  printf '\033[32mAll green.\033[0m Students are good to go on this key.\n'
  echo "Reminder: each student's .env needs FOUR lines — the key twice:"
  echo "  OPENAI_API_KEY / OPENAI_BASE_URL / TYPESAFE_API_KEY / TYPESAFE_BASE_URL"
else
  printf '\033[31mSomething is broken.\033[0m Each FAIL above names its own fix;\n'
  echo "RUNBOOK.md has the longer version. Common causes, in order of likelihood:"
  echo "  - expired key (cohort 3's ran out silently — check the expiry in /ui)"
  echo "  - a column-name error in the 401 body means the DB schema is behind the"
  echo "    image: run prisma migrate deploy (see RUNBOOK.md)"
  echo "  - a 404 on /v1/systemone means the image predates the Jev route"
fi
exit "$FAILED"
