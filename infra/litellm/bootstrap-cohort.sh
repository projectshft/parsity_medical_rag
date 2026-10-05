#!/usr/bin/env bash
# =============================================================
# One command to get a cohort running: check the admin key, mint
# the student + canary keys, then PROVE the proxy actually works.
#
#   cd infra/litellm
#   ./bootstrap-cohort.sh cohort-4 roster-cohort4.txt
#   ./bootstrap-cohort.sh cohort-4 roster-cohort4.txt --rotate   # new master key
#
# Exists because doing this by hand went wrong four times in a row: deploying
# from the wrong directory, running against a branch without this folder, a
# placeholder master key that minted a CSV full of "ERROR", and keys that had
# silently expired a month earlier. Every one of those is checked here.
#
# Safe to re-run. Nothing is destructive except --rotate, which replaces the
# admin key (student keys live in Postgres and are unaffected).
# =============================================================
set -euo pipefail

COHORT="${1:-}"
ROSTER="${2:-}"
ROTATE="${3:-}"
APP="parsity-litellm"

if [ -z "$COHORT" ] || [ -z "$ROSTER" ]; then
  echo "Usage: ./bootstrap-cohort.sh <cohort-name> <roster.txt> [--rotate]" >&2
  exit 1
fi

cd "$(dirname "$0")"
say() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
ok()  { printf '    \033[32mOK\033[0m   %s\n' "$1"; }
bad() { printf '    \033[31mFAIL\033[0m %s\n' "$1"; }

# ---------------------------------------------------------------- 1. the repo
say "Checking you're on a branch that has this infra"
if [ ! -f new-cohort.sh ] || [ ! -f litellm-config.yaml ]; then
  bad "new-cohort.sh / litellm-config.yaml missing from $(pwd)."
  echo "    infra/litellm lives on the instructor branches only. Try:" >&2
  echo "      git checkout cohort-4-instructor && git pull" >&2
  exit 1
fi
grep -q "FOUR lines" new-cohort.sh || {
  bad "new-cohort.sh is an OLD copy (it would write 'ERROR' rows and exit 0)."
  echo "      git pull" >&2
  exit 1
}
ok "infra present, new-cohort.sh is current"

# ------------------------------------------------------------- 2. the secrets
say "Checking the admin key"
[ -f .env ] || { cp .env.example .env; echo "    created .env from .env.example"; }

if [ "$ROTATE" = "--rotate" ]; then
  NEW_KEY="sk-$(openssl rand -hex 32)"
  echo "    Rotating LITELLM_MASTER_KEY on Fly (safe: minted student keys are unaffected)"
  fly secrets set "LITELLM_MASTER_KEY=$NEW_KEY" -a "$APP"
  # Replace in .env without printing the value
  if grep -q '^LITELLM_MASTER_KEY=' .env; then
    tmp=$(mktemp); grep -v '^LITELLM_MASTER_KEY=' .env > "$tmp"
    printf 'LITELLM_MASTER_KEY=%s\n' "$NEW_KEY" >> "$tmp"
    mv "$tmp" .env
  else
    printf 'LITELLM_MASTER_KEY=%s\n' "$NEW_KEY" >> .env
  fi
  chmod 600 .env
  ok "rotated and written to .env — SAVE IT, Fly will never show it again"
  echo "    Setting a secret restarts the machine; waiting for it to come back."
  sleep 20
fi

# shellcheck disable=SC1091
source ./.env
if [ -z "${LITELLM_MASTER_KEY:-}" ] || [ "$LITELLM_MASTER_KEY" = "sk-..." ]; then
  bad "LITELLM_MASTER_KEY in infra/litellm/.env is empty or still the placeholder."
  echo "    Fly cannot show it back ('fly secrets list' prints digests only)." >&2
  echo "    Paste the real one into .env, or re-run with --rotate to make a new one:" >&2
  echo "      ./bootstrap-cohort.sh $COHORT $ROSTER --rotate" >&2
  exit 1
fi
ok "admin key present"

PROXY_URL="${PROXY_URL:-https://$APP.fly.dev}"

# -------------------------------------------------------------- 3. the proxy
say "Checking the proxy is up and carrying the current config"
code=$(curl -s -o /dev/null -m 20 -w '%{http_code}' "$PROXY_URL/health/readiness" || true)
[ "$code" = "200" ] && ok "readiness 200" || { bad "readiness $code — 'fly logs -a $APP'"; exit 1; }

code=$(curl -s -o /dev/null -m 25 -w '%{http_code}' "$PROXY_URL/v1/systemone" \
  -H 'Content-Type: application/json' -d '{}' || true)
case "$code" in
  401|403) ok "/v1/systemone guarded ($code)" ;;
  404) bad "/v1/systemone is 404 — the deployed image predates the Jev route."
       echo "    Rebuild: fly deploy --no-cache -a $APP   (from THIS directory)" >&2; exit 1 ;;
  422) bad "auth NOT enforced (422 = the request reached TypeSafe). OPEN RELAY."
       echo "    Restore 'auth: true' in litellm-config.yaml and rotate TYPESAFE_API_KEY." >&2; exit 1 ;;
  2*)  bad "OPEN RELAY on /v1/systemone — rotate TYPESAFE_API_KEY now."; exit 1 ;;
  *)   bad "/v1/systemone returned $code unauthenticated; key is not leaking but the proxy is unwell."; exit 1 ;;
esac

# --------------------------------------------------------------- 4. the keys
say "Minting keys"
./new-cohort.sh "$COHORT" "$ROSTER" 10 90
echo canary > .canary-roster.txt
./new-cohort.sh canary .canary-roster.txt 5 180    # outlives the cohort on purpose
rm -f .canary-roster.txt

CANARY_KEY=$(tail -n1 keys-canary.csv | cut -d, -f2)
[ -n "$CANARY_KEY" ] || { bad "could not read the canary key out of keys-canary.csv"; exit 1; }

# ------------------------------------------------------- 5. prove it all works
say "Proving a real key works end to end"

code=$(curl -s -o /dev/null -m 60 -w '%{http_code}' "$PROXY_URL/v1/chat/completions" \
  -H "Authorization: Bearer $CANARY_KEY" -H 'Content-Type: application/json' \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"ping"}],"max_tokens":1}' || true)
[ "$code" = "200" ] && ok "chat/completions 200" || bad "chat/completions $code"

code=$(curl -s -o /dev/null -m 60 -w '%{http_code}' "$PROXY_URL/v1/embeddings" \
  -H "Authorization: Bearer $CANARY_KEY" -H 'Content-Type: application/json' \
  -d '{"model":"text-embedding-3-small","input":"ping"}' || true)
[ "$code" = "200" ] && ok "embeddings 200" || bad "embeddings $code"

RESP=$(curl -s -m 90 -w $'\n%{http_code}' "$PROXY_URL/v1/systemone" \
  -H "Authorization: Bearer $CANARY_KEY" -H 'Content-Type: application/json' \
  -d '{"model":"jev-latest","state":{"text":"The patient is doing well and reports no pain."},
       "questions":{"positive":{"type":"noul","instructions":"Is the tone of the text positive?"}}}' || true)
code=$(printf '%s' "$RESP" | tail -n1)
if [ "$code" = "200" ]; then
  ok "Jev 200 — $(printf '%s' "$RESP" | sed '$d' | tr -d '\n' | cut -c1-120)"
else
  bad "Jev $code — $(printf '%s' "$RESP" | sed '$d' | head -c 200)"
fi

say "Done"
cat <<EOF
    Student keys : keys-${COHORT}.csv   (gitignored, mode 600)
    Canary key   : keys-canary.csv      -> set as the PROXY_CANARY_KEY repo secret,
                                           with PROXY_URL=$PROXY_URL
    Each student's .env needs FOUR lines — the key is the same value twice:
      OPENAI_API_KEY=<their key>
      OPENAI_BASE_URL=$PROXY_URL
      TYPESAFE_API_KEY=<their key>
      TYPESAFE_BASE_URL=$PROXY_URL
EOF
