# Day 14 — Pinecone: Your First Vector Index

**Needs: `PINECONE_API_KEY` and `OPENAI_API_KEY` in `.env`; the Bible chunks from the chunking block**

## Today you will

- Build a working vector search by hand — corpus to vectors to ranked results — so the database is never a black box
- Create the index that will eventually hold the medical notes, and load + search it with the Bible chunks
- Understand exactly what a vector database does that Postgres doesn't, and what it adds over your hand-rolled loop

## Concept

Yesterday you computed similarity between five phrases by embedding all five and comparing every pair. Now scale that thought: a real query needs the best matches among **tens of thousands** of stored documents. Embedding the query is one API call — fine. But comparing it against 144,000 stored vectors, per query? You need those 144,000 embeddings computed *once*, stored, and searchable *fast*.

That's the whole job description of a **vector database**:

1. **Store** vectors with their text and metadata
2. **Search** by similarity — give it a query vector, get back the top-K nearest neighbors, quickly
3. **Filter** — restrict the search by metadata (you built the case for this in the chunking block)

```mermaid
flowchart LR
    Q[query text] -->|embed once| QV[query vector]
    QV --> P[(Pinecone index<br/>thousands of vectors<br/>+ metadata)]
    P -->|top-K nearest| R[ranked matches<br/>with text + metadata]
```

> **Why a dedicated vector database and not Postgres-with-an-extension?** Postgres has pgvector, and for many projects it's a fine answer — one database, one bill. We chose a managed vector store because it isolates a genuinely different workload (approximate nearest-neighbor search has its own indexing, scaling, and tuning) and keeps our Postgres schema boring. The honest tradeoff: one more service, one more key, one more thing to mock in tests. If you rebuild this system solo later, pgvector is a legitimate fork in the road — what doesn't change is everything else you're learning this week.

### Index configuration is a commitment

An index is created with two parameters that **cannot change later**:

- **Dimensions: 1536** — must match the embedding model exactly (`text-embedding-3-small` outputs 1,536 numbers; a 1,536-dim index physically cannot store a vector of any other length)
- **Metric: cosine** — the similarity measure you computed by hand yesterday, now run by the database

Wrong dimension count = recreate the index. New embedding model = recreate the index *and re-embed every document*. This is why yesterday's "one index, one model, forever" warning was a warning.

## Implementation

### 1. Build the search by hand first

Before you touch a vector database, build the thing one *does* — in about ten lines. Its core operation is no mystery once you've written it yourself.

```typescript
import 'dotenv/config';
import { createEmbedding, createEmbeddings } from './lib/openai';

// cosine similarity — the same function from yesterday
function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function main() {
  // (a) text -> vectors: embed a tiny corpus ONCE
  const corpus = [
    'In the beginning God created the heaven and the earth.',
    'Love your neighbour as yourself.',
    'Thou shalt not steal.',
    'The Lord is my shepherd; I shall not want.',
    'Blessed are the peacemakers.',
  ];
  const docVectors = await createEmbeddings(corpus);

  // (b) embed the query
  const query = 'caring for the people around you';
  const queryVector = await createEmbedding(query);

  // (c) score the query against every document, rank by similarity
  const ranked = corpus
    .map((text, i) => ({ text, score: cosine(queryVector, docVectors[i]) }))
    .sort((a, b) => b.score - a.score);

  console.log(`query: "${query}"\n`);
  for (const r of ranked) console.log(`${r.score.toFixed(3)}  ${r.text}`);
}
main();
```

Run it. The query *"caring for the people around you"* shares **zero words** with *"Love your neighbour as yourself"* — and ranks it first. You just ran a **nearest-neighbor search**: embed a corpus once, embed a query, score the query against every stored vector, return the highest. That loop — `map` to a similarity score, `sort` descending, take the top — **is what a vector database does.** There is no extra magic in the box.

> **Cosine or dot product?** Same ranking here. Cosine is the dot product divided by both vectors' lengths — it measures the *angle* between them, ignoring magnitude. OpenAI's embeddings come back already unit-length (normalized), so for them `dot(a, b)` alone gives the identical ordering — which is why some vector databases default to a raw dot-product metric: it skips the division, fewer operations per comparison. Pinecone's `cosine` metric does the normalization for you, so you don't have to think about it.

So if search is just that loop, why pay for Pinecone? Two reasons, and only two:

1. **Persistence.** Your script re-embeds the corpus every run. A database embeds once and *keeps* the vectors — you pay the embedding cost a single time.
2. **Speed at scale.** Your loop compares the query against *every* vector — fine for 5, hopeless for 144,000 (that's 144,000 cosine computations per query). A vector database builds an **index** — approximate nearest-neighbor search — that finds the closest vectors *without* checking every one, trading a sliver of accuracy for enormous speed. That index is the entire reason the product exists.

Everything else (metadata filtering, the API, the dashboard) is convenience wrapped around those two. The *search* is the loop you just wrote — so when you call Pinecone below, you already know exactly what it's doing under the hood.

### 2. Create the index

The repo has a helper that creates it if missing — `ensureIndexExists()` in `lib/pinecone.ts`. Read it first (note the dimension and metric), then run it from a scratch script:

```typescript
import 'dotenv/config';
import { ensureIndexExists } from './lib/pinecone';

ensureIndexExists().then(() => console.log('done'));
```

Then look at the index in the [Pinecone console](https://app.pinecone.io) — confirm name `medical-notes`, dimension 1536, metric cosine.

![Screenshot: Pinecone console showing the medical-notes index configuration](assets/day14-pinecone-index.png)
<!-- TODO(brian): capture from logged-in Pinecone console -->

### 3. Load a corpus you already understand

Before risking the medical data, load the corpus where you can *judge* search quality by eye: your structure-aware Bible chunks. You know their shape, their metadata, their seams — perfect test cargo.

```typescript
import 'dotenv/config';
import * as fs from 'fs';
import { upsertChunks, MedicalChunk } from './lib/pinecone';

async function main() {
  const chunks: MedicalChunk[] = fs
    .readFileSync('data/bible/chunks-smart.jsonl', 'utf-8')
    .split('\n')
    .filter(Boolean)
    .slice(0, 2000) // first ~2,000 chunks: plenty to search, cheap to embed
    .map((line) => {
      const c = JSON.parse(line);
      return {
        id: String(c.id),
        content: c.text,
        metadata: {
          resourceType: 'BibleChunk',
          source: 'kjv',
          chunkIndex: c.id,
          book: c.metadata.book,
          reference: c.metadata.reference,
        },
      };
    });

  console.log(`upserting ${chunks.length} chunks...`);
  const n = await upsertChunks(chunks);
  console.log(`done: ${n}`);
}
main();
```

Read `upsertChunks` in `lib/pinecone.ts` while it runs (a couple of minutes): it embeds in batches of 100 and stores each vector with its text and metadata. This is the exact function the medical ingest uses — you're just feeding it scripture.

### 4. Search it

```typescript
import 'dotenv/config';
import { searchChunks } from './lib/pinecone';

async function main() {
  for (const q of ['love thy neighbour', 'the creation of the world', 'forgiveness of sins']) {
    const results = await searchChunks(q, 3);
    console.log(`\n=== ${q}`);
    for (const r of results) {
      console.log(`${r.score.toFixed(3)}  [${r.metadata.reference}]  ${r.content.slice(0, 80)}…`);
    }
  }
}
main();
```

Judge the results like you judged chunks: did "the creation of the world" surface Genesis 1? Does each hit carry a citation you can verify against the source? That round trip — query → match → reference → source text — is the metadata payoff, live.

### Common mistakes

- **Forgetting that upsert embeds.** `upsertChunks` calls the OpenAI API for every chunk — that's where the time and money go, not Pinecone. 2,000 chunks ≈ a minute or two and a few cents. Don't feed it all 9,737 to "be thorough"; today is about understanding, not coverage.
- **Searching immediately after upserting and panicking at missing results.** The index is *eventually* consistent — freshly upserted vectors can take a few seconds to become searchable. Wait, retry, then debug.
- **Creating the index by hand in the console with default settings.** Console defaults may not be 1536/cosine. Use `ensureIndexExists()` — config-as-code is reproducible; clicks are not.

## Your turn

Spend **no more than 45 minutes** here.

1. Run the by-hand search. Then change the query to one that shares words with a *wrong* document but meaning with a *right* one (e.g. query "do not take what isn't yours" against the corpus — does "Thou shalt not steal" win on meaning?). Record the ranking. This is the keyword-vs-meaning point from Day 1, now measured by your own loop.
2. Load the chunks into Pinecone, run the three searches above, and verify one result against `data/bible/kjv.txt` using its `reference`.
3. Search for a *story* you know without using any of its words — e.g. describe a famous parable in modern English. Did the geometry find it? Record the query, the top hit, and the score.
4. Search for something the corpus **cannot** answer ("how do I file my taxes"). Look at the scores of the "best" matches and compare them to your good queries' scores. Write one sentence about what a retrieval system should *do* with that observation.

## Check yourself

- In one sentence: what does a vector database actually *do* on a search, and what are the only two things it adds over the loop you wrote by hand?
- What two index parameters are permanent, and what breaks if each is wrong?
- Where does the cost and latency of `upsertChunks` actually come from?

<details>
<summary>Solution / discussion</summary>

**What a vector DB does + what it adds:** on a search it embeds the query, scores it against the stored vectors by similarity (cosine/dot product), and returns the top-K — exactly your by-hand loop. The only two things it adds: **persistence** (vectors stored once, not re-embedded per query) and **speed at scale** (an index that finds nearest neighbors without comparing against every vector). If you can say that, you understand vector search; the rest is API surface.

**The no-words search (typical result):** describing the prodigal son as "a young man wastes his inheritance and his father welcomes him home" reliably surfaces Luke 15 chunks — zero shared vocabulary with "prodigal." This is yesterday's 0.701 effect operating at corpus scale, and it's the moment most students believe.

**The unanswerable query:** "how do I file my taxes" still returns *something* — vector search always returns the K nearest neighbors, however far away they are. The scores are visibly lower than your good queries' scores, but **not zero**, and (per yesterday) there's no universal threshold that separates "real match" from "best of a bad lot." The observation to write down: *the retrieval layer cannot tell the system "nothing matched" — something downstream has to decide that.* Where and how that decision gets made is a question this course returns to twice more, with better tools each time.

**Permanent parameters:** dimensions (vectors of the wrong length are rejected outright) and metric (changes what "nearest" means — silently different rankings, no error). Both are why index config lives in code.

</details>

## Further reading (optional)

- [Pinecone: what is a vector database?](https://www.pinecone.io/learn/vector-database/) — the architecture under today's two function calls
