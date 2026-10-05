# Homework: Chunking — slice up the Bible and store it in Qdrant

> Nothing religious about this exercise — the KJV is just a big, public-domain, heavily-quoted text with lots of structure (books → chapters → verses), which makes it a perfect chunking corpus. It's also the exact *opposite* shape from our clinical notes, which are already retrieval-sized and need no chunking at all. **Decide from the corpus in front of you, not from habit.**

## Why a second vector database

The medical notes live in Pinecone. This lab runs on **Qdrant**, and that is deliberate.

If this were a Pinecone assignment you would import `upsertChunks` from `lib/pinecone.ts` and the storage half would be one line. You'd learn nothing about what a vector index *is*, because we already made every decision for you. On Qdrant you write the client code, and three things Pinecone hides become yours:

- **The collection does not exist until you create it** — with an explicit vector size and distance metric, neither of which can be changed afterwards.
- **It's a `payload`, not `metadata`** — a filterable JSON document attached to the point, not a bag of tags.
- **Payload fields aren't indexed for filtering until you say so**, and you pick the index type.

Second, more honest reason: you will one day inherit a system built on a vector DB you've never used. The skill is reading a client's types and docs and getting something working — not knowing Pinecone.

## Set up Qdrant

Free tier, **no credit card**: [cloud.qdrant.io](https://cloud.qdrant.io). Create a cluster, then put both values in `.env`:

```
QDRANT_URL=https://....cloud.qdrant.io
QDRANT_API_KEY=...
```

The API key is shown **once**, at creation. Miss it and you rotate.

> Free clusters are suspended after a week of inactivity and deleted after four. You build the collection this week and search it next week — if your collection looks empty, reactivate it in the dashboard before you assume your code is broken.

Already have Docker and would rather stay local? `docker run --rm -p 6333:6333 qdrant/qdrant`, set `QDRANT_URL=http://localhost:6333`, leave the key blank, and you get a dashboard at `localhost:6333/dashboard`. Everything below works the same, with one exception noted under *filtering*.

## Get the text

```bash
npm run bible:fetch
```

Downloads `kjv.txt` (~4.5 MB) into `data/bible/`.

## The assignment

**Chunk the text, embed it, and store it in Qdrant with a payload.**

1. **Write your chunker** in `scripts/bible/chunk-smart.ts`. Strategy is your call — by verse, by chapter, packed passages, with or without overlap. Have a reason. `scripts/bible/parse.ts` is provided: `loadVerses()` returns every verse as `{ book, chapter, verse, text }`. Nobody is grading your regex.
2. **Every chunk carries a payload** — at minimum a human-readable `reference` like `Genesis 1:1-5`, plus `book` so you can filter.
3. **Store it**, then do the same for the naive output so you have both to compare:
   ```bash
   npm run bible:fixed                                              # the naive baseline
   npm run bible:store -- data/bible/chunks-fixed.jsonl bible_fixed
   npm run bible:store -- data/bible/chunks-smart.jsonl bible_smart
   ```
4. **Pick your vector size and defend it.** `text-embedding-3-small` gives you 1536 by default, but it supports 512 and `-large` goes to 3072. On Qdrant the number goes in `createCollection` and is immutable — so this is a decision, not a dropdown. Why did you pick yours?
5. **Audit both** and read the difference:
   ```bash
   npm run bible:audit -- data/bible/chunks-fixed.jsonl
   npm run bible:audit -- data/bible/chunks-smart.jsonl
   ```
   The naive one scores ~89% of chunks starting mid-word and ~97% ending mid-sentence. Yours should be dramatically better — and if it isn't, that's the interesting result.

**Two collections, not one.** Fixed and structure-aware chunking produce *different chunks*, so they can't share points. (Qdrant's named vectors let one point hold several embeddings — that's for comparing embedding *models* on the same text, which isn't what this compares.)

## Four things that will cost you an hour if nobody tells you

These are not hypothetical; they are the specific ways this lab goes wrong.

1. **`client.search()` does not exist.** It was removed in client v1.19.0 in favour of `client.query()`. Every tutorial, Stack Overflow answer and LLM completion written before August 2026 still uses `search`. TypeScript will tell you — `Property 'search' does not exist on type 'QdrantClient'` — and when you switch, note that `query()` returns `{ points: [...] }`, **an object, not an array**, so `results.map(...)` is the next thing that breaks.
2. **Point IDs must be an unsigned integer or a UUID.** `"Genesis-1-1"` is rejected with a 400 at runtime, and the TypeScript type is `number | string`, so **the compiler will not save you here**. Use an incrementing integer or `crypto.randomUUID()` and put the readable reference in the payload — which is where it belongs anyway.
3. **`wait` defaults to `false` on upsert.** The call returns `acknowledged` before your points are searchable, so a query run immediately afterwards can legitimately return nothing. That looks exactly like broken embeddings. Pass `wait: true`.
4. **Filtering an unindexed payload field fails on Qdrant Cloud.** Cloud runs strict mode; local Docker doesn't. Call `createPayloadIndex` for any field you intend to filter on — otherwise your code works on a classmate's laptop and errors on your cluster, which is a miserable afternoon.

`scripts/bible/store.ts` is yours to write. Its header comments say what each step is for.

## Further reading

**Chunking:**

- [Pinecone — Chunking Strategies for LLM Applications](https://www.pinecone.io/learn/chunking-strategies/)
- [Cohere — Effective Chunking Strategies](https://docs.cohere.com/page/chunking-strategies)
- [LangChain — Text splitters](https://python.langchain.com/docs/concepts/text_splitters/)
- [Greg Kamradt — 5 Levels of Text Splitting](https://github.com/FullStackRetrieval-com/RetrievalTutorials/blob/main/tutorials/LevelsOfTextSplitting/5_Levels_Of_Text_Splitting.ipynb)
- [LlamaIndex — Evaluating the Ideal Chunk Size](https://www.llamaindex.ai/blog/evaluating-the-ideal-chunk-size-for-a-rag-system-using-llamaindex-6207e5d3fec5)

**Qdrant:**

- [Qdrant — Quickstart](https://qdrant.tech/documentation/quickstart/)
- [Qdrant — Points and IDs](https://qdrant.tech/documentation/manage-data/points/)
- [Qdrant — Filtering](https://qdrant.tech/documentation/concepts/filtering/)

**Embeddings & dimensions:**

- [OpenAI — Embeddings guide](https://platform.openai.com/docs/guides/embeddings)
- [Simon Willison — Embeddings: what they are and why they matter](https://simonwillison.net/2023/Oct/23/embeddings/)
- [Jay Alammar — The Illustrated Word2vec](https://jalammar.github.io/illustrated-word2vec/)
- [Hugging Face — Matryoshka embeddings](https://huggingface.co/blog/matryoshka)

## The video (2–3 min, phone is fine)

1. **What chunking is**, in your own words
2. **How you approached it here** — your strategy and why
3. **What sentence overlap is and when you'd use it**
4. **One thing Qdrant made you decide that Pinecone decided for you** — and whether you think that's better or worse

Submit via the link pinned in Slack.

The code is the easy half — **the reasoning is the assignment.**
