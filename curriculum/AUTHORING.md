# Curriculum Authoring Tracker

Working doc for building the day-by-day curriculum in batches. **Update the status table every batch.** The template and rules here are the spec — every day file must follow them so the course reads in one voice.

## ▶ Pick up here (updated 2026-06-09, batch 6 done)

**Next: Batch 7 (FINAL) — Days 31–36, production gates & capstone.** Days: 31 the upload API (rebuild `/api/upload` on the new pipeline — `docs/CHALLENGE-UPLOAD-API.md` is the spec per rule 11; additive + idempotent; zod `.parse()` validation per CLAUDE.md), 32 RBAC I (sessions/login/auth guard — `docs/CHALLENGE-RBAC.md` + the 24 failing specs ARE the assignment; lib/auth.ts stubs; jose JWT, httpOnly cookie, anti-enumeration 401s), 33 RBAC II (role-shaped responses: STAFF never see PII even via header/body override, DOCTOR can't schedule; `lib/pii.ts` is complete on student — the obscuring layer finally gets its consumer), 34 adversarial day: the poisoned document (`docs/CHALLENGE-POISONED-DOCS.md` + `data/security/poisoned/` exist on main/instructor — CHECK student-branch presence, likely needs sync; pays off Day 23's "sneakier entrance" promise: injection via retrieved CONTENT; `lib/security/content-validator.ts` + 49 tests), 35 evals as the spine (regression suite assembled from ALL prior instruments: fhir-extract tests, retrieval hit@5, analyzer accuracy, failure battery, RBAC specs; `npm run test:evals` for LLM-judge; cost observability), 36 capstone (🎥): ship one extension + THE POSTMORTEM (the credibility artifact — what broke, what changed, what I deliberately didn't build; adversarial review questions from the challenge-design philosophy).

Before writing Batch 7:
1. Re-read `day-01.md` (voice) and ALL 17 rules.
2. Verify student-branch state of: `app/api/upload/route.ts` (old chunking version = the homework target), the 24 failing RBAC specs (lib/auth.test.ts etc.), `lib/pii.ts` (complete) vs `challenge/pii-obscuring` branch (skeleton — which do students get?), `data/security/poisoned/` + `lib/security/content-validator.ts` presence on student, `lib/evals/` (skeleton: llm-judge TODOs).
3. Day 36's deliverable should reference the full test-suite progress bar from Day 2 (24 failed → 0 on student after RBAC days) — verify the final expected counts.
4. After the batch: update status table, final review, then the BIG SYNC (see sync reminder) before any student touches the course.

**Sync reminder (grows as batches land):** the following live on `instructor`/`main` only and MUST reach `student` before the corresponding days ship:
- `scripts/bible/` + three `bible:*` npm scripts + `data/bible/` gitignore entry → before Day 7 (lab infrastructure; do NOT ship Day 12's `chunk-constitution.ts` — students write it)
- `mcp-server/auth.ts`, `mcp-server/auth.test.ts`, `mcp-server/audit.ts` → before Day 27 (student branch's mcp-server/ currently has ONLY index.ts; the challenge doc says "the auth module is provided" — discovered 2026-06-09, batch 6)

Done so far: README (rev 2), day-01 (rev 3), days 02–06 (Batch 2), days 07–12 + scripts/bible lab (Batch 3), this tracker.

**Where this lives:** the `instructor` branch ONLY — the repo is cold storage; day files get copy/pasted into the delivery platform. Do NOT sync `curriculum/` to `main` or `student` (students must not see it in the repo). Author future batches directly on `instructor`.

## Status

| Day | Title | Status | Batch |
|---|---|---|---|
| — | README (overview, calendar, cadence) | ✅ written (rev 2: weekly deliverables, no week labels, no durations) | 1 |
| 1 | What RAG actually is | ✅ written (rev 2) — **the exemplar, read it before writing any day** | 1 |
| 2 | Setup: accounts, keys, running app | ✅ written | 2 |
| 3 | Meet the data: FHIR + 1,278 patients | ✅ written | 2 |
| 4 | Postgres + Prisma | ✅ written | 2 |
| 5 | The SQL half of hybrid RAG | ✅ written | 2 |
| 6 | Build day: first end-to-end feature (🎥) | ✅ written | 2 |
| 7 | Why chunking exists (and why our notes don't need it) | ✅ written | 3 |
| 8 | Bible lab I: naive chunking breaks | ✅ written | 3 |
| 9 | Bible lab II: boundaries + overlap | ✅ written | 3 |
| 10 | Metadata: the part everyone skips | ✅ written | 3 |
| 11 | Five chunking failure modes, measured | ✅ written | 3 |
| 12 | Your turn: chunk the Constitution (🎥) | ✅ written | 3 |
| 13 | Embeddings: meaning as geometry | ✅ written | 4 |
| 14 | Pinecone: first vector index (Bible chunks as test cargo) | ✅ written | 4 |
| 15 | Semantic search over clinical notes | ✅ written | 4 |
| 16 | Hybrid queries: SQL meets vectors | ✅ written | 4 |
| 17 | When cosine lies: reranking | ✅ written | 4 |
| 18 | Build day: retrieval eval set (🎥) | ✅ written | 4 |
| 19 | Structured outputs (zod + Responses API) | ✅ written | 5 |
| 20 | The query analyzer | ✅ written | 5 |
| 21 | Orchestration: three paths (reading day) | ✅ written | 5 |
| 22 | The chat agent: grounding contract | ✅ written | 5 |
| 23 | Failure day: six bait categories incl. prompt injection | ✅ written | 5 |
| 24 | Build day: analyzer eval (🎥) | ✅ written | 5 |
| 25 | MCP: tools for AI assistants (3 TODO bodies + pipe smoke-test) | ✅ written | 6 |
| 26 | Wiring into Claude Desktop/Cursor (config, logs, break-fix) | ✅ written | 6 |
| 27 | Securing MCP: keys + scopes (wrapper for CHALLENGE-MCP-AUTH) | ✅ written | 6 |
| 28 | Observability: implement traced(), debugger-for-the-past | ✅ written | 6 |
| 29 | HITL scheduling: propose/approve/execute, Cal.com | ✅ written | 6 |
| 30 | Build day: 4th tool + audit trail + adversarial demo (🎥) | ✅ written | 6 |
| 31 | Upload API: additive ingestion | ⬜ todo | 7 |
| 32 | RBAC I: sessions + login | ⬜ todo | 7 |
| 33 | RBAC II: role-shaped responses + PII | ⬜ todo | 7 |
| 34 | Adversarial day: poisoned document | ⬜ todo | 7 |
| 35 | Evals as the spine | ⬜ todo | 7 |
| 36 | Capstone + postmortem | ⬜ todo | 7 |

**Batch plan:** one week per batch (Batch 2 = Week 1 remainder, Batch 3 = Week 2 chunking, … Batch 7 = Week 6). Review + commit after each batch.

## Screenshot registry

Ownership: **agent** captures localhost UIs (the app, Prisma Studio when schema+data align, MCP Inspector, etc.) by running the service and driving the gstack `browse` binary (`~/.claude/skills/gstack/browse/dist/browse` → `goto` + `screenshot <abs path>`). **brian** captures authenticated dashboards (Neon, Pinecone, OpenAI, LangSmith) and desktop apps (Claude Desktop, Cursor). **class-ingest** = capture during the live class data load (needs the new-schema DB populated).

Gotcha learned 2026-06-09: the medical-rag dev server may land on **:3001** if another project holds :3000 — check `npm run dev` output for the actual port before screenshotting.

| File | Day | Owner | Status |
|---|---|---|---|
| day02-app-running.png | 2 | agent | ✅ captured |
| day02-neon-connection.png | 2 | brian | ⬜ pending (logged-in Neon dashboard) |
| day04-prisma-studio.png | 4 | class-ingest | ⬜ pending (needs new schema + data) |
| day14-pinecone-index.png | 14 | brian | ⬜ pending (Pinecone console: medical-notes index, 1536/cosine) |
| day26-claude-desktop-tools.png | 26 | brian | ⬜ pending (Claude Desktop, medical-rag server connected, tools visible) |
| day28-langsmith-trace.png | 28 | brian | ⬜ pending (LangSmith project, one execute_query trace open) |

Add a row here whenever a day file gets a screenshot placeholder.

## Day template

```markdown
# Day N — Title

**Needs: <keys/accounts required today, or "nothing">**

## Today you will
- 2–4 bullets; a CLEAR finish line

## Concept
Prose, at most one mermaid diagram, screenshot placeholders where UI is involved.
"Why this approach / what we rejected" table or callout — ONLY when a real alternative exists.

## Implementation
Guided build steps against the repo. Real commands, real file paths.

### Common mistakes
- 2–4 bullets, from the failure modes we actually know

## Your turn
The unaided exercise. May open with "Spend no more than X minutes here."

## Check yourself
- Test command / expected output / questions answerable without scrolling up

<details>
<summary>Solution / discussion</summary>
Full worked solution. Never inline-visible.
</details>

## Further reading (optional)
- 1–3 VERIFIED links only (see link registry below)
```

**Deliverable-day addition (Days 6, 12, 18, 24, 30, 36 ONLY)** — insert before Further reading:

```markdown
## Deliverable 🎥
2–3 min video: teach back / defend a decision / walk through what you built this block.
**Submit:** [Typeform — submission](https://form.typeform.com/to/PLACEHOLDER-DAYNN) <!-- PLACEHOLDER: replace with real Typeform URL -->
```

## Authoring rules

1. **Read `day-01.md` first** — match its voice: direct, concrete, lightly wry, zero filler. Short paragraphs.
2. **Concept → Implementation → Your turn.** Never skip Your Turn; never make it a repeat of Implementation.
3. **Common mistakes are mandatory**; alternatives ("why this not that") only when genuinely viable — never option-overload.
4. **Solutions always in `<details>`** blocks.
5. **Mermaid** for diagrams (` ```mermaid ` fences — renders on GitHub). Max 1–2 per day. Keep diagrams under ~10 nodes.
6. **Screenshots:** `![Screenshot: <what it shows>](assets/dayNN-<slug>.png)` followed by `<!-- TODO: capture screenshot -->`. Use only where a UI is involved (dashboards, Claude Desktop, Prisma Studio, the app).
7. **Deliverables are weekly, not daily.** The 🎥 video + Typeform section appears ONLY on Days 6, 12, 18, 24, 30, 36. Placeholder URL: `https://form.typeform.com/to/PLACEHOLDER-DAYNN` with the replace-me comment.
8. **Every command and file path must be real** — verify against the repo before writing. No invented npm scripts, no invented exports.
9. **Code style:** zod `.parse()` (never `safeParse`, never `typeof` checks), OpenAI Responses API + `zodTextFormat`, `type` aliases over `interface` (see CLAUDE.md). Curriculum code must model repo conventions.
10. **Rest days:** mentioned at the end of each Day 6/12/18/24/30 file ("tomorrow is a rest day"), not separate files.
11. Days that correspond to existing challenge docs (27→MCP-AUTH, 31→UPLOAD-API, 32–33→RBAC/PII, 34→POISONED-DOCS) should **link to and build on** those docs, not duplicate them. The failing test specs are the assignment; the day file is the narrative wrapper.
12. **No time estimates** — never "~60 min" or per-section budgets. The ONLY permitted time mention is a cap: "spend no more than X minutes" (use in Your Turn or before solutions).
13. **No week numbers anywhere in day files** — the schedule may change. No "Week 2", no "on Day 16". Forward references are vague: "later in the course", "when we build the search layer". Day files don't link to the next day ("Next →" footers are banned); navigation lives in the README only.
14. **No concepts before they're taught.** Maintain the unlock order: embeddings/vectors are NOT mentioned before Day 13 (say "meaning-based search" or "a search that understands meaning"); chunking specifics not before Day 7; MCP not before Day 25. When in doubt, check what an attentive student would know on that morning.
15. **Examples use household-name medicine only** — aspirin, ibuprofen, insulin, antibiotics, "blood pressure medication", diabetes, high blood pressure. NOT clinician-common drugs (metformin, lisinopril, amlodipine — those read as jargon to non-medical students). Generic patients ("this patient"), never dataset names. Questions answerable from general knowledge plus the day's content.
16. **Rule 14 applies to ML concepts too** — no fine-tuning, no tokenization internals, no "context window" mechanics beyond plain meaning, until/unless a day actually teaches them. Day 1 mentions zero ML vocabulary beyond "LLM" and "prompt".
17. **Backward references are fine, forward ones are vague.** "You saw on Day 1" / "the mapping from earlier" reinforces continuity — allowed. Forward references stay vague ("later", "when we build the search layer") and never cite a future day number. "The vector database" is allowed as the NAME of the Pinecone service (established Day 2) — that's naming a tool, not explaining embeddings; don't *explain* vectors/embeddings before Day 13.

## Repo facts sheet (do not hallucinate — check here first)

- Students work on the **`student`** branch. Expected test state there: `npm run test:run` → **24 failed / 56 passed** (the 24 are RBAC homework specs).
- npm scripts: `dev`, `test`, `test:run`, `test:evals`, `db:generate`, `db:push`, `db:studio`, `db:migrate`, `ingest`
- Ingest: `npm run ingest -- data/subset` or `-- --limit 20` / `--skip-vectors`; full dataset needs `npx prisma db push --force-reset` first
- Data: `data/coherent/fhir/` — 1,278 Synthea Coherent bundles, ~144k DocumentReference notes (one per encounter, avg ~450 chars, base64 in `content[0].attachment.data`), 823 patients have `deceasedDateTime`, all have `telecom` phone
- Key files: `lib/fhir-extract.ts` (+23 tests), `scripts/ingest-coherent.ts`, `prisma/schema.prisma` (FHIR id = PK; Patient has phone/deathDate/race/ethnicity; User+Role enum DOCTOR|STAFF), `lib/sql-queries.ts` (pre-built), `lib/query-analyzer.ts` (Week 4 skeleton), `lib/query-executor.ts`, `lib/vector-search.ts` (student: 1 TODO), `lib/pinecone.ts`, `lib/agent.ts`/`lib/calendar.ts`/`lib/scheduling.ts`/`lib/langsmith.ts` (student skeletons), `mcp-server/` (student skeleton; `auth.ts` complete + 43 tests), `lib/pii.ts` (complete; challenge variant on `challenge/pii-obscuring`), `lib/security/content-validator.ts`
- Roles: STAFF = schedule appointments, never see PII (server-enforced); DOCTOR = sees PII, cannot schedule
- Pinecone metadata contract (read by `lib/vector-search.ts`): `content`, `patientId`, `patientName`, `type`, `date` (YYYY-MM-DD)
- One note = one vector — the medical corpus is NOT chunked (notes avg ~450 chars). The Bible lab exists to teach chunking on a corpus that needs it.
- Bible corpus: Project Gutenberg KJV plain text — verses formatted `1:1 In the beginning...` (chapter:verse prefix per verse; books as headers). Lab scripts live in `scripts/bible/` (created in Batch 3).

## Verified link registry (checked 2026-06-06)

| Link | Use on |
|---|---|
| https://www.gutenberg.org/cache/epub/10/pg10.txt — KJV plain text | Days 7–11 |
| https://www.gutenberg.org/cache/epub/5/pg5.txt — US Constitution plain text (verified 2026-06-09) | Day 12 |
| https://developers.openai.com/api/docs/guides/embeddings — OpenAI embeddings guide (301 from platform.openai.com; verified 2026-06-09) | Day 13 |
| https://www.pinecone.io/learn/vector-database/ (verified 2026-06-09) | Day 14 |
| https://docs.pinecone.io/guides/index-data/indexing-overview#metadata — metadata filtering (verified 2026-06-09) | Days 15–16 |
| https://docs.cohere.com/docs/rerank-overview (verified 2026-06-09) | Day 17 |
| https://www.pinecone.io/learn/offline-evaluation/ — Recall@K/MRR/nDCG (verified 2026-06-09) | Day 18 |
| https://developers.openai.com/api/docs/guides/structured-outputs (verified 2026-06-09) | Days 19–20 |
| https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/overview (301 from docs.anthropic.com; verified 2026-06-09) | Day 22 |
| https://genai.owasp.org/llmrisk/llm01-prompt-injection/ — OWASP LLM01 (verified 2026-06-09) | Day 23 |
| https://hamel.dev/blog/posts/evals/ — Hamel Husain on evals (verified 2026-06-09) | Day 24 |
| https://modelcontextprotocol.io/docs/develop/connect-local-servers (verified 2026-06-09; log paths + config format confirmed against it) | Day 26 |
| https://modelcontextprotocol.io/specification/draft/basic/security_best_practices (verified 2026-06-09) | Days 27, 30 |
| https://docs.langchain.com/langsmith/observability (308 from docs.smith.langchain.com; verified 2026-06-09) | Day 28 |
| https://cal.com/docs/api-reference (verified 2026-06-09) | Day 29 |
| https://www.pinecone.io/learn/chunking-strategies/ | Days 7, 9 |
| https://www.anthropic.com/news/contextual-retrieval | Days 1, 10, 17 |
| https://modelcontextprotocol.io/ | Days 25–27 |
| https://arxiv.org/abs/2005.11401 — RAG paper | Day 1 |

Verify any NEW link with WebFetch before adding it to a day file, then record it here.

## Decisions log

- 2026-06-06 · Brian's day-1 review corrections, now rules 7, 12–15: no time estimates except caps; no week numbers or next-day links in day files; deliverable videos weekly (block-end days only), not daily; examples use common meds + generic patients; never mention untaught concepts (no "embeddings" before Day 13).
- 2026-06-06 · 36 working days (6 blocks × 6) + rest day after every 6th. Rest days are notes, not files.
- 2026-06-06 · Text-based markdown, GitHub-rendered mermaid, screenshot placeholders for later capture.
- 2026-06-07 · Moved to the `instructor` branch (was a standalone `curriculum` branch, now deleted). Repo is storage only — content ships via another platform; students never see `curriculum/` in the repo.
- 2026-06-06 · Chunking taught on the KJV Bible (corpus that needs it) precisely because the medical notes don't — the contrast IS the lesson (decide from data, not habit).
