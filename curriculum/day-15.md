# Day 15 — Semantic Search over Clinical Notes

**Needs: Pinecone index from yesterday; the medical dataset; OpenAI + Pinecone keys**

## Today you will

- Ingest the real cargo: clinical notes, one note = one vector
- Implement `searchClinicalNotes` — the first production search code you write in this course
- Pay off your Day 1 bet: the synonym pair that shares zero keywords

## Concept

Everything is finally in place. You know what a piece is (one note — you measured it). You know what metadata it carries (patientId, name, type, date — you designed the equivalent). You know how text becomes searchable (embeddings) and where vectors live (the index). Today the system's second retrieval engine comes online.

One new idea ships today: **metadata filtering inside vector search.** Pinecone can restrict the nearest-neighbor search to vectors whose metadata matches a condition:

```typescript
filter: { patientId: { $in: ['abc', 'def'] } }
```

This is not post-processing. The index finds the top-K nearest *among only the matching vectors* — searching one patient's 40 notes instead of all 144,000. Cheaper, faster, and **correct** in a way that filtering afterward is not: the top-10 results filtered down to one patient might leave zero results, while a filtered search returns that patient's true top 10. Remember the chunking block's warning that `patientId` is the privacy boundary — this `filter` parameter is where that boundary is enforced.

## Implementation

### 1. Ingest the notes

The ingest script you ran for Postgres also handles vectors — you skipped them with `--skip-vectors` back then. Now run it without the flag (it clears and reloads both stores):

```bash
npm run ingest -- data/subset
# or, smaller and faster for today:
npm run ingest -- --limit 50
```

This embeds every note (batches of 100) and upserts them. The subset (~150 patients ≈ 17,000 notes) takes a while and costs well under a dollar — start it, and write the search function while it runs. Note: this clears yesterday's Bible chunks from the index. They were scaffolding; the scripts can always rebuild them.

### 2. Implement `searchClinicalNotes`

Open `lib/vector-search.ts`. The function is a skeleton:

```typescript
export async function searchClinicalNotes(
  query: string,
  options: VectorSearchOptions = {}
): Promise<VectorSearchResult[]> {
  const { topK = 10, patientIds } = options;

  // TODO: Implement vector search

  throw new Error('Not implemented - your turn!');
}
```

You know every ingredient. The recipe:

1. Embed the query (`createEmbedding` — already imported)
2. Build a metadata filter *if* `patientIds` was provided (one id → `{ patientId: id }`; several → `{ patientId: { $in: ids } }`; none → no filter)
3. Query the index: `index.query({ vector, topK, includeMetadata: true, filter })`
4. Map each match into a `VectorSearchResult` (check its shape in `lib/types.ts`) — id, score, the metadata fields, and a truncated `contentPreview` (the provided `truncateContent` helper, 500 chars)

Write it. The provided `searchPatientNotes` helper just below shows how your function gets called.

### 3. The Day 1 payoff

```typescript
import 'dotenv/config';
import { searchClinicalNotes } from './lib/vector-search';

async function main() {
  for (const q of ['shortness of breath', 'trouble breathing']) {
    const results = await searchClinicalNotes(q, { topK: 5 });
    console.log(`\n=== ${q}`);
    for (const r of results) {
      console.log(`${r.score.toFixed(3)} ${r.patientName} (${r.date}) — ${r.contentPreview.slice(0, 100)}…`);
    }
  }
}
main();
```

Run your own Day 1 synonym pair too. Two phrasings, zero shared keywords, and watch them surface overlapping notes. In the first days of this course that was a promise; now it's your code.

### Common mistakes

- **Filtering after the query instead of in it.** `index.query(...)` then `.filter(r => patientIds.includes(...))` *looks* equivalent and isn't — you get "the global top 10, minus strangers" (often empty) instead of "this patient's top 10." The filter belongs inside the query.
- **Passing an empty filter object.** `filter: {}` and `filter: undefined` are different — an empty object can error or silently match nothing depending on client version. Build the filter only when there's something to filter on.
- **Forgetting `includeMetadata: true`.** Without it you get ids and scores — no text, no patient, nothing to display. The symptom is a result list full of `undefined`.
- **Embedding the query on every loop iteration while debugging.** Each embed is an API call. Cache it in a variable while you iterate on the mapping code.

## Your turn

Spend **no more than 60 minutes** here (including the skeleton work above).

1. Finish `searchClinicalNotes` and get both demo queries returning sensible, overlapping results.
2. Test the patient filter: pick one patient id from Prisma Studio, search a symptom with `{ patientIds: [thatId] }`, and confirm every result belongs to that patient.
3. The keyword shootout: pick a clinical concept and search it three ways — clinical term, plain-English phrasing, and a *misspelled* version. Record the top-3 for each. Where does the geometry shine, and where does it wobble?

## Check yourself

- Why must the patient filter live inside `index.query` rather than after it? Two reasons — one about quality, one about safety.
- Your search for "diabetes medication side effects" returns notes scoring 0.45–0.55, and your search for gibberish returns 0.30–0.35. What can you conclude? What can't you?

<details>
<summary>Solution / discussion</summary>

A working implementation:

```typescript
export async function searchClinicalNotes(
  query: string,
  options: VectorSearchOptions = {}
): Promise<VectorSearchResult[]> {
  const { topK = 10, patientIds } = options;

  const index = pinecone.Index(INDEX_NAME);
  const queryEmbedding = await createEmbedding(query);

  let filter: Record<string, unknown> | undefined;
  if (patientIds && patientIds.length > 0) {
    filter = patientIds.length === 1
      ? { patientId: patientIds[0] }
      : { patientId: { $in: patientIds } };
  }

  const results = await index.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
    filter,
  });

  return (results.matches ?? []).map((match) => ({
    id: match.id,
    score: match.score ?? 0,
    patientId: (match.metadata?.patientId as string) ?? '',
    patientName: (match.metadata?.patientName as string) || undefined,
    documentType: (match.metadata?.type as string) || 'Clinical Note',
    date: (match.metadata?.date as string) || undefined,
    contentPreview: truncateContent((match.metadata?.content as string) ?? '', 500),
  }));
}
```

**Filter placement, two reasons:** *quality* — a post-filter discards globally-ranked strangers and can leave you with zero of the patient's actually-relevant notes; *safety* — post-filtering means other patients' note content transits your application code on every query, one logging statement away from a privacy incident. In-query filtering means it never leaves the database.

**The 0.45 vs 0.30 question:** you can conclude the medication query's matches are *more related than gibberish's* — relative information. You cannot conclude they're *good answers* — no absolute threshold exists (the lesson from two days ago, now with production stakes). Whether 0.45–0.55 notes actually answer the question is an empirical question about *your* corpus and *your* queries, and the honest way to answer it is exactly what this block's build day constructs.

**The misspelling result** usually surprises: embeddings degrade gracefully on typos ("diabtes" still lands near diabetes) — another thing keyword search can't do. The wobble shows up on rare drug names and abbreviations, where the model has seen too little context to place them well.

</details>

## Further reading (optional)

- [Pinecone: metadata filtering](https://docs.pinecone.io/guides/index-data/indexing-overview#metadata) — the full filter syntax beyond `$in`
