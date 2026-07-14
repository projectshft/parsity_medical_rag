# Semantic Search Over Clinical Notes (and Why Metadata Is the Point)

**Needs: the fully vectorized index from the previous lesson (all 21,090 notes); OpenAI + Pinecone keys**

## Today you will

- Implement `searchClinicalNotes` — the first production search code you write in this course
- Use the metadata each vector carries, and see why `patientId` is a privacy boundary, not decoration
- Pay off the very first lesson: the synonym pair that shares zero keywords, now found by your own code

## Concept

Everything's in place. All 21,090 notes are embedded and stored (you ran `vectorize`). The by-hand loop taught you what a search *is*. Today you write the real thing and meet the one idea that turns a toy search into a usable one: **metadata**.

### Metadata: the three jobs text can't do

When you vectorized, each note got tagged with fields — `patientId`, `firstName`/`lastName`, `age`, `gender`, `race`, `city`, `state`, `currentMedications`. The note's *text* is what gets **matched**. The metadata is everything else a real system has to do with a match:

| Job | Question it answers | Without it |
|---|---|---|
| **Filter** | "Search only *this patient's* notes" | You search all 21,090, always |
| **Cite** | "Whose note is this?" | An anonymous fragment |
| **Debug** | "Why did this note match?" | You can't trace it back |

Remember: one patient has ~105 notes on average (the heaviest chart has 1,632). "Summarize this patient's history" is only possible if you can *narrow the search to that patient* — and that's what `patientId` is for.

### Filtering happens *inside* the search

The key new idea: Pinecone can restrict the nearest-neighbor search to vectors whose metadata matches a condition —

```typescript
filter: { patientId: { $in: ['abc', 'def'] } }
```

This is **not** post-processing. The index finds the top-K *among only the matching vectors* — this patient's ~105 notes instead of everyone's 21,090. That's cheaper, faster, and **correct** in a way that filtering afterward is not:

- Search globally for "chest pain," then keep only patient A's hits → you get "the global top 10, minus strangers," which is often **zero** of patient A's actually-relevant notes.
- Search *filtered to patient A* → you get patient A's true top 10.

(One caveat you learned when choosing the metadata: filters are **exact-match** — `$in` compares whole strings. Meaning lives in the text; filters narrow by facts.)

And there's a safety edge. Without the filter, a question that should be about one chart returns fragments from strangers' charts — in a clinical product that's not a bad search result, it's a **patient-privacy boundary violation**. `patientId` is where that boundary is enforced, and it lives *inside* `index.query`, so other patients' note content never even transits your app code.

## Implementation

### 1. Implement `searchClinicalNotes`

Open `lib/vector-search.ts`. The function is a skeleton:

```typescript
export async function searchClinicalNotes(
	query: string,
	options: VectorSearchOptions = {},
): Promise<VectorSearchResult[]> {
	const { topK = 10, patientIds } = options;

	// TODO: Implement vector search

	throw new Error('Not implemented - your turn!');
}
```

You know every ingredient. The recipe:

1. Embed the query (`createEmbedding` — already imported).
2. Build a metadata filter *only if* `patientIds` was provided — one id → `{ patientId: id }`; several → `{ patientId: { $in: ids } }`; none → no filter at all.
3. Query the index: `index.query({ vector, topK, includeMetadata: true, filter })`.
4. Map each match into a `VectorSearchResult` (check its shape in `lib/types.ts`) — id, score, `patientId`, a display name assembled from the `firstName`/`lastName` metadata, and a truncated `contentPreview`.

Write it before opening the solution.

### 2. Run a search

`scripts/search.ts` — a thin runner over your function:

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

The query never says "dyspnea," yet the top hits are the breathing notes. The `score` column is the cosine from the by-hand lesson, now over the real corpus.

### 3. The payoff

Run your synonym pair from the very first lesson — two phrasings, zero shared keywords — and watch them surface overlapping notes. What was a promise in the first days of the course is now your code:

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/search.ts "shortness of breath"
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/search.ts "trouble breathing"
```

### 4. Feel the filter — and the leak

Run a patient-scoped question *without* the filter, and read the `patientName` column:

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/search.ts "chest pain"
```

Hits come from *many different patients*. Now pass a patient id (grab one from Prisma Studio) as the third argument:

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/search.ts "chest pain" <patientId>
```

Every hit now shares that one patient. That's the boundary — enforced by one `filter` field.

### 5. From function to endpoint

In class we wrap this function in an API route — `/api/search`, a thin POST handler that validates the request body and calls `searchClinicalNotes`. The route is plumbing; the function you just wrote is the engine, and it's the same engine everything later in the course (the agent, the tools) will call.

### Common mistakes

- **Filtering after the query instead of in it.** `index.query(...)` then `.filter(r => patientIds.includes(...))` *looks* equivalent and isn't — you get "global top 10 minus strangers" (often empty) instead of "this patient's top 10." The filter belongs inside the query.
- **Passing an empty filter object.** `filter: {}` and `filter: undefined` differ — an empty object can error or silently match nothing. Build the filter only when there's something to filter on.
- **Forgetting `includeMetadata: true`.** Without it you get ids and scores — no text, no patient, nothing to display. The symptom is a result list full of `undefined`.
- **Re-embedding the query every loop iteration while debugging.** Each embed is an API call. Cache it in a variable while you iterate on the mapping code.

## Your turn

Spend **no more than 60 minutes** here (including implementing the function).

1. Finish `searchClinicalNotes` and get both synonym queries returning sensible, overlapping results.
2. Test the patient filter: pick one patient id, search a symptom with `{ patientIds: [thatId] }`, and confirm *every* result belongs to that patient.
3. The keyword shootout: pick a clinical concept and search it three ways — clinical term, plain-English phrasing, and a *misspelled* version. Record the top-3 for each. Where does the geometry shine, and where does it wobble?

```quiz
[
  {
    "q": "Why must the patientId filter live INSIDE index.query rather than filtering the results afterward?",
    "options": [
      "Post-filtering is slower but produces the same results",
      "Pinecone rejects queries that aren't followed by a filter step",
      "Post-filtering gives you 'the global top 10 minus strangers' — often zero of the patient's relevant notes — and strangers' note content transits your app on every query",
      "In-query filters are the only way to sort results by score"
    ],
    "answer": 2,
    "explain": "Two failures at once. Quality: the index finds the top-K among ONLY matching vectors, so filtering inside returns the patient's true top 10. Safety: post-filtering means other patients' notes leave the database on every query — one log line away from a privacy incident."
  },
  {
    "q": "What's the division of labor between a vector's text and its metadata?",
    "options": [
      "The text is matched by meaning; metadata is what search can filter, cite, and trace by — and those filters are exact-match, not semantic",
      "Metadata is also searched by meaning, just at lower priority than the text",
      "The text is only for display; metadata is what actually gets embedded",
      "They're interchangeable — Pinecone merges them before embedding"
    ],
    "answer": 0,
    "explain": "Meaning lives in the text; facts live in the metadata. A filter on currentMedications compares whole strings — 'aspirin' won't match 'Aspirin 81 MG Oral Tablet'. Two different tools, and confusing them is a classic silent failure."
  },
  {
    "q": "Your search for 'diabetes medication side effects' returns notes scoring 0.45–0.55, while gibberish returns 0.30–0.35. What can you conclude?",
    "options": [
      "The 0.45–0.55 notes are good answers — they cleared the gibberish baseline",
      "The notes are more related than gibberish — relative information only; whether they actually answer the question is empirical, settled by retrieval evals, not by the score",
      "The search is broken — real matches should score above 0.9",
      "Nothing — cosine scores in that range are indistinguishable from noise"
    ],
    "answer": 1,
    "explain": "Same lesson as the embeddings day, now in production: scores rank candidates for one query, they don't certify answers. No absolute threshold exists, and pretending one does is how systems quietly return confident garbage."
  }
]
```

## Check yourself

- Why must the patient filter live inside `index.query` rather than after it? Give both reasons — one about quality, one about safety.
- Your search for "diabetes medication side effects" returns notes scoring 0.45–0.55, and gibberish returns 0.30–0.35. What can you conclude, and what can't you?

<details>
<summary>Solution / discussion</summary>

A working implementation:

```typescript
export async function searchClinicalNotes(
	query: string,
	options: VectorSearchOptions = {},
): Promise<VectorSearchResult[]> {
	const { topK = 10, patientIds } = options;

	const index = pinecone.Index(INDEX_NAME);
	const queryEmbedding = await createEmbedding(query);

	let filter: Record<string, unknown> | undefined;
	if (patientIds && patientIds.length > 0) {
		filter =
			patientIds.length === 1
				? { patientId: patientIds[0] }
				: { patientId: { $in: patientIds } };
	}

	const results = await index.query({
		vector: queryEmbedding,
		topK,
		includeMetadata: true,
		filter,
	});

	return (results.matches ?? []).map((match) => {
		const meta = match.metadata ?? {};
		const patientName = [meta.firstName, meta.lastName]
			.filter(Boolean)
			.join(' ');
		const content = (meta.content as string) ?? '';
		return {
			id: match.id,
			score: match.score ?? 0,
			patientId: (meta.patientId as string) ?? '',
			patientName: patientName || undefined,
			documentType: 'Clinical Note', // every vector in this index is a note
			contentPreview:
				content.length > 500 ? content.slice(0, 500) + '…' : content,
		};
	});
}
```

Note the mapping: the vectors carry `firstName`/`lastName` (the metadata you chose during vectorize), so the display name is assembled here. The note *text* rides along in the `content` metadata field — that's what makes `contentPreview` possible without a trip back to Postgres.

**Filter placement, two reasons:** *quality* — a post-filter discards globally-ranked strangers and can leave you zero of the patient's actually-relevant notes; *safety* — post-filtering means other patients' note content transits your app on every query, one log line away from a privacy incident. In-query filtering means it never leaves the database.

**The 0.45 vs 0.30 question:** you can conclude the medication matches are *more related than gibberish* — relative information. You cannot conclude they're *good answers* — no absolute threshold exists. Whether 0.45–0.55 notes truly answer the question is empirical, about *your* corpus and *your* queries, and the honest way to settle it is retrieval evals, later in the course.

**The misspelling** usually surprises: embeddings degrade gracefully on typos ("diabtes" still lands near diabetes) — another thing keyword search can't do. The wobble shows up on rare drug names and abbreviations the model has seen too little of.

</details>

## Further reading (optional)

- [Pinecone: metadata filtering](https://docs.pinecone.io/guides/index-data/indexing-overview#metadata) — the full filter syntax beyond `$in`.
