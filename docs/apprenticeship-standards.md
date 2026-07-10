# Registered Apprenticeship Standards: Build Guide & Agent Instructions

> This file tells a human what the RAP standards are, and tells the agent what to
> produce and keep in sync while building the curriculum. The generated artifacts
> live in [`/standards`](../standards/).

## Why this file exists

The Parsity AI Engineering curriculum is being formalized into a DOL **Registered
Apprenticeship Program (RAP)** under the National Apprenticeship Act grant (FAIN
24A60AP000081, administered by NextGen Policy). The deliverable is not just a course.
It is a curriculum that maps cleanly onto an approvable **Standards of Apprenticeship**
package.

The goal of this doc: as the curriculum changes, the standards artifacts change with it,
on the same branch, in the same PR. No end-of-grant scramble to reverse-engineer
paperwork from a finished course.

-----

## Background: what a "Standards" package actually is

The Standards of Apprenticeship is the formal document set a registration agency approves.
Core components:

|Component                        |What it is                                                                                   |Where it comes from in our work                                             |
|---------------------------------|---------------------------------------------------------------------------------------------|----------------------------------------------------------------------------|
|**Occupation**                   |One apprenticeable occupation + O*NET-SOC code                                               |Pick from DOL list (software developer family). One-time decision.          |
|**RTI Outline**                  |The classroom half: list of courses/modules apprentices complete                             |Our curriculum module sequence, with instructional hours                    |
|**Work Process Schedule (WPS)**  |The on-the-job half: competencies the apprentice demonstrates at work                        |Our hands-on project capabilities, phrased as observable "can do" statements|
|**Competency map**               |Competencies + how each is tested/evaluated                                                  |Our project deliverables + grading rubrics                                  |
|**Wage scale**                   |Progressive wage increases tied to skill gain                                                |Employer-set. Placeholder only on our side.                                 |
|**Ratio / probation / selection**|Governance: journeyworker-to-apprentice ratio, probation period, how apprentices are selected|Employer-facing. Placeholder only.                                          |
|**Approach**                     |Time-based, competency-based, or hybrid                                                      |Recommended: competency-based or hybrid                                     |

### Benchmarks to hold the curriculum against

- **RTI minimum:** ~144 hours of related technical instruction per year.
- **Competency-based programs:** must run at least 12 months.
- **WPS must state both** the competencies AND the means of testing/evaluating them.

### Who approves it

- California runs its own state agency: the **Division of Apprenticeship Standards (DAS)**,
  under the Dept. of Industrial Relations. New programs (including IT) are registered through DAS.
- DAS consultants help new sponsors develop programs. Info sessions: `DAS_InfoSessions@dir.ca.gov`.
- Because this is grant-funded, confirm the registration pathway and any technical-assistance
  contact with **NextGen first**. Treat occupation code, approach, and term length as
  "confirm before finalizing" items (see Open Items at the bottom).

-----

## Repo structure the agent should create and maintain

Create and keep a `/standards` directory in sync with the curriculum:

```
/standards
  occupation.md            # occupation + O*NET-SOC code, justification
  rti-outline.md           # module list, learning objectives, instructional hours
  work-process-schedule.md # OJL competencies, grouped by domain
  competency-map.md        # competency -> assessment method -> rubric reference
  assessment-rubrics.md    # graded rubrics per competency
  wage-and-governance.md   # wage scale, ratio, probation, selection (placeholders)
  crosswalk.md             # module <-> RTI <-> competency <-> rubric (nothing orphaned)
  hours-ledger.md          # running total of RTI instructional hours (must show >=144/yr)
```

-----

## Mapping rules (curriculum -> standards)

Apply these every time curriculum content is added or changed:

1. **Each curriculum module -> one RTI entry** in `rti-outline.md`, with: module name,
   written learning objectives, and estimated instructional hours.
2. **Each hands-on capability/deliverable -> one WPS competency** in
   `work-process-schedule.md`, written as an observable statement (see conventions below).
3. **Each competency -> one assessment method + rubric** in `competency-map.md` and
   `assessment-rubrics.md`. A competency with no rubric is incomplete.
4. **Update `crosswalk.md`** so every module ties to its RTI entry, competencies, and rubrics.
   Flag any orphans (a module with no competency, a competency with no rubric, etc.).
5. **Recompute `hours-ledger.md`.** If total RTI < 144 hrs/yr, flag it in the PR.
6. **Keep wage/governance untouched** unless explicitly instructed. Those are set with the
   employer, not derived from curriculum.

-----

## Competency authoring conventions (for the WPS)

Write competencies so a registration agency and a mentor can both assess them:

- **Observable, demonstrable, assessable.** Avoid "understands X." Use "builds X," "deploys X,"
  "evaluates X against Y."
- **Pattern:** `The apprentice can [action verb] [artifact] [to standard / under condition].`
  - Example: "The apprentice can build an ingestion pipeline that chunks, embeds, and upserts
    a document corpus into a vector database and verifies retrieval quality."
- **Group by domain** so the WPS reads as a coherent skill progression:
  - Foundations (LLM fundamentals, prompting, eval basics)
  - Retrieval (data sourcing, chunking, embeddings, vector DB, retrieval, hybrid search)
  - Application layer (chat interface, API routes, app integration)
  - Agents & tooling (MCP server, SQL agent, tool/function calling)
  - Data & security (SQL/relational data, RBAC, PII handling)
  - Evaluation & observability (eval harnesses, tracing/observability)
  - Deployment (model hosting / inference access, environment setup)

-----

## Seed content (from the current build)

Use this as the starting RTI/competency set. Keep it current as modules evolve.

**RTI modules (classroom):**

1. LLM fundamentals and prompting
2. Data sourcing & preparation (Hugging Face medical corpus)
3. Relational data & SQL database setup (Neon)
4. RAG ingestion: chunking, embeddings, vector upload (Pinecone)
5. Retrieval & hybrid search
6. Chat interface & application routes
7. MCP server design and implementation
8. SQL agent design
9. Role-based access control (RBAC)
10. PII handling in AI applications
11. Evaluation & observability (e.g. LangSmith)
12. Model hosting / inference access (e.g. AWS Bedrock) and deployment

**Example WPS competencies (on-the-job, observable):**

- Sources and prepares a domain document corpus suitable for retrieval.
- Provisions and configures a vector database and relational database for an AI app.
- Builds an ingestion pipeline (chunk, embed, upsert) with verified retrieval.
- Implements hybrid search and measures retrieval quality.
- Builds a working chat interface backed by a RAG pipeline.
- Designs and ships an MCP server exposing defined tools.
- Builds a SQL agent that translates natural language to safe, scoped queries.
- Implements RBAC and PII-handling controls in a production-style web app.
- Stands up evaluation and observability for an AI system.
- Configures hosted model inference access for end users.

-----

## Agent task checklist (run on a branch)

When asked to update the curriculum or standards, do this and open a PR:

- [ ] Update `rti-outline.md` for any new/changed module (objectives + hours).
- [ ] Derive/refresh competencies in `work-process-schedule.md`.
- [ ] Ensure every competency has an assessment method (`competency-map.md`) and a rubric
  (`assessment-rubrics.md`).
- [ ] Update `crosswalk.md`; report any orphaned modules/competencies/rubrics.
- [ ] Recompute `hours-ledger.md`; flag if total RTI < 144 hrs/yr.
- [ ] Leave `wage-and-governance.md` as placeholders unless told otherwise.
- [ ] In the PR description, list what changed and any Open Items that now need a NextGen/DAS answer.

-----

## Guardrails

- This work is **curriculum and standards building**, which is in scope for the grant.
  It is **not program delivery** (teaching cohorts, running the trial class, day-to-day ops),
  which is out of scope for grant funds. Keep the artifacts on the build side.
- Wage scale, journeyworker ratio, and selection procedures are employer decisions. Use clearly
  labeled placeholders; do not invent binding values.

-----

## Open items to confirm (do not finalize without answers)

- [ ] **Occupation + O*NET-SOC code** to register under (software developer family vs. a specific code).
- [ ] **Registration pathway:** California DAS, federal DOL Office of Apprenticeship, or DAS with
  grant technical assistance via NextGen.
- [ ] **Approach:** competency-based vs. hybrid, and the program term length (>=12 months if competency-based).
- [ ] **RTI hours target** for the registered term, so `hours-ledger.md` has a real threshold to hit.
- [ ] Whether NextGen provides a boilerplate Standards template you should conform these artifacts to.
