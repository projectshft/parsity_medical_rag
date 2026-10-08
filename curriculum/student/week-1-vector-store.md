# Week 1 — The vector store

**Session:** Saturday · [recording posted in Slack]
**Needs:** `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `PINECONE_API_KEY`, `PINECONE_INDEX`, `DATABASE_URL`

## What we built

Everything today served one goal: **21,090 clinical notes, sitting in Postgres,
made searchable by meaning.** By the end of the session your own Pinecone index
was populated and you could see the vectors in the console.

We got there in four moves.

### 1. Why a second database at all

We opened in the database and looked at one patient's notes — decades of them,
hundreds of entries, dense SOAP-style text. Then we dumped that pile into Claude
and asked for a summary, and got something a doctor could actually use in thirty
seconds.

That's the whole product in one gesture. The problem is that it doesn't scale:
the doctor would have to know SQL, have database access, and repeat it per
patient. And SQL can't help with the questions that matter most, because
`LIKE '%heart attack%'` never matches a note that says *myocardial infarction*.

Someone suggested Elasticsearch, which is a fair answer and worth knowing. But
keyword search still assumes you know the vocabulary in the documents. Front-desk
staff don't know what a hemogram is.

### 2. What an embedding actually is

An embedding is text crushed into a list of numbers — 512, 1536, or 3072 of them —
by a proprietary model, such that things that *mean* similar things land near each
other.

We built the intuition by hand first, scoring how close `sad` is to `melancholy`,
`happy`, `cat`, `burrito`, `the devil`. Then we ran the real thing:

```bash
npm run similarity
```

`scripts/similarity.ts` embeds a query and a handful of candidates, scores them
with cosine similarity, and ranks them. Editing the strings in that file and
re-running is the fastest way to build a feel for what the model considers
"close." Do it a few times; the results are occasionally surprising.

**Dimensions** are the one real decision here. More dimensions = more nuance
captured, more storage, more cost. Tweets don't need 3072. Dense legal or medical
text might. We used **1536** — the safe default, and what `text-embedding-3-small`
gives you.

> **This is a one-way door.** Everything in one index must be embedded by the
> same model at the same dimensions. Change your mind later and you re-embed the
> entire corpus. Choose deliberately.

### 3. Metadata — the part everyone skips

Cosine similarity is fuzzy by design. It cannot do a hard filter. "Tell me about
*this* patient" is not a similarity question, and a semantic search for
`Avery Mueller` will happily return Avery Kemmer.

So every vector carries **metadata** alongside the embedded text — key/value pairs
you can filter on exactly, before or alongside the similarity search. We decided
the fields together in class, from what a clinic would actually filter by:

`patientId` · `firstName` · `lastName` · `age` · `gender` · `race` · `city` ·
`state` · `currentMedications` · `source`

Only `content` — the note text — gets embedded. The rest rides along as filters.
It's cheap to update metadata later, so over-collecting slightly is the right
error to make.

### 4. Vectorize

`scripts/vectorize.ts` reads notes from Postgres with Prisma, shapes each into a
`MedicalChunk`, and hands the batch to `upsertChunks()`, which embeds and upserts
100 at a time.

```bash
npm run vectorize -- --limit 5     # prove it works before you spend money
npm run vectorize                  # all ~21,000
```

The `--limit 5` step is not optional politeness. Upload five, open the Pinecone
console, confirm the metadata looks right, *then* run the whole thing. We did it
in that order in class and it saved several people from re-uploading 21,000
malformed vectors.

Two details worth keeping:

- **`id: note.id`** — reusing the note's database id makes re-runs idempotent.
  Run it twice and you overwrite, never duplicate.
- **`withPineconeRetry`** — bulk upserts hit `ECONNRESET` on some networks. The
  helper in `lib/pinecone.ts` retries with backoff. Several people still saw the
  run die partway; re-running is safe, precisely because of the id choice above.

The full run takes 15–25 minutes and costs a few cents.

## Homework — chunk the Bible and store it in Qdrant

> Nothing religious about this. The KJV is a big, public-domain, heavily-quoted
> text with deep structure (books → chapters → verses), which makes it a perfect
> chunking corpus — and the exact *opposite* shape from our clinical notes, which
> are already retrieval-sized and need no chunking at all. The contrast is the
> lesson: **decide from the corpus in front of you, not from habit.**

### Get the text

```bash
npm run bible:fetch
```

Downloads `kjv.txt` (~4.2 MB) into `data/bible/`.

### The assignment

Write a script that **chunks the text and stores it in Qdrant — with a payload.**

**Qdrant, not Pinecone, on purpose.** If this ran on Pinecone you'd import
`upsertChunks` from `lib/pinecone.ts` and the storage half would be one line.
On Qdrant you write the client code, and the decisions we already made for you
become yours: the collection doesn't exist until you create it, with a vector
size and distance metric that can't be changed afterwards. Free tier, no credit
card: [cloud.qdrant.io](https://cloud.qdrant.io).

- **Chunking strategy is your call** — by verse, by chapter, packed passages,
  paragraphs, with or without overlap. Have a reason.
- **Every chunk carries a payload** — at minimum a human-readable reference like
  `Genesis 1:1-5`, plus `book` so you can filter. (`scripts/bible/parse.ts` is
  provided: `loadVerses()` gives you every verse as
  `{ book, chapter, verse, text }`. Nobody is grading your regex.)
- **Two collections** — `bible_fixed` and `bible_smart`. The two strategies
  produce different chunks, so they can't share points.
- **Pick 512, 1536 or 3072 and explain why.** On Qdrant the number goes into
  `createCollection` and is immutable — a decision, not a dropdown.
- **Audit both** and read the gap. The naive chunker scores ~89% of chunks
  starting mid-word; yours should be far better, and if it isn't, that's the
  interesting result.

Four things that cost an hour each if nobody warns you — **`client.search()` no
longer exists** (it's `query()`, and it returns `{ points }`, not an array);
**point ids must be an integer or UUID**, which TypeScript won't catch;
**`wait` defaults to false**, so a query straight after an upsert can return
nothing; and **filtering an unindexed payload field errors on Qdrant Cloud**.
All four are explained in `docs/CHALLENGE-CHUNKING.md` — read it before you start.

Storing it is the assignment. Searching it is next week.

### The video (2–3 min, phone is fine)

1. **What chunking is**, in your own words
2. **How you approached it here** — your strategy, how many dimensions, and why
3. **What sentence overlap is** and when you'd use it
4. **Show your chunks** in the Pinecone console

Post it in the channel.

## Reading

**Chunking**
- [Pinecone — Chunking Strategies](https://www.pinecone.io/learn/chunking-strategies/)
- [Cohere — Effective Chunking Strategies](https://docs.cohere.com/page/chunking-strategies)
- [LangChain — Text splitters](https://python.langchain.com/docs/concepts/text_splitters/)
- [Greg Kamradt — 5 Levels of Text Splitting](https://github.com/FullStackRetrieval-com/RetrievalTutorials/blob/main/tutorials/LevelsOfTextSplitting/5_Levels_Of_Text_Splitting.ipynb)
- [LlamaIndex — Evaluating the ideal chunk size](https://www.llamaindex.ai/blog/evaluating-the-ideal-chunk-size-for-a-rag-system-using-llamaindex-6207e5d3fec5)

**Embeddings (bonus)**
- [OpenAI — Embeddings guide](https://platform.openai.com/docs/guides/embeddings)
- [Simon Willison — Embeddings: what they are and why they matter](https://simonwillison.net/2023/Oct/23/embeddings/)
- [Jay Alammar — The Illustrated Word2vec](https://jalammar.github.io/illustrated-word2vec/)
- [Hugging Face — Matryoshka embeddings](https://huggingface.co/blog/matryoshka)

Also worth a look: **[chunkviz.com](https://www.chunkviz.com/)** — paste text, watch
chunking strategies apply visually. Good for the video.

## When it breaks

Every one of these hit someone in cohort 3.

- **`401` / `403` from OpenAI.** `OPENAI_BASE_URL` is commented out or missing in
  your `.env`. The proxy needs it; without it the SDK silently uses the default
  host and your key is rejected there.
- **Index not found (404).** The name in `PINECONE_INDEX` doesn't match the index
  you created. Open the console and copy the name exactly.
- **`Can't reach database server`.** Check `DATABASE_URL` against the string from
  class. `scripts/vectorize.ts` prefers `DIRECT_URL` when it's set — a *pooled*
  connection times out on the long batch read over 21k notes. `.env.example`
  documents it as an optional commented line; uncomment it with the non-pooled
  host (no `-pooler` in the hostname) if the full run keeps dying.
- **The run dies partway with `ECONNRESET` / `fetch failed`.** Transient. Re-run
  it — ids make it idempotent. If it's persistent, delete the index and start
  clean; that fixed it for at least one person faster than debugging did.
- **Bible verses in your medical index.** Someone did this in cohort 3, back when
  the Bible homework also ran on Pinecone. Moving it to Qdrant makes that
  particular mistake impossible — different database, different client, no
  shared `PINECONE_INDEX` to forget. The replacement mistake is writing both
  chunk sets into one Qdrant collection; use `bible_fixed` and `bible_smart`.

## Check yourself

- Your medical index has ~21,000 vectors, and one you open in the console has both
  `content` and the metadata fields.
- You can say, in one sentence, why 1536 and not 512.
- You can explain why `LIKE '%heart attack%'` fails on a note that says
  *myocardial infarction*, and what fixes it.
