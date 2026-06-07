---
name: create-challenge
description: Design and build a student challenge (homework assignment) for the medical RAG course. Use when asked to create, design, or scaffold a new challenge, homework, or assignment for students. Encodes the evidence-based pedagogy (evals as spine, planted failures, production gates, portfolio artifacts) and this repo's tests-first + three-branch mechanics.
---

# Creating a Student Challenge

The goal of every challenge: produce **evidence that the student stressed a real system and made decisions from measurement, not vibes**. A model can write the code; it can't hand them the eval result showing it didn't help, or the postmortem of what broke. Design for that.

## Pedagogy principles (non-negotiable)

1. **No metric, no decision.** If the challenge involves tuning or choosing anything (reranker, chunk size, model, threshold, index config), the student must build or use an eval FIRST and justify the choice with a number. Never let a challenge end at "it works" — end at "here's the measurement that says it works."
2. **Plant the failures — don't wait for them.** Seed the failure mode into the data or queries so every student hits it by design:
   - Poisoned document in the corpus (prompt injection via retrieval)
   - PII buried in data that must be detected and handled
   - A retrieval set where naive cosine similarity returns plausible garbage (forces hybrid search / reranking to *demonstrably* help)
   - Hallucination-bait queries (answers not in the corpus; system must say so)
   - A cost blowup (query pattern that burns tokens unless they add limits/caching)
   - Cross-tenant/role leakage bait (data a role shouldn't see, reachable unless they enforce it server-side)
3. **Ugly data over toy data.** Use the Coherent dataset's real mess (Synthea digit-suffixed names, 143k notes, dead patients, inconsistent fields). Never fabricate clean fixtures for the *challenge itself* — clean fixtures are fine inside unit tests.
4. **Tie to a production gate.** Each challenge should move the system past one gate: regression evals on every change, cost/token observability, scoped access (RBAC/MCP auth), tracing/logging, or correct handling of a planted failure. Name the gate in the doc.
5. **Portfolio artifact, not demo.** Where it fits, require a written component: a short design note (tradeoff + alternative rejected + why) or a postmortem (what broke, what changed, what they deliberately didn't build). The adversarial review questions go in the doc: "Show me your eval. Show me where it failed. Defend this against the alternative."

## Repo mechanics (how challenges ship here)

**Branch model** (see also `docs/CURRICULUM-PLAN.md`):
- `main` — dev/canonical. Gets: challenge doc + failing specs + stubs.
- `student` — what students use. Gets: the same spec material. NEVER copy solutions or these skeleton files from main: `lib/query-analyzer.ts`, `lib/calendar.ts`, `lib/agent.ts`, `lib/scheduling.ts`, `lib/langsmith.ts`, `app/api/chat/route.ts`, `lib/chunking.ts`, `lib/vector-search.ts`, `mcp-server/index.ts`, `lib/evals/*`.
- `instructor` — solutions only. Gets: the reference solution + reference tests, all green.

**Tests-first format** (the RBAC challenge `docs/CHALLENGE-RBAC.md` is the canonical example):
1. Write the failing test specs that pin the exact behavior — including the security-relevant negatives (e.g., "client cannot opt out via header", "calendar never called on 403").
2. Write stubs that **compile and fail on assertions, not imports**: functions `throw new Error('Not implemented')`, routes return 501. Include TODO comments stating requirements, not steps (match `docs/CHALLENGE-PII.md` tone).
3. Install any new deps and add env vars to `.env.example` up front — students start at the spec, not at setup.
4. **Prove the spec is satisfiable**: implement a throwaway solution, run the FULL suite green, then restore the stubs. Commit the solution to `instructor` (marked `INSTRUCTOR REFERENCE SOLUTION`), never leave copies elsewhere.
5. Tests mock external services (`vi.mock` prisma/pinecone/openai/calendar) — `npm run test:run` must never hit a network or cost money. Evals that call real LLMs go under `lib/evals/` behind `npm run test:evals`.

**Challenge doc**: `docs/CHALLENGE-<NAME>.md`. Sections: title + one-line mission, Learning Objectives, Background (why this failure mode matters in production), The Spec / Your Task (point at the failing test files by path), numbered Parts, Hints, Stretch Goals. State the expected red/green test counts.

## Build checklist

- [ ] Which planted failure or production gate does this teach? (name it)
- [ ] What measurement forces the decision? (no metric, no decision)
- [ ] Failing specs written; fail on assertions, not import errors
- [ ] Stubs + deps + `.env.example` committed; student starts at the spec
- [ ] Throwaway solution proves all tests green; stubs restored
- [ ] Challenge doc written, expected red/green counts stated
- [ ] `main` + `student`: spec lands, suite shows exactly the new reds
- [ ] `instructor`: solution lands, suite fully green, `tsc` clean, `next build` passes
- [ ] Adversarial review questions / portfolio artifact included where it fits
- [ ] Commits local on all three branches; Brian reviews before push
