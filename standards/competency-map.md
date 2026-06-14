# Competency Map

Each WPS competency mapped to its **assessment method** and the **rubric** that
grades it. A competency with no rubric is incomplete; none are incomplete here.

> Rubric IDs (e.g., `R-FND-1`) resolve to sections in `assessment-rubrics.md`.
> Passing bar for every competency is rubric rating **Proficient (3)** or higher.

| Competency | Module | Assessment method | Primary evidence / artifact | Rubric |
|------------|--------|-------------------|-----------------------------|--------|
| C-FND-1 | 1 | Code review + written prompt-variant comparison | Structured-output implementation (`responses.parse` + Zod); 1-page variant write-up | R-FND-1 |
| C-RET-1 | 2 | Artifact review + ingestion-readiness checklist | Prepared corpus (cleaned, deduped, metadata-tagged) | R-RET-1 |
| C-RET-2 | 4 | Pipeline demo + automated tests | Chunk→embed→upsert pipeline; sample queries return relevant chunks | R-RET-2 |
| C-RET-3 | 5 | Retrieval-metrics report on held-out query set | `lib/evals/retrieval.test.ts` results; hybrid + rerank comparison | R-RET-3 |
| C-APP-1 | 6 | Live demo + route/code review | Chat UI + API routes with source attribution | R-APP-1 |
| C-AGT-1 | 7 | Tool-schema review + end-to-end MCP demo | MCP server exposing schema-validated tools in a client | R-AGT-1 |
| C-AGT-2 | 8 | Adversarial query test + code review | SQL agent; injection/scope test set | R-AGT-2 |
| C-SEC-1 | 3 | Schema/migration review + query exercises | Prisma schema, migrations, parameterized queries | R-SEC-1 |
| C-SEC-2 | 9 | Permission-matrix test + audit-log inspection | RBAC scopes × tools; `mcp-server/auth.test.ts`; audit logs | R-SEC-2 |
| C-SEC-3 | 10 | Automated PII + content-validator tests | `lib/pii.test.ts`, `lib/security/content-validator.test.ts` | R-SEC-3 |
| C-EVL-1 | 11 | Eval-harness run + written interpretation + trace | `lib/evals/` output; LangSmith trace | R-EVL-1 |
| C-DEP-1 | 12 | Deployment demo + config review | Running hosted deployment; secrets/env configuration | R-DEP-1 |

## Assessment method notes

- **Automated tests** are the objective floor where they exist (`*.test.ts`).
  Passing tests is necessary but not sufficient — the rubric still requires the
  apprentice to explain and defend the implementation.
- **Demos** are observed by the mentor/journeyworker and rated live against the
  rubric; record the date and rating for the apprentice's competency record.
- **Written artifacts** (comparisons, interpretations) demonstrate reasoning, not
  just working code, which the registering agency expects for a software occupation.

## Open Items

- [ ] Confirm whether the registering agency wants a **single competency record
      form** per apprentice (most do). If so, this map is the source of truth for
      that form's rows.
- [ ] Confirm whether **third-party / employer mentor** sign-off is required in
      addition to instructor assessment.
