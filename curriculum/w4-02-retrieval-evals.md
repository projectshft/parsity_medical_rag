# Retrieval Evals: hit@5, Compared to What

**Needs: vector search working; `OPENAI_API_KEY` and `PINECONE_API_KEY` in `.env` — the reranker runs on the same Pinecone key, no extra account needed**

## Today you will

- Build the measuring instrument: a set of *(query, expected-note)* pairs drawn from your own corpus
- Score your retrieval with it — a real quality number, not a feeling
- Score it **twice** — vector search alone, then vector + reranker — and answer the reranker question the search block left open

## Concept

A trace explains *one* answer. It cannot tell you whether the system is any *good* — that's the second question you couldn't defend yet, and it needs a different instrument. Search that *feels good* is the most dangerous kind of working code: it demos beautifully and fails silently. Today you stop feeling and start measuring.

A retrieval eval is embarrassingly simple machinery:

1. A list of **(query, expected)** pairs — questions with a known-correct note *in your corpus*
2. Run each query through search
3. Count how often the expected note appears in the top K — the metric is **hit rate @ K**

```
hit@5 = (queries where an expected note appeared in the top 5) / (total queries)
```

That's the whole thing. No statistics degree. The hard part isn't the math — it's the honesty of the pairs. Where does "known-correct" come from? **From you, reading your own data.** You open real notes, find what they discuss, and write queries those notes should answer. The instrument is only as good as this groundwork, which is exactly why the engineer who built the search has to be the one who reads the corpus.

> **Why hit rate and not something fancier?** Real retrieval research uses richer metrics (MRR, nDCG — they also credit *where* in the top K the hit landed). Hit@K is the right first instrument because every part of it is inspectable by eye: when a query misses, you look at what came back instead and *learn something*. Graduate to fancier metrics when hit rate stops discriminating between your options — not before.

## Implementation

### 1. Build the eval set — 15 pairs minimum

Open Prisma Studio (`npm run db:studio`) and a scratch search script. For each pair:

1. Pick a patient; read 2–3 of their notes (search with a `patientIds` filter and a neutral query, or pull content previews)
2. Find something concrete a note discusses — a symptom, an event, a treatment
3. Write the query a *user* would type for it — **in different words than the note uses.** A query that quotes the note verbatim tests nothing but whether the database can find itself.
4. Record the pair, keyed on the note's `patientId`

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

Mix difficulties: some pairs where the note's wording is close to the query, some where only *meaning* connects them (the "shortness of breath" vs "dyspnea" gap from the first day), a couple of hybrids (condition + symptom). If every pair is a layup, every configuration scores 100% and the instrument can't discriminate. You *want* some misses — misses are where decisions come from.

### 2. Write the harness

A scratch script that's yours to keep — `eval/run-retrieval-eval.ts`. It leans on `searchClinicalNotes` from `lib/vector-search`, which returns results carrying a `patientId`:

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

Run it. Whatever number comes out — 60%, 80%, 93% — **that is your system's first real quality measurement.** Write it in your notes with the date. Every retrieval change you make from now on has a before/after.

### 3. Score it a second time — with the reranker

Now the payoff. The reranker (`rerankResults` in `lib/reranker.ts` — Pinecone's hosted `bge-reranker-v2-m3`, on the same `PINECONE_API_KEY`) re-orders a wide candidate list using a second model that reads query and document *together*. It only helps if you **over-fetch** first — hand it 25 candidates, keep the best 5 — because a relevant note buried at #19 by cosine is invisible unless the funnel mouth is wide enough to include it before the reranker gets a look. (Fetch 5 and rerank 5 and the reranker early-returns unchanged: there's no depth to reorder.)

Copy the harness and swap the search path to over-fetch then rerank, scoring the *same* eval set. `rerankResults` takes the `SearchResult` shape from `lib/pinecone` (it reranks on `.content`), so adapt what `searchClinicalNotes` returns:

```typescript
import { searchClinicalNotes } from '../lib/vector-search';
import { rerankResults } from '../lib/reranker';

const candidates = await searchClinicalNotes(c.query, { topK: 25 }); // wide funnel mouth
const top5 = await rerankResults(
  c.query,
  candidates.map((r) => ({
    id: r.id,
    score: r.score,
    content: r.contentPreview,
    metadata: { patientId: r.patientId, source: 'clinical-note' },
  })),
  5 // keep the best 5
);
const hit = top5.some((r) => r.metadata.patientId === c.expectPatientId);
```

One trap to know before you read your numbers: `rerankResults` fails **soft** — if the Pinecone rerank call errors, it logs `Reranking failed` and returns the original vector order. Two identical rows in your table can mean "reranking doesn't help here" *or* "reranking never actually ran." Check the console before you conclude anything.

Fill in the table:

| configuration | hit@5 |
|---|---|
| vector search alone | your number |
| vector search + reranker | your number |

You now know something about rerankers **no tutorial could have told you**, because it's a fact about *your* corpus, *your* queries, and *your* eval set. Maybe it's +16 points. Maybe it's ±0 and the reranker is latency you don't need. Both findings are wins — *the decision now has a basis.*

### "Is 73% good?"

Someone will ask. The only honest answer is: **compared to what?** A number means nothing in isolation. It means everything next to the same number for a different configuration, or for last month's system. (*Illustrative:* vector alone 73% → vector + reranker 89% — your numbers will differ.) An eval doesn't hand you a *grade*. It hands you a *difference*. That's the whole discipline in one sentence.

### Common mistakes

- **Verbatim queries.** Copying the note's phrasing into the query inflates every score and tests only that the database can find itself. Encode the *user's* vocabulary, not the corpus's.
- **Only easy cases.** All layups → every configuration scores 100% → the instrument can't tell your options apart. Some misses are the point.
- **Tuning on the eval until it's perfect.** The eval is an instrument, not a target. Adjust the system specifically to fix case #7 and you've started memorizing the test. Keep a few pairs you never look at while tuning, and check them last.
- **Throwing the harness away.** This script is the seed of the regression suite the course keeps building toward. It goes in git — the eval set too. It's data, and it's valuable.

## Your turn

This *is* the your-turn: 15+ pairs, the harness, **both** configurations scored, the table filled in your notes. Spend **no more than 30 minutes** reading failures before drawing conclusions — then write three sentences: what's your hit@5, did reranking earn its place, and which failed case taught you the most?

## Check yourself

- You're done when the table above has your two numbers and a dated entry in your notes.
- Someone asks: "is your 73% hit@5 good?" What's the only honest answer?

<details>
<summary>Solution / discussion</summary>

**"Is it good?"** — *compared to what?* A number in isolation is meaningless; it means everything next to a second configuration's number, or last month's. Evals create *differences*, not grades. (Same lesson as cosine scores: relative, not absolute.)

**What results tend to look like on this corpus (illustrative):** vector-only lands somewhere in the 60–85% range depending on how adversarial your phrasings are. On a 15-case set, reranking commonly moves hit@5 by ±1–2 cases — which is the moment to notice that **15 cases is a small instrument**: one case is ~7 points. That's not a flaw in your work, it's instrument resolution, now understood from the inside. Production eval sets grow to hundreds of cases precisely so small real effects aren't drowned by noise. Grow yours as the course continues.

**Reading a miss:** look at what *did* come back in the top 5. Usually one of: the expected note exists but ranks #8 (a ranking problem — reranking / over-fetch may fix it); the query's vocabulary is too far from anything in the corpus (an embedding limit); or — most common — your "expected" note wasn't actually the best answer and the system found a better one (an eval bug: fix the pair, thank the system).

</details>

## Further reading (optional)

- [Pinecone: evaluating retrieval](https://www.pinecone.io/learn/offline-evaluation/) — the fancier metrics (MRR, nDCG), for when hit rate stops being enough
