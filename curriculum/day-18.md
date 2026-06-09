# Day 18 — Build Day: Your Retrieval Eval Set

**Needs: everything from this block, working**

## Today you will

- Build the measuring instrument: a query → expected-result eval set for *your* data
- Score your retrieval with it — then answer yesterday's open question with a number
- Record this block's deliverable video

This is a **build day**, and it's the most important one in the course so far. Search that *feels good* is the most dangerous kind of working code: it demos beautifully and fails silently. Today you stop feeling and start measuring.

## Concept

A retrieval eval is embarrassingly simple machinery:

1. A list of **(query, expected)** pairs — questions with known-correct answers *in your corpus*
2. Run each query through search
3. Count how often the expected result appears in the top K — the metric is called **hit rate @ K**

```
hit@5 = (queries where an expected note appeared in the top 5) / (total queries)
```

That's it. No statistics degree required. The hard part isn't the math — it's the honesty of the pairs. Where does "known-correct" come from? **From you, reading your own data.** You'll open real notes, find what they discuss, and write queries that those notes should answer. The instrument is only as good as this groundwork — which is exactly why the engineer who built the search has to be the one who reads the corpus.

> **Why hit rate and not something fancier?** Real retrieval research uses richer metrics (MRR, nDCG — they also credit *where* in the top K the hit landed). Hit@K is the right starting instrument because every part of it is inspectable by eye: when a query misses, you look at what came back instead and *learn something*. Graduate to fancier metrics when hit rate stops discriminating between your options — not before.

## Implementation

### 1. Build the eval set — 15 pairs minimum

Open Prisma Studio (`npm run db:studio`) and your search scratch scripts. For each pair, the workflow is:

1. Pick a patient; read 2–3 of their notes (search with their `patientId` filter and a neutral query, or pull content previews)
2. Find something concrete a note discusses — a symptom, an event, a treatment
3. Write a query a *user* would type for it — **in different words than the note uses** (queries that quote the note verbatim test nothing)
4. Record the pair

Store them as data, not prose — `eval/retrieval-set.json`:

```json
[
  {
    "query": "patient having trouble sleeping",
    "expectPatientId": "abc-123",
    "note": "note text says 'reports difficulty falling asleep, wakes frequently'"
  }
]
```

Include the two queries you saved yesterday (the rescue case and the no-change case). Mix difficulties: some pairs where the note's wording is close to the query, some where only meaning connects them, a couple of hybrids (condition + symptom).

### 2. Write the harness

A scratch script that's yours to keep — `eval/run-retrieval-eval.ts`:

```typescript
import 'dotenv/config';
import * as fs from 'fs';
import { searchClinicalNotes } from '../lib/vector-search';

type EvalCase = { query: string; expectPatientId: string; note?: string };

async function main() {
  const cases: EvalCase[] = JSON.parse(fs.readFileSync('eval/retrieval-set.json', 'utf-8'));
  const K = 5;
  let hits = 0;

  for (const c of cases) {
    const results = await searchClinicalNotes(c.query, { topK: K });
    const hit = results.some((r) => r.patientId === c.expectPatientId);
    if (hit) hits++;
    console.log(`${hit ? '✓' : '✗'}  ${c.query}`);
  }

  console.log(`\nhit@${K}: ${hits}/${cases.length} = ${((100 * hits) / cases.length).toFixed(0)}%`);
}
main();
```

Run it. Whatever number comes out — 60%, 80%, 93% — **that is your system's first real quality measurement.** Write it in your notes with the date. Every retrieval change you ever make to this system now has a before/after.

### 3. Answer yesterday's question

Now the payoff. Modify the harness (or copy it) to run the funnel — over-fetch 25, rerank, keep 5 — and score the *same* eval set:

| configuration | hit@5 |
|---|---|
| vector search alone | your number |
| vector search + reranker | your number |

You now know something about rerankers **that no tutorial could have told you**, because it's a fact about your corpus, your queries, and your eval set. Maybe it's +20 points. Maybe it's ±0 and the reranker is latency you don't need. Both findings are wins — *the decision now has a basis.*

### Common mistakes

- **Verbatim queries.** Copying the note's phrasing into the query inflates every score and tests only that the database can find itself. The eval must encode the *user's* vocabulary, not the corpus's.
- **Only easy cases.** If every pair is a layup, every configuration scores 100% and the instrument can't discriminate. You *want* some misses — misses are where tuning decisions come from.
- **Tuning on the eval until it's perfect.** The eval is an instrument, not a target. If you adjust the system specifically to fix case #7, you've started memorizing the test. Keep a few pairs you never look at while tuning, and check them last.
- **Throwing the harness away.** This script is the seed of the regression suite this course keeps building toward. It goes in git (the eval set too — it's data, and it's valuable).

## Your turn

This *is* the your-turn: 15+ pairs, the harness, both configurations scored, and the table in your notes. Spend **no more than 30 minutes** reading failures before drawing conclusions — then write three sentences: what's your hit@5, did reranking earn its place, and which failed case taught you the most?

## Check yourself

- You're done when the table above has your two numbers and a dated entry in your notes.
- Someone asks: "is 73% hit@5 good?" What's the only honest answer?

<details>
<summary>Solution / discussion</summary>

**"Is 73% good?"** — the honest answer: *compared to what?* A number means nothing in isolation; it means everything next to the same number for a different configuration, or for last month's system. Evals create *differences*, not grades. (Sound familiar? It's the same lesson as cosine scores: relative, not absolute.)

**What typical results look like on this corpus:** vector-only usually lands in the 60–85% range depending on how adversarial your phrasings are. Reranking on a 15-case set commonly moves hit@5 by ±1–2 cases — which is the moment to notice that **15 cases is a small instrument**: one case is ~7 points. That's not a flaw in your work; it's a fact about instrument resolution that you now understand from the inside. Production eval sets grow to hundreds of cases precisely so that small real effects aren't drowned by noise. Grow yours as the course continues — every bug you fix and every weird query you meet is a candidate pair.

**Reading a miss:** when a case fails, look at what *did* come in the top 5. Usually one of: the expected note exists but ranks #8 (a ranking problem — reranking/over-fetch may fix it), the query's vocabulary is too far from anything in the corpus (an embedding limit), or — most common — your expected answer wasn't actually the best answer in the corpus and the system found a better one (an eval bug; fix the pair, thank the system).

</details>

## Deliverable 🎥

Record **2–3 minutes**, phone camera is fine. Pick one:

- **Defend with the number:** Present your eval table. State whether the reranker stays in your system and why — and name what would change your mind (a different corpus? more eval cases? latency budget?).
- **Teach back:** Explain to a non-engineer why "the search feels better" is not evidence, and what you built today instead — using one real query from your eval set as the example.

**Submit:** [Typeform — submission](https://form.typeform.com/to/PLACEHOLDER-DAY18) <!-- PLACEHOLDER: replace with real Typeform URL -->

## Rest day next

Look at what exists now: two retrieval engines, a hybrid pattern joining them, a second-opinion reranker, and — above all — **an instrument that turns retrieval opinions into retrieval facts.** Tomorrow is a rest day. When you return: the system learns to read the *user's* mind — taking a raw question and deciding, automatically, which of your engines should answer it.

## Further reading (optional)

- [Pinecone: evaluating retrieval](https://www.pinecone.io/learn/offline-evaluation/) — the fancier metrics (MRR, nDCG), for when hit rate stops being enough
