# Curriculum Authoring Tracker

Working doc for building the day-by-day curriculum in batches. **Update the status table every batch.** The template and rules here are the spec — every day file must follow them so the course reads in one voice.

## ▶▶ RESTRUCTURE IN PROGRESS (2026-07-05, rev 2) — read this first

Big re-scope (Brian). **Core framing:** you're joining a company that *already has* its data in a database. The job = make it **semantically searchable** and build an **agent** on top. So the SQL/structured side is a **GIVEN — not taught, not uploaded live.** Front-load the working system; compress to **5 weeks**. README "Week index" is the canonical map; day files + decks are being reconciled.

**Logistics decision — pre-loaded DB:** the Neon Postgres is PRE-LOADED (all patients/conditions/obs/meds/encounters/**note text** — done, 1278 patients / 143,946 notes in Neon) and students **copy it** (a dump / Neon branch) rather than running the ingest live. Removes all DB-setup time; Day 1 goes straight to the vector store.

**Architecture (unchanged, validated):** Postgres = system of record (holds everything incl. note text — `Note` table done + populated). Pinecone = derived semantic index. The **vectorize script** reads notes from Postgres → embeds → upserts to Pinecone. Frame plainly: *"this is how you make existing company data searchable by meaning."* **NO drift/reconciliation exercise** (that was over-engineered — dropped).

**New 5-week shape:**
1. **The vector store** — problem statement (why a second DB for meaning-based search; SQL/`LIKE` matches letters not meaning — "dyspnea" ≠ "shortness of breath") → what a vector is + semantic similarity → the **vectorize script** (Postgres → Pinecone) → **implement vector search** (live, ideally day 1) → **chunking intro**: our notes are self-contained pieces (no chunking needed); the Bible is the opposite (needs it) — the contrast IS the point. DB pre-loaded.
2. **Agentic / hybrid search** — the agent that routes and does BOTH SQL and vector search.
3. **MCP + human-in-the-loop.**
4. **Agents + evals + observability.**
5. **Privacy & data** — PII, RBAC, access control.

**Homework — Bible chunking as a 2-week side project (📝):**
- Week 1: research chunking strategies, propose one, record a video explaining what chunking IS.
- Week 2: actually chunk + upload. Uses `scripts/bible/`. Purely a side project for learning chunking (our medical notes don't need it).

**Dropped from live weeks:** live SQL teaching (pre-loaded given); the standalone chunking week (→ side-project homework); poisoned-docs (→ optional homework, `CHALLENGE-POISONED-DOCS.md` exists); the standalone upload-API day (the vectorize script + pre-load cover ingestion). The old "no embeddings before Day 13" rule (14) is moot — vectors are the Week 1 subject now.

**Week 1 must TEACH vector similarity (not black-box it).** Brian: students should *understand* how similarity works, not just call it. W1 includes hands-on similarity — cosine / dot product, "same direction = same meaning" — reusing material already written: `day-00.md` (vector-math primer), `day-13.md` (embeddings/cosine), `day-14.md` "be the vector DB by hand" (embed a tiny corpus → cosine → rank). So W1 = problem → **what a vector is + how similarity works (hands-on)** → vectorize script → vector search → chunking intro. Supersedes the earlier "black box in W1" idea — vectors ARE the W1 subject now.

**Data model (confirmed):** one patient → MANY notes (avg 112.6; range 2–2,162; `Patient.notes = Note[]`). Vectorize emits one vector per note, tagged `patientId` so search can filter to a patient.

**Execution phases:**
1. ✅ Spine: README + this tracker (rev 2). (2026-07-05)
2. ✅ Foundation: `Note` table (Postgres = system of record); Neon populated (1278/143,946). Shipped all branches.
3. ✅ **Vectorize script** (`scripts/vectorize.ts` + `npm run vectorize`): read notes from Postgres → `upsertChunks` (embed + upsert) with metadata. Instructor solution (verified live, --limit 5) / main solution / student STUB. Shipped (fcd6f7b / 10ed3ed / 7b7388d).
4. ⬜ Week 1 deck/runbook + day files (the big new content): problem → **vectors + similarity (hands-on)** → vectorize → vector search → chunking intro. Bible = homework part 1.
5. ⬜ Week 2 (agentic/hybrid search) + Bible homework part 2.
6. ⬜ Weeks 3–5 relabel/remap (MCP+HITL / agents+evals+obs / privacy).
7. ⬜ Day-file renumbering + INSTRUCTOR-NOTES + deck kickers reconciled to the 5-week map.

**Student-branch reconciliation plan (do alongside the phases):** `student` = skeletons + failing specs; it must track the restructure.
- ✅ `scripts/vectorize.ts` = STUB on student (Week 1 build-it exercise); solution on instructor/main. (7b7388d)
- ✅ `Note` table + `noteRowFromChunk` = provided infra on student; upload route stays a STUB (still CHALLENGE-UPLOAD-API).
- ⬜ **Pre-loaded DB:** students do NOT run the FHIR ingest — they connect to the pre-loaded Neon DB (read-only role, or a per-student Neon branch). Update student setup/day-02 + `.env.example`: `DATABASE_URL` = the provided DB; no ingest step. `scripts/ingest-coherent.ts` stays only as reference (students don't run it).
- ⬜ **Students still IMPLEMENT (keep as student stubs, just re-map to new week #s):** vectorize (W1, done), `searchClinicalNotes`/vector-search (W1), query analyzer + agent / hybrid search (W2), MCP server (W3), RBAC/PII (W5). Don't rewrite — relabel.
- ⬜ **No student code to delete:** `scripts/bible/` stay (homework); poisoned-docs stays (optional homework). It's mostly re-labeling which week each stub belongs to.
- ⬜ Re-run student suite after remap; expected red = still-unimplemented assignments. (vectorize has no test yet — run-it exercise; add a note→chunk mapping test if we want it graded.)

**Day-file manifest (2026-07-06) — full renumber to 5 weeks.** New files `wN-MM-slug.md` (week-visible); old `day-NN.md` retired after. day-00 (foundations pre-work) kept.
- **W1 vector store:** w1-01 what-rag-is (←day-01) · w1-02 setup/pre-loaded-DB (←day-02) · w1-03 meet-the-data (←day-03) · w1-04 embeddings (←day-13) · w1-05 similarity-by-hand (←day-14) · w1-06 vectorize (NEW, ←vectorize.ts + day-15) · w1-07 semantic-search + metadata (←day-15) · w1-08 chunking-intro (←day-07). HW: homework-bible-chunking (←day-08..12).
- **W2 agentic search:** w2-01 structured-outputs (←19) · w2-02 query-analyzer (←20) · w2-03 orchestration (←21) · w2-04 hybrid-queries (←16) · w2-05 reranking (←17) · w2-06 chat-agent/grounding (←22) · w2-07 failure-day (←23).
- **W3 MCP+HITL:** w3-01 mcp-intro (←25) · w3-02 wiring (←26) · w3-03 securing (←27) · w3-04 human-in-the-loop (←29) · w3-05 new-tool-audit (←30).
- **W4 agents/evals/obs:** w4-01 observability (←28) · w4-02 retrieval-evals (←18) · w4-03 analyzer-evals (←24) · w4-04 evals-as-spine (←35).
- **W5 privacy:** w5-01 rbac-sessions (←32) · w5-02 rbac-pii (←33) · w5-03 wrap-up (←36). HW: homework-poisoned-docs (←34). (Upload API DROPPED — company already has its data; remove route+spec+challenge doc from code too.)
Cross-cutting reframes: SQL is a given (pre-loaded, not taught); Postgres=system of record, Pinecone=derived (vectorize builds it); no "no-embeddings-before-day-13" rule; refer to weeks not day numbers.

Everything below predates the restructure — treat as historical until reconciled.

## ▶ Pick up here (updated 2026-06-13 — ALL 36 DAYS DONE)

**The curriculum is content-complete.** No more day files to write. What remains before students can use it, in priority order:

1. **THE BIG SYNC — ✅ DONE (2026-06-14, student commit c78dda8).** Synced to student: `scripts/bible/`+`bible:*` scripts+`data/bible/` gitignore; `mcp-server/auth.ts`+`auth.test.ts`+`audit.ts`; `lib/security/content-validator.ts`+`.test.ts`; `data/security/poisoned/*.json`; `scripts/security/demo-{poisoned-docs,mcp-auth}.ts`; `docs/CHALLENGE-{POISONED-DOCS,MCP-AUTH}.md`. NOT synced (correct): `mcp-server/index.ts` (student skeleton = the assignment), curriculum/, solution code. Student suite now **24 failed / 148 passed** (the +92 are the two provided modules' tests); Day 2's count updated to match. Left alone: pre-existing student tsc warts in `app/api/upload/route.ts` (Day 31 homework target) and dead `scripts/process-fhir.ts`.
2. **Screenshots** — see registry: 5 brian-owned (Neon, Pinecone, Claude Desktop, LangSmith, Prisma-Studio-at-class-ingest), 1 agent-captured already done (day02-app-running).
3. **Typeform URLs** — 6 deliverable days (6/12/18/24/30/36) have `PLACEHOLDER-DAYNN` links to replace.
4. **PII branch decision:** `lib/pii.ts` is COMPLETE on student, but `challenge/pii-obscuring` has it as a skeleton. Day 33 assumes complete. Decide whether the PII-implementation is its own assignment (then Day 33 needs a dependency note) or pre-built (then it's fine as written). Unresolved — ask Brian.

If Brian wants NEW content: the obvious extensions are a glossary, a "day 0" environment-doctor script, or per-block recap pages. None are written.

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
| 31 | Upload API: additive + idempotent (CHALLENGE-UPLOAD-API) | ✅ written | 7 |
| 32 | RBAC I: sessions/login/guard (CHALLENGE-RBAC P1-3) | ✅ written | 7 |
| 33 | RBAC II: role-shaped responses + PII (CHALLENGE-RBAC P4) | ✅ written | 7 |
| 34 | Adversarial: poisoned document (CHALLENGE-POISONED-DOCS) | ✅ written | 7 |
| 35 | Evals as the spine + cost gate | ✅ written | 7 |
| 36 | Capstone + postmortem (🎥, the credibility artifact) | ✅ written | 7 |

**ALL 36 DAYS WRITTEN (2026-06-13). Course content complete.** The big sync to student is ✅ DONE (2026-06-14, student commit c78dda8 — student suite now 24 failed / 148 passed). Remaining: screenshot capture + Typeform URLs + the PII-branch decision (see Pick up here).

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
| https://docs.stripe.com/api/idempotent_requests (verified 2026-06-13) | Day 31 |
| https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html (verified 2026-06-13) | Day 32 |
| https://owasp.org/Top10/A01_2021-Broken_Access_Control/ (verified 2026-06-13) | Day 33 |
| https://simonwillison.net/series/prompt-injection/ (verified 2026-06-13) | Day 34 |
| https://sre.google/sre-book/postmortem-culture/ (verified 2026-06-13) | Day 36 |
| https://www.pinecone.io/learn/chunking-strategies/ | Days 7, 9 |
| https://www.anthropic.com/news/contextual-retrieval | Days 1, 10, 17 |
| https://modelcontextprotocol.io/ | Days 25–27 |
| https://arxiv.org/abs/2005.11401 — RAG paper | Day 1 |
| https://www.youtube.com/watch?v=yMQPQuz5WpA — 3B1B "But what is a GPT?" (verified 2026-06-14) | Day 1 |
| https://www.youtube.com/watch?v=fNk_zzaMoSs — 3B1B "Vectors, what even are they?" LA Ch.1 (verified 2026-06-14) | Day 13 |
| https://www.youtube.com/watch?v=LyGKycYT2v0 — 3B1B "Dot products and duality" LA Ch.9 (verified 2026-06-14) | Day 13 |

Verify any NEW link with WebFetch before adding it to a day file, then record it here.

## Decisions log

- 2026-06-06 · Brian's day-1 review corrections, now rules 7, 12–15: no time estimates except caps; no week numbers or next-day links in day files; deliverable videos weekly (block-end days only), not daily; examples use common meds + generic patients; never mention untaught concepts (no "embeddings" before Day 13).
- 2026-06-06 · 36 working days (6 blocks × 6) + rest day after every 6th. Rest days are notes, not files.
- 2026-06-06 · Text-based markdown, GitHub-rendered mermaid, screenshot placeholders for later capture.
- 2026-06-07 · Moved to the `instructor` branch (was a standalone `curriculum` branch, now deleted). Repo is storage only — content ships via another platform; students never see `curriculum/` in the repo.
- 2026-06-06 · Chunking taught on the KJV Bible (corpus that needs it) precisely because the medical notes don't — the contrast IS the lesson (decide from data, not habit).
- 2026-06-27 · The "AI Engineering Certificate Program" Form B proposal is the governance/reference doc for THIS repo's curriculum — cleaned-up copy saved to `docs/AI-Engineering-Certificate-Program.md`. Sparse+dense hybrid **stays optional research** (Day 16's "Going further (optional)" section unchanged) — here the lexical/exact-match half is owned by Postgres, so sparse vectors aren't needed. Per Brian: address the curriculum and its spirit; reconcile only glaring objective/assessment contradictions — do NOT chase the proposal module-for-module.
- 2026-06-22 · Added `day-00.md` (Day Zero — optional pre-work: LLM + vector-math primer with the cosine formula written out, plus assignments to research `text-embedding-3-small` and watch the 3B1B videos). This **intentionally** front-loads embeddings/vectors before Day 13 — a conscious, Brian-approved exception to Rule 14, because it's framed as optional prerequisite grounding, not part of the build's unlock order (the hands-on proof still lands on Days 13–14). Also added two foundations recap slides to the Week 3 deck (`slides/week-3.html`, now 21 slides). Day Zero is listed in the README index but is NOT a deliverable day.
- 2026-06-14 · Brian: mechanism/under-the-hood understanding is REQUIRED, not optional theory. Added Day 14 Step 1 "Build the search by hand first" (text→vectors→cosine/dot-product ranking = a vector DB's core op, in the main Implementation flow, not further reading) — answers "how vector DBs work under the hood" by having students BE one before using Pinecone. Fits the existing build-naive-by-hand motif (Days 8, 16). Also: Day 13 gained a dot-product note (cosine = normalized dot product) + 3B1B linear-algebra videos in further reading; Day 1 gained 3B1B "But what is a GPT?" for the LLM-internals "why". 3B1B videos are further-reading (can't gate on a YouTube watch); the hands-on exercise is the required part.
