# Teaching-Readiness Audit & Fix Plan

**Date:** 2026-06-28 · **Branches audited:** `main` (dev/canonical), `student` (skeletons + failing specs), `instructor` (solutions + curriculum). Produced by a 5-agent read-only audit + dynamic checks.

## Bottom line

**The course is close to teach-ready.** The `student` branch is clean (no curriculum or solution leaks, all assignment stubs correct, all provided lab infra present), the historically-buggy shared libs are coherent across branches, every curriculum command/path/symbol resolves, `tsc --noEmit` passes, and `npm run test:run` is **178/178 green** on instructor. Two real P1 fixes remain before the upload and MCP blocks can be taught, plus minor polish and cleanup.

## Verdict by area

| Area | Verdict | Notes |
|---|---|---|
| Student-branch integrity (no leaks, stubs, infra) | ✅ PASS | 0 leaks; all 10 assignment files correctly stubbed; all provided infra present; 9 spec files present |
| Cross-branch coherence | ⚠️ 1×P1, 2×P2 | shared libs coherent; upload challenge broken on student |
| Curriculum ↔ repo references | ✅ PASS | all npm scripts / paths / exports resolve; placeholders outstanding |
| Scripts & environment | ⚠️ 1×P1 | MCP keys undocumented in `.env.example` |
| Dynamic checks | ✅ PASS | `tsc` clean (after clearing stale `.next`), 178/178 tests green |

---

## Fix plan (prioritized)

### P1 — teach-blockers (fix before the relevant block)

- [ ] **Upload challenge not teachable on `student`/`main`.** The failing spec `app/api/upload/route.test.ts` exists **only on `instructor`**; `student` and `main` carry the *old chunking-based* `app/api/upload/route.ts` (a working impl, not a stub) and **no failing test**. A student following Day 31 / `docs/CHALLENGE-UPLOAD-API.md` finds a mismatched route and nothing to drive.
  - **Fix:** source of truth = `instructor`. Port `app/api/upload/route.test.ts` to `student` **and** `main`; replace the old route on `student` with a proper **stub** (fails on assertion, not import — per `docs/CHALLENGE-UPLOAD-API.md`); set `main`'s route to the **new solution** (match `instructor`, the dominant `main==instructor` pattern). Verify: spec **fails** on student, **passes** on instructor/main.
- [ ] **MCP keys undocumented in `.env.example`.** `MCP_API_KEY` + `MCP_ADMIN_KEY` are read by `mcp-server/auth.ts:202,212` (gate read/read_pii vs admin scope) but absent from `.env.example`. Students doing the MCP security work (Day 27) hit a silent missing-key wall.
  - **Fix:** add an MCP section to `.env.example` on all teaching branches (descriptions mirror `scripts/security/demo-mcp-auth.ts`).

### P2 — polish

- [ ] **`scripts/ingest-coherent.ts` whitespace drift.** `instructor` differs from `main`/`student` by tabs-vs-spaces only (zero logic). Reformat instructor to match (`git checkout main -- scripts/ingest-coherent.ts`).
- [ ] **Bible lab missing on `main`.** `scripts/bible/*` + the `bible:*` npm scripts are on `instructor`/`student` but absent on `main`. No student impact (teaching branches agree), but the canonical branch lacks a released lab — forward-merge when convenient.
- [ ] **6 Typeform deliverable links** still `PLACEHOLDER-DAYNN` (Days 6/12/18/24/30/36). Brian-owned; replace before each block's deliverable day.
- [ ] **3 screenshots** flagged `<!-- TODO: capture screenshot -->`. Brian-owned (authenticated dashboards / live-class ingest).
- [ ] *(optional)* `app/api/chat/route.ts` on `student` ships the scheduling-action solution as a commented-out hint block — trim to a one-line TODO if zero-spoiler is wanted.

### By design — not bugs (no action)

- Day 12 references `data/bible/constitution.txt`, `scripts/bible/chunk-constitution.ts`, `chunks-constitution.jsonl` — intentionally student-created (AUTHORING rule 17 says do NOT ship `chunk-constitution.ts`).
- `data/subset/` — optional instructor subset; curriculum documents the `--limit` fallback.

---

## Cleanup (approved 2026-06-28)

**Removed:** `.gstack/` (untracked scratch), `docs/WEEK1-INTRO.html`…`WEEK6-CAPSTONE.html` (6, superseded by `curriculum/slides/`), `scripts/process-fhir.ts` (dead), `docs/CURRICULUM-PLAN.md`, `docs/IMPLEMENTATION_PLAN.md` (stale planning). README references to the WEEK*.html updated.

**Kept (intentional):** `scripts/generate-fhir.ts`, `scripts/create-subset.ts` (data-prep — may be used live with the class); `curriculum/assets/.gitkeep`.

---

## Verification

- `npx tsc --noEmit` → clean (clear `.next` first if stale LMS types appear).
- `npm run test:run` → 178/178 on `instructor`.
- After the upload fix: `npm run test:run` on `student` should show the upload spec **failing** (assignment red); on `instructor`/`main` it should **pass**.
