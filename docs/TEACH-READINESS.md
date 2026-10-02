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
| `npm run test:run` | **75 passed** (4 files) |
| `npm run build` | compiles; 6 routes |
| Every `npm run …` named in live `curriculum/` | resolves |
| Every repo path named in live `curriculum/` | resolves |
| `AUTHORING.md` npm-script list vs `package.json` | exact match |

Student-branch baseline, verified separately on a fresh clone of `cohort_4`:
`tsc` clean, **51 passed**. The 24-test gap is the two solution specs, which is
what you'd expect and is now written down in `AUTHORING.md`.

Three unresolved script references (`npm run ingest`, `mcp:inspect`,
`test:selector`) live in `curriculum/archive/` only — the demoted self-paced
track and its backlog. Archive content is explicitly bonus material, so these
are not teach-blockers.

## Still open — Brian-owned

- **Week 4 has never been delivered.** "Where it breaks" is mostly prediction.
  Fill in "Notes from cohort 4" the day you teach it; that section is
  unreconstructible a month later.
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
