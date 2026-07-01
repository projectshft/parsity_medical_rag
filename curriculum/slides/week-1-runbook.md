# Week 1 — Foundations · Facilitator Runbook

**Block:** Foundations · **Days covered:** 1–6 · **Session length:** ~100 min · **Deck:** `week-1.html`

**Goal of this session:** the room leaves able to explain, without notes, *why* a medical assistant needs both a database and a meaning-based search — and they've stood up the database half and queried real patient data themselves.

> This runbook is backstage. Say anything here; the slides are what students see. You do **not** need to have built the system to run this — the Pre-flight and Code-together sections assume you're coming in cold.

---

## Pre-flight (before the room arrives)

- [ ] Repo cloned on the **`student`** branch, `npm install` done, `.env` filled with `DATABASE_URL` (a Neon Postgres URL). Nothing else is needed this week — no OpenAI/Pinecone keys yet.
- [ ] A terminal open in the repo, plus a second tab for `npm run db:studio`.
- [ ] **The Synthea Coherent dataset unpacked into `data/coherent/fhir/`** (or the ~150-patient subset in `data/subset/`). The ingest reads bundles from there and errors with "FHIR directory not found" if it's missing — see `day-03.md` for the one-time download.
- [ ] Run the happy path once yourself before class: `npm run db:push` then `npm run ingest -- --limit 50 --skip-vectors`. Confirm rows land in Studio. (If `db:push` complains the DB is non-empty, that's fine for a fresh Neon project.)
- [ ] One real clinical note open in a text editor to read aloud (any `DocumentReference` in `data/coherent/fhir/`, base64-decoded — or just use the one on slide 7).
- [ ] `week-1.html` open full-screen in a browser. Arrow keys / click to navigate.

If a laptop in the room can't reach Neon, pair them up — this week survives one DB between two people.

---

## Timed flow (~100 min)

| Time | Arc segment | Slides | What to do |
|---|---|---|---|
| 0:00 | **Problem statement** | 1–3 | Cold open. Ask the room to ask an LLM (in another tab) "what meds is patient Rodriguez on?" — it can't. Sit in that gap before naming RAG. |
| 0:10 | **How it's solved** | 3 | Land the one line: *fetch the records at question time, paste them into the prompt.* The model reads, it doesn't know. |
| 0:15 | **High-level concept** | 4, 6 | Two kinds of questions → two engines → the one-diagram architecture. This is the mental model the whole course hangs on. |
| 0:25 | **Discussion / breakout** | 5 | Sort the five queries (structured / semantic / hybrid). Breakout if >8 people. Debrief with the answer key below. |
| 0:40 | **Practical example** | 7 | Read one real clinical note aloud. Point at the two facts: it has structure, and it's short (~450 chars). Plant that the "short" fact decides an architecture call later. |
| 0:48 | **Concept: the structured half** | 8 | Postgres + Prisma: one schema → tables + typed client. Land the FHIR-id-as-primary-key design point. |
| 0:55 | **Code together** | 9 | Run the three commands live (below). Open Studio, browse real patients landing. This is the hands-on core. |
| 1:10 | **Concept: the mapping problem** | 10 | "diabetes" isn't in the data — "Type 2 Diabetes Mellitus" is. Show the synonym dictionary. Contrast with what meaning-based search does for free (seed Week 3). |
| 1:18 | **Break it / extend** | 11 | Run one entry from the break-it bank live, then turn them loose on the mini-challenge. |
| 1:35 | **Recap + send-off** | 12, 13 | Research question + Friday deliverable framing. |

Runs long? The compressible segments are the practical example (0:40) and the mapping concept (1:10) — never the code-together or the break-it.

---

## Breakout prompt + answer key

**Prompt (slide 5):** "Sort these five into structured / semantic / hybrid. For the hybrid ones, say which part goes to which engine."

- "How many patients are on insulin?" → **structured** (a `COUNT` with a filter).
- "Which patients describe chest pain at night?" → **semantic** (note prose; "chest pain at night" won't be a column).
- "Do any diabetics mention medication side effects in their notes?" → **hybrid** (SQL filters to diabetics → semantic search over *their* notes).
- "Summarize this patient's health history." → **hybrid** (structured record + recent notes for one patient).
- "What's a normal blood pressure?" → **trick**: general medical knowledge, *not in the corpus*. The right system behavior is to recognize it has no patient-specific data to ground this and not pretend otherwise. This seeds the Week 4 "refuse what isn't there" thread.

**What to listen for:** the argument on the hybrid ones is the point — don't resolve it too fast. The instinct to throw the whole question at one engine is exactly the instinct the course dismantles.

---

## Code-together (slide 9)

Run these in order, narrating each:

```bash
npm run db:push                                 # schema → tables. "One file just became a database."
npm run ingest -- --limit 50 --skip-vectors     # load 50 patients, Postgres only
npm run db:studio                               # browse the rows live
```

- **Narrate `--skip-vectors`:** we're only building the database half today; the search half doesn't exist yet. Naming the flag plants that there *is* a second half coming.
- **Expected output:** ingest logs ~50 patients + their conditions/observations/meds; Studio shows populated `Patient`, `Condition`, `Observation`, `Medication` tables.
- **Most likely live failure:** `db:push` errors on connection → it's the `DATABASE_URL`, not the code. Have the Neon dashboard open to copy the pooled connection string. Second most likely: someone's on `main`/`instructor` not `student` — check the branch first.

---

## Break it / extend bank

Run at least one live, then let the room try the rest.

**1. Break the condition mapping (the headline one).**
- **Sabotage:** count a condition the synonym dictionary doesn't have yet. **Show it live in the already-open Prisma Studio:** filter the `Condition` table's `display` column for `asthma`. (Studio's exact-match filter *is* the naive `WHERE display = 'asthma'`.)
- **Expected failure:** **0 rows**, even though asthmatic patients exist. Plausible-looking, silently wrong.
- **Fix:** query the data for what it *actually* calls the condition, add the real phrasings to the dictionary, re-run. The count jumps from 0 to N.
- **Extend:** have them record the before/after number. "It seems better" isn't done; "0 → 14" is done. This is the whole course in miniature — find a gap, fill it, verify with a number.

**2. Re-run ingestion twice.**
- **Sabotage:** run the `ingest` command a second time. Naively you'd expect duplicate patients.
- **Expected failure:** *no* duplicates — counts are identical.
- **Fix/why:** the FHIR id is the primary key, so a re-run **updates** rather than inserts. Connect this to idempotency, which becomes the upload API's whole job in Week 6.
- **Extend:** bump `--limit 50` to `--limit 200` and re-run — watch it add the new 150 without touching the first 50.

**3. Ask the database a semantic question.**
- **Sabotage:** try to answer "which patients mention trouble sleeping?" with SQL — `LIKE '%sleep%'` over a notes column.
- **Expected failure:** misses "insomnia," "wakes frequently," "poor sleep hygiene" — same meaning, zero shared keywords.
- **Fix:** you can't, with SQL alone. *That gap is why the vector half exists.* Best possible setup for Week 3.

---

## Misconceptions to preempt

- **"RAG is a model / a product."** No — it's a pattern: retrieve, then generate. The engineering is almost entirely in the retrieve.
- **"Just fine-tune the model on the patient data."** Surfaces in the research question on purpose — let them find out why retrieval beats fine-tuning for facts that change and must be cited. (Don't pre-empt; the Week 1 research slide sends them to discover it.)
- **"The vector database could replace Postgres."** It can store and filter metadata, so why keep SQL? The honest answer — each engine is bad at something the other is good at — is the research prompt, not a lecture.

---

## Deliverable 🎥 (Friday, Day 6)

A strong 2–3 min video: the student explains, in their own words, **why this system needs both a database and a meaning-based search** — ideally naming a question each engine alone gets wrong.

**Grade against one question:** can they name a concrete query that SQL gets wrong *and* one that keyword search gets wrong? If they can, they own the two-engine split. If they're reciting "structured vs semantic" without an example, they don't yet.

---

## Materials

- Student day files this anchors: `day-01.md` … `day-06.md`
- Deck: `week-1.html`
- Further-reading the keen students will have hit: the RAG paper (arxiv 2005.11401), 3Blue1Brown "But what is a GPT?"
