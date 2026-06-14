# Crosswalk: Module ↔ RTI ↔ Competency ↔ Rubric

Traceability across all standards artifacts so **nothing is orphaned**: every
curriculum module ties to an RTI entry, one or more WPS competencies, an
assessment method, and a rubric.

## Master crosswalk

| Module | RTI entry | Domain | Competency | Assessment method | Rubric |
|--------|-----------|--------|------------|-------------------|--------|
| 1 — LLM Fundamentals & Prompting | RTI-1 | Foundations | C-FND-1 | Code review + prompt-variant write-up | R-FND-1 |
| 2 — Data Sourcing & Preparation | RTI-2 | Retrieval | C-RET-1 | Artifact review + readiness checklist | R-RET-1 |
| 3 — Relational Data & SQL Setup | RTI-3 | Data & Security | C-SEC-1 | Schema/migration review + queries | R-SEC-1 |
| 4 — RAG Ingestion (chunk/embed/upsert) | RTI-4 | Retrieval | C-RET-2 | Pipeline demo + tests | R-RET-2 |
| 5 — Retrieval & Hybrid Search | RTI-5 | Retrieval | C-RET-3 | Retrieval-metrics report | R-RET-3 |
| 6 — Chat Interface & App Routes | RTI-6 | Application | C-APP-1 | Live demo + route review | R-APP-1 |
| 7 — MCP Server Design | RTI-7 | Agents & Tooling | C-AGT-1 | Schema review + MCP demo | R-AGT-1 |
| 8 — SQL Agent Design | RTI-8 | Agents & Tooling | C-AGT-2 | Adversarial query test + review | R-AGT-2 |
| 9 — RBAC | RTI-9 | Data & Security | C-SEC-2 | Permission-matrix test + audit inspection | R-SEC-2 |
| 10 — PII Handling | RTI-10 | Data & Security | C-SEC-3 | PII + content-validator tests | R-SEC-3 |
| 11 — Evaluation & Observability | RTI-11 | Eval & Observability | C-EVL-1 | Eval run + interpretation + trace | R-EVL-1 |
| 12 — Model Hosting & Deployment | RTI-12 | Deployment | C-DEP-1 | Deployment demo + config review | R-DEP-1 |

## Orphan check

Run this each time the curriculum or standards change. Current status: **PASS —
no orphans.**

| Check | Result |
|-------|--------|
| Every module has an RTI entry | ✅ 12/12 |
| Every module has ≥1 competency | ✅ 12/12 |
| Every competency has an assessment method | ✅ 11/11 |
| Every competency has a rubric | ✅ 11/11 |
| Every rubric maps back to a competency | ✅ 11/11 |
| Every RTI entry contributes to the hours ledger | ✅ 12/12 |

### Notes on cardinality

- Modules **3, 9, 10** all live in the **Data & Security** domain and each maps to
  its own distinct competency (C-SEC-1 / C-SEC-2 / C-SEC-3) — no merging.
- The mapping is currently **1 module → 1 competency**. If a future module yields
  multiple distinct hands-on capabilities, split into multiple competencies and
  add rows here (keep the 1 competency → 1 rubric rule).
- Auxiliary code present in the repo but **not** part of the registered scope
  (e.g., `lib/calendar.ts`, `lib/scheduling.ts`, `app/api/schedule`) is
  intentionally **not** mapped — it is not part of the apprenticeship curriculum.
  Revisit if a scheduling module is later added to the curriculum.

## Open Items

- [ ] If NextGen/DAS requires **competency → RTI hour attribution**, extend the
      master table with an hours column sourced from `hours-ledger.md`.
