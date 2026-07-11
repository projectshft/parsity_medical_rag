# Homework: Chunking — slice up the Bible and store it in Pinecone

> Nothing religious about this exercise — the KJV is just a big, public-domain, heavily-quoted text with lots of structure (books → chapters → verses), which makes it a perfect chunking corpus. Real semantic Bible-search apps exist; this is that, minus the search.

## Get the text

```bash
npm run bible:fetch
```

That's it — downloads `kjv.txt` (~4.2 MB) into `data/bible/`.

## The assignment

Write a script that **chunks the text and stores it in your own Pinecone index — with metadata**.

- **Chunking strategy is your call**: by verse, by chapter, packed passages, paragraphs, with or without overlap. Have a reason.
- **Every chunk carries metadata** — at minimum a human-readable reference like `"Genesis 1:1-5"`. (`scripts/bible/parse.ts` is provided: `loadVerses()` gives you every verse as `{ book, chapter, verse, text }`.)
- **Store it**: reuse `upsertChunks` + `ensureIndexExists` from `lib/pinecone.ts` with `PINECONE_INDEX=bible-kjv` so you don't write into your medical index. The whole book is ~1M embedding tokens ≈ **$0.02**, and it fits your Pinecone free tier.
- **Verify** in the Pinecone console: the vector count and your metadata look right.

Searching the index comes next class — this week is chunk + store.

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
3. **What sentence overlap is and when you'd use it**

Submit via the link pinned in Slack.

The code is the easy half — **the reasoning is the assignment.**
