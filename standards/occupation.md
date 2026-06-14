# Occupation

The single apprenticeable occupation this program registers under.

## Recommended occupation

| Field | Value |
|-------|-------|
| **Occupation title** | Software Developer |
| **O*NET-SOC code** | **15-1252.00 — Software Developers** |
| **Occupational family** | Software developer family (DOL apprenticeable occupations list) |
| **RAPIDS / state occupation code** | *To confirm with NextGen / California DAS* |
| **Type of program (approach)** | Hybrid (competency-based with a related-instruction hours floor) — *confirm; see Open Items* |

## Justification

The curriculum trains an apprentice to design, build, secure, evaluate, and
deploy an applied AI / Retrieval-Augmented Generation (RAG) system end to end.
The work spans data modeling, backend services, API design, third-party
service integration, security controls, and deployment — all core duties of a
**Software Developer (15-1252.00)**. O*NET describes this occupation as
developing, creating, and modifying applications software, analyzing user needs,
and designing software solutions, which maps directly to the project deliverables
in this repository (a Next.js application backed by PostgreSQL and a vector
database, an MCP tool server, a SQL agent, and security/evaluation layers).

### Why this occupation rather than a narrower one

- The skill set is **AI-application engineering**, which DOL has not yet broken
  out as its own standalone apprenticeable occupation in widespread use. The
  Software Developer occupation is the closest recognized, registrable home and
  is already approved for apprenticeship in the software developer family.
- A narrower or emerging title (e.g., "AI/ML Engineer", "Machine Learning
  Engineer", O*NET 15-2051.01 *Business Intelligence Analysts* or 15-1221.00
  *Computer and Information Research Scientists*) may exist, but each carries
  registration-pathway and crosswalk risk. We default to the well-supported
  Software Developer code and flag the alternative for NextGen/DAS review.

### Mapping evidence (occupation duties → curriculum)

| Software Developer duty (O*NET 15-1252.00) | Where it appears in the build |
|--------------------------------------------|-------------------------------|
| Analyze user needs and design software solutions | Query analysis / agent design (Module 1, 8) |
| Develop and direct software system validation/testing | Evaluation & observability (Module 11) |
| Modify existing software to correct errors / improve performance | Hybrid search tuning, reranking (Module 5) |
| Store, retrieve, and manipulate data for analysis | Relational + vector data layers (Modules 3–5) |
| Consult on security / integrity of systems | RBAC, PII handling, content validation (Modules 9–10) |
| Design and deploy software for distributed use | Deployment / hosted inference (Module 12) |

## Open Items (confirm before finalizing — do not finalize without answers)

- [ ] **Exact occupation + code to register under.** Confirm Software Developer
      (O*NET-SOC 15-1252.00) vs. a more specific/emerging AI engineering code,
      and obtain the matching RAPIDS or California DAS occupation code.
- [ ] **Registration pathway** (affects which occupation list governs): California
      DAS, federal DOL Office of Apprenticeship, or DAS with NextGen technical
      assistance.
- [ ] **Approach** (time-based / competency-based / hybrid) and **term length**
      (≥12 months if competency-based). See `wage-and-governance.md` and
      `hours-ledger.md`.
