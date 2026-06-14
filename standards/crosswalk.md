# Crosswalk: Module ↔ RTI ↔ Competency ↔ Rubric ↔ Assignment

Traceability across all standards artifacts so **nothing is orphaned**: every
curriculum module ties to an RTI entry, a WPS competency, an assessment method, a
rubric, and the **actual graded assignment** we give. The final column is the
assignment-to-competency **alignment review** requested for the hybrid program.

> **Program:** Hybrid approach · 144 hr/yr RTI floor · capstone tracked as 40–80
> OJL/project hours (see `hours-ledger.md`).

## Master crosswalk

| Module | RTI | Domain | Competency | Rubric | Actual assignment / deliverable | Alignment |
|--------|-----|--------|------------|--------|---------------------------------|-----------|
| 1 — LLM Fundamentals & Prompting | RTI-1 | Foundations | C-FND-1 | R-FND-1 | Wk4 TODOs: `analyzeQuery()` w/ Zod structured output + system-prompt authoring (`lib/query-analyzer.ts`, `lib/prompts.ts`) | ✅ Full |
| 2 — Data Sourcing & Preparation | RTI-2 | Retrieval | C-RET-1 | R-RET-1 | Wk1 challenge: explore FHIR data (read-only). Corpus is **pre-ingested** via `scripts/process-fhir.ts` | ⚠️ Gap — provided, not student-built |
| 3 — Relational Data & SQL Setup | RTI-3 | Data & Security | C-SEC-1 | R-SEC-1 | Wk1 TODOs: connect Neon, run Prisma migration. Schema (`prisma/schema.prisma`) **pre-built** | ⚠️ Partial — provisions/migrates only; no modeling |
| 4 — RAG Ingestion (chunk/embed/upsert) | RTI-4 | Retrieval | C-RET-2 | R-RET-2 | Wk2 `chunkDocument()` (`lib/chunking.ts`) + Wk3 `createEmbedding()`/`upsertChunks()` (`lib/embeddings.ts`, `lib/pinecone.ts`) | ✅ Full |
| 5 — Retrieval & Hybrid Search | RTI-5 | Retrieval | C-RET-3 | R-RET-3 | Wk3 `searchClinicalNotes()` (`lib/vector-search.ts`); eval via `lib/evals/retrieval.test.ts`; reranking as capstone track (`lib/reranker.ts`) | ✅ Full (rerank = capstone-optional) |
| 6 — Chat Interface & App Routes | RTI-6 | Application | C-APP-1 | R-APP-1 | Capstone **Option 5: App Layer Build** (`docs/WEEK6-CAPSTONE.html`; `docs/CHALLENGE-APP-BUILD.md` to author). Every apprentice builds + deploys the app | ✅ Covered via capstone track |
| 7 — MCP Server Design | RTI-7 | Agents & Tooling | C-AGT-1 | R-AGT-1 | Wk5 TODOs: define MCP tools + handlers; add a new tool (`mcp-server/`) | ✅ Full |
| 8 — SQL Agent Design | RTI-8 | Agents & Tooling | C-AGT-2 | R-AGT-2 | Wk4: `executeQuery()` orchestration (`lib/query-executor.ts`). Scoped SQL (`lib/sql-queries.ts`) **pre-built** | ⚠️ Partial — orchestration only; safe-SQL pre-built |
| 9 — RBAC | RTI-9 | Data & Security | C-SEC-2 | R-SEC-2 | `docs/CHALLENGE-MCP-AUTH.md`: API keys, scopes, audit (`mcp-server/auth.ts`, `audit.ts`, `auth.test.ts`) | ✅ Full (challenge / capstone track) |
| 10 — PII Handling | RTI-10 | Data & Security | C-SEC-3 | R-SEC-3 | `docs/CHALLENGE-PII.md` (`lib/pii.ts`, `pii.test.ts`) + `docs/CHALLENGE-POISONED-DOCS.md` (`lib/security/content-validator.ts`) | ✅ Full (challenge / capstone track) |
| 11 — Evaluation & Observability | RTI-11 | Eval & Observability | C-EVL-1 | R-EVL-1 | `lib/evals/retrieval.test.ts` (retrieval eval, has student TODO); `lib/langsmith.ts` observability **pre-wired** | ⚠️ Partial — retrieval eval only; no observability deliverable |
| 12 — Model Hosting & Deployment | RTI-12 | Deployment | C-DEP-1 | R-DEP-1 | Capstone **Option 6: Deployment & Hosted Inference** (`docs/WEEK6-CAPSTONE.html`; `docs/CHALLENGE-DEPLOY.md` to author). Every apprentice deploys the app | ✅ Covered via capstone track |
| Capstone | *(OJL)* | Capstone & Integration | C-CAP-1 | R-CAP-1 | Wk6: self-scoped extension — PII / reranking / multimodal / new data source / custom MCP tool (`docs/WEEK6-CAPSTONE.html`), 40–80 OJL hrs | ✅ Full |

## Assignment-to-competency alignment review

**Summary:** of the **13** competencies, **9 are fully covered** by a graded
deliverable, and **4 RTI-module competencies remain partial** because the
corresponding code is shipped pre-built (instructor branch) rather than assigned
as student work. The two previously-open gaps — **C-APP-1 (app build)** and
**C-DEP-1 (deployment)** — are now formal capstone tracks (Options 5 & 6); per
sponsor, every apprentice builds and deploys the app, so both are demonstrated.

### Fully aligned (✅) — 9
C-FND-1, C-RET-2, C-RET-3, C-AGT-1, C-SEC-2, C-SEC-3, C-CAP-1, **C-APP-1**
(capstone Option 5), **C-DEP-1** (capstone Option 6). Each has a
TODO/challenge/capstone deliverable and, where applicable, a passing test suite.

### Resolved (was ❌, now ✅) via capstone tracks

| Competency | Resolution |
|------------|-----------|
| C-APP-1 (chat UI / routes) | Capstone **Option 5: App Layer Build** added to `docs/WEEK6-CAPSTONE.html`. Every apprentice builds the app, so the competency is demonstrated. `docs/CHALLENGE-APP-BUILD.md` still to author. |
| C-DEP-1 (deployment) | Capstone **Option 6: Deployment & Hosted Inference** added. Every apprentice deploys the app. `docs/CHALLENGE-DEPLOY.md` still to author. |

### Remaining partials (⚠️) — 4, with recommended fixes

| Competency | Issue | Recommended fix (curriculum change) |
|------------|-------|-------------------------------------|
| C-RET-1 (corpus sourcing/prep) | ⚠️ Corpus is pre-ingested; Wk1 is read-only exploration | Add a small data-prep deliverable, or require the **“new data source”** capstone track. Already a listed capstone option. |
| C-SEC-1 (relational modeling) | ⚠️ Schema pre-built; students only provision/migrate | Add a TODO to model 1–2 entities (or a relation) themselves, then migrate. |
| C-AGT-2 (safe SQL agent) | ⚠️ Scoped SQL pre-built; students do orchestration only | Have students author ≥1 parameterized, scoped query (incl. an injection-resistance check) instead of all pre-built. |
| C-EVL-1 (eval & observability) | ⚠️ Retrieval eval exists; no observability deliverable | Add an observability TODO (instrument one trace via `lib/langsmith.ts`) **or** make eval/observability an eligible capstone track. |

> These are **recommendations for the curriculum**, surfaced by the alignment
> review — they are not yet implemented in the course. None block the standards
> artifacts from being internally consistent; they flag where the *delivered*
> course does not yet exercise a competency a registering agency would expect.

## Orphan check

Run each time the curriculum or standards change. Current status: **PASS — no
structural orphans** (every module → RTI → competency → rubric). Coverage gaps
above are *assignment* gaps, tracked separately for the curriculum to close.

| Check | Result |
|-------|--------|
| Every module has an RTI entry | ✅ 12/12 |
| Every module has ≥1 competency | ✅ 12/12 |
| Every competency has an assessment method | ✅ 13/13 |
| Every competency has a rubric | ✅ 13/13 |
| Every rubric maps back to a competency | ✅ 13/13 |
| Every RTI entry contributes to the hours ledger | ✅ 12/12 |
| Every competency has a graded student assignment | ⚠️ 9/13 full, 4 partial (see review above) |

### Notes on cardinality

- Modules **3, 9, 10** all live in **Data & Security** and each maps to a distinct
  competency (C-SEC-1 / C-SEC-2 / C-SEC-3) — no merging.
- The mapping is **1 module → 1 competency**, plus one integrative capstone
  competency (C-CAP-1) that is **OJL**, not an RTI module.
- Auxiliary code in the repo but **not** in registered scope (`lib/calendar.ts`,
  `lib/scheduling.ts`, `app/api/schedule`) is intentionally unmapped — not part of
  the apprenticeship curriculum. Revisit if a scheduling module is added.

## Open Items

- [x] **C-APP-1 and C-DEP-1 resolved** as capstone tracks (Options 5 & 6).
- [ ] Author the two referenced challenge files: `docs/CHALLENGE-APP-BUILD.md` and
      `docs/CHALLENGE-DEPLOY.md` (currently referenced by the capstone page but not
      yet written — same status as the other unwritten capstone challenge files).
- [ ] Decide each remaining partial fix above (4: C-RET-1, C-SEC-1, C-AGT-2,
      C-EVL-1) — add assignment vs. make capstone-eligible.
- [ ] If NextGen/DAS requires **competency → RTI hour attribution**, extend the
      master table with an hours column sourced from `hours-ledger.md`.
