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

## LiteLLM upgraded itself and now nothing authenticates

Symptom: every keyed route returns

```
401 {"error":{"message":"Authentication Error, column t.<something> does not exist", ...}}
```

while `/health/readiness` returns `200 {"db":"connected"}` and unauthenticated
requests still return a clean 401. Nobody in the cohort can make a single call.

Cause: the Dockerfile's `main-stable` is a floating tag, so any `fly deploy`
can move LiteLLM forward, and `DISABLE_SCHEMA_UPDATE=True` means the database
schema never followed. The new code queries a column that isn't there. It
presents as an authentication error because the failure happens inside the key
lookup, before any key is compared — which is also why *un*authenticated
requests look fine: they never reach the database.

Fix — run the migration once, by hand. Prefer this over flipping
`DISABLE_SCHEMA_UPDATE`, which runs the migration at boot where it has only Fly's
60s grace period to finish and can leave you in a crash loop:

```bash
# 0. FIRST: record the current image digest, so you can roll back if the
#    migration fights you. Keep this output somewhere you can find it.
fly image show -a parsity-litellm

# 1. apply the migration. The migrations ship with litellm-proxy-extras, NOT
#    next to /app/schema.prisma — use the extras copy or prisma finds no
#    migrations to apply. Paths verified inside the image (prisma lives at
#    /app/.venv/bin/prisma and is already on PATH; DATABASE_URL is a Fly secret
#    so it's in the environment):
fly ssh console -a parsity-litellm -C "sh -lc 'cd /app/litellm-proxy-extras/litellm_proxy_extras && prisma migrate deploy --schema=./schema.prisma'"

# 3. confirm a real student key works again
curl -s -o /dev/null -w '%{http_code}\n' https://parsity-litellm.fly.dev/v1/chat/completions \
  -H "Authorization: Bearer <a key from keys-*.csv>" -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"ping"}],"max_tokens":1}'
# want 200. A 401 naming a column means the migration did not apply.
```

If the migration refuses, it is almost always one of these:

- **`P3005: database schema is not empty`** — the schema was created without
  Prisma's migration history, so there is nothing recorded as applied. Mark the
  existing migrations applied, then deploy again:
  `prisma migrate resolve --applied <name> --schema=./schema.prisma` for each
  one already in the database (`ls migrations` lists them in order).
- **drift / "migration already applied"** — the database is ahead of or beside
  the history. Treat `prisma db push` as a last resort: it syncs the schema with
  no migration history and **can drop columns**. This database holds the student
  keys and all spend history. Keys can be re-minted (and re-emailed); spend
  cannot be recovered.

**The reliable escape hatch is the image, not the database.** Rebuild pinned to
the digest from step 0 — our config still applies, and the old code matches the
old schema:

```
FROM ghcr.io/berriai/litellm@sha256:<digest from step 0>
```

That restores every student key immediately and lets the upgrade happen
deliberately, with the migration, when there isn't a cohort waiting.

Then stop it recurring: pin the image to a digest (`fly image show -a
parsity-litellm`, then `FROM ghcr.io/berriai/litellm@sha256:<digest>`) so a
config deploy can't move the version during a cohort, and upgrade deliberately
between cohorts with the migration in the same change.

**The canary catches this and the readiness check does not.** Its live model call
uses a real key, so it fails the moment auth breaks. Make sure `PROXY_URL` and
`PROXY_CANARY_KEY` are set as repo secrets — without them this class of outage is
invisible until a student reports it.

---

## Start of cohort: one command

```bash
cd infra/litellm
./bootstrap-cohort.sh cohort-4 roster-cohort4.txt
./bootstrap-cohort.sh cohort-4 roster-cohort4.txt --rotate   # if the admin key is lost
```

It checks the branch has this folder and that `new-cohort.sh` is current, checks
the admin key isn't the `.env.example` placeholder, checks the proxy is up and
that `/v1/systemone` is guarded (distinguishing 404 / 422 / 2xx and naming the
fix for each), mints the student and canary keys, then proves a real key gets
`200` from chat, embeddings and Jev.

Every check in it exists because that exact thing went wrong once: deploying
from the wrong directory, running against a branch without this folder, a
placeholder admin key that minted a CSV full of `ERROR` while exiting 0, and
cohort-3 keys that had expired a month before anyone noticed. Re-runnable;
nothing destructive except `--rotate`.

The canary key it mints is deliberately longer-lived than the cohort (180d vs
90d) — a monitor that expires with the thing it monitors is worse than none.

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
Fly secrets: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TYPESAFE_API_KEY`.

---

## Jev — the week-5 eval judge (pass-through, not a model)

Jev is **not** in the table above and never will be: it is not a chat model, so
it has no model name. The SDK posts `{state, questions}` to `/v1/systemone` and
gets `{answers}` back — there is no `/chat/completions` to translate, which is
also why LiteLLM ships no TypeSafe provider. It rides a **pass-through route**
instead: the proxy forwards the request body untouched and swaps in our key.

Students get it with the same key they already have, plus one extra env var:

```
TYPESAFE_BASE_URL=https://parsity-litellm.fly.dev
TYPESAFE_API_KEY=<their LiteLLM key — the SAME value as OPENAI_API_KEY>
```

The second line looks wrong and isn't. `@typesafe-ai/sdk` sends
`Authorization: Bearer $TYPESAFE_API_KEY`, which is exactly where LiteLLM
expects a virtual key. The proxy authenticates it, then **replaces** that header
with the real TypeSafe key before forwarding. The real key never leaves Fly, and
nobody in the cohort needs a TypeSafe account — which matters, because Jev is
early access with no free tier and signups may be closed.

### Why `auth: true` is load-bearing

Without it the pass-through route is **unauthenticated**: anyone who learns the
URL can spend our TypeSafe key. With it, LiteLLM runs its normal key auth first,
so a request needs a valid virtual key and the student's per-key budget applies.

A 401 on this route means the student's **LiteLLM** key is wrong. Do not "fix" it
by dropping `auth`.

> LiteLLM's published docs still label `auth` as Enterprise. That is stale. It
> was fixed because the old behaviour left OSS operators with no safe option;
> `auth: true` now attaches `user_api_key_auth` with no license check. Verified
> in `litellm/proxy/pass_through_endpoints/pass_through_endpoints.py`.

### Spend

Pass-through routes have **no token accounting**, so `cost_per_request` in the
config is a flat estimate (currently `$0.0005`), deliberately rounded up. Jev is
$0.042 per 1M input tokens with output free, so a judging call is a fraction of a
cent and the cohort's Jev spend is rounding error against the $10 caps. The
config cache does not cover pass-through either — every judge call is a real call.

To see real Jev spend, read TypeSafe's own console; the `/ui` dashboard only
knows the flat figure above.

### Deploy / verify

Changing the route means a **rebuild**, because the config is baked into the image:

```bash
cd infra/litellm                                             # REQUIRED — see below
fly secrets set TYPESAFE_API_KEY="..." -a parsity-litellm    # restart, no rebuild
fly deploy -a parsity-litellm                                # config change
```

**Run the deploy from `infra/litellm/`, on a branch that has this directory.**
Two ways this bites, and the error names neither:

```
Error: failed to fetch an image or build from source:
dockerfile '.../infra/litellm/Dockerfile' not found
```

- `infra/litellm/` lives on the **instructor branches only**. Deploying from a
  checkout of `cohort_4` or `main` cannot work — there's nothing to build.
- `fly.toml` here says `dockerfile = "Dockerfile"`, resolved relative to the
  config file. Run `fly deploy` from the repo root and Fly falls back to the
  app's saved config, resolves the Dockerfile against your *current* directory,
  and reports it missing even when the file is right there on disk.

> **`-a` picks the TARGET app, not the source.** `fly deploy -a parsity-litellm`
> from some other project's directory will happily build *that* project and push
> it as the proxy, replacing LiteLLM with an unrelated application. Check your
> shell is in `infra/litellm/` of this repo before deploying. `pwd` costs
> nothing.

**A deploy that "succeeded" is not proof the config shipped.** Ask the container:

```bash
fly ssh console -a parsity-litellm -C "grep -c pass_through_endpoints /app/config.yaml"
```

`0` means the image is carrying an older config — the file is there, our block
isn't — and the route will 404 while the proxy looks perfectly healthy. Rebuild
with `fly deploy --no-cache` from `infra/litellm/`. Distinguish the two failures
by status: a **404** on `/v1/systemone` means the route was never registered
(stale config), while a **401** means it registered and is guarded.

A `fly secrets set` that prints `Machine ... update succeeded` has already
worked, even if the `fly deploy` after it fails: setting a secret restarts the
machine on its own. The secret is live; only the config change is still pending.

Smoke test with a student key (not the master key — you want to prove the auth
path a student actually takes):

```bash
curl -s -w '\n%{http_code}\n' https://parsity-litellm.fly.dev/v1/systemone \
  -H "Authorization: Bearer <a student key from the CSV>" \
  -H "Content-Type: application/json" \
  -d '{"model":"jev-latest",
       "state":{"text":"The patient is doing well."},
       "questions":{"positive":{"type":"noul","instructions":"Is the tone positive?"}}}'
```

Expect `200` and an `answers.positive.noul` probability (~0.95 for that text).

**`model` is required in the body.** Leave it out and TypeSafe returns `422
{"detail":[{"loc":["body","model"],"msg":"Field required"}]}`, not a 401 — so a
422 here means your request is malformed, not that auth failed. The SDK always
sends it (from `TYPESAFE_DEFAULT_MODEL`, default `jev-latest`); only hand-written
curl can forget it. Verified against the live API: `jev-latest` currently
resolves to `jev-1.13.0`, which is the value to pin if you want reproducibility.

Then confirm the guard actually guards — this must **fail**:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://parsity-litellm.fly.dev/v1/systemone \
  -H "Content-Type: application/json" -d '{}'      # expect 401, NOT 200/422
```

`401` is right: LiteLLM's auth runs before the body ever reaches TypeSafe. Read
the failure modes carefully, because they are not interchangeable:

| Status | Means |
|---|---|
| `401`/`403` | correct — the route is guarded and the database is healthy |
| `422` | **auth is NOT enforced.** Only TypeSafe validates bodies, so a 422 proves LiteLLM forwarded an unauthenticated request. |
| any `2xx` | **open relay**, and someone just spent our key |
| `5xx` | the key is *not* leaking — nothing reached TypeSafe — but the proxy is unwell. Usually the database. Check `fly logs`. |

A `422` or a `2xx` mean the same remediation: rotate `TYPESAFE_API_KEY` and
restore `auth: true` before class. A `5xx` is an availability problem, not a
disclosure one — don't rotate the key over it.

The thing being tested is **"the request never reached TypeSafe"**, not any
particular number. Verified against a real LiteLLM instance running this exact
config: with `auth: true`, an unauthenticated request dies inside
`user_api_key_auth` and never leaves the proxy. Without a database attached it
surfaces as a `500` rather than a `401`, which is why the table above reads the
way it does.

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
The same applies to `TYPESAFE_API_KEY` and the `/v1/systemone` route.
