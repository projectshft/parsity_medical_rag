# Related Technical Instruction (RTI) Outline

The classroom / supplemental-instruction half of the Standards. Each curriculum
module maps to exactly one RTI entry below, with written learning objectives and
estimated instructional hours.

> **Source curriculum:** `docs/CURRICULUM-PLAN.md` (6-week instructor-led pilot)
> expanded to a 12-module RTI sequence for the registered term.
>
> **Hours basis:** Hours below are RTI estimates for the **registered program
> term**, not the pilot's contact hours. The 6-week pilot delivers ~12 contact
> hours of live coding; the RAP RTI scales each topic to apprenticeship depth
> (lecture + guided lab + assessment). Totals roll up in `hours-ledger.md`.
> The per-module hours are estimates pending a confirmed RTI target (Open Items).

## Module sequence

### Module 1 — LLM Fundamentals & Prompting
*Domain: Foundations · Est. RTI hours: 12 · Code: `lib/openai.ts`, `lib/agent.ts`*

**Learning objectives.** The apprentice will be able to:
- Explain the LLM request/response lifecycle (tokens, context window, temperature).
- Engineer prompts for a domain task and compare prompt variants by output quality.
- Enforce **structured outputs** using Zod schemas with the OpenAI Responses API
  (`responses.parse()` + `zodTextFormat`) per project convention.
- Describe basic evaluation concepts (what "good" output means for the task).

### Module 2 — Data Sourcing & Preparation
*Domain: Retrieval · Est. RTI hours: 12 · Code: `scripts/process-fhir.ts`, `scripts/create-subset.ts`*

**Learning objectives.** The apprentice will be able to:
- Acquire a domain corpus (e.g., a medical dataset such as Synthea/Hugging Face) and
  describe its schema/licensing.
- Clean, deduplicate, and subset a corpus for an AI application.
- Attach retrieval metadata (source, date, section/type) to documents.

### Module 3 — Relational Data & SQL Database Setup (Neon)
*Domain: Data & Security · Est. RTI hours: 12 · Code: `prisma/schema.prisma`, `lib/prisma.ts`*

**Learning objectives.** The apprentice will be able to:
- Model structured domain entities (patients, conditions, observations, medications)
  in a relational schema.
- Provision a managed PostgreSQL database (Neon) and run migrations with a typed ORM (Prisma).
- Write parameterized queries, including numeric filters and aggregations.

### Module 4 — RAG Ingestion: Chunking, Embeddings, Vector Upload (Pinecone)
*Domain: Retrieval · Est. RTI hours: 16 · Code: `lib/chunking.ts`, `lib/pinecone.ts`, `lib/vector-search.ts`*

**Learning objectives.** The apprentice will be able to:
- Explain chunking trade-offs (size, overlap, document-aware vs. fixed) and chunk
  structured documents (e.g., SOAP notes) with metadata.
- Generate embeddings via an embeddings API and reason about dimensionality/cost.
- Upsert vectors into a vector database (Pinecone) with namespaces/metadata and
  verify that retrieval returns relevant chunks.

### Module 5 — Retrieval & Hybrid Search
*Domain: Retrieval · Est. RTI hours: 14 · Code: `lib/vector-search.ts`, `lib/query-executor.ts`, `lib/reranker.ts`*

**Learning objectives.** The apprentice will be able to:
- Implement semantic retrieval with metadata filtering.
- Combine structured (SQL) filters with vector search into a **hybrid** query path.
- Apply reranking and measure retrieval quality against a labeled query set.

### Module 6 — Chat Interface & Application Routes
*Domain: Application · Est. RTI hours: 12 · Code: `app/page.tsx`, `app/api/chat/route.ts`, `app/api/query/route.ts`*

**Learning objectives.** The apprentice will be able to:
- Build a chat UI backed by a RAG pipeline.
- Implement API routes that orchestrate query analysis → retrieval → generation.
- Stream/format model responses and surface source attribution to the user.

### Module 7 — MCP Server Design & Implementation
*Domain: Agents & Tooling · Est. RTI hours: 14 · Code: `mcp-server/index.ts`, `mcp-server/auth.ts`, `mcp-server/audit.ts`*

**Learning objectives.** The apprentice will be able to:
- Explain the Model Context Protocol and when to expose a system as MCP tools.
- Define schema-validated tools and implement their handlers.
- Integrate an MCP server with an AI client (Claude Desktop / Cursor).

### Module 8 — SQL Agent Design
*Domain: Agents & Tooling · Est. RTI hours: 12 · Code: `lib/query-executor.ts`, `lib/agent.ts`*

**Learning objectives.** The apprentice will be able to:
- Translate natural language into a structured query plan with an LLM.
- Generate **safe, scoped, parameterized** SQL (no injection; least-privilege scope).
- Format query results back into LLM context for response generation.

### Module 9 — Role-Based Access Control (RBAC)
*Domain: Data & Security · Est. RTI hours: 12 · Code: `mcp-server/auth.ts`, `mcp-server/audit.ts`*

**Learning objectives.** The apprentice will be able to:
- Design permission scopes (e.g., read / read_pii / admin) for data tools.
- Enforce least privilege at the tool/endpoint boundary with authentication.
- Add audit logging of access (who accessed what, when) and security events.

### Module 10 — PII Handling in AI Applications
*Domain: Data & Security · Est. RTI hours: 12 · Code: `lib/pii.ts`, `lib/security/content-validator.ts`*

**Learning objectives.** The apprentice will be able to:
- Identify PII/PHI categories (HIPAA identifiers) in structured and free text.
- Implement obscuring (hash pseudonymization, date generalization, regex redaction).
- Defend the retrieval path against prompt-injection / poisoned documents
  (content validation, sandboxed context).

### Module 11 — Evaluation & Observability
*Domain: Evaluation & Observability · Est. RTI hours: 14 · Code: `lib/evals/`, `lib/langsmith.ts`*

**Learning objectives.** The apprentice will be able to:
- Build an evaluation harness with retrieval metrics and an LLM-as-judge.
- Instrument the app with tracing/observability (e.g., LangSmith).
- Interpret eval results to drive iteration on prompts/retrieval.

### Module 12 — Model Hosting / Inference Access & Deployment
*Domain: Deployment · Est. RTI hours: 14 · Code: `.env.example`, deployment config*

**Learning objectives.** The apprentice will be able to:
- Configure hosted model inference access (e.g., a hosted API or AWS Bedrock).
- Manage environment configuration and secrets across environments.
- Deploy the application to a runnable hosted environment and verify health.

## Hours summary

| # | Module | Domain | RTI hrs |
|---|--------|--------|---------|
| 1 | LLM Fundamentals & Prompting | Foundations | 12 |
| 2 | Data Sourcing & Preparation | Retrieval | 12 |
| 3 | Relational Data & SQL Setup | Data & Security | 12 |
| 4 | RAG Ingestion (chunk/embed/upsert) | Retrieval | 16 |
| 5 | Retrieval & Hybrid Search | Retrieval | 14 |
| 6 | Chat Interface & App Routes | Application | 12 |
| 7 | MCP Server Design | Agents & Tooling | 14 |
| 8 | SQL Agent Design | Agents & Tooling | 12 |
| 9 | RBAC | Data & Security | 12 |
| 10 | PII Handling | Data & Security | 12 |
| 11 | Evaluation & Observability | Eval & Observability | 14 |
| 12 | Model Hosting & Deployment | Deployment | 14 |
| | **Total** | | **156** |

Total RTI = **156 hrs/yr**, which **meets** the ~144 hr/yr minimum. Detailed
accounting and the threshold check live in `hours-ledger.md`.

## Open Items

- [ ] **RTI hours target for the registered term.** Per-module hours above are
      estimates; confirm the official target with NextGen/DAS so the ledger has a
      real threshold (≥144/yr assumed).
- [ ] Confirm whether NextGen provides a **boilerplate RTI template** these
      entries must conform to.
