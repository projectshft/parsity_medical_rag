# Week 3 — Embeddings & vector search · Facilitator Runbook

**Block:** Embeddings & vector search · **Days covered:** 13–18 · **Session length:** ~110 min · **Deck:** `week-3.html`

**Goal of this session:** the room leaves able to explain *why* meaning-based search works (embeddings → cosine → geometry that replaces the synonym table), having run a vector search by hand and a real one over clinical notes — and they understand the spine rule that lands Friday: **no metric, no decision.** You can't claim reranking helped without an eval, which is the Day 18 deliverable.

> This runbook is backstage. Say anything here; the slides are what students see. You do **not** need to have built the system to run this — Pre-flight and Code-together assume you're coming in cold.

---

## Pre-flight (before the room arrives)

- [ ] Repo cloned on the **`student`** branch, `npm install` done.
- [ ] `.env` filled with **three** keys this week: `OPENAI_API_KEY` (embeddings), `PINECONE_API_KEY` (the index), and `COHERE_API_KEY` (reranking — free trial tier is enough). Missing the Cohere key is the headline live failure; have it set, but know what its absence looks like (below).
- [ ] **A populated note index.** Run `npm run ingest -- --limit 50` once yourself before class so the `medical-notes` index has real clinical-note vectors. Confirm in the [Pinecone console](https://app.pinecone.io): index `medical-notes`, dimension **1536**, metric **cosine**, non-zero vector count. The first ~30 min of the deck don't need it, but everything from slide 11 on does.
- [ ] Two terminals open in the repo: one for scratch scripts, one for `npm run db:studio` (you'll grab a real `patientId` live).
- [ ] A scratch file ready to paste into — scripts run with `npx ts-node --compiler-options '{"module":"CommonJS"}' scratch.ts`.
- [ ] `week-3.html` open full-screen. Arrow keys / click to navigate.

If a laptop can't reach Pinecone or OpenAI, pair up — the by-hand and ladder demos survive one working machine between two people.

---

## Timed flow (~110 min)

| Time | Arc segment | Slides | What to do |
|---|---|---|---|
| 0:00 | **Problem statement** | 1–3 | Cold open on the promise we've deferred since Week 1: "trouble breathing" must find a note that says "shortness of breath," zero shared words. No synonym table did that. Sit in the gap before naming embeddings. |
| 0:08 | **High-level concept** | 4 | Embedding = text → point in space; cosine = "do they point the same way?" Land that cosine is a normalized dot product, and the geometry *is* the learned synonym dictionary. |
| 0:18 | **Practical example** | 5 | The ladder, with the real numbers (0.701 / 0.327 / 0.163). The zero-shared-keyword pair at 0.701 is the whole reason engine two exists. |
| 0:25 | **The honest limit** | 6 | Watch it lie: knee-pain sentence (0.622) beats dyspnea (0.597) on a shared template. Plant that two later pieces — filter-before, second-opinion-after — exist for this. |
| 0:32 | **Discussion / breakout** | 7 | "Is 0.6 a good score?" Breakout if >8 people. Debrief with the answer key below — drive to *relative, not absolute*. |
| 0:45 | **Code together (by hand)** | 8 | Be the vector database: embed a tiny corpus, embed a query, `map → sort → take top`. "Caring for the people around you" ranks "Love your neighbour" first. *This loop is what Pinecone does.* |
| 0:58 | **Concept: why pay for it** | 9 | Only two reasons: persistence + speed at scale. Two permanent index params: dims 1536, metric cosine. |
| 1:05 | **Code together (real notes)** | 10–11 | `npm run ingest -- --limit 50` (already done in pre-flight — show the log), then `searchClinicalNotes`. Run the Day 1 payoff queries live. Land the in-query filter = privacy boundary. |
| 1:18 | **Concept + break-it: hybrid** | 12 | Facts narrow the world, meaning ranks what's left — SQL first, vectors second. Run the empty-filter privacy break (bank #2) live. |
| 1:28 | **Mini-challenge: controls** | 13 | Turn them loose: hybrid + vector-only control, count the strangers in the global top-10. |
| 1:38 | **Concept + code: reranking** | 14–15 | The funnel. Wire it live; trip the silent Cohere fallback (bank #1) so they see it once. |
| 1:48 | **Spine rule + deliverable** | 16–17 | "No metric, no decision." Frame the eval set as the instrument; "is 73% good?" → *compared to what?* |
| 1:55 | **Recap + send-off** | 18–19 | The two-meanings-of-hybrid research question (dense+sparse) + Friday deliverable framing + light forward ref: next block the LLM routes questions automatically. |

Runs long? The compressible segments are the ladder (0:18) and the why-pay concept (0:58) — **never** the by-hand code-together (0:45) or the eval-set spine landing (1:48). If you must cut a break-it, keep the empty-filter privacy one.

---

## Breakout prompt + answer key

**Prompt (slide 7):** "A teammate hardcodes 'only show results scoring above 0.6.' Argue: what's wrong with the question 'is 0.6 good?' to begin with? A gibberish query still returns top matches — at what score, and what should the system do with that? And if you can't trust an absolute threshold, how would you *ever* know your search is any good?"

- **"Is 0.6 good?" is malformed** — cosine has no absolute calibration; it depends on the model, text length, domain, even boilerplate. The only well-formed question is "did the *right* document outrank the *wrong* ones for this query?" Scores are meaningful **only relative to other candidates for the same query**.
- **The gibberish query** ("how do I file my taxes" against clinical notes) still returns its K nearest neighbors — at visibly lower scores, but **not zero**, and with no universal threshold separating "real match" from "best of a bad lot." The retrieval layer *cannot* say "nothing matched"; something downstream must decide that.
- **How would you know it's good?** — this is the trap door. There's no answer from scores alone; you need ground truth — known-correct (query, expected) pairs. That's Friday's deliverable, seeded here. **Don't resolve it** — let the room feel they can't answer the third bullet yet.

**What to listen for:** anyone reaching for "just pick a higher threshold" is walking into the wall on purpose — that instinct is exactly what the eval set dismantles. The students who say "good *compared to what?*" already get it.

---

## Code-together

### Part A — be the vector database by hand (slide 8)

Paste into a scratch script, run with `npx ts-node --compiler-options '{"module":"CommonJS"}' scratch.ts`:

```typescript
import 'dotenv/config';
import { createEmbedding, createEmbeddings } from './lib/openai';

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function main() {
  const corpus = [
    'In the beginning God created the heaven and the earth.',
    'Love your neighbour as yourself.',
    'Thou shalt not steal.',
    'The Lord is my shepherd; I shall not want.',
    'Blessed are the peacemakers.',
  ];
  const docVectors = await createEmbeddings(corpus);
  const query = 'caring for the people around you';
  const queryVector = await createEmbedding(query);
  const ranked = corpus
    .map((text, i) => ({ text, score: cosine(queryVector, docVectors[i]) }))
    .sort((a, b) => b.score - a.score);
  console.log(`query: "${query}"\n`);
  for (const r of ranked) console.log(`${r.score.toFixed(3)}  ${r.text}`);
}
main();
```

- **Narrate:** the corpus is embedded **once**; the query is embedded once; the rest is `map` to a score, `sort` descending, take the top. There is no extra magic in a vector database — just persistence and speed.
- **Expected output:** "Love your neighbour as yourself." ranks **first**, despite sharing zero words with the query. The other four trail it.
- **Most likely live failure:** `OPENAI_API_KEY` missing/invalid → the `createEmbeddings` call throws an auth error. It's the key, not the code. Second most likely: `ts-node` module error → make sure the `--compiler-options '{"module":"CommonJS"}'` flag is on the command.

### Part B — real semantic search (slides 10–11)

```bash
npm run ingest -- --limit 50          # embeds + upserts real notes (run in pre-flight; show the log)
```

Then run the Day 1 payoff against your implemented `searchClinicalNotes` (`lib/vector-search.ts`):

```typescript
import 'dotenv/config';
import { searchClinicalNotes } from './lib/vector-search';
async function main() {
  for (const q of ['shortness of breath', 'trouble breathing']) {
    const results = await searchClinicalNotes(q, { topK: 5 });
    console.log(`\n=== ${q}`);
    for (const r of results)
      console.log(`${r.score.toFixed(3)} ${r.patientName} (${r.date}) — ${r.contentPreview.slice(0,100)}…`);
  }
}
main();
```

- **Narrate:** two phrasings, zero shared keywords, **overlapping notes** surface. The Week 1 promise is now their code.
- **Expected output:** both queries return 5 notes each; you can see the same patient/notes appearing across both lists.
- **Most likely live failure:** empty results / all-`undefined` fields → either the index wasn't populated (pre-flight!), `includeMetadata: true` was omitted in their implementation, or Pinecone's eventual consistency means a fresh upsert isn't searchable yet (wait a few seconds, retry). If they get ids+scores but no text, it's the missing `includeMetadata`.

---

## Break it / extend bank

Run at least the silent-fallback and the empty-filter privacy bug live — both are this block's signature failure modes.

**1. The silent rerank fallback (the headline one).**
- **Sabotage:** comment out / unset `COHERE_API_KEY`, then run the funnel (`searchChunks(query, 25)` → `rerankResults(query, candidates, 5)`).
- **Expected failure:** **no error.** The reranked list comes back *identical* to the vector order. `rerankResults` in `lib/reranker.ts` deliberately returns the original order if the call fails — degraded search beats no search — so a missing key fails into a silent no-op.
- **Fix:** restore the key. Reranked order now differs from cosine order on at least some queries.
- **Extend:** make the fallback *loud* — have it `console.warn` when it falls back, and discuss the real tradeoff: silent degradation keeps the app up but hides a broken feature. Where would you want loud vs quiet? (Foreshadows Week 5 observability.)

**2. The empty-`patientIds` filter privacy bug (from Day 16).**
- **Sabotage:** run a hybrid where step 1 returns nothing — e.g. `getPatientIdsByConditions(['asthmaa'])` (typo) or a condition the mapping misses → `patientIds = []`. Pass that straight into `searchClinicalNotes(query, { patientIds: [] })`.
- **Expected failure:** **plausible-looking results from every patient.** An empty array hits the `if (patientIds && patientIds.length > 0)` guard as false → **no filter built** → it searches the whole corpus. This is a *privacy* bug, not a relevance bug: it returns strangers' notes while looking like it worked.
- **Fix:** guard explicitly — if step 1 returns `[]`, return `[]` (no patients matched ≠ search everyone). Show the `if (patientIds.length === 0) return [];` early-out from the Day 16 hybrid.
- **Extend:** add a control count — log how many of the results fall outside the intended cohort. The habit of producing the number is the point; plausible-but-wrong is beaten by counts, never by staring harder.

**3. Reranking with no over-fetch.**
- **Sabotage:** fetch 5 and rerank 5 (`searchChunks(query, 5)` → `rerankResults(query, candidates, 5)`).
- **Expected failure:** the "reranked" list is the same 5 results, merely shuffled — the reranker has no depth to promote from.
- **Fix:** over-fetch — fetch 25, keep 5. A relevant note buried at #19 by cosine is invisible unless the funnel mouth is wide enough to include it.
- **Extend:** sweep the funnel width (10 / 25 / 100) on one query and watch what gets rescued vs what it costs (latency, per-candidate price). Note you can't *judge* which width is right without an eval — straight into Day 18.

**4. The *other* hybrid: dense + sparse (BM25) — would it help here? (advanced/optional, slide 19.)**
- **Sabotage (thought experiment, not code):** propose bolting a sparse/BM25 keyword score onto the vector side to "catch exact terms" — a drug name, a lab code like `HbA1c`, an acronym.
- **Expected failure:** you'd be re-solving a problem **Postgres already owns**. Exact facts live in structured columns and get a `WHERE` clause; sparse-dense fusion also forces a specific metric and needs a keyword encoder kept in sync with the corpus. It double-pays for the exact-match half this system already has.
- **Fix/judgment:** "hybrid" is *two-of-something* — two **engines** (ours: Postgres + vectors) or two **scores** (dense + sparse). Whether the second thing is another engine or another score depends on **where your exact-match signal already lives**. Here it lives in Postgres, so we don't need sparse vectors.
- **Extend:** name the one honest seam where sparse *would* earn its place — a term that appears **only in free-text notes, never as structured data** (a symptom phrase; a drug mentioned in a note but never coded into the medications table). SQL can't see it (not a column) and dense search can fuzz the exact string. Note that reranking is the lighter-weight alternative most teams reach for there first. Keep this as the honest optional-advanced note it is — it does **not** rewire the core two-engine hybrid story.

---

## Misconceptions to preempt

- **"A cosine score of 0.6 means a good match."** No — cosine has no absolute calibration. Scores are meaningful only *relative to other candidates for the same query*. Hardcoding a threshold off vibes is the trap slide 7 is built to spring.
- **"A vector database is doing something magical / more than my loop."** It does exactly the by-hand loop (embed query → score against stored vectors → top-K). It adds **only** persistence and speed-at-scale. If they can say that, they own vector search.
- **"The order changed, so reranking helped."** "Changed" ≠ "got better." Better needs ground truth. This is the spine rule — *no metric, no decision* — and resisting the conclusion until Friday's eval exists is the discipline being taught.
- **"Filter the vector results in JavaScript afterward — same thing."** Not the same: post-filtering gives "the global top-K minus strangers" (often empty) and leaks other patients' note content through your app code. The filter belongs **inside** `index.query` — quality reason and safety reason.
- **"Run the vector search first, then keep the matching patients."** Backwards. Exact filters narrow the world; semantic search ranks what's left. A fact is a `WHERE`, not a similarity score — and the over-fetch math fails quietly the other way around.

---

## Deliverable 🎥 (Friday, Day 18)

A strong 2–3 min video walks through the **retrieval eval set the student built — and what it measured.** They should show:

- The eval set itself: 15+ (query, expected) pairs read from *their own* corpus, queries in the **user's** vocabulary (not the note's verbatim wording).
- The number: **hit@5** for vector-alone vs vector+reranker, side by side.
- The judgment: does the reranker stay in their system, and **what would change their mind** (a different corpus? more eval cases? a latency budget?). Either that, or the teach-back: why "the search feels better" is not evidence, using one real eval query as the example.

**Grade against one question:** when asked *"is your hit@5 good?"*, do they answer **"compared to what?"** — and point to the second configuration's number? If yes, they own the spine rule: evals create *differences*, not grades. If they recite a percentage as a grade, they don't yet. Bonus signal: they kept a few pairs they never tuned on (didn't memorize the test) and can name the single failed case that taught them the most.

---

## Materials

- Student day files this anchors: `day-13.md` … `day-18.md`
- Deck: `week-3.html`
- Code touched live: `lib/openai.ts` (`createEmbedding`/`createEmbeddings`), `lib/pinecone.ts` (`ensureIndexExists`, `upsertChunks`, `searchChunks`), `lib/vector-search.ts` (`searchClinicalNotes`), `lib/reranker.ts` (`rerankResults`); ingest via `npm run ingest -- --limit 50`.
- Eval artifacts the deliverable produces: `eval/retrieval-set.json`, `eval/run-retrieval-eval.ts` (both go in git — the eval set is data, and it's valuable; it's the seed of the regression suite later weeks build on).
- Further reading the keen students will have hit: 3Blue1Brown "Vectors, what even are they?" and "Dot products and duality"; Cohere rerank docs; Anthropic "Contextual Retrieval" (note its headline numbers stack contextual chunks *with* reranking — production retrieval is a measured stack of techniques).
