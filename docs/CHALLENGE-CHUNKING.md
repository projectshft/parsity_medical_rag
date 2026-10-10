# Homework: Chunking — slice up the Bible, store it, search it

> Nothing religious about this exercise — the KJV is just a big, public-domain, heavily-quoted text with lots of structure (books → chapters → verses), which makes it a perfect chunking corpus. Real semantic Bible-search apps exist; this is a small one.

## Get the text

```bash
npm run bible:fetch
```

That's it — downloads `kjv.txt` (~4.5 MB) into `data/bible/`. `scripts/bible/parse.ts` gives you `loadVerses()`, which returns every verse as `{ book, chapter, verse, text }`.

## The assignment

Build a working proof of concept: **chunk the Bible, store it in a vector database you set up yourself, and expose an endpoint that searches it.**

### 1. Chunk it

- **Chunking strategy is your call**: by verse, by chapter, packed passages, paragraphs, with or without overlap. Have a reason.
- **Every chunk carries metadata** — at minimum a human-readable reference like `"Genesis 1:1-5"`.

### 2. Store it — in your own vector database

Pick one and run it yourself:

- **[Qdrant](https://qdrant.tech/documentation/quickstart/)** — runs locally in one Docker command, or use the free cloud tier
- **[pgvector](https://github.com/pgvector/pgvector)** — vectors inside Postgres (your own instance; the course database is read-only)
- **[Chroma](https://docs.trychroma.com/)**, **[LanceDB](https://lancedb.github.io/lancedb/)**, **[Weaviate](https://weaviate.io/developers/weaviate)** — also fine

**Pinecone is allowed but strongly discouraged.** You've already used it; setting up a second vector store is part of the point.

Embeddings: `createEmbeddings(texts)` from `lib/openai.ts` (`text-embedding-3-small`, 1536 dimensions) works. The whole book is ~1M tokens ≈ **$0.02**. Any other embedding model is fine too. Whatever you pick, embed your queries with the **same** model you used for your chunks.

### 3. Search it — one endpoint

An endpoint that takes a query and returns the top **k** stored chunks:

```
POST /search
{ "query": "love is patient", "k": 5 }

→ { "results": [ { "reference": "1 Corinthians 13:4-7", "text": "...", "score": 0.83 }, ... ] }
```

Any stack, in this repo or your own. Exact shape is up to you, but every result must include its reference and text.

**That's the whole homework:** chunk → store → an endpoint that returns k documents for a query.

## Watch (one or two, max)

- [3Blue1Brown — Large Language Models explained briefly](https://www.youtube.com/watch?v=LPZh9BOjkQs) (~8 min)
- [3Blue1Brown — Transformers, the tech behind LLMs (Deep Learning Ch. 5)](https://www.youtube.com/watch?v=wjZofJX0v4M) — the embeddings section is exactly what your vector database is storing

## Further reading

**Chunking:**

- [Pinecone — Chunking Strategies for LLM Applications](https://www.pinecone.io/learn/chunking-strategies/)
- [Cohere — Effective Chunking Strategies](https://docs.cohere.com/page/chunking-strategies)
- [LangChain — Text splitters](https://python.langchain.com/docs/concepts/text_splitters/)
- [Greg Kamradt — 5 Levels of Text Splitting](https://github.com/FullStackRetrieval-com/RetrievalTutorials/blob/main/tutorials/LevelsOfTextSplitting/5_Levels_Of_Text_Splitting.ipynb)
- [LlamaIndex — Evaluating the Ideal Chunk Size](https://www.llamaindex.ai/blog/evaluating-the-ideal-chunk-size-for-a-rag-system-using-llamaindex-6207e5d3fec5)

**Embeddings & dimensions:**

- [OpenAI — Embeddings guide](https://platform.openai.com/docs/guides/embeddings)
- [Simon Willison — Embeddings: what they are and why they matter](https://simonwillison.net/2023/Oct/23/embeddings/)
- [Jay Alammar — The Illustrated Word2vec](https://jalammar.github.io/illustrated-word2vec/)
- [Hugging Face — Matryoshka embeddings](https://huggingface.co/blog/matryoshka)

## The video (2–3 min, phone is fine)

1. **What chunking is**, in your own words
2. **How you approached it here** — your strategy and why
3. **What sentence overlap is and why you'd use it**

## Submit

Your repo link (the working POC) + your video, via the link pinned in Slack.

The code is the easy half — **the reasoning is the assignment.**
