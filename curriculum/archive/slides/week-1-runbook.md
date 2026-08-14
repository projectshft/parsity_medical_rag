# Week 1 — The vector store · Facilitator Runbook

**Block:** The vector store · **Week 1 of 5** · **Days covered:** ~1–6 (Foundations → the vector store) · **Session length:** ~100 min · **Deck:** `week-1.html` (16 slides)

**Goal of this session:** the room leaves able to say — in their own words — *why* the database they already have can't answer "which patients are short of breath?", *what* a vector is, and *how* "near" is measured (cosine, by hand, not black-boxed). They will have turned the company's existing Postgres notes into a vector store with the FULL `npm run vectorize` run (21,090 vectors, metadata they chose as a team), verified it in the Pinecone console, and named why our self-contained notes need no chunking while the Bible does. **They do NOT search anything today** — the session ends on the cliffhanger (a full index and no way to query it; that's next weekend's payoff).

> This runbook is backstage — say anything here; the slides are what students see. You do **not** need to have built this system to run the session: Pre-flight and Code-together assume you're coming in cold. The single idea to protect all session: **the vector store is a *derived* search index built from the database — Postgres is the source of truth, the vector store is a searchable projection of it.** The restructure's reframing is the spine: the company already has its data; we're teaching the thing on top — search by meaning.

---

## Pre-flight (before the room arrives)

The big shift from the old Foundations week: **there is no live SQL ingest.** The company's data is already in Postgres and students connect to it (a read-only role or a provided copy). Nobody rebuilds the database. Week 1's subject is the layer *on top* — the vector store.

- [ ] Repo cloned, `npm install` done. Node 18+.
- [ ] `.env` has all three keys the vectorize path needs (per `scripts/vectorize.ts` header):
      - `DATABASE_URL` — the **provided, pre-loaded** database (read-only role or a copy). Students do not create or seed it. Optionally `DIRECT_URL` for steadier bulk reads on Neon (the script falls back to de-pooling `DATABASE_URL` on its own).
      - `OPENAI_API_KEY` — embeddings (`text-embedding-3-small`, 1536 dims; see `lib/openai.ts`).
      - `PINECONE_API_KEY` — the vector store. Optional `PINECONE_INDEX` (defaults to `medical-notes`).
- [ ] **Make sure the Pinecone index exists first.** `vectorize.ts` calls `upsertChunks`, which writes to `pinecone.Index('medical-notes')` directly — it does **not** create the index. If it's missing, the upsert throws. Create it once (dimension **1536**, metric **cosine**, serverless aws/us-east-1) via the Pinecone console, or run the helper already in the repo:
      ```bash
      npx ts-node --compiler-options '{"module":"CommonJS"}' \
        -e "require('dotenv/config'); require('./lib/pinecone').ensureIndexExists().then(()=>process.exit(0))"
      ```
- [ ] **Warm the demo before class.** Run the full vectorize once so the index has vectors and you've seen the numbers:
      ```bash
      npm run vectorize
      ```
      Expected tail: `Vectorizing 21090 notes from Postgres...` then `Done. Upserted 21090 note vectors into Pinecone.` The full run is **~10–15 min and ~$0.10** (21,090 notes ≈ 5M embedding tokens, 211 batches of 100) — cheap enough that everyone runs it live, and it fits Pinecone's free tier with ~8× headroom (~155 MB vs 2 GB). (`-- --limit 200` still exists if you just want a quick smoke test.)
- [ ] Confirm `npm run similarity` works. So you are not typing cold.
- [ ] A terminal open in the repo; `scripts/vectorize.ts` open in an editor to scroll to live.
- [ ] `week-1.html` open full-screen. Arrow keys / click to navigate, `N` toggles presenter notes.

**Network reality:** Pinecone bulk writes can be flaky on conference/hotel Wi-Fi. The full run is 211 batches of 100 (`batchSize = 100` in `lib/pinecone.ts`), so a hiccup costs one batch, not the session. If a live upsert stalls, Ctrl-C and re-run — it's idempotent by note id (break-it entry 1), so you never double-write. **Session beat:** kick off the full run, then run the metadata team-decision discussion while it chews — both finish together.

---

## Timed flow (~100 min)

| Time | Arc segment | Slides | What to do |
|---|---|---|---|
| 0:00 | **Problem statement** | 1–4 | Cold open on the reframe: *you joined a company; the data is already here.* Read the query aloud — "which patients are short of breath?" — then show the `LIKE '%shortness of breath%'` → **0 rows** because the note says *"dyspnea on exertion."* Sit in the gap. Ask the room (slide 4 cue) for three more phrasings of the same symptom; let them generate the misses. |
| 0:12 | **High-level concept — vector + cosine** | 5–6 | Text → a point in space; similar meaning lands near. Then make "near" precise: cosine = direction, not distance-from-origin. Land the one-sentence definition. Do **not** black-box it — the next slide proves it in ten lines. |
| 0:22 | **Code together I — be the vector DB by hand** | 7 | Run `npm run similarity`. "dyspnea on exertion" ranks #1 for *"short of breath"* with **zero shared words.** The loop *is* a vector database. (Full script + narration below.) |
| 0:35 | **Discussion / breakout** | 8 | "Which needs meaning — and which is just a lookup?" Breakout if >8 people, else full room. Drive to the split: counts/filters vs "sounds like / describes / mentions." Answer key below. That split *is* the routing agent (the selector) they build next weekend. |
| 0:46 | **Concept — two stores, one source of truth** | 9 | The architecture beat. Postgres = system of record (everything); vector store = derived index (just notes + metadata, embedded). If they disagree, Postgres wins; you rebuild the index. This mental model survives the whole course. |
| 0:52 | **Code together II — the vectorize script** | 10–11 | Walk `scripts/vectorize.ts` (read from Postgres → shape with metadata → `upsertChunks`). Kick off the FULL `npm run vectorize` live (~10–15 min; run the metadata discussion while it chews). Then the metadata slide: `patientId`/`type`/`date` are what make the index *useful* — one patient averages ~105 notes (up to 1,632), so without `patientId` you can't summarize *this* patient. |
| 1:06 | **Mini-challenge + break it** | 12 | Prove the index is real WITHOUT searching: Pinecone console count = 21,090; fetch one vector by note id and read its metadata; re-run `npm run vectorize` and watch the count NOT change (entry 1). Land the cliffhanger: *you have no way to search any of this — next weekend.* Turn them loose on the bank. |
| 1:25 | **Concept — chunking intro + the Bible contrast** | 13–14 | Why our notes need no chunking: one note = one encounter = one piece (~940 chars, self-contained). Then the opposite: one 4M-char book embedded whole "means everything, matches nothing" → you must split it, but *where?* That decision is chunking. |
| 1:33 | **Homework + recap + send-off** | 15–16 | Homework (required): chunk the Bible with a strategy they choose and STORE it in their own `bible-kjv` index with metadata + the 2–3 min video (what chunking is / their approach / sentence overlap). Brief: `docs/CHALLENGE-CHUNKING.md`. Recap. Deliverable video: keyword vs meaning, their own words. Tease next weekend: search BOTH indexes — retrieval, reranking, and their first agent. |

Runs long? Compress the architecture slide (0:46) and the chunking contrast (1:25) — **never** cut the two code-togethers or the break-it. The by-hand demo (slide 7) is the "understand it, don't black-box it" beat; protect it.

---

## Breakout prompt + answer key

**Prompt (slide 8):** "For each question, decide: does it need **meaning** (semantic search over the notes), or is it just an **exact lookup/count** the database already does? Say which, and why."

- **"How many patients have diabetes?"** → **exact lookup.** A count over structured condition rows. Meaning search returns a *ranked list of similar things* — the wrong shape for an integer. Postgres already answers this.
- **"Which patients mention trouble sleeping?"** → **meaning.** "Trouble sleeping" won't literally appear; notes say "insomnia," "wakes at 3am," "poor sleep hygiene." Different words, same fact.
- **"Notes that describe chest pain at night"** → **meaning.** "Describe" is the tell — you're matching the *content* of free text, not a column value.
- **"List patients over 65"** → **exact lookup.** A numeric filter on date-of-birth. No meaning involved; the DB does it exactly and it must be exact.
- **"Anyone whose notes sound like they're struggling to cope?"** → **meaning**, and the softest one. "Sound like" is pure semantics — no keyword captures it. Good place to note that soft queries will matter later: they also flatten similarity scores (next weekend, when search exists).

**What to listen for:** the instinct to reach for meaning search for *everything* because it "handles synonyms." Push back: counts and thresholds need exactness, and a ranked similarity list can't count. The honest system keeps **both** engines — and the routing between them is the little agent they build next weekend. The debrief line: *the words "how many / over / list" smell like SQL; "mentions / describes / sounds like" smell like vectors.*

---

## Code-together

Two hands-on pieces. The similarity-by-hand one is a *scratch script you write live* — that's the point, feel the cosine math. The second is the real thing: the full vectorize run.

### Part I — be the vector database by hand (slide 7)

`scripts/similarity.ts` — embeds a query + a few candidate phrases, ranks them by cosine. No Pinecone, no DB; just OpenAI embeddings and arithmetic. It ships, so run it live:

```bash
npm run similarity
```

The full script (open it on screen — it's ~40 lines): a hand-written `cosine(a, b) = (a·b)/(|a||b|)`, then `createEmbeddings([query, ...candidates])`, map to scores, sort, print.

- **Narrate:** this is the entire engine. Embed the query, embed each candidate, score by cosine, sort. A real vector database does exactly this — just fast, over millions of vectors, and it stores them for you.
- **Expected output** (scores approximate; the *ranking and the gap* are the point):
      ```
      0.599  dyspnea on exertion            ← no shared words, still #1
      0.438  complains of a persistent cough
      0.379  winded climbing the stairs
      0.253  well-controlled type 2 diabetes
      0.251  fractured left ankle
      ```
- **The line to say out loud:** "short of breath" and "dyspnea on exertion" share *zero* letters, yet cosine puts them on top. That is meaning, not keywords — and it's why `LIKE` returned 0 rows on slide 4.
- **Then edit and re-run:** change a candidate or the query in `scripts/similarity.ts` and run it again — students *feel* the geometry when they move a phrase and watch its score move.
- **If asked why we don't divide out the magnitudes:** OpenAI's embeddings come back length-1, so the dot product alone gives the same ranking. We wrote the full cosine so nobody has to take that on faith.

### Part II — vectorize: the full run (slides 10–12)

**Vectorize** — read `scripts/vectorize.ts` on screen (the paging loop), then kick off the full run:

```bash
npm run vectorize
```

- **Narrate the loop:** (1) a **cursor-paginated** `findMany` reads 100 notes at a time (`skip: 1, cursor, orderBy id` — never more than 100 in memory, and Prisma does NOT paginate for you); (2) `.map()` shapes each page into `{ id, content, metadata }` — active meds only, age derived, `note.id` as the vector id (**that's what makes re-runs idempotent** — entry 1); (3) `upsertChunks` embeds + upserts each page, with the retry/backoff riding shotgun for flaky wifi.
- **Expected output:** the upfront header (`Vectorizing 21090 of 21090 notes … 211 page(s) of 100`), then `page N/211` progress lines with an ETA, then `Done. Upserted 21090 note vectors in ~15 min.` The occasional `Pinecone hiccup (attempt 2/8), retrying…` line is the retry working, not a problem.
- **While it chews (~10–15 min):** run the metadata team-decision discussion (section below) — both finish together.

**Verify** — prove the index is real without searching it (slide 12):

- Open the Pinecone console: the vector count should read **21,090**.
- Fetch one vector by a note id and read the metadata back — patient fields, age, `currentMedications`. Is what the team decided actually on the vector?
- Re-run `npm run vectorize` and watch the count **not** change — ids are note ids, so re-runs overwrite in place (entry 1).
- **Then land the cliffhanger (slide 12):** the index is full and there is no way to search it. Resist any temptation to demo a query — the payoff belongs to next weekend's session.

**Most likely live failures (+ recovery):**
- **Upsert throws `index not found` / 404** → the `medical-notes` index doesn't exist. Run the `ensureIndexExists` one-liner from Pre-flight, then re-run vectorize.
- **Pinecone write stalls on the room's Wi-Fi** → Ctrl-C, re-run `npm run vectorize`. Idempotent by id, so no harm.
- **`Environment variable not found: DATABASE_URL`** (or OpenAI/Pinecone key) → the `.env` isn't loaded or a key is missing. All three keys are required for this path; check `.env`.

---

## Break it / extend bank

Run entry 1 live (idempotency is the headline now that search waits for next weekend), then let the room try the rest.

**1. Re-running vectorize is idempotent (prove it).**
- **Sabotage:** run `npm run vectorize` a second time and worry aloud about duplicates.
- **Expected failure:** *there is none* — that's the lesson. Pinecone upserts key on vector **id**, and the script reuses `note.id` as the id (`scripts/vectorize.ts`). Re-running overwrites the same vectors in place; the index doesn't grow.
- **Fix / point:** nothing to fix — this is *by design*. Idempotency is why "rebuild the index" (slide 9) is safe: Postgres is the source of truth, and you can re-derive the vector store any time without fear of doubling it.
- **Extend:** re-run with `--limit 50` after a full run and note the same 50 ids just get re-written in place. Then reason about the opposite hazard: if you *deleted* a note in Postgres, the stale vector would linger in Pinecone until a full rebuild or explicit delete (`deleteAllChunks`). Derived indexes drift; you reconcile them.

**2. The metadata you didn't tag doesn't exist.**
- **Sabotage:** in the Pinecone console, fetch a vector and ask the room: "find me every note for patients on a statin, written before 2010." Can this index do either?
- **Expected failure:** meds work only if `currentMedications` carries the exact display string ($in is exact-match — "Simvastatin" alone matches nothing); dates fail entirely — nothing numeric was stored, and Pinecone range-filters (`$gte`/`$lte`) only work on numbers.
- **Fix:** none today — that's the point. Metadata is decided at write time; a question you didn't plan for is a re-tag (cheap: `index.update` patches metadata without re-embedding) or a re-vectorize away.
- **Extend:** design the tag that WOULD make the date question work (`year: 2009` as a number) — it's one line in the chunk-shaping map.

**3. (extend only) One giant vector vs many small ones — the chunking foreshadow.**
- **Sabotage (thought experiment):** imagine concatenating one patient's ~105 notes into a single 50,000-char string and embedding *that* as one vector.
- **Expected failure:** the vector "means" the average of everything the patient ever presented with — it matches *many* queries weakly and *no* specific one strongly. Same failure as embedding the whole Bible at once (slide 14).
- **Point:** our per-note vectors dodge this only because a note is already the right-sized piece. When the piece is too big, you must split — and *where* you split is the craft. That's the homework.

---

## Team decision — what to vectorize, and what metadata to attach (~10 min, WHILE the full run chews)

Run this while the full vectorize is grinding through its 211 pages — it fills the wait perfectly, and the decisions land in the very script that's running. It's a **design discussion, not a lab** — the point is that corpus selection and metadata design *are* the engineering, and both have defensible answers. Make it a real team decision; you're deciding together what a future re-vectorize would do (the actual re-run stays a with-the-class event — never a solo reset).

**Ground them in what's true today** (from `scripts/vectorize.ts` + `lib/vector-search.ts`):
- Only `note.content` is embedded — one vector per note.
- Metadata attached: `patientId`, `firstName`, `lastName`, `age`, `gender`, `race`, `city`, `state`, `source`, `currentMedications` (active meds only — 946 active vs 29,627 stopped).
- Of those, **only `patientId` will actually be used to filter** (next weekend). No date/year field is stored at all — and Pinecone range-filters only work on numbers, so "notes since 2015" is impossible with today's tags. Names are stored in a third-party index — hold that thought.

### Decision 1 — "should we vectorize more than the notes?"
Let them argue it, then land the answer: **usually no — and knowing why is the lesson.** The other tables (`conditions`, `medications`, `observations`) are already exact, structured data. The SQL agent is **text-to-SQL** — the LLM writes a raw `SELECT` straight against those tables (`lib/agents/sql.ts`), so "how many diabetics," "A1c over 9," "meds for patient X" are already answered precisely. Embedding a `Hypertension` row adds *zero* semantic value and just pollutes the index. **Embedding everything is the classic beginner mistake.** You vectorize the notes because that's where *meaning* lives and keyword/SQL fails — nowhere else.
- **The one candidate worth debating:** a synthesized per-patient *summary* doc (roll up conditions + meds + recent notes into one blurb) for "tell me about patient X." Real, but derived and goes stale, and text-to-SQL + a note search mostly cover it. Good argument; most rooms land on "notes only."

### Decision 2 — "what metadata should ride on each vector?"
Metadata is only worth attaching if you'll **filter or display** on it. Three live options, in rising order of interest:
- **Add `year` as a NUMBER.** Pinecone can only range-filter (`$gte`/`$lte`) on numbers — a `"YYYY-MM-DD"` string is unfilterable. One derived field and "notes from the last five years" becomes real. Cleanest hands-on win if they want to *build* something.
- **Denormalize condition tags onto each note vector** (e.g. `conditions: ["Diabetes", "Hypertension"]`). Then "notes about sleep for *diabetic* patients" is a pure Pinecone metadata filter. This makes the **filter-here-vs-there** tradeoff concrete: the hybrid path can filter in **Postgres** (text-to-SQL finds the cohort) or *inside* the vector store via tags. Neither is free — Postgres-side stays fresh but needs two round-trips; tag-side is one query but goes stale when a diagnosis changes. Great thing to make them defend.
- **The PII one — the sharpest teaching moment.** We store `firstName`/`lastName` **in Pinecone**, a third-party derived index. Should identifying data live in the vector store at all, or store only `patientId` and re-join to Postgres for the name at display time? That's a **privacy decision hiding in a Week 1 script** — surface it now; it pays off in the PII/channels session later in the course.

### The fact that makes this cheap to try
Trying a metadata idea does **not** require re-embedding 21k notes. **Pinecone can patch metadata in place** (`index.update` by vector id) without touching the embedding — so "add condition tags" or "drop the name fields" is a metadata-only pass, not a paid re-embed. (`upsertChunks` re-embeds; a metadata-only update would be its own small helper.) Say this out loud so nobody assumes every tweak costs an embedding run.

**What to listen for:** the reflex to "embed more to be safe." Push back — the vector store earns its keep on *meaning*; structured facts belong in Postgres where text-to-SQL already reaches them exactly. A bigger index isn't a better one.

---

## Misconceptions to preempt

- **"We're replacing the database with a vector database."** No — Postgres stays the system of record and holds *everything*; the vector store is a *derived* copy of just the notes, built for one job (semantic search). If they disagree, Postgres wins and you rebuild the index. Students who miss this think the vector store is the truth; it never is.
- **"Semantic search handles synonyms, so use it for everything."** It returns a *ranked list of similar things* — useless for counts ("how many diabetics") and thresholds ("A1c over 9"). Those need exact SQL. The whole system keeps both engines on purpose; the agent that routes between them starts next weekend.
- **"Cosine measures distance between the points."** It measures the **angle** — direction, not distance-from-origin. Two vectors can differ in magnitude and still point the same way (same meaning). Get the one-sentence definition out of their mouths at slide 6.
- **"Higher score = correct answer."** Score is *similarity to the query*, not *truth*. They'll feel this next weekend when search exists (a vague query makes everything score ~0.3); "it returned results" is not "it's right" — which is why evals exist later.
- **"Metadata is just labels."** `patientId` is the difference between "summarize this patient" working and one patient's chart leaking into another's answer (they'll trigger that leak themselves next weekend). Metadata decides *which questions you can answer* and *which boundaries you can enforce*.

---

## Deliverable 🎥 (end of week)

A **2–3 min video** (phone is fine): explain, in your own words, **why keyword/SQL search isn't enough, and what a vector fixes.** A strong one uses the session's own concrete case — *"a doctor searches 'shortness of breath'; the note says 'dyspnea on exertion'; `LIKE` returns 0 rows; the embedding puts them ~0.7 apart so meaning search finds it"* — and names the mental model: Postgres is the source of truth, the vector store is a derived, searchable projection. Bonus if they mention that cosine measures direction, not keyword overlap.

**Grade against one question:** *can they explain the keyword-vs-meaning gap with a real example, not just repeat "vectors are numbers"?* A weak video defines an embedding as "a list of 1,536 numbers" and stops — that's a definition, not an understanding. A strong one shows the *miss* keyword search makes and *why* the vector doesn't.

(The **Bible homework**, slide 15, is separate and required: choose a chunking strategy, chunk the KJV, and STORE it in their own `bible-kjv` Pinecone index with metadata, plus a 2–3 min video — what chunking is, their approach and why, what sentence overlap is and when it's used. Brief: `docs/CHALLENGE-CHUNKING.md`. They query that index next weekend.)

---

## Materials

- Deck: `curriculum/slides/week-1.html` (16 slides)
- Real code the demos are grounded in (read live if asked):
  - `scripts/vectorize.ts` — Postgres notes → Pinecone (`npm run vectorize`)
  - `lib/pinecone.ts` — `upsertChunks` (batches of 100), `ensureIndexExists`, `deleteAllChunks`
  - `lib/openai.ts` — `createEmbedding` / `createEmbeddings` (`text-embedding-3-small`, 1536 dims)
  - `prisma/schema.prisma` — the `Note` model (`id` doubles as the Pinecone vector id)
- Shipped exercise: `npm run similarity` (`scripts/similarity.ts`). (No search today — `lib/vector-search.ts` is next weekend's build.)
- Homework corpus: `scripts/bible/` tools (`npm run bible:fetch` downloads the KJV) + `docs/CHALLENGE-CHUNKING.md`
- Data facts to have on hand: **200 patients**, **21,090 notes** total, **~105 notes per patient on average** (up to **1,632**); notes ~938 chars, self-contained. Full vectorize ≈ 10–15 min, ~$0.10, well inside Pinecone free tier.
- Env the vectorize path needs: `DATABASE_URL` (provided/read-only), `OPENAI_API_KEY`, `PINECONE_API_KEY` (+ optional `PINECONE_INDEX`, `DIRECT_URL`).
