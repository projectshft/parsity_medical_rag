# LiteLLM Proxy — Operator Runbook

The 5-minute version. For deep setup/deploy details see [`README.md`](./README.md).

## What this is

One always-on box (`https://parsity-litellm.fly.dev`) that sits between your
students and the model providers. Students point the **OpenAI SDK** at it and
use any model name; the proxy holds the real provider keys and enforces a
**per-student dollar cap**.

```
  student key (capped) ──▶  parsity-litellm.fly.dev  ──▶  OpenAI   (gpt-4o, gpt-4o-mini, text-embedding-3-small, o-series …)
   OPENAI_API_KEY=sk-...                │                  Anthropic (claude-sonnet-4-6, claude-haiku-4-5, claude-*)
   OPENAI_BASE_URL=https://…            │
                                        └─ spend + budgets stored in Neon Postgres (the `litellm` DB)
```

Two keys matter:
- **Master key** (`LITELLM_MASTER_KEY` in `infra/litellm/.env`) — admin. Mints student keys, reads usage, opens the dashboard. **Never give this to students.**
- **Student keys** — one per student, budget-capped, minted from a roster.

Everything below runs from `infra/litellm/`:
```bash
cd infra/litellm
```

---

## Mint keys

### A whole cohort
```bash
printf "ada@example.com\ngrace@example.com\n" > roster.txt
./new-cohort.sh 2026-q3 roster.txt 10 90
#                 └cohort  └roster    │  └key lifetime (days)
#                                     └budget: $10 per student
# -> writes keys-2026-q3.csv  (student,api_key,budget,days) — gitignored, don't commit
```
Email each student their key plus:
```
OPENAI_API_KEY=<their key from the CSV>
OPENAI_BASE_URL=https://parsity-litellm.fly.dev
# any model works: gpt-4o-mini, text-embedding-3-small, claude-haiku-4-5, claude-sonnet-4-6, ...
```

### One more student later
Same script with a one-line roster — existing keys are untouched:
```bash
echo "newstudent@example.com" > one.txt
./new-cohort.sh 2026-q3 one.txt 10 90
```

### No-terminal option: the Google Sheet ([`sheet-mint.gs`](./sheet-mint.gs))
For your assistant. A Google Sheet with a bound Apps Script — they fill in
**Name / Email / Start Date**, click **Cohort ▸ Mint keys for new rows**, and the
key + expiry land back in the sheet. Setup instructions are in the header comment
of `sheet-mint.gs`.
- Respects **Start Date** — a future date waits (key mints *on* the start date, so
  the 60-day clock starts then, not early).
- **Cohort ▸ Update budget for selected rows…** raises/lowers a student's cap on
  existing keys (spend preserved).
- The raw `sk-...` key only exists in the sheet + the student's email — the `/ui`
  dashboard shows alias/spend/budget but **never re-shows the key value**.
- Master key lives in the script's **Script Properties**, not the sheet. Anyone
  with edit access to the *script* can read it — if that's a concern, front it with
  a Vercel function that holds the master key server-side (ask and I'll build it).

---

## The budget cap

- Set at **mint time** (the `10` above = $10). Enforced per-key by the proxy.
- When a student's cumulative spend crosses their cap, requests start **failing**
  (budget error) — a runaway loop caps out that student, not your bill.
- **It's one dollar pool across ALL models**, not $10-per-provider. Claude costs
  more per token than `gpt-4o-mini`, so heavy Sonnet use drains the $10 faster:

  | Model | in $/1M | out $/1M |
  |---|---|---|
  | gpt-4o-mini | ~$0.15 | ~$0.60 |
  | claude-haiku-4-5 | $1.00 | $5.00 |
  | claude-sonnet-4-6 | $3.00 | $15.00 |

  Want more headroom? Mint at a higher number (`./new-cohort.sh 2026-q3 roster.txt 20 90`).

---

## Check usage / spend

Set the master key once per shell:
```bash
MK=$(grep '^LITELLM_MASTER_KEY=' .env | cut -d= -f2-)
```

**Dashboard (easiest)** — see every key, spend vs. budget, per-model breakdown:
```
https://parsity-litellm.fly.dev/ui       # log in with the master key
```

**One student by key** (paste their key):
```bash
curl -s https://parsity-litellm.fly.dev/key/info -H "Authorization: Bearer $MK" \
  -G --data-urlencode "key=sk-..." | python3 -m json.tool
# -> spend, max_budget, key_alias (cohort-student), expires
```

**Global spend / usage report:**
```bash
curl -s https://parsity-litellm.fly.dev/global/spend/report \
  -H "Authorization: Bearer $MK" | python3 -m json.tool
```

---

## Available models

Students pass any of these as the `model` name (via the OpenAI SDK):

| Provider | Models |
|---|---|
| OpenAI | `gpt-4o`, `gpt-4o-mini`, `gpt-4.1-nano`, `text-embedding-3-small`, o-series — **any** OpenAI model (wildcard route) |
| Anthropic | `claude-sonnet-4-6`, `claude-haiku-4-5`, or any `claude-*` snapshot |

Routing lives in [`litellm-config.yaml`](./litellm-config.yaml). Provider keys are
Fly secrets: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`.

---

## Smoke test / is it up?

```bash
MK=$(grep '^LITELLM_MASTER_KEY=' .env | cut -d= -f2-)
for m in gpt-4o-mini claude-haiku-4-5; do
  echo "== $m =="
  curl -s https://parsity-litellm.fly.dev/v1/chat/completions \
    -H "Authorization: Bearer $MK" -H "Content-Type: application/json" \
    -d "{\"model\":\"$m\",\"messages\":[{\"role\":\"user\",\"content\":\"ping\"}],\"max_tokens\":5}"
  echo
done
```
A GitHub Action (`.github/workflows/proxy-canary.yml`) also pings it every 15 min
and emails you if it's down.

---

## Common ops

```bash
fly status  -a parsity-litellm     # is the machine up?
fly logs    -a parsity-litellm     # live logs (debug a failing model)
fly secrets list -a parsity-litellm

# Change a provider key:
fly secrets set OPENAI_API_KEY="sk-..." -a parsity-litellm   # restarts machine, no rebuild

# Change routing/models (edited litellm-config.yaml) — needs a rebuild+deploy:
fly deploy  -a parsity-litellm
```

> **Gotcha we hit:** the proxy reads `infra/litellm/.env`, **not** the project-root
> `.env`. Provider keys must live in `infra/litellm/.env` (and be pushed as Fly
> secrets). If a model 401s with "x-api-key required", the secret is empty/missing.
