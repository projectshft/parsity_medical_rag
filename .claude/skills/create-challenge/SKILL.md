---
name: create-challenge
description: Design and build a student challenge (homework assignment) for the medical RAG course. Use when asked to create, design, or scaffold a new challenge, homework, or assignment for students. Encodes the evidence-based pedagogy (evals as spine, planted failures, production gates, portfolio artifacts) and this repo's tests-first mechanics.
---

# Creating a Student Challenge

The goal of every challenge: produce **evidence that the student stressed a real system and made decisions from measurement, not vibes**. A model can write the code; it can't hand them the eval result showing it didn't help, or the postmortem of what broke. Design for that.

## Pedagogy principles (non-negotiable)

1. **No metric, no decision.** If the challenge involves tuning or choosing anything (reranker, chunk size, model, threshold, index config), the student must build or use an eval FIRST and justify the choice with a number. Never let a challenge end at "it works" — end at "here's the measurement that says it works."
2. **Plant the failures — don't wait for them.** Seed the failure mode into the data or queries so every student hits it by design:
   - Poisoned document in the corpus (prompt injection via retrieval)
   - PII buried in data that must be detected and handled
   - A write the model attempts without a human confirming it
   - A retrieval set where naive cosine similarity returns plausible garbage (forces hybrid search / reranking to *demonstrably* help)
   - Hallucination-bait queries (answers not in the corpus; system must say so)
   - A cost blowup (query pattern that burns tokens unless they add limits/caching)
   - Cross-tenant/role leakage bait (data a role shouldn't see, reachable unless they enforce it server-side)
3. **Ugly data over toy data.** Use the Coherent dataset's real mess (Synthea digit-suffixed names, ~21k notes, dead patients, inconsistent fields). Never fabricate clean fixtures for the *challenge itself* — clean fixtures are fine inside unit tests.
4. **Tie to a production gate.** Each challenge should move the system past one gate: regression evals on every change, cost/token observability, scoped access, human-confirmed writes, tracing/logging, or correct handling of a planted failure. Name the gate in the doc.
5. **Portfolio artifact, not demo.** Where it fits, require a written component: a short design note (tradeoff + alternative rejected + why) or a postmortem (what broke, what changed, what they deliberately didn't build). The adversarial review questions go in the doc: "Show me your eval. Show me where it failed. Defend this against the alternative."

## Repo mechanics (how challenges ship here)

**Where challenges live** (see `docs/CURRICULUM.md` for the six-week plan):
- `main` is the canonical student-facing branch. It carries the challenge doc,
  the failing specs, and stubs that compile.
- Reference solutions never land on `main`. Keep them on a separate
  `instructor` branch, marked `INSTRUCTOR REFERENCE SOLUTION`.
- Files that are deliberately stubs on `main`: `lib/pii.ts`, `lib/reranker.ts`,
  `lib/evals/llm-judge.ts`, plus whatever the current week is building.

**Tests-first format** (`lib/agents/read-only.test.ts` is the canonical example of the security-negative style):
1. Write the failing test specs that pin the exact behavior — including the security-relevant negatives (e.g., "client cannot opt out via header", "calendar never called on 403").
2. Write stubs that **compile and fail on assertions, not imports**: functions `throw new Error('Not implemented')`, routes return 501. Include TODO comments stating requirements, not steps (match `lib/reranker.ts` tone).
3. Install any new deps and add env vars to `.env.example` up front — students start at the spec, not at setup. Add a `doctor` check for anything that can be misconfigured silently.
4. **Prove the spec is satisfiable**: implement a throwaway solution, run the FULL suite green, then restore the stubs. Commit the solution to `instructor` (marked `INSTRUCTOR REFERENCE SOLUTION`), never leave copies elsewhere.
5. Tests mock external services (`vi.mock` prisma/pinecone/openai/calendar) — `npm run test:run` must never hit a network or cost money. Evals that call real LLMs go under `lib/evals/` behind `npm run test:evals`.

**Challenge doc**: `docs/CHALLENGE-0<N>-<NAME>.md`, numbered by week. Sections: title + one-line mission, numbered Parts, a "What done looks like" checklist, and the video prompt. State the expected red/green test counts. Match the tone of `docs/CHALLENGE-02-RETRIEVAL-EVAL.md` — requirements and reasoning, not step-by-step instructions.

## Build checklist

- [ ] Which planted failure or production gate does this teach? (name it)
- [ ] What measurement forces the decision? (no metric, no decision)
- [ ] Failing specs written; fail on assertions, not import errors
- [ ] Stubs + deps + `.env.example` committed; student starts at the spec
- [ ] Throwaway solution proves all tests green; stubs restored
- [ ] Challenge doc written, expected red/green counts stated
- [ ] `main`: spec lands, suite shows exactly the new reds
- [ ] `instructor`: solution lands, suite fully green, `tsc` clean, `next build` passes
- [ ] Nothing reintroduces MCP, Retell, `ts-node`, or a response-header side channel — see CLAUDE.md
- [ ] Adversarial review questions / portfolio artifact included where it fits
- [ ] Commits local on `main` and `instructor`; Brian reviews before push
