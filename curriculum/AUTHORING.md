# Authoring guide

How to keep this curriculum accurate. Read before editing anything in `student/`
or `instructor/`.

## What this curriculum is

A **record of a course that was actually delivered**, not a design for one that
might be. Cohort 3 ran six Saturdays, 2026-07-11 → 2026-08-15, and every claim in
these files is traceable to a session recording or a `#cohort-3` Slack post.

That constraint is the whole value. Anyone can write a syllabus; this one names
the failures that actually happened, in the order they happened, with the fixes
that worked. Don't dilute it with content nobody taught.

## Structure

```
curriculum/
├── README.md                 the six-session map — start here
├── AUTHORING.md              this file
├── INSTRUCTOR-NOTES.md       cross-cutting teaching context (HIPAA framing, etc.)
├── student/                  what students get — one file per session
│   ├── week-0-prework.md
│   ├── week-1-vector-store.md … week-6-demo-day.md
│   └── bonus-voice-ai.md
├── instructor/               one runbook per session
│   └── week-1-runbook.md … week-6-runbook.md
└── archive/                  the pre-cohort self-paced track (bonus material)
```

**Both versions live on the `instructor` branch only.** "Student version" means
student-*facing*, not the `student` branch. Students receive this content through
the delivery platform and Slack — never by reading `curriculum/` in the repo.
Never sync this directory to `main` or `student`.

## The two shapes

### Student session guides

```markdown
# Week N — Title
**Session:** Saturday · [recording posted in Slack]
**Needs:** keys/accounts required

## What we built          ← narrative of the live session, in the order it happened
## Homework               ← the assignment as posted in Slack
### The video             ← the deliverable, when there is one
## Reading                ← only links actually posted
## When it breaks         ← real failures from the cohort, with fixes
## Check yourself         ← 3–4 concrete finish-line checks
```

### Instructor runbooks

```markdown
# Week N Runbook — Title
**Duration.** Student guide link.

## Before you start       ← checklist, including things to do days earlier
## The arc                ← timed table
## Live-coding checkpoints
## Where it breaks        ← symptom / cause / fix table
## Discussion prompts
## Homework to post
## Notes from cohort 3    ← what actually happened; what to change next time
```

## Rules

1. **Every failure listed must have actually happened.** "Where it breaks" and
   "When it breaks" are evidence sections. If you're speculating, say so or leave
   it out. Their credibility is the reason people read them.
2. **Every command and file path must be real.** Verify against the repo. No
   invented npm scripts, no invented exports.
3. **Only link what was posted.** The reading lists are the actual Slack links.
   Adding "better" resources nobody assigned makes the record wrong. If you want
   to add one, verify it and note that it's new.
4. **Student guides stay in the student register** — direct, concrete, lightly
   wry, no filler. Household-name medicine only (aspirin, insulin, "blood pressure
   medication"), never clinician jargon in examples.
5. **Runbooks may break every student rule.** Timings, week numbers, forward
   references, candid assessments of what went badly — all fine and all useful.
   They're for the person teaching.
6. **No time estimates in student guides.** Runbooks are all timings; guides have
   none.
7. **Code style in examples follows the repo** (see `CLAUDE.md`): zod `.parse()`
   not `safeParse`, Responses API + `zodTextFormat`, `type` over `interface`.
8. **Solutions are not hidden.** Unlike the archived self-paced track, these are
   session records — the code was on screen. Show it.

## When you teach a new cohort

Update in this order:

1. **Runbooks first, during or right after each session** — while the failures are
   fresh. The "Notes from cohort N" section is the highest-value thing in the file
   and it is unreconstructible a month later.
2. **Student guides after** — fold in anything that changed, and re-check that the
   homework matches what you actually posted in Slack.
3. **`README.md`** if the session shape changed.
4. Add a "Notes from cohort N" section — **keep the older ones, oldest last**. Two
   cohorts of evidence is better than one. (Week 4's is empty and waiting; it has
   not been delivered.)
5. **Verify every claim against the branch students actually have**, not against
   `instructor`. The table above exists because cohort 3's guides described the
   solutions branch as if it were the student repo, which sent people looking for
   code that wasn't there.

## The archive

`archive/` holds the 24-lesson self-paced track written before cohort 3, plus its
slide decks, its authoring tracker, its standalone homework docs, and (since
cohort 4) the MCP session's student guide and runbook.

Partway through cohort 3 it was explicitly demoted to **bonus material** —
students were told to do only the homework posted in Slack. It is kept because
several deep-dives (embeddings, chunking failure modes, evals, PII, poisoned
documents) go further than the live sessions had time for.

**Mine it for explanation. Don't hand it out as the syllabus.** Its assignments
contradict the ones students were actually given, and its five-week shape doesn't
match the six live sessions.

## Repo facts (check here before writing)

- Branches: **`main`** = canonical student-facing · **`instructor`** = solutions +
  this curriculum · **`student`** = legacy mirror. Students clone a snapshot repo,
  `projectshft/medical-rag-student`.
- Data: Synthea Coherent, ~200-patient subset, ~21,000 notes, pre-loaded in Neon,
  read-only. Students never run an ingest.
- One note = one vector. The medical corpus is **not** chunked. The Bible homework
  exists to teach chunking on a corpus that needs it.
- **Two vector databases, deliberately.** Medical notes → Pinecone. The Bible
  chunking lab → **Qdrant** (`@qdrant/js-client-rest`, pinned `1.19.0`), on
  Qdrant Cloud's free tier (no credit card). The point is that students can't
  reuse `lib/pinecone.ts`: they write the client code and own the vector size
  and distance metric, which Qdrant fixes immutably at collection creation.
  Collections are `bible_fixed` and `bible_smart` — two, because the strategies
  produce different chunks and can't share points. Don't write "store it in
  Pinecone" for the Bible anywhere; that was cohort 3.
- The Qdrant client is pinned EXACTLY because `1.19.0` removed `.search()` in a
  minor release. `query()` replaces it and returns `{ points }`, not an array.
  That break is load-bearing teaching material — every pre-Aug-2026 tutorial and
  most LLM answers are wrong, and TypeScript catches it — so don't "upgrade" it
  casually or paper over it.
- Qdrant free clusters **suspend after a week idle, delete after four**. The
  collection is built in week 1 and searched in week 2. Say so in both.
- Reranking is Pinecone's hosted cross-encoder even for the Qdrant lab: it takes
  a query and a list of strings and is decoupled from storage. That's the week-2
  lesson, not an inconsistency — don't "fix" it by looking for a Qdrant reranker.
- **Models: `gpt-4o` / `gpt-4o-mini`, deliberately, for cohort 4.** Not an
  oversight and not laziness — checked on 2026-10-07. GPT-5 is end-of-life
  (`gpt-5-2025-08-07` shuts down 2026-12-11, inside a cohort starting in
  October), and the current GPT-6 line are reasoning models that **reject
  `temperature`** with a 400, which `CLAUDE.md` mandates and students copy. The
  migration is six call sites, three SDKs and the pattern we teach — see
  `docs/MODEL-MIGRATION.md`. Do it between cohorts, with a live call first.
- Use the **bare aliases**, never a dated snapshot. `gpt-4o-2024-05-13` shuts
  down 2026-10-23; the alias is the only reason that isn't our problem.
- Pinecone: `text-embedding-3-small`, 1536 dims, cosine. Reranker is
  `bge-reranker-v2-m3` via `pinecone.inference.rerank` (hosted, free).
- Node **22**. `package.json` declares `"engines": { "node": ">=22" }` and
  `.nvmrc` pins 22, so `nvm use` picks it up and npm warns on a bad version
  instead of letting someone discover it halfway through week 1. The floor is 22
  because `@qdrant/js-client-rest` requires it, not by preference. Don't write
  "Node 20 only" (asserted for a while, never true) and don't write "20 or 22" —
  20 no longer satisfies the Qdrant client. **Check `package.json` before
  quoting a range here; this bullet has drifted from it twice.**
- The eval judge runs on **Jev** (TypeSafe AI), not OpenAI — the one deliberate
  departure from the Responses-API pattern in `CLAUDE.md`. Typed questions in,
  calibrated probabilities out, no text generation. Rubrics cap at 10 levels;
  `noul` is a probability, not a boolean. Week 5's guide and runbook carry the
  teaching argument.
- **Students do not have a TypeSafe account, and don't write as though they do.**
  Jev is early access with no free tier, so one key lives on the LiteLLM proxy and
  students reach it on a pass-through route: `TYPESAFE_API_KEY` is the *same value*
  as `OPENAI_API_KEY`, plus `TYPESAFE_BASE_URL` pointed at the proxy. Never tell
  them to get a key from `console.typesafe.ai`.
- Jev cannot be a `model_list` entry — it has no `/chat/completions`, so there is
  no model name for it. It is `general_settings.pass_through_endpoints` in
  `infra/litellm/litellm-config.yaml`, and `auth: true` on that route is what
  stops it being an open relay on our key. Pass-through spend is a flat
  `cost_per_request` estimate, not token accounting; don't claim the dashboard
  shows real Jev cost.
- `infra/litellm/` is **instructor-only infra** (proxy config, key minting, the
  operator runbook). It is not part of any student exercise, and `keys-*.csv`
  holds raw student keys — it's gitignored, keep it that way.
- npm scripts: `dev`, `build`, `start`, `lint`, `test`, `test:run`, `test:evals`,
  `db:generate`, `db:push`, `db:studio`, `vectorize`, `similarity`,
  `retell:deploy`, `bible:fetch`, `bible:fixed`, `bible:smart`, `bible:audit`,
  `bible:store`, `bible:search`, `security:poisoned`.
- Agent pipeline files: `lib/agents/{selector,sql,rag,aggregator}.ts`, orchestrated
  by `app/api/chat/route.ts`. Tool calling is `lib/graph.ts` +
  `app/api/chat-graph/route.ts` (LangGraph v1 — `schema:` on `tool()`, **not** the
  AI SDK's `parameters:`; both libraries are installed). Deps:
  `@langchain/langgraph`, `@langchain/openai`, `@langchain/core`.
- `Plan` carries `useSql`, `useRag`, `useScheduler`, `needsSearch`,
  `semanticQuery`. Scheduling short-circuits retrieval and the route streams that
  response itself, so the aggregator is not the only streamer in the file.

### Branch-divergent facts — check WHICH branch before you write

These differ between `main`/`cohort_4` (what students have) and `instructor` (the
solutions). Cohort 3's guides stated the instructor version as though students had
it; don't repeat that.

| Thing | Student branch | `instructor` |
|---|---|---|
| `assertReadOnly` | a marked TODO above `$queryRawUnsafe` | implemented + exported, `lib/agents/sql.ts`, spec in `lib/agents/sql.test.ts` |
| `buildGraph()` | throws (the exercise) | implemented, `lib/graph.ts` |
| The SQL tool in `lib/graph.ts` | a TODO next to the worked notes tool | implemented as `query_patient_records` |
| `/api/chat-graph` | throws (the exercise) | implemented, streams from the `agent` node |
| `lib/graph.test.ts` | absent | 9 specs — the loop, both routes, and the missing-edge bug |
| `lib/evals/llm-judge.ts` | three stubs that throw | implemented on **Jev** (`@typesafe-ai/sdk`) |
| `lib/judge-contract.test.ts` | absent | 13 offline specs for the judge's mapping logic |
| `scripts/bible/store.ts` + `search.ts` | the exercise (throws) | implemented against Qdrant 1.19 |
| `infra/litellm/` + the proxy canary | absent | present — proxy config, key minting, operator runbook |
| Test count, fresh `npm run test:run` | **51** | **88** |

Both branches keep `ai` + `@ai-sdk/openai` — the aggregator streams with
`streamText`. That's why the "don't mix the two libraries in one file" warning
matters: both really are installed, for different jobs. LangGraph owns
`lib/graph.ts` and `/api/chat-graph`; the AI SDK owns the aggregator and
`/api/chat`.

The live SQL guardrail on **both** branches is the database role: `DATABASE_URL`
→ `student_ro`, SELECT only. Say it that way round — the database enforces, a
validator explains.

### Corrections made for cohort 4 (don't reintroduce these)

- ~~`lib/vector-search.ts` has a hardcoded `INDEX_NAME`~~ — **fixed** in
  `19f4194`; reads `process.env.PINECONE_INDEX`. A 404 is the student's `.env`.
- ~~`selector.ts` ships a commented-out `FEW_SHOT` array of 11 typed examples~~ —
  **never true on any current branch.** It existed and was deleted in `6e95a1d`
  when the selector became pure-routing. Teach few-shot by typing it live.
- `{ topN: 10 }` was passed as `.map()`'s second argument (the callback's
  `thisArg`), never to `rerank()` — a silent no-op, and part of why reranking
  demoed badly. **Fixed**; `topN` is a real `VectorSearchOptions` field.
- The aggregator was on `gpt-4` (8K context) and silently truncated patients with
  many notes. **Now `gpt-4o`.**
- `LANGSMITH_API_KEY` alone produces no traces and no error —
  **`LANGSMITH_TRACING=true`** is the switch `wrapOpenAI` reads. Both are in
  `.env.example` now. Ignore `lib/langsmith.ts`; it's an unused half-written
  helper.
- **The old AI-SDK tool-calling answer is gone.** `lib/agent-tools.ts` and
  `/api/chat-tools` were cohort 4's first pass at this week, written against the
  AI SDK before the session settled on LangGraph. They lingered on `instructor`
  only, contradicted the student exercise, and `lib/evals/rag-quality.test.ts`
  imported them — so a `tsc` run on `instructor` failed. All three removed.
- **PII and MCP are deleted, not deferred** (cohort 4). Gone: `lib/pii.ts`,
  `lib/pii.test.ts`, `mcp-server/`, both challenge docs, the `mcp` /
  `mcp:inspect` scripts, `@modelcontextprotocol/sdk`, and `OBSCURE_PII`. The MCP
  guides live in `archive/`. **A fresh clone is fully green (51 tests)** — the
  old "pii lab fails (31) + rest green" baseline is obsolete.
- `searchClinicalNotes(query, options)` takes **two** arguments, options are
  `{ topK, topN, patientIds, dateFrom, dateTo }`, and it returns
  `{ docs, rerankedDocuments }` — **not an array**. No `firstName` option, no
  third "obscure" argument.
