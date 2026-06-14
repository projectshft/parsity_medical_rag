# Work Process Schedule (WPS)

The on-the-job learning (OJL) half of the Standards: the competencies an
apprentice **demonstrates at work**, written as observable "can do" statements
and grouped by skill domain.

> **Authoring convention.** Pattern:
> `The apprentice can [action verb] [artifact] [to standard / under condition].`
> Every competency is observable, demonstrable, and assessable — and every one
> has an assessment method (`competency-map.md`) and a rubric
> (`assessment-rubrics.md`).
>
> **Means of evaluation (required by the WPS):** each competency states *how* it
> is tested below ("Evaluated by …"). Full rubric detail is in
> `assessment-rubrics.md`. Mentor sign-off requires a rubric rating of
> **Proficient (3)** or higher.

## Domain 1 — Foundations

### C-FND-1
**The apprentice can** engineer prompts and enforce schema-validated structured
outputs for an LLM task, and document how prompt variants affect output quality.
*Evaluated by:* code review of the structured-output implementation + a short
written comparison of prompt variants. *(Module 1)*

## Domain 2 — Retrieval

### C-RET-1
**The apprentice can** source and prepare a domain document corpus suitable for
retrieval — cleaned, deduplicated, and tagged with retrieval metadata.
*Evaluated by:* review of the prepared corpus + ingestion-readiness checklist. *(Module 2)*

### C-RET-2
**The apprentice can** build an ingestion pipeline that chunks, embeds, and
upserts a document corpus into a vector database and verifies retrieval quality.
*Evaluated by:* pipeline demo with sample queries returning relevant chunks +
passing ingestion tests. *(Module 4)*

### C-RET-3
**The apprentice can** implement hybrid search (structured filter + semantic
vector, with reranking) and measure retrieval quality against a labeled query set.
*Evaluated by:* retrieval-metrics report on a held-out query set
(`lib/evals/retrieval.test.ts`). *(Module 5)*

## Domain 3 — Application Layer

### C-APP-1
**The apprentice can** build a working chat interface and API routes backed by a
RAG pipeline, with source attribution surfaced to the user.
*Evaluated by:* live demo against a scripted set of user queries + route review. *(Module 6)*

## Domain 4 — Agents & Tooling

### C-AGT-1
**The apprentice can** design and ship an MCP server that exposes defined,
schema-validated tools to an AI client.
*Evaluated by:* tool-schema review + end-to-end demo (natural language → MCP tool
→ result) in an MCP client. *(Module 7)*

### C-AGT-2
**The apprentice can** build a SQL agent that translates natural language into
safe, scoped, parameterized queries (no injection; least-privilege scope).
*Evaluated by:* adversarial query test set (including injection attempts) +
code review of query construction. *(Module 8)*

## Domain 5 — Data & Security

### C-SEC-1
**The apprentice can** provision and model a relational database for structured
domain data using a typed ORM, with working migrations and parameterized queries.
*Evaluated by:* schema/migration review + query exercises. *(Module 3)*

### C-SEC-2
**The apprentice can** implement role-based access control over data tools or
endpoints, enforcing least privilege with authentication and audit logging.
*Evaluated by:* permission-matrix test (scopes × tools) + audit-log inspection
(`mcp-server/auth.test.ts`). *(Module 9)*

### C-SEC-3
**The apprentice can** implement PII/PHI detection and obscuring controls in an
AI application and defend the retrieval path against poisoned-document injection.
*Evaluated by:* passing PII tests (`lib/pii.test.ts`) + content-validator tests
(`lib/security/content-validator.test.ts`). *(Module 10)*

## Domain 6 — Evaluation & Observability

### C-EVL-1
**The apprentice can** stand up an evaluation harness (retrieval metrics and/or
LLM-as-judge) and tracing/observability for an AI system, and use the results to
drive iteration.
*Evaluated by:* eval-harness run with a written interpretation + a captured trace. *(Module 11)*

## Domain 7 — Deployment

### C-DEP-1
**The apprentice can** configure hosted model inference access and deploy the
application to a runnable hosted environment with managed secrets/config.
*Evaluated by:* successful deployment demo + environment/secrets configuration review. *(Module 12)*

## Competency index

| ID | Domain | Module | Short title |
|----|--------|--------|-------------|
| C-FND-1 | Foundations | 1 | Prompting & structured outputs |
| C-RET-1 | Retrieval | 2 | Corpus sourcing & preparation |
| C-RET-2 | Retrieval | 4 | Ingestion pipeline (chunk/embed/upsert) |
| C-RET-3 | Retrieval | 5 | Hybrid search & retrieval quality |
| C-APP-1 | Application | 6 | Chat interface & API routes |
| C-AGT-1 | Agents & Tooling | 7 | MCP server with defined tools |
| C-AGT-2 | Agents & Tooling | 8 | Safe SQL agent |
| C-SEC-1 | Data & Security | 3 | Relational DB provisioning & modeling |
| C-SEC-2 | Data & Security | 9 | RBAC & audit logging |
| C-SEC-3 | Data & Security | 10 | PII handling & injection defense |
| C-EVL-1 | Eval & Observability | 11 | Eval harness & observability |
| C-DEP-1 | Deployment | 12 | Hosted inference & deployment |

**11 competencies across 7 domains.** All are mapped in `crosswalk.md`; none are
orphaned.

## Open Items

- [ ] Confirm whether the registering agency requires **approximate OJL hours**
      per competency (some WPS templates do). If so, derive from the employer's
      work schedule — these are employer-set, not curriculum-derived.
- [ ] Confirm the **approach** (competency-based vs. hybrid); this determines
      whether progression is by demonstrated competency, elapsed hours, or both.
