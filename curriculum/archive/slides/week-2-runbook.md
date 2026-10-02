# Week 2 — Retrieval, reranking & your first agent · Facilitator Runbook

**Block:** Retrieval & the first agent · **Week 2 of 5** · **Lessons covered:** w2-01 → w2-04 (semantic search → reranking → structured outputs → the selector) · **Session length:** ~110 min · **Deck:** `week-2.html` (17 slides)

**Goal of this session:** the room leaves having *searched* both indexes they loaded last weekend — `searchClinicalNotes` implemented by their own hands, the dyspnea payoff run ("patient struggling to breathe" → the right notes, zero shared keywords), the `patientId` filter felt as a privacy boundary, their own `bible-kjv` chunking strategies compared under one shared query, a rerank funnel wired and its silent fallback caught, and a working **selector** — their first agent — routing four kinds of question to the right store(s). They should be able to say *why* the funnel over-fetches, *why* rerank scores aren't cosines, and *why* the selector routes but does not extract.

> This runbook is backstage — say anything here; the slides are what students see. The single idea to protect all session: **retrieval is a pipeline of cheap-then-careful stages, and every stage is a place to be quietly wrong** — the missing filter leaks strangers' charts with no error, the failed rerank returns the original order with no error, the fat selector breaks in two places instead of one. The session's emotional arc is *payoff first* (the dyspnea search, ~35 min in), *paranoia second* (everything after teaches a silent failure mode).

---

## Pre-flight (before the room arrives)

Where the cohort actually is: last weekend everyone ran the FULL `npm run vectorize` live together (21,090 notes, ~15 min) — their `medical-notes` index is loaded. For homework, each student chunked the King James Bible with their **own** strategy into their **own** `bible-kjv` index. **Nobody has queried either index yet.** That's the cliffhanger you open on.

- [ ] Repo cloned, `npm install` done, Node 18+. Students are on the `student` branch, where `lib/vector-search.ts` (`searchClinicalNotes`) and `lib/agents/selector.ts` (`select`) are **stubs that throw** — that's the material. Solutions live on `instructor`; have it checked out somewhere you can peek, not on screen.
- [ ] `.env` sanity — no new keys this week, and say that out loud (it's a slide bullet):
      - `OPENAI_API_KEY` + `OPENAI_BASE_URL` — the LiteLLM proxy. Embeddings and the selector's `gpt-4o-mini` calls both route through it and burn pennies. If a student's key is exhausted/misbehaving, unsetting `OPENAI_BASE_URL` falls back to api.openai.com (their own key) — last resort, not the plan.
      - `PINECONE_API_KEY` — the index **and** the reranker. The hosted `bge-reranker-v2-m3` runs on this same key; no signup, no new bill, no new vendor.
      - `PINECONE_INDEX` — **the sneaky one.** Anyone who set `PINECONE_INDEX=bible-kjv` in `.env` during the chunking homework (instead of per-run) will semantically search *the Bible* for chest pain today. Check yours; warn the room. Unset, it defaults to `medical-notes`.
- [ ] Implement `searchClinicalNotes` yourself the night before, on a scratch branch, from the recipe on slide 5 — so you're live-coding something you've typed once. Same for the selector stub.
- [ ] Save the two scratch scripts from the lessons where you can paste them fast: `scripts/search.ts` (the thin runner from w2-01 — **not shipped**, pasted in class) and the funnel script from w2-02. The routing battery from w2-04 too.
- [ ] Warm the demo: after your own implementation, run the dyspnea query and the funnel once. Grab **one real `patientId`** from Prisma Studio (`npm run db:studio`) and keep it in a note — you need it for the leak demo's "fix" step.
- [ ] Have a rerank "jump" query in your pocket: run the funnel over 4–5 queries the night before and note one where something below #10 gets promoted. Live discovery is great; a guaranteed backup is better.
- [ ] Interactive explainers open in tabs for projection: `visuals/vector-search.html` (during code-together I) and `visuals/reranking.html` (slides 9–11).
- [ ] `week-2.html` open full-screen. Arrow keys / click to navigate, `N` toggles presenter notes.

**Network reality:** this session is many small API calls (embeds, queries, rerank, selector), not one big write like last week — flaky Wi-Fi means retries, not disasters. The one silent hazard: a rerank call that times out *looks like success* (original order back). That's break-it entry 2 — if the room's network is bad you'll teach it involuntarily; know the log line: `Reranking failed, using original order`.

---

## Timed flow (~110 min)

| Time | Arc segment | Slides | What to do |
|---|---|---|---|
| 0:00 | **Cold open — the cliffhanger** | 1–3 | *Two indexes full of vectors, and not one search yet.* Recap what the room did last weekend (full vectorize, live; Bible chunked solo), then open `lib/vector-search.ts` and show the throw: `Not implemented - your turn!`. One function between them and "which patients are struggling to breathe?" (8 min) |
| 0:08 | **Concept — metadata + the in-query filter** | 4 | Filter / cite / debug. The key idea: the filter runs *inside* `index.query` — top-K among only the matching vectors. Post-filtering = "global top 10 minus strangers," a quality bug *and* a safety bug. ~105 notes per patient (max 1,632) is why the filter exists. (7 min) |
| 0:15 | **Code together I — implement `searchClinicalNotes` + the payoff** | 5–6 | ~15 min heads-down from the slide-5 recipe (you last, on screen), then paste `scripts/search.ts` and run *"patient struggling to breathe."* Zero shared keywords, right notes back. Let it land — this is the block's peak. Then the synonym pair. (20 min) |
| 0:35 | **Break it — the `patientId` leak** | 7 | Run "chest pain" with no filter; read the `patientName` column out loud — strangers' charts. Re-run with your pocketed patientId — one person. Not a bad search result; a privacy-boundary violation. (8 min) |
| 0:43 | **Breakout — the Bible debrief** | 8 | Everyone queries their OWN `bible-kjv` index with the same flood query (no *drown/boat/world* in the KJV — it says *flood/ark/earth*). Pairs compare: same query, same embeddings, different chunking, different results. Debrief to "a chunk size is a bet on the questions." Answer key below. (15 min) |
| 0:58 | **Concept — when cosine lies + the funnel** | 9–10 | Template match beats meaning match; embeddings compress *before the query exists*; the reranker reads the pair together. Then the funnel: over-fetch 25 → rerank → keep 5; no new key. Plant the "scores are different universes" warning. (8 min) |
| 1:06 | **Code — run the funnel, then break it quietly** | 11 | Paste the funnel script, run 3–4 queries, find a jump (use your pocketed one if none appears). Then sabotage the model name → same order back, no error, one log line. The second headliner. Resist "it helped!" — no metric, no decision. (12 min) |
| 1:18 | **Concept — structured outputs** | 12 | Brisk. Code can't branch on prose; the four-step pattern (`responses.parse` + `zodTextFormat`, `temperature: 0`, `Schema.parse`). Two beats: required-fields-fabricate, and trust-but-parse. It powers everything from here. (7 min) |
| 1:25 | **Code together II — the selector** | 13–14 | The Plan schema (three fields), four legal routes including *neither*, and the design rule: **route, don't extract** — the SQL specialist re-derives entities better next weekend, schema in hand. Students fill the stub in `lib/agents/selector.ts`. (11 min) |
| 1:36 | **Mini-challenge — the routing battery** | 15 | Four queries → four routes (SQL / vector / both / neither). Add their own + one history-dependent follow-up. Misroute? Fix the prompt, not the caller. (6 min) |
| 1:42 | **Deliverable + recap + tease** | 16–17 | The 🎥: search + rerank their own Bible index, one changed ordering, why over-fetch matters. Recap the four wins. Tease Weekend 3: the SQL agent (an LLM that writes real queries) + the full pipeline. (8 min → ends 1:50) |

Runs long? Compress structured outputs (1:18) to five minutes and cut the battery's "add your own" round — **never** cut the two break-its (the leak, the silent fallback) or the Bible debrief; those are the session. If the room is slow implementing `searchClinicalNotes`, show yours at 0:27 and move on — the payoff run matters more than everyone finishing solo.

---

## Breakout prompt + answer key

**Prompt (slide 8):** "Everyone run the *same* query against your *own* `bible-kjv` index: **'the world drowns and one family builds a boat to survive'** (`topK: 10`). Then, in pairs with someone who chunked *differently*: What came back — verses, chapters, windows? Would a stranger get the flood story from your top 3? What did the other person's index do better — and worse?"

Mechanics: `searchClinicalNotes` maps note-specific metadata, so this runs on a five-line scratch script instead — `createEmbedding(query)` then `index.query({ vector, topK: 10, includeMetadata: true })`, with `PINECONE_INDEX=bible-kjv` set *for the run*, not in `.env` (snippet in Code-together Part II — same skeleton). Students who did the homework via `scripts/bible/chunk-smart.ts` already have every piece.

**The trick in the query:** the KJV flood narrative never says *drown*, *boat*, or *world* — it says *flood*, *ark*, *earth*. It's the dyspnea move again, on their own corpus: zero-keyword retrieval works on 1611 English too.

**What the room should discover (the answer key):**

- **Verse-chunkers** get pinpoint hits — "and the ark went upon the face of the waters" — beautiful citations, *no story*. A single verse rarely "means" the whole event; sometimes their top-3 misses the flood entirely.
- **Chapter-chunkers** get Genesis 7 whole: strong story context, fuzzy citation ("somewhere in this chapter"), and a chunk that also "means" fifty other things — precision suffers on narrow queries.
- **Fixed-window chunkers** land in between — and sometimes a window cuts mid-story, so a top hit *starts* in the ark and *ends* in a genealogy. Incoherence is the cost of ignoring natural seams.
- **The synthesis to land:** same query, same embedding model, same corpus — the only variable is chunking, and the results differ visibly. Nobody's index is "wrong"; each is a **bet on who queries it** (quote-hunters vs story-askers). That's the homework's tiebreaker question, now demonstrated across the room.

**What to listen for:** "my results are worse, I chunked wrong" → reframe as *different bet, different questions served* — then ask what query their chunking would *win* on, and have them run it. An index returning junk or nothing usually means the homework upsert didn't finish or metadata is missing — check the record count in the Pinecone console; don't debug live for more than a minute, pair them with a neighbor.

**Close the loop:** this breakout is a rehearsal for the deliverable — same index, same kind of query, plus the reranker. Say so.

---

## Code-together

Three hands-on pieces. Parts I and III are **stub implementations** (students write real repo code); Part II is a scratch funnel script. All LLM traffic goes through the LiteLLM proxy (`OPENAI_BASE_URL`); costs are pennies.

### Part I — implement `searchClinicalNotes` (slides 5–6)

The stub is in `lib/vector-search.ts`; the recipe is on slide 5 (embed → conditional filter → `index.query` with `includeMetadata: true` → map to `VectorSearchResult`). Give the room ~15 minutes, circulate, then live-code yours. The runner is the lesson's scratch script — paste it as `scripts/search.ts` (it is **not** in the repo):

```typescript
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
    console.log(r.score.toFixed(3), '·', r.patientName);
    console.log('   ', r.contentPreview.slice(0, 120).replace(/\s+/g, ' '), '\n');
  }
}
main();
```

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/search.ts "patient struggling to breathe"
```

- **Expected output:** five notes, scores roughly 0.5–0.6, and the top hits are the breathing notes — "dyspnea on exertion," "shortness of breath," "respiratory distress." Exact scores vary; **the ranking and the zero-keyword overlap are the point.** Say it: the query never says dyspnea, the notes never say struggling to breathe.
- **Then the synonym pair** (pays off the course's first lesson): `"shortness of breath"` and `"trouble breathing"` — overlapping result sets from different phrasings.
- **Then the leak** (slide 7, break-it entry 1): `"chest pain"` with no third argument → many names; with your pocketed patientId → one name.

**Most likely live failures (+ recovery):**
- **`Not implemented - your turn!`** → they ran the runner before finishing the stub. Working as intended; back to the recipe.
- **Every field `undefined` in the output** → `includeMetadata: true` is missing from `index.query`. The classic; it's named on the slide, let them find it.
- **Results are Bible verses** → `PINECONE_INDEX=bible-kjv` left in `.env` from the homework. Best live failure of the day if it happens — search for "chest pain," get Leviticus. Unset it; the default is `medical-notes`.
- **Empty results / error with a filter** → they passed `filter: {}` when no patientIds were given. `{}` and `undefined` are different; build the filter only when there's something to filter on.
- **Empty results everywhere** → their `medical-notes` index never finished last weekend's vectorize. Do not re-run 21k embeds mid-session — pair them with a neighbor and flag for after class.

### Part II — the funnel: over-fetch, rerank, keep 5 (slide 11)

Scratch script (from w2-02) — paste and run against the note index. The adapter step matters: `rerankResults` speaks `lib/pinecone`'s `SearchResult` shape, so map results onto `content` + `score`:

```typescript
import 'dotenv/config';
import { searchClinicalNotes } from './lib/vector-search';
import { rerankResults } from './lib/reranker';

async function main() {
  const query = 'patient struggling to breathe at night';

  // Stage 1: broad — over-fetch deliberately
  const notes = await searchClinicalNotes(query, { topK: 25 });
  const candidates = notes.map((n) => ({
    id: n.id,
    score: n.score,
    content: n.contentPreview,
    metadata: { source: 'note' },
  }));

  // Stage 2: careful — rerank, keep the best 5
  const reranked = await rerankResults(query, candidates, 5);

  console.log('=== vector order (top 5 of 25)');
  for (const r of candidates.slice(0, 5)) console.log(`${r.score.toFixed(3)}  ${r.content.slice(0, 90)}…`);
  console.log('\n=== reranked order');
  for (const r of reranked) console.log(`${r.score.toFixed(3)}  ${r.content.slice(0, 90)}…`);
}
main();
```

- **Expected output:** two five-row lists. Rerank scores are 0–1 but **not cosines** — different universes, never compare across lists. On some queries the order barely moves; on others something from #10–20 jumps into the top 5. Run 3–4 queries until a jump appears (or use your pocketed one).
- **Narrate the funnel width:** stage 1 pulls 25, not 5 — the reranker can only promote what's in the pool. Note the guard in `lib/reranker.ts`: `results.length <= topN` returns the input unchanged, so fetch-5-keep-5 literally does nothing (break-it entry 3).
- **Then the silent fallback** (break-it entry 2): typo the model name, re-run, same order, no error, one log line.
- **The discipline beat:** you watched an order change — that is an *anecdote*. Whether reranking earns its latency and cost on this corpus is a measurement, and the instrument (retrieval evals) is a later week. Resist concluding anything today.

**Most likely live failures (+ recovery):**
- **Reranked list always identical to the original** → the fallback already fired (bad network, key issue). Check the server log for `Reranking failed, using original order` *before* concluding anything — this is the lesson arriving early; embrace it.
- **Fewer than 25 results from stage 1** → fine; if it drops to ≤ 5 the guard no-ops the rerank. Point at the guard, raise `topK`.
- **Type complaints on the candidate mapping** → they skipped the adapter step; the reranker only uses `content` and `score`.

**Bible variant (for the breakout + deliverable):** same skeleton with raw `index.query` instead of `searchClinicalNotes`, run with the env var set inline:

```bash
PINECONE_INDEX=bible-kjv npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/bible-search.ts
```

```typescript
// scripts/bible-search.ts — scratch, ~10 lines
import 'dotenv/config';
import { Pinecone } from '@pinecone-database/pinecone';
import { createEmbedding } from '../lib/openai';

async function main() {
  const query = process.argv[2] ?? 'the world drowns and one family builds a boat to survive';
  const index = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! }).Index(process.env.PINECONE_INDEX!);
  const res = await index.query({ vector: await createEmbedding(query), topK: 10, includeMetadata: true });
  for (const m of res.matches ?? [])
    console.log((m.score ?? 0).toFixed(3), m.metadata?.reference, String(m.metadata?.content).slice(0, 90));
}
main();
```

### Part III — the selector (slides 13–15)

The stub is `lib/agents/selector.ts` — schema and `Plan` type provided; students write the system prompt and `select`. It's yesterday's four-step pattern verbatim: `responses.parse` at `temperature: 0` with `zodTextFormat(PlanSchema, 'plan')`, input = system prompt + `history.slice(-5)` + query, then `PlanSchema.parse`, then map to the `Plan` (`needsSearch = useSql || useRag`, `semanticQuery || query` fallback). A good system prompt is ~20 lines: describe the two stores, one both-stores example, name the general-question case, and the tie-breaker ("when unsure about a records question, prefer the notes").

The battery (scratch script from w2-04):

```typescript
import 'dotenv/config';
import { select } from './lib/agents/selector';

const queries = [
  'How many patients have diabetes?',
  'notes mentioning chest pain at night',
  'what do the notes say about sleep for patients with depression?',
  "what's a normal A1C range?",
];

async function main() {
  for (const q of queries) console.log(`\n${q}\n `, await select(q));
}
main();
```

- **Expected output:** SQL-only, vector-only, both, neither (`needsSearch: false`) — in that order. The neither case short-circuits retrieval entirely; make sure the room hears that it's a *route*, not an error.
- **When a route is wrong:** the fix is a sentence in the system prompt, not code in the caller. Model that live — mis-route, edit one line, re-run.

**Most likely live failures (+ recovery):**
- **Everything routes to vector** → the prompt never says counts/filters/named patients are SQL's job. Add the sentence.
- **"What's a normal A1C range?" routes to a store** → the prompt lacks the general-knowledge carve-out. Add it; re-run.
- **`semanticQuery` comes back as a string for SQL-only questions** → harmless (it's nullable and the mapping falls back to the raw query), but a good moment for the required-fields-fabricate lesson.
- **LiteLLM proxy hiccup / budget exhausted** → selector calls fail loudly (good). Check the key's budget; worst case unset `OPENAI_BASE_URL` for the demo machine only.

---

## Break it / extend bank

Run entries 1 and 2 live — they're the headliners (a privacy leak and a silent no-op, both errorless) — then let the room try 3 and 4.

**1. The `patientId` leak — strangers' charts in a one-patient question (slide 7).**
- **Sabotage:** ask a patient-scoped question with no filter: `scripts/search.ts "chest pain"` (no patientId argument). Read the `patientName` column out loud.
- **Expected failure:** hits from many different patients. You asked about one chart and got fragments of strangers' charts. In a clinical product that's not a bad search result — it's a **patient-privacy boundary violation**, and nothing errored.
- **Fix:** pass the id: `scripts/search.ts "chest pain" <patientId>` → every hit is one person. Under the hood the filter goes *inside* `index.query`, so other patients' note content never even transits your app code.
- **Extend:** contrast with post-filtering (`.filter()` on the results): quality bug (global top-10 minus strangers, often zero relevant) *and* the strangers' data already left the database. This is why `patientId` had to be metadata at vectorize time. Foreshadow: the same filter, forgotten, is a planted bug in a later week's hybrid path.

**2. The silent rerank fallback — a bogus model name changes nothing, loudly says nothing (slide 11).**
- **Sabotage:** in `lib/reranker.ts`, change `RERANK_MODEL` to `"bge-reranker-v2-m3-TYPO"` and re-run the funnel.
- **Expected failure:** *none visible.* The reranked list equals the vector order, exit code 0, no throw — just `Reranking failed, using original order: …` in the log. The catch block returns `results.slice(0, topN)` by design: degraded search beats no search.
- **Fix:** restore the model name; confirm the orders diverge again. Then the real lesson: **if your two lists are always identical, check the log line before concluding "reranking does nothing."** A network blip fails exactly the same way.
- **Extend:** debate the design. Soft-fail keeps the product answering during a vendor outage; it also means a quiet quality regression (a drop in hit@5 nobody notices). What would you want in production — a metric on rerank-failure rate? An alert? This is Week 3's observability lesson knocking.

**3. Fetch 5, rerank 5 — the funnel with no mouth.**
- **Sabotage:** set stage 1 to `topK: 5` and keep `topN: 5`.
- **Expected failure:** the "reranked" list is byte-identical to the input — and not because the reranker agreed: the `results.length <= topN` guard in `lib/reranker.ts` returns the input without paying for a rerank at all. No promotion is possible when the pool is the keep.
- **Fix:** restore `topK: 25`. The reranker's power is *promotion from depth*; a note cosine ranked #19 can only be rescued if the funnel mouth includes it.
- **Extend:** widen to `topK: 100` and watch latency/cost intuitions kick in — per-candidate pricing, one more remote call. The right width depends on how often cosine buries relevant notes *in this corpus* — a measurable question (later week). Common production start: rerank 3–5× the K you keep.

**4. The schema that demands fiction (structured outputs).**
- **Sabotage:** in a scratch copy of the selector (or the w2-03 ticket extractor), make a field the input can't supply — e.g. remove `.nullable()` from `semanticQuery`, then route `"How many patients have diabetes?"`; or add `flightNumber: z.string()` to the ticket schema.
- **Expected failure:** no error — an *invention*. The model fabricates a plausible value wearing a perfectly valid type, and it flows downstream silently.
- **Fix:** make the schema match reality: `nullable()` where absence is real, enums where the answer set is closed, `.describe()` where judgment lives.
- **Extend:** drop `temperature: 0` from the selector and run the same borderline question five times — watch the route wobble. A router that routes the same question differently on Tuesday isn't a component, it's a coin. Both knobs (nullability, temperature) are the difference between "LLM as typed function" and "LLM as vibes."

---

## Misconceptions to preempt

- **"Filtering after the query is the same thing."** No — the index finds top-K among *only* matching vectors. Post-filtering gives "the global top 10 minus strangers" (often zero relevant notes) *and* strangers' data has already left the database. In-query filtering is both the quality fix and the privacy boundary.
- **"The reranker's 0.91 beats the cosine's 0.58."** Different models, different scales, different meanings. Rerank scores and cosines are from different universes; the only valid comparison is order *within* one list.
- **"The order changed, so reranking helped."** "Changed" and "better" are different claims — the second needs ground truth about which notes are actually relevant, and nothing built so far knows that. No metric, no decision; the measuring instrument (retrieval evals) is a later week. Also the inverse trap: "the lists are identical, reranking is useless" — check the silent-fallback log line first.
- **"The selector should extract the entities while it's in there."** The SQL specialist re-derives them *better* next weekend because it holds the database schema; the selector extracts blind. A fat selector adds a second failure mode to every question. Route only — `semanticQuery` survives the test because nothing downstream re-derives it.
- **"Both booleans false means the router failed."** It's the correct route for greetings and general knowledge ("what's a normal A1C range?"). Forcing every message into a store drags irrelevant patient records into answers that never needed them. Refusing to route *is* a route.
- **"'Please respond in JSON' is basically the same as a schema."** A request vs a constraint. Fences, preambles, missing fields, and invented enum values all appear eventually — in production, not in the demo. And `Schema.parse` on top isn't redundant: it turns drift/refusals/truncation into one loud error at the call site.

---

## Deliverable 🎥 (end of week)

A **2–3 min video** (phone is fine), specced in w2-02's Deliverable section: run the funnel against **your own `bible-kjv` index** — embed the query, `index.query` with a wide `topK` (`PINECONE_INDEX=bible-kjv` for the run), then `rerankResults`. It must show:

- one **semantic search** and the same query **reranked** (over-fetch ~25, keep 5), side by side;
- **one query where reranking changed the order** — ideally a chunk promoted from deep in the pool — with the student saying *why* the two models disagreed;
- **why the funnel over-fetches**, in their own words: what happens to a relevant chunk cosine ranked #19 if stage 1 only fetches 5?

**Grade against one question:** *does the video show a promotion the reranker made from below the cut, and can they explain why over-fetching is what made it possible?* Two identical lists with no explanation is a run, not an understanding. And if their lists never differ, the honest move is to check the silent-fallback log line **on camera** and say so — catching the no-op is worth more than hiding it.

**Submit:** the Typeform link in w2-02 (placeholder until the real URL is minted).

---

## Materials

- Deck: `curriculum/slides/week-2.html` (17 slides)
- Lessons this session runs on (ground truth for every claim):
  - `curriculum/w2-01-semantic-search.md` — `searchClinicalNotes`, the in-query filter, the leak
  - `curriculum/w2-02-reranking.md` — the funnel, the silent fallback, the deliverable spec
  - `curriculum/w2-03-structured-outputs.md` — the four-step typed-function pattern
  - `curriculum/w2-04-selector.md` — the Plan schema, route-don't-extract, the battery
- Real code the demos are grounded in (read live if asked):
  - `lib/vector-search.ts` — the `searchClinicalNotes` stub students implement (the `patientId` filter lives here)
  - `lib/reranker.ts` — `rerankResults`: Pinecone-hosted `bge-reranker-v2-m3`, the `length <= topN` guard, the soft-fallback catch
  - `lib/agents/selector.ts` — the selector stub: `PlanSchema`, the `Plan` type, `select`
  - `lib/openai.ts` — `createEmbedding` (`text-embedding-3-small`, 1536 dims) + the `OPENAI_BASE_URL` proxy wiring
  - `lib/pinecone.ts` — the `SearchResult` shape the reranker speaks
- Scratch scripts pasted in class (not shipped): `scripts/search.ts` (w2-01), the funnel script (w2-02), `scripts/bible-search.ts` (printed above), the routing battery (w2-04)
- Interactive explainers for projection: `visuals/vector-search.html`, `visuals/reranking.html`
- Data facts to have on hand: **200 patients**, **21,090 notes**, **~938 chars avg**, **~105 notes per patient on average** (max **1,632**). Each student has two indexes: `medical-notes` (built live last weekend) + `bible-kjv` (their own chunking homework).
- Env this session needs: `OPENAI_API_KEY` + `OPENAI_BASE_URL` (LiteLLM proxy), `PINECONE_API_KEY` (index **and** reranker — no new key), `PINECONE_INDEX` unset or `medical-notes` (watch for a leftover `bible-kjv`).
