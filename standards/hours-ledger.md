# RTI Hours Ledger

Running total of Related Technical Instruction (RTI) hours. The registered
program must show **≥ ~144 RTI hours per year**. Recompute this whenever a
module's hours change in `rti-outline.md`.

## Threshold

| Item | Value |
|------|-------|
| Minimum RTI (benchmark) | **144 hrs/yr** |
| Confirmed target (NextGen/DAS) | *Pending — see Open Items* |
| Program term assumption | 12 months (competency-based minimum) |

## Ledger

| # | Module | RTI hrs | Running total |
|---|--------|--------:|--------------:|
| 1 | LLM Fundamentals & Prompting | 12 | 12 |
| 2 | Data Sourcing & Preparation | 12 | 24 |
| 3 | Relational Data & SQL Setup (Neon) | 12 | 36 |
| 4 | RAG Ingestion (chunk/embed/upsert) | 16 | 52 |
| 5 | Retrieval & Hybrid Search | 14 | 66 |
| 6 | Chat Interface & App Routes | 12 | 78 |
| 7 | MCP Server Design | 14 | 92 |
| 8 | SQL Agent Design | 12 | 104 |
| 9 | Role-Based Access Control (RBAC) | 12 | 116 |
| 10 | PII Handling | 12 | 128 |
| 11 | Evaluation & Observability | 14 | 142 |
| 12 | Model Hosting & Deployment | 14 | **156** |

## Result

| Metric | Value |
|--------|-------|
| **Total RTI hours/yr** | **156** |
| Minimum required | 144 |
| Margin over minimum | +12 |
| **Status** | ✅ **MEETS** the ≥144 hr/yr benchmark |

> **No flag raised.** Total RTI (156) ≥ 144. If a future edit drops the total
> below 144, raise it in the PR description per the agent checklist.

## Hours basis & honesty note

These are **RTI estimates for the registered program term**, not the pilot's
delivered contact hours. The current 6-week instructor-led pilot
(`docs/CURRICULUM-PLAN.md`) delivers roughly **12 contact hours** (6 × 2-hour
sessions). The figures above scale each pilot topic to apprenticeship depth
(lecture + guided lab + assessment) to reach a registrable RTI volume. They are
planning estimates and **must be validated** against the confirmed RTI target
and the registering agency's hour-counting rules before finalizing.

## Open Items

- [ ] **Confirm the official RTI hours target** for the registered term with
      NextGen/DAS so this ledger checks against a real threshold (≥144 assumed).
- [ ] Confirm how the agency **counts RTI hours** (lecture only vs. lecture +
      supervised lab) — this may change per-module figures.
- [ ] Confirm **term length** (≥12 months if competency-based); if the term is
      multi-year, restate the 144/yr check per program year.
