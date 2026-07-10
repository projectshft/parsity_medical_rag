# Assessment Rubrics

One graded rubric per WPS competency. Every competency in
`work-process-schedule.md` has exactly one rubric here.

## Rating scale (applies to all rubrics)

| Rating | Label | Meaning |
|--------|-------|---------|
| 1 | Emerging | Attempts the task; major gaps; cannot run/verify unaided. |
| 2 | Developing | Partially working; needs significant guidance; some criteria unmet. |
| 3 | **Proficient** | **Meets all criteria; works and is verified; minimal guidance. Minimum to pass / mentor sign-off.** |
| 4 | Advanced | Exceeds criteria; handles edge cases, performance, or extends scope independently. |

**A competency is signed off at rating ≥ 3.** Record the rating, date, and
assessor on the apprentice's competency record (see `competency-map.md`).

---

## R-FND-1 — Prompting & structured outputs *(C-FND-1, Module 1)*

| Criterion | Proficient (3) evidence |
|-----------|-------------------------|
| Structured output | Uses Zod schema + `responses.parse()` / `zodTextFormat`; output validates against schema. |
| Prompt design | System/user prompts are task-appropriate and documented. |
| Variant analysis | Compares ≥2 prompt variants and states which is better and why. |
| Correctness | Runs without schema-validation errors on sample inputs. |

**Advanced (4):** adds guardrails (refusal/edge-case handling) and measures
variant quality quantitatively.

---

## R-RET-1 — Corpus sourcing & preparation *(C-RET-1, Module 2)*

| Criterion | Proficient (3) evidence |
|-----------|-------------------------|
| Sourcing | Corpus acquired with documented source and licensing. |
| Cleaning | Deduplicated and cleaned; obvious noise removed. |
| Metadata | Each document tagged with retrieval metadata (source, date, type/section). |
| Readiness | Passes an ingestion-readiness checklist (format, encoding, size). |

**Advanced (4):** automated, reproducible prep script; handles malformed records gracefully.

---

## R-RET-2 — Ingestion pipeline *(C-RET-2, Module 4)*

| Criterion | Proficient (3) evidence |
|-----------|-------------------------|
| Chunking | Document-aware chunking with sensible size/overlap and per-chunk metadata. |
| Embeddings | Embeddings generated via API; dimensionality/cost understood. |
| Upsert | Vectors upserted to the vector DB with namespaces/metadata. |
| Verification | Sample queries return relevant chunks; ingestion tests pass. |

**Advanced (4):** idempotent re-ingestion, batching/rate-limit handling, retrieval spot-check report.

---

## R-RET-3 — Hybrid search & retrieval quality *(C-RET-3, Module 5)*

| Criterion | Proficient (3) evidence |
|-----------|-------------------------|
| Semantic retrieval | Vector search with metadata filtering works. |
| Hybrid path | Structured (SQL) filter combined with vector search for combined queries. |
| Reranking | Reranking applied and its effect described. |
| Measurement | Retrieval quality measured on a labeled query set (`lib/evals/retrieval.test.ts`). |

**Advanced (4):** reports precision/recall-style metrics and tunes parameters from the data.

---

## R-APP-1 — Chat interface & API routes *(C-APP-1, Module 6)*

| Criterion | Proficient (3) evidence |
|-----------|-------------------------|
| UI | Working chat interface backed by the RAG pipeline. |
| Routes | API routes orchestrate analyze → retrieve → generate. |
| Attribution | Source/citation surfaced to the user. |
| Robustness | Handles empty/ambiguous queries without crashing. |

**Advanced (4):** streaming responses, loading/error states, and basic input validation.

---

## R-AGT-1 — MCP server with defined tools *(C-AGT-1, Module 7)*

| Criterion | Proficient (3) evidence |
|-----------|-------------------------|
| Tool definitions | Tools defined with validated input schemas and clear descriptions. |
| Handlers | Handlers return correct, well-formed results. |
| Integration | Server connects to an MCP client; NL → tool → result demo works. |
| Errors | Invalid inputs handled with informative errors. |

**Advanced (4):** adds a novel tool beyond the seed set and documents the tool contract.

---

## R-AGT-2 — Safe SQL agent *(C-AGT-2, Module 8)*

| Criterion | Proficient (3) evidence |
|-----------|-------------------------|
| NL → query | Natural language translated to a correct structured query plan. |
| Safety | Queries are parameterized; no string-concatenated SQL; injection attempts fail. |
| Scope | Queries respect least-privilege scope (no access beyond intent). |
| Formatting | Results formatted back into usable LLM context. |

**Advanced (4):** passes an adversarial injection test set and rejects out-of-scope requests explicitly.

---

## R-SEC-1 — Relational DB provisioning & modeling *(C-SEC-1, Module 3)*

| Criterion | Proficient (3) evidence |
|-----------|-------------------------|
| Schema | Domain entities modeled with appropriate relations/types. |
| Provisioning | Managed PostgreSQL provisioned; migrations run cleanly. |
| Queries | Parameterized queries incl. numeric filters and an aggregation. |
| ORM | Typed ORM (Prisma) used correctly. |

**Advanced (4):** indexes/constraints justified; migration is reversible and documented.

---

## R-SEC-2 — RBAC & audit logging *(C-SEC-2, Module 9)*

| Criterion | Proficient (3) evidence |
|-----------|-------------------------|
| Scopes | Permission scopes defined (e.g., read / read_pii / admin). |
| Enforcement | Least privilege enforced at the tool/endpoint boundary with auth; `auth.test.ts` passes. |
| Audit | Access and security events logged (who/what/when); sensitive params redacted. |
| Matrix | Scope × tool permission matrix behaves as specified. |

**Advanced (4):** fine-grained permissions (per-resource) or key rotation, with tests.

---

## R-SEC-3 — PII handling & injection defense *(C-SEC-3, Module 10)*

| Criterion | Proficient (3) evidence |
|-----------|-------------------------|
| Detection | PII/PHI categories detected in structured and free text. |
| Obscuring | Hash pseudonymization, date generalization, regex redaction implemented; `pii.test.ts` passes. |
| Injection defense | Poisoned-document patterns detected; retrieval path validated/sandboxed; `content-validator.test.ts` passes. |
| Preservation | Non-PII content preserved (no over-redaction). |

**Advanced (4):** adds new detection patterns (e.g., addresses, homoglyphs) or output validation.

---

## R-EVL-1 — Eval harness & observability *(C-EVL-1, Module 11)*

| Criterion | Proficient (3) evidence |
|-----------|-------------------------|
| Harness | Eval harness runs with retrieval metrics and/or LLM-as-judge. |
| Observability | App instrumented with tracing (e.g., LangSmith); a trace is captured. |
| Interpretation | Written interpretation of results identifying a concrete improvement. |
| Iteration | Demonstrates one change driven by eval findings. |

**Advanced (4):** regression-style eval gating and a small dashboard/summary of trends.

---

## R-DEP-1 — Hosted inference & deployment *(C-DEP-1, Module 12)*

| Criterion | Proficient (3) evidence |
|-----------|-------------------------|
| Inference access | Hosted model inference configured (hosted API or AWS Bedrock). |
| Config/secrets | Environment config and secrets managed across environments (no secrets in code). |
| Deployment | App deployed to a runnable hosted environment. |
| Verification | Health/smoke check confirms the deployment serves requests. |

**Advanced (4):** documented rollback/redeploy and a basic uptime/health check.

---

## R-CAP-1 — Integrative capstone deliverable *(C-CAP-1, Capstone, 40–80 OJL hrs)*

| Criterion | Proficient (3) evidence |
|-----------|-------------------------|
| Scoping | Apprentice independently scopes a viable extension (one of the capstone tracks or an approved alternative) with stated goals. |
| Build | Working deliverable, authored by the apprentice (not a provided skeleton), integrated into the system. |
| Integration | Deliverable correctly composes with existing retrieval/app/security layers without regressing them. |
| Demonstration | Live demo plus a short written design rationale explaining choices and trade-offs. |

**Advanced (4):** ships tests for the new work, handles edge cases, and the
chosen track also meets the Advanced bar of its underlying competency (e.g., a
reranking capstone meets R-RET-3 Advanced).

> **Note:** When a capstone track is the *only* graded deliverable for an
> otherwise thinly-covered competency (see the alignment review in
> `crosswalk.md`), assess it against **both** R-CAP-1 and that competency's rubric.

---

## Open Items

- [ ] Confirm whether NextGen/DAS supplies a **standard rubric format** these must
      conform to (the 1–4 scale above is a sensible default, not a mandate).
- [ ] Confirm whether a **competency-based** approach requires a strict
      pass/no-pass gate rather than the 1–4 scale (the ≥3 sign-off rule already
      supports this).
