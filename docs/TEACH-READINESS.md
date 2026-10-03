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
- [x] **Node version enforced** — `engines: >=20 <23` and a `.nvmrc`. Node 21+
      breaks `ts-node` on every script in `scripts/`; a guide nobody reads was
      the only thing preventing it.
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
- **Deploy and verify the Jev pass-through route.** The judge and the key are
  now proven against TypeSafe directly (see above); what is *not* proven is the
  proxy hop, because the config has never been deployed. That's the only
  remaining step on the critical path for week 5. In order:
  `fly secrets set TYPESAFE_API_KEY=... -a parsity-litellm`, then
  `fly deploy -a parsity-litellm` (the config is baked into the image, so a
  secret alone won't pick it up), then the two curl checks in
  `infra/litellm/RUNBOOK.md`: a student key gets `200` from `/v1/systemone`, an
  unauthenticated call gets `401`. Add `TYPESAFE_API_KEY` to
  `infra/litellm/.env` locally too, for `new-cohort.sh`.
  Two things remain genuinely unverified until that deploy, and only these two:
  that `main-stable` (the floating tag the Dockerfile pins — the local run was
  1.103.2) behaves the same, and that a **minted virtual key** rather than the
  master key passes the route. Both are exercised the moment the canary goes
  green with `PROXY_CANARY_KEY`.
  Then point `TYPESAFE_BASE_URL` at the proxy and run `npm run test:evals` once.
  Expect the same numbers as the direct calls above; a 422 at that point means
  the body isn't arriving intact, and a 401 means the LiteLLM key is wrong.
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
