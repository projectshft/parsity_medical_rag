# Week 1 — The vector store · Facilitator Runbook

**Block:** The vector store · **Week 1 of 5** · **Days covered:** ~1–6 (Foundations → the vector store) · **Session length:** ~100 min · **Deck:** `week-1.html` (16 slides)

**Goal of this session:** the room leaves able to say — in their own words — *why* the database they already have can't answer "which patients are short of breath?", *what* a vector is, and *how* "near" is measured (cosine, by hand, not black-boxed). They will have turned the company's existing Postgres notes into a searchable vector store with `npm run vectorize`, run real semantic search over it, watched it match "dyspnea" from a query that never says it, and named why our self-contained notes need no chunking while the Bible does.

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
- [ ] **Warm the demo before class.** Run the cheap slice once so the index has vectors and you've seen the numbers:
      ```bash
      npm run vectorize -- --limit 200
      ```
      Expected tail: `Vectorizing 200 notes from Postgres...` then `Done. Upserted 200 note vectors into Pinecone.` Embedding all ~143,946 notes costs real money and ~an hour — **never do the full run live.** Keep the live slice at 200.
- [ ] Have the be-the-db scratch script (`scripts/be-the-db.ts`) written and test-run once (it is printed in full below), and confirm `npm run search -- "x"` works. So you are not typing cold.
- [ ] A terminal open in the repo; `scripts/vectorize.ts` open in an editor to scroll to live.
- [ ] `week-1.html` open full-screen. Arrow keys / click to navigate, `N` toggles presenter notes.

**Network reality:** Pinecone bulk writes can be flaky on conference/hotel Wi-Fi. The 200-slice is one batch of 100 + one of 100 (`batchSize = 100` in `lib/pinecone.ts`), so a hiccup costs seconds, not the session. If a live upsert stalls, Ctrl-C and re-run — it's idempotent by note id (break-it entry 3), so you never double-write.

---

## Timed flow (~100 min)

| Time | Arc segment | Slides | What to do |
|---|---|---|---|
| 0:00 | **Problem statement** | 1–4 | Cold open on the reframe: *you joined a company; the data is already here.* Read the query aloud — "which patients are short of breath?" — then show the `LIKE '%shortness of breath%'` → **0 rows** because the note says *"dyspnea on exertion."* Sit in the gap. Ask the room (slide 4 cue) for three more phrasings of the same symptom; let them generate the misses. |
| 0:12 | **High-level concept — vector + cosine** | 5–6 | Text → a point in space; similar meaning lands near. Then make "near" precise: cosine = direction, not distance-from-origin. Land the one-sentence definition. Do **not** black-box it — the next slide proves it in ten lines. |
| 0:22 | **Code together I — be the vector DB by hand** | 7 | Run `scripts/be-the-db.ts`. "dyspnea on exertion" ranks #1 for *"short of breath"* with **zero shared words.** The loop *is* a vector database. (Full script + narration below.) |
| 0:35 | **Discussion / breakout** | 8 | "Which needs meaning — and which is just a lookup?" Breakout if >8 people, else full room. Drive to the split: counts/filters vs "sounds like / describes / mentions." Answer key below. That split *is* next week's routing agent. |
| 0:46 | **Concept — two stores, one source of truth** | 9 | The architecture beat. Postgres = system of record (everything); vector store = derived index (just notes + metadata, embedded). If they disagree, Postgres wins; you rebuild the index. This mental model survives the whole course. |
| 0:52 | **Code together II — the vectorize script** | 10–11 | Walk `scripts/vectorize.ts` (read from Postgres → shape with metadata → `upsertChunks`). Run `npm run vectorize -- --limit 200` live. Then the metadata slide: `patientId`/`type`/`date` are what make the index *useful* — one patient averages ~113 notes (up to 2,162), so without `patientId` you can't summarize *this* patient. |
| 1:06 | **Mini-challenge + break it** | 12 | Run `npm run search`: *"patient struggling to breathe"* → did it find the dyspnea notes? Then break it live — the too-vague query (entry 1), then the missing-`patientId`-filter leak (entry 2). Turn them loose on the bank. |
| 1:25 | **Concept — chunking intro + the Bible contrast** | 13–14 | Why our notes need no chunking: one note = one encounter = one piece (~450 chars, self-contained). Then the opposite: one 4M-char book embedded whole "means everything, matches nothing" → you must split it, but *where?* That decision is chunking. |
| 1:33 | **Homework + recap + send-off** | 15–16 | Homework part 1: propose a chunking strategy for the Bible + record the 2–3 min "what is chunking" clip. Recap where they are. This week's deliverable video: keyword vs meaning, their own words. Tease Week 2: you'll *run* your chunking strategy and measure it. |

Runs long? Compress the architecture slide (0:46) and the chunking contrast (1:25) — **never** cut the two code-togethers or the break-it. The by-hand demo (slide 7) is the "understand it, don't black-box it" beat; protect it.

---

## Breakout prompt + answer key

**Prompt (slide 8):** "For each question, decide: does it need **meaning** (semantic search over the notes), or is it just an **exact lookup/count** the database already does? Say which, and why."

- **"How many patients have diabetes?"** → **exact lookup.** A count over structured condition rows. Meaning search returns a *ranked list of similar things* — the wrong shape for an integer. Postgres already answers this.
- **"Which patients mention trouble sleeping?"** → **meaning.** "Trouble sleeping" won't literally appear; notes say "insomnia," "wakes at 3am," "poor sleep hygiene." Different words, same fact.
- **"Notes that describe chest pain at night"** → **meaning.** "Describe" is the tell — you're matching the *content* of free text, not a column value.
- **"List patients over 65"** → **exact lookup.** A numeric filter on date-of-birth. No meaning involved; the DB does it exactly and it must be exact.
- **"Anyone whose notes sound like they're struggling to cope?"** → **meaning**, and the softest one. "Sound like" is pure semantics — no keyword captures it. Good place to note that soft queries also flatten scores (foreshadows break-it entry 1).

**What to listen for:** the instinct to reach for meaning search for *everything* because it "handles synonyms." Push back: counts and thresholds need exactness, and a ranked similarity list can't count. The honest system keeps **both** engines — that's next week's hybrid routing. The debrief line: *the words "how many / over / list" smell like SQL; "mentions / describes / sounds like" smell like vectors.*

---

## Code-together

Two hands-on pieces. The similarity-by-hand one is a *scratch script you write live* (`scripts/be-the-db.ts` — that's the point, feel the cosine math). The note search is a real command that ships: `npm run search -- "your query"`.

### Part I — be the vector database by hand (slide 7)

`scripts/be-the-db.ts` — embeds a tiny corpus, embeds a query, ranks by cosine. No Pinecone, no DB; just OpenAI embeddings and arithmetic:

```ts
import 'dotenv/config';
import { createEmbeddings } from '../lib/openai';

const cosine = (a: number[], b: number[]) => {
  const dot = a.reduce((s, x, i) => s + x * b[i], 0);
  const mag = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return dot / (mag(a) * mag(b));
};

async function main() {
  const docs = ['dyspnea on exertion', 'broken ankle', 'well-controlled diabetes'];
  const q = 'patient is short of breath';
  const [qv, ...dv] = await createEmbeddings([q, ...docs]);
  docs
    .map((d, i) => ({ d, score: cosine(qv, dv[i]) }))
    .sort((a, b) => b.score - a.score)
    .forEach((r) => console.log(r.score.toFixed(3), r.d));
}
main();
```

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/be-the-db.ts
```

- **Narrate:** this is the entire engine. Embed the query, embed each doc, score by cosine, sort. A real vector database does exactly this — just fast, over millions of vectors, and it stores them for you.
- **Expected output** (scores approximate; the *ranking and the gap* are the point, not the exact decimals):
      ```
      0.7xx dyspnea on exertion      ← no shared words, still #1
      0.2xx broken ankle
      0.1xx well-controlled diabetes
      ```
- **The line to say out loud:** "short of breath" and "dyspnea on exertion" share *zero* letters, yet cosine puts them on top. That is meaning, not keywords — and it's why `LIKE` returned 0 rows on slide 4.
- **If asked why we don't divide out the magnitudes:** OpenAI's embeddings come back length-1, so the dot product alone gives the same ranking. We wrote the full cosine so nobody has to take that on faith.

### Part II — vectorize, then search it (slides 10–12)

**Vectorize** — read `scripts/vectorize.ts` on screen (the three numbered steps), then run the slice:

```bash
npm run vectorize -- --limit 200
```

- **Narrate the three steps:** (1) `prisma.note.findMany({ take: limit })` reads notes from Postgres — the source of truth; (2) `.map()` shapes each note into `{ id, content, metadata }`, reusing `note.id` as the vector id (**this is what makes re-runs idempotent** — entry 3); (3) `upsertChunks` embeds + upserts in batches of 100.
- **Expected output:** `Vectorizing 200 notes from Postgres...` → `Done. Upserted 200 note vectors into Pinecone.`

**Search** — `npm run search` (`scripts/search.ts`), built on the real `searchClinicalNotes` from `lib/vector-search.ts`:

```ts
import 'dotenv/config';
import { searchClinicalNotes } from '../lib/vector-search';

async function main() {
  const query = process.argv[2] ?? 'patient struggling to breathe';
  const patientId = process.argv[3]; // optional filter
  const results = await searchClinicalNotes(query, {
    topK: 5,
    patientIds: patientId ? [patientId] : undefined,
  });
  console.log(`\nQuery: "${query}"${patientId ? `  (patient ${patientId})` : ''}\n`);
  for (const r of results) {
    console.log(r.score.toFixed(3), '·', r.patientName, '·', r.documentType);
    console.log('   ', r.contentPreview.slice(0, 120).replace(/\s+/g, ' '), '\n');
  }
}
main();
```

```bash
npm run search -- "patient struggling to breathe"
```

- **Narrate:** the query never says "dyspnea," yet the top hits are the breathing notes. Point at the `score` column — that number is the cosine from Part I, now over the real corpus.
- **The instinct to build (slide 12 cue):** don't just admire the top hit — ask *what did it rank #1, and does that make sense?* "Looks right" isn't a measurement. We turn it into one in a later week (retrieval evals).

**Most likely live failures (+ recovery):**
- **Upsert throws `index not found` / 404** → the `medical-notes` index doesn't exist. Run the `ensureIndexExists` one-liner from Pre-flight, then re-run vectorize.
- **Search returns nothing / weak junk** → you searched before vectorizing, or against a fresh/empty index. Confirm the 200-slice upsert finished first.
- **Pinecone write stalls on the room's Wi-Fi** → Ctrl-C, re-run `npm run vectorize -- --limit 200`. Idempotent by id, so no harm.
- **`Environment variable not found: DATABASE_URL`** (or OpenAI/Pinecone key) → the `.env` isn't loaded or a key is missing. All three keys are required for this path; check `.env`.

---

## Break it / extend bank

Run at least entries 1 and 2 live (they're the headline — a flattened ranking and a privacy leak), then let the room try the rest.

**1. The too-vague query — scores flatten (slide 12's "make it miss").**
- **Sabotage:** search something so generic everything matches a little: `npm run search -- "patient has a problem"`.
- **Expected failure:** the top-5 scores bunch up (e.g. 0.30 / 0.29 / 0.28 …) and the results are a grab-bag — no clear winner. The system isn't *wrong*, it's *undiscriminating*: a vague query points at the center of everything, so everything is "a little near."
- **Fix:** make the query carry meaning — `"shortness of breath climbing stairs"` re-separates the ranking, top score jumps and the gap to #2 widens. Retrieval quality is a property of the *query* as much as the index.
- **Extend:** this is *why* you can't trust "it returned results." A later week builds a retrieval eval set so "it found the right note" becomes a number, not a vibe. Name that forward ref.

**2. The missing `patientId` filter — one patient's notes leak into another's answer (the privacy one).**
- **Sabotage:** run a patient-scoped question *without* the filter: `npm run search -- "chest pain"` (no patientId arg) and read the `patientName` column — hits come from *many different patients*.
- **Expected failure:** you asked a question that should be about one chart, and got fragments from strangers' charts. In a clinical product that's not a bad search result — it's a patient-privacy boundary violation.
- **Fix:** pass the filter: `npm run search -- "chest pain" <patientId>`. Under the hood (`lib/vector-search.ts`) this sets Pinecone's metadata `filter.patientId`, and every hit now shares that one id. Confirm the `patientName` column is now a single person.
- **Extend:** this is exactly why `patientId` had to be on the vector at *vectorize* time (slide 11) — metadata isn't decoration, it's the filter that enforces the boundary. Foreshadow: the same filter, forgotten, is a planted bug in a later week's hybrid path.

**3. Re-running vectorize is idempotent (prove it).**
- **Sabotage:** run `npm run vectorize -- --limit 200` a second time and worry aloud about duplicates.
- **Expected failure:** *there is none* — that's the lesson. Pinecone upserts key on vector **id**, and the script reuses `note.id` as the id (`scripts/vectorize.ts` ~line 43). Re-running overwrites the same 200 vectors in place; the index doesn't grow.
- **Fix / point:** nothing to fix — this is *by design*. Idempotency is why "rebuild the index" (slide 9) is safe: Postgres is the source of truth, and you can re-derive the vector store any time without fear of doubling it.
- **Extend:** change the slice — `--limit 50` then `--limit 200` — and note the same ids get re-written, new ids added. Then reason about the opposite hazard: if you *deleted* a note in Postgres, the stale vector would linger in Pinecone until a full rebuild or explicit delete (`deleteAllChunks`). Derived indexes drift; you reconcile them.

**4. (extend only) One giant vector vs many small ones — the chunking foreshadow.**
- **Sabotage (thought experiment):** imagine concatenating one patient's ~113 notes into a single 50,000-char string and embedding *that* as one vector.
- **Expected failure:** the vector "means" the average of everything the patient ever presented with — it matches *many* queries weakly and *no* specific one strongly. Same failure as embedding the whole Bible at once (slide 14).
- **Point:** our per-note vectors dodge this only because a note is already the right-sized piece. When the piece is too big, you must split — and *where* you split is the craft. That's the homework and next week.

---

## Misconceptions to preempt

- **"We're replacing the database with a vector database."** No — Postgres stays the system of record and holds *everything*; the vector store is a *derived* copy of just the notes, built for one job (semantic search). If they disagree, Postgres wins and you rebuild the index. Students who miss this think the vector store is the truth; it never is.
- **"Semantic search handles synonyms, so use it for everything."** It returns a *ranked list of similar things* — useless for counts ("how many diabetics") and thresholds ("A1c over 9"). Those need exact SQL. The whole system keeps both engines on purpose; that contrast is next week.
- **"Cosine measures distance between the points."** It measures the **angle** — direction, not distance-from-origin. Two vectors can differ in magnitude and still point the same way (same meaning). Get the one-sentence definition out of their mouths at slide 6.
- **"Higher score = correct answer."** Score is *similarity to the query*, not *truth*. A vague query makes everything score ~0.3 (entry 1); a sharp query separates the field. "It returned results" is not "it's right" — which is why evals exist later.
- **"Metadata is just labels."** `patientId` is the difference between "summarize this patient" working and one patient's chart leaking into another's answer (entry 2). Metadata decides *which questions you can answer* and *which boundaries you can enforce*.

---

## Deliverable 🎥 (end of week)

A **2–3 min video** (phone is fine): explain, in your own words, **why keyword/SQL search isn't enough, and what a vector fixes.** A strong one uses the session's own concrete case — *"a doctor searches 'shortness of breath'; the note says 'dyspnea on exertion'; `LIKE` returns 0 rows; the embedding puts them ~0.7 apart so meaning search finds it"* — and names the mental model: Postgres is the source of truth, the vector store is a derived, searchable projection. Bonus if they mention that cosine measures direction, not keyword overlap.

**Grade against one question:** *can they explain the keyword-vs-meaning gap with a real example, not just repeat "vectors are numbers"?* A weak video defines an embedding as "a list of 1,536 numbers" and stops — that's a definition, not an understanding. A strong one shows the *miss* keyword search makes and *why* the vector doesn't.

(Homework **part 1**, slide 15, is separate and feeds Week 2: skim `scripts/bible/`, propose one chunking strategy for the King James Bible and say why, and record a 2–3 min "what is chunking / what trade-off does my strategy make" clip. They *run and measure* it next week.)

---

## Materials

- Deck: `curriculum/slides/week-1.html` (16 slides)
- Real code the demos are grounded in (read live if asked):
  - `scripts/vectorize.ts` — Postgres notes → Pinecone (`npm run vectorize -- --limit 200`)
  - `lib/pinecone.ts` — `upsertChunks` (batches of 100), `searchChunks`, `ensureIndexExists`, `deleteAllChunks`
  - `lib/vector-search.ts` — `searchClinicalNotes` (the `patientId` metadata filter lives here)
  - `lib/openai.ts` — `createEmbedding` / `createEmbeddings` (`text-embedding-3-small`, 1536 dims)
  - `prisma/schema.prisma` — the `Note` model (`id` doubles as the Pinecone vector id)
- Scratch script you write live: `scripts/be-the-db.ts` (printed above). Shipped command: `npm run search`
- Homework corpus (Week 2): `scripts/bible/` tools — KJV Bible
- Data facts to have on hand: **1,278 patients**, **143,946 notes** total, **~113 notes per patient on average** (up to **2,162**); notes ~450 chars, self-contained.
- Env the vectorize path needs: `DATABASE_URL` (provided/read-only), `OPENAI_API_KEY`, `PINECONE_API_KEY` (+ optional `PINECONE_INDEX`, `DIRECT_URL`).
