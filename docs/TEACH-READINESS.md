# Teach-readiness — cohort 4

**Date:** 2026-10-02 · **Verdict: ready to teach weeks 1–6.**

Supersedes the 2026-06-28 audit, which described the cohort-3 course (MCP block,
PII lab, 178 tests) and is no longer true of anything.

## What was wrong, and is now fixed

The two cohort-4 lines had drifted apart badly enough that neither was
teachable on its own.

| | Before | Now |
|---|---|---|
| `cohort_4` (student code) | correct and green, but no curriculum and no solutions | unchanged — it was right |
| `instructor` (curriculum) | curriculum correct; **code a month stale** | code is `cohort_4`'s, plus the solutions |

Specifically, on `instructor`: `mcp-server/` and `@modelcontextprotocol/sdk`
were still installed, `lib/pii.ts` + its 244-line test still present, no
LangGraph dependency at all, no `lib/graph.ts`, `lib/vector-search.ts` still the
pre-reranker version returning an array, and `lib/evals/rag-quality.test.ts`
importing a module that `AUTHORING.md` said had been deleted. `npx tsc --noEmit`
failed on that branch.

`AUTHORING.md` asserted most of these were already done. They were done on
`cohort_4` only. That is precisely the class of error the branch-divergent-facts
table exists to prevent, so the table now covers the graph and the guardrail too.

## Fixed in this pass

- [x] **MCP gone for real** — `mcp-server/`, the SDK dependency, the `mcp` and
      `mcp:inspect` scripts. Only historical references remain (the "why we cut
      it" narration in the runbooks and the archived guides), which is correct.
- [x] **PII code gone for real** — `lib/pii.ts`, `lib/pii.test.ts`,
      `docs/CHALLENGE-PII.md`, `OBSCURE_PII`.
- [x] **The superseded AI-SDK tool path removed** — `lib/agent-tools.ts`,
      `/api/chat-tools`, and the eval that imported them. It predated the
      decision to teach LangGraph and contradicted the student exercise.
- [x] **LangGraph reference solution written and proved** — `lib/graph.ts`
      (`buildGraph` + `query_patient_records`), `app/api/chat-graph/route.ts`,
      and `lib/graph.test.ts`: 9 specs, offline, no API key.
- [x] **`assertReadOnly` implemented** — the week-3 guardrail TODO, with 15
      specs in `lib/agents/sql.test.ts` covering the smuggling cases
      (second statement, writing CTE, comment-hidden writes).
- [x] **The week-5 judge implemented, on Jev** — `lib/evals/llm-judge.ts` now
      calls `@typesafe-ai/sdk` (pinned to `0.6.0`) instead of `gpt-4o-mini`: a
      five-level rubric scaled onto the 0-10 the `EvalResult` contract promises,
      and `pass` thresholded off `noul`, which is a probability rather than a
      boolean. 13 offline specs in `lib/judge-contract.test.ts` — deliberately
      outside `lib/evals/`, which the free run excludes — pin the mapping, so
      `retrieval.test.ts` keeps passing whoever is underneath. **Nobody has made
      a live Jev call yet:** those specs mock the SDK, so they prove the mapping
      and not the wire format.
- [x] **The judge verified against the live Jev API** — this was the outstanding
      caveat and it's now discharged for the direct path. The wire format matches
      what `llm-judge.ts` assumes: a `score` answer returns `score`, `confidence`,
      `legend` and `probabilities` keyed by level index, and `noul` returns a bare
      probability. Observed on real calls — relevant retrieval 10.0/10 pass,
      irrelevant 0.0/10 fail, an answer inventing a second medication 3.0/10
      (confidence 0.83), and a half-answered question 4.8/10, which is the
      between-levels behaviour the student guide describes. `jev-latest` resolves
      to `jev-1.13.0` today.
      One bug fell out: **`model` is a required body field**, so the hand-written
      curl checks in the runbook and the canary were both wrong and would have
      returned 422 on a route that was working fine. Fixed in both, with the
      status table that distinguishes 401 (guarded) from 422 (auth NOT enforced)
      from 2xx (open relay).
- [x] **The config validated against a real LiteLLM instance** — short of the
      Fly deploy itself, which needs credentials this environment doesn't have.
      Ran LiteLLM with `infra/litellm/litellm-config.yaml` verbatim and confirmed:
      it boots with no config errors, `/v1/systemone` registers as a route, and
      **the header swap works** — a call with a valid proxy key came back with
      TypeSafe's own 401 for the *injected* dummy key, proving the caller's key
      was replaced rather than forwarded. Unauthenticated and bogus-key calls
      died inside `user_api_key_auth` with zero requests reaching TypeSafe, so
      `auth: true` is genuinely enforced and not an open relay.
      This corrected a mistake in the checks: they asserted `401`, but without a
      database attached an unauthenticated call surfaces as `500`. The property
      worth asserting is *"the request never reached TypeSafe"*, so the canary
      and runbook now separate a disclosure problem (2xx, 422) from an
      availability one (5xx) instead of treating any non-401 as a leak.
- [x] **Jev reaches students without a TypeSafe account** — Jev is early access
      with no free tier and signups may be closed, so a per-student key was never
      a safe plan. It now rides the LiteLLM proxy on a pass-through route
      (`general_settings.pass_through_endpoints` in
      `infra/litellm/litellm-config.yaml`): students set `TYPESAFE_API_KEY` to
      their existing LiteLLM key and `TYPESAFE_BASE_URL` to the proxy, and the
      real key never leaves Fly. `auth: true` on the route is load-bearing —
      without it the route is an open relay on our key — and the proxy canary now
      asserts both the live call and the 401, so a regression pages us instead of
      surfacing in class.
- [x] **`infra/litellm/` ported onto this branch** — it existed only on the old
      `instructor` history, while `.env.example` here pointed students at
      `infra/litellm/README.md`, a path that did not exist. Brought across with
      the proxy canary, and `.gitignore` now covers `keys-*.csv` (raw student
      keys) which it previously did not on this branch.
- [x] **The Bible chunking lab moved to Qdrant** — a second vector database, so
      the homework can't be solved by importing `lib/pinecone.ts`. Students now
      create the collection themselves with an explicit, immutable vector size
      and distance metric. `@qdrant/js-client-rest` pinned to `1.19.0`;
      reference solutions in `scripts/bible/store.ts` and `search.ts`
      (`bible:store`, `bible:search`); `docs/CHALLENGE-CHUNKING.md` rewritten.
      Verified against the real client types: `tsc` passes on both scripts, and
      `client.search(...)` is a **compile error** (`Property 'search' does not
      exist on type 'QdrantClient'`) — that removal in 1.19.0 is the forcing
      function, since every pre-Aug-2026 tutorial and most LLM answers still use
      it. The other three landmines are documented with it: ids must be
      integer/UUID (TypeScript won't catch a string), `wait` defaults to false
      so a query straight after an upsert returns nothing, and filtering an
      unindexed payload field errors on Cloud but not on Docker.
      **Not run end to end** — no Qdrant server was reachable from the authoring
      environment, so the ingest and search paths are typechecked and
      argument-checked but never executed against a live cluster. First run
      before week 1: `npm run bible:fetch && npm run bible:fixed && npm run
      bible:store -- data/bible/chunks-fixed.jsonl bible_fixed`, then
      `npm run bible:search -- bible_fixed "a question"`.
- [x] **Node floor raised to 22** — `@qdrant/js-client-rest@1.19.0` declares
      `engines: >=22.0.0`, so the `>=20 <23` added earlier in this pass would
      have warned on every install. Now `>=22 <23` with `.nvmrc` pinning 22,
      which is the version the whole suite, the build and every ts-node script
      were verified on today.
- [x] **Node version enforced** — `engines: >=20 <23` and a `.nvmrc` pinning 20.
      **This box was checked while both were absent.** Neither existed on any
      branch; the audit asserted an intention as a fact, which is the same error
      the branch-divergent-facts table exists to prevent, committed by this
      document. Both now exist and were verified after adding. The claim they
      carried was also wrong: `npx ts-node` runs fine on Node **22** here,
      including scripts importing from `lib/`, so the range admits it and the
      week-1 troubleshooting note no longer blames 22.
- [x] **Week-4 runbook pre-flight discharged** — deps confirmed with versions,
      solution located, and the missing-edge failure marked **Verified** rather
      than predicted.

## Verification

Run on this branch, 2026-10-02:

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run test:run` | **88 passed** (5 files) |
| `npm run build` | compiles; 6 routes |
| Every `npm run …` named in live `curriculum/` | resolves |
| Every repo path named in live `curriculum/` | resolves |
| `AUTHORING.md` npm-script list vs `package.json` | exact match |

Student-branch baseline, verified separately on a fresh clone of `cohort_4`:
`tsc` clean, **51 passed**. The 37-test gap is the three solution specs — the
graph, the SQL guardrail, and the judge contract — which is what you'd expect and
is now written down in `AUTHORING.md`.

Three unresolved script references (`npm run ingest`, `mcp:inspect`,
`test:selector`) live in `curriculum/archive/` only — the demoted self-paced
track and its backlog. Archive content is explicitly bonus material, so these
are not teach-blockers.

## Still open — Brian-owned

- **Week 4 has never been delivered.** "Where it breaks" is mostly prediction.
  Fill in "Notes from cohort 4" the day you teach it; that section is
  unreconstructible a month later.
- **Mint cohort-4 keys — the existing ones are EXPIRED.** The key in hand
  expired `2026-09-09`; cohort 3's were minted for 90 days and have run out.
  Nothing works for any student until new ones exist, on any route. This is
  independent of Jev and blocks week 1, not week 5:

  ```bash
  cd infra/litellm                     # needs .env with LITELLM_MASTER_KEY + PROXY_URL
  printf "student1@example.com\nstudent2@example.com\n" > roster-cohort4.txt
  ./new-cohort.sh cohort-4 roster-cohort4.txt 10 90
  ```

  Mint a canary key in the same pass and use it for `PROXY_CANARY_KEY`:
  `echo canary > one.txt && ./new-cohort.sh canary one.txt 5 120`. Give it a
  longer lifetime than the cohort so the monitor doesn't silently expire
  mid-course — the way these did.
  The onboarding email needs **four** lines now: `OPENAI_API_KEY`,
  `OPENAI_BASE_URL`, `TYPESAFE_API_KEY` (same value as the first) and
  `TYPESAFE_BASE_URL`.
- **One keyed call left to confirm, then the Jev route is done.** The route is
  deployed and verified from outside: `POST /v1/systemone` returns `401`
  unauthenticated (registered and guarded — not an open relay), `GET` returns
  `405` (POST-only honored), and a bogus bearer token is rejected with
  `Invalid proxy server token` rather than a schema error. The migration is
  positively confirmed, not merely assumed: a real (if expired) key was looked up
  in the database and rejected with `expired_key` and its true expiry timestamp,
  which means the lookup query now runs clean. What nobody has run is a call with
  an **unexpired** minted key:

  ```bash
  curl -s -w '\n%{http_code}\n' https://parsity-litellm.fly.dev/v1/systemone \
    -H "Authorization: Bearer <a key from keys-*.csv>" \
    -H "Content-Type: application/json" \
    -d '{"model":"jev-latest","state":{"text":"The patient is doing well."},
         "questions":{"positive":{"type":"noul","instructions":"Is the tone positive?"}}}'
  ```

  Want `200` and `answers.positive.noul` around 0.95. Then
  `TYPESAFE_BASE_URL=https://parsity-litellm.fly.dev npm run test:evals` with the
  same key as `TYPESAFE_API_KEY` should reproduce the scores recorded above.
- **Pin the proxy image before the cohort starts.** The Dockerfile tracks
  `main-stable`, a floating tag. Bringing this route up re-pulled it, LiteLLM
  moved forward, and because `DISABLE_SCHEMA_UPDATE=True` had been skipping
  migrations, **every keyed route broke at once** with
  `401 Authentication Error, column t.tpd_limit does not exist` — chat,
  embeddings and Jev together. `/health/readiness` stayed `200` with
  `"db":"connected"` throughout, and unauthenticated requests kept returning a
  clean 401, so nothing looked wrong. Fixed by running
  `prisma migrate deploy` against the `litellm-proxy-extras` schema. To stop a
  routine config deploy doing it again mid-cohort: `fly image show -a
  parsity-litellm`, then pin `FROM ghcr.io/berriai/litellm@sha256:<digest>` and
  upgrade deliberately between cohorts, with the migration in the same change.
- **Set `PROXY_URL` and `PROXY_CANARY_KEY` as repo secrets.** The canary is the
  only check that catches the outage above — its live call uses a real key, and
  the readiness probe never will. Without those secrets the workflow runs and
  proves nothing.
- **Model migration, after the cohort — not before.** Cohort 4 stays on
  `gpt-4o` / `gpt-4o-mini` on purpose. GPT-5 is already end-of-life (shutdown
  2026-12-11, which a cohort starting in October would cross) and the current
  GPT-6 line rejects `temperature`, which `CLAUDE.md` mandates and students copy
  into their own agents. Research, call sites and the ordered migration steps are
  in `docs/MODEL-MIGRATION.md`. Embeddings are unaffected —
  `text-embedding-3-small` is still current, so nothing needs re-vectorizing.
- **The two rehearsal items** in the week-4 pre-flight: a question that routes
  wrong with a vague tool description, and a multi-hop follow-up the week-3
  selector handles badly. Both want verifying against live data before class —
  they're the session's best ten minutes and they don't improvise well.
- **Branch naming.** This branch is `cohort_4`'s code + `curriculum/` + the
  solutions. Decide whether it becomes the new `instructor`, and whether
  `cohort_4` or a snapshot repo is what students clone.
- Typeform deliverable links and the screenshot placeholders carried over from
  the June audit, where they were already yours.

## What NOT to reintroduce

`mcp-server/`, `@modelcontextprotocol/sdk`, `lib/pii.ts`, `lib/agent-tools.ts`,
`/api/chat-tools`, `ts-node` on Node 21+. See the corrections list at the end of
`curriculum/AUTHORING.md`.
