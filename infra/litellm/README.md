# LiteLLM proxy (instructor infra)

Gives students an OpenAI-compatible endpoint with a **per-student budget-capped
key** so a runaway loop can't blow the bill. Students just set two env vars and
use **any model name** — the proxy routes it.

```
    ┌─ student A ─┐
    ├─ student B ─┤   OPENAI_API_KEY=<their capped key>   (from keys-<cohort>.csv)
    └─ student C ─┘   OPENAI_BASE_URL=https://<your-proxy-host>
           │
           ▼
   ONE LiteLLM proxy (:4000)   ← holds the master OpenAI/Bedrock keys + budgets
           │
           ├─ gpt-5.5 / gpt-5.4      → Bedrock OpenAI endpoint (us-east-2)
           └─ everything else        → OpenAI proper (wildcard route)
              gpt-4o, gpt-4o-mini, gpt-4.1-nano, text-embedding-3-small, ...
```

## Where does this run?

**One central always-on box that YOU host** — not on student machines (they'd
need the master key, which defeats budget control), and AWS is *not* required
for the proxy itself (it's only the Bedrock model backend, if you use it).

- **Dev/verify:** locally via `docker compose up` (localhost:4000).
- **Production:** deploy this same compose to one public box with an HTTPS URL —
  a $5–10/mo VPS (Fly.io, Railway, DigitalOcean) or a small AWS box
  (Lightsail / ECS Fargate). Students point `OPENAI_BASE_URL` at it.

> **Apple Silicon note:** the LiteLLM arm64 image crashes on startup under
> Docker Desktop (exit 132 / SIGILL). `docker-compose.yml` pins
> `platform: linux/amd64` to work around it locally. On a Linux x86 host that
> line is a harmless no-op.

## Files

| File | What it is |
|------|-----------|
| `new-cohort.sh` | Per-cohort: mints one budget-capped key per student → `keys-<cohort>.csv`. |
| `litellm-config.yaml` | Routing — wildcard passthrough to OpenAI (any model). |
| `docker-compose.yml` | Local dev: LiteLLM + Postgres (key/budget state). |
| `Dockerfile` + `fly.toml` | Production deploy to Fly.io. |
| `.env` | Secrets. **Gitignored.** |
| `.env.example` | Documents `.env`'s shape. |

Backend is **OpenAI only** (wildcard route) — OpenAI already serves every model
the course needs (`gpt-4o`, embeddings, nano, …).

## Local dev / verify

```bash
# 1. Create .env:
cp .env.example .env
#   REQUIRED: OPENAI_API_KEY     (dedicated classroom key — powers every model)
#   REQUIRED: LITELLM_MASTER_KEY (echo "sk-$(openssl rand -hex 32)")

# 2. Bring the proxy up (amd64 pinned for Apple Silicon):
docker compose up -d

# 3. Smoke test:
MK=$(grep '^LITELLM_MASTER_KEY=' .env | cut -d= -f2-)
curl -s http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $MK" -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"ping"}],"max_tokens":5}'
```

## Deploy to Fly.io (production) — LIVE at https://parsity-litellm.fly.dev

One always-on Fly machine, **backed by Neon Postgres** (not Fly Postgres — Fly's
own Postgres kept auto-stopping and wedging boots). Set a unique `app` name in
`fly.toml` first.

```bash
fly auth login                                    # opens browser (your account)
fly apps create parsity-litellm                   # match fly.toml `app`

# --- Postgres on Neon (one-time) ---
# Create a dedicated DB on your Neon project, then point the proxy at it.
# Use the DIRECT (non-pooler) host; keep sslmode=require:
psql "<neon-admin-url>/neondb" -c "CREATE DATABASE litellm;"
fly secrets set \
  DATABASE_URL="postgresql://<user>:<pw>@<neon-direct-host>:5432/litellm?sslmode=require" \
  OPENAI_API_KEY="$(grep '^OPENAI_API_KEY=' .env | cut -d= -f2-)" \
  LITELLM_MASTER_KEY="$(grep '^LITELLM_MASTER_KEY=' .env | cut -d= -f2-)"

fly deploy
fly open                                           # https://parsity-litellm.fly.dev
```

That public URL is your students' `OPENAI_BASE_URL`.

> **Gotcha (already handled in `fly.toml`):** `DISABLE_SCHEMA_UPDATE=True`. On
> boot LiteLLM runs `prisma migrate deploy`, which hangs against Neon and never
> binds `:4000` → crash loop. The schema is applied once (the very first boot,
> or run `prisma migrate deploy` manually), then this flag skips it. Re-enable
> only when upgrading LiteLLM (schema changes). Health-check `grace_period` is
> also set generously (180s) for first-boot migration.

## Each cohort

```bash
printf "ada@example.com\ngrace@example.com\n" > roster.txt
./new-cohort.sh 2026-q3 roster.txt 10 90   # $10/student, 90-day keys
# -> keys-2026-q3.csv  (gitignored; do not commit)
```

Onboarding email per student:

```
OPENAI_API_KEY=<their key from the CSV>
OPENAI_BASE_URL=https://<your-proxy-host>
# use any model: gpt-4o-mini, text-embedding-3-small, gpt-4.1-nano, gpt-5.5, ...
```

Keys default to **all models** (no `models` restriction). To limit, edit the
`/key/generate` body in `new-cohort.sh`.

## Dogfood + canary ("make sure it always works")

- **Dogfood:** this repo's app honors `OPENAI_BASE_URL` (`lib/openai.ts`). Point it
  at the deployed proxy and it exercises the proxy on every request — if the
  proxy breaks, the app breaks, so you find out immediately. Mint a dedicated
  low-budget key for the app (don't reuse the master key):

  ```bash
  ./new-cohort.sh app <(echo app) 20 365   # -> keys-app.csv
  # then set in the app's env:
  #   OPENAI_API_KEY=<key from keys-app.csv>
  #   OPENAI_BASE_URL=https://parsity-litellm.fly.dev
  ```

- **Canary:** `.github/workflows/proxy-canary.yml` pings the proxy every 15 min
  (health + a real 1-token completion) and fails the run (→ GitHub emails you) if
  it's down. Add repo secrets `PROXY_URL` and `PROXY_CANARY_KEY` (another
  dedicated low-budget key). Fly also restarts the machine on its own health
  check (`fly.toml`), so the canary is your *external* signal.

## Notes / gotchas

- **Budgets are per-key**, set at mint time. Do **not** add
  `litellm_settings.max_budget` to the config — that's a *global* ceiling and
  `0` rejects every request.
- **Apple Silicon:** the arm64 LiteLLM image SIGILLs (exit 132) under Docker
  Desktop; `docker-compose.yml` pins `platform: linux/amd64`. No-op on Fly's
  Linux hosts.
- Use a **dedicated** classroom `OPENAI_API_KEY`, not a personal one — all
  student spend funnels through it (per-student caps still apply).
```
