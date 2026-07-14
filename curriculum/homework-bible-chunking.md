# Homework: Chunking — slice up the Bible and store it in Pinecone

**Needs: `OPENAI_API_KEY` + `PINECONE_API_KEY` (both already in your `.env`)**

> Nothing religious about this exercise — the KJV is just a big, public-domain, heavily-quoted text with lots of structure (books → chapters → verses), which makes it a perfect chunking corpus. Real semantic Bible-search apps exist; this is that, minus the search.

Our clinical notes don't need chunking — you proved that: one note is already a retrieval-sized piece. Most corpora aren't so tidy, and chunking is a core RAG skill you'll reach for constantly. So you learn it on a corpus that genuinely demands it: one enormous, beautifully structured document — the opposite shape of our notes. The transferable lesson: **decide from the corpus in front of you, not from habit.**

The assignment of record is `docs/CHALLENGE-CHUNKING.md` in your repo. This page is the same assignment, with more of the *why*.

## Get the text

```bash
npm run bible:fetch
```

That's it — downloads `kjv.txt` (~4.2 MB) into `data/bible/` (gitignored; like all data here, downloaded, not committed).

## The assignment

Write **one script** that **chunks the text and stores it in your own Pinecone index — with metadata**.

- **Chunking strategy is your call**: by verse, by chapter, packed passages, paragraphs, with or without overlap. Have a reason.
- **Every chunk carries metadata** — at minimum a human-readable reference like `"Genesis 1:1-5"`. (`scripts/bible/parse.ts` is provided: `loadVerses()` gives you every verse as `{ book, chapter, verse, text }` — nobody is grading your regex.)
- **Store it**: reuse `upsertChunks` + `ensureIndexExists` from `lib/pinecone.ts` with `PINECONE_INDEX=bible-kjv` so you don't write into your medical index. The whole book is ~1M embedding tokens ≈ **$0.02**, and it fits your Pinecone free tier.
- **Verify** in the Pinecone console: the vector count and your metadata look right.

**Searching the index comes next class — this week is chunk + store.**

## Why you can't just slice every 500 characters

Before designing your strategy, watch the naive way fail. A fixed-size chunker is provided:

```bash
npm run bible:fixed
```

It slices the raw text into 500-character windows and prints a few of them. Read one. Odds are it starts mid-word, ends mid-sentence, and — worse — carries no idea which book or chapter it came from. A chunk like that can match a query, but it can't be *cited*, *filtered*, or *traced back* to the source. If you want the damage as numbers instead of vibes, the optional auditor measures it:

```bash
npm run bible:audit -- data/bible/chunks-fixed.jsonl
```

The vast majority of fixed-size chunks start mid-word or end mid-sentence, and exactly zero have metadata. Try `-- --size 800`; the percentages barely move. The flaw isn't the size — it's that **character positions don't align with meaning**. The Bible hands you real joints (verses, chapters, books). Whatever you design should cut along meaning, not byte offsets.

## Picking a strategy: who queries this index?

There's no "correct" chunk. Every option trades something:

| Strategy | What it buys | What it costs |
|---|---|---|
| One chunk per verse | Precise matches, perfectly citable | Tiny fragments — `"And he said unto them"` matches confidently and tells you nothing |
| One chunk per chapter | Full narrative context | Matches everything a little and nothing well; way past retrieval size |
| Packed passages (whole verses up to ~N chars) | Retrieval-sized pieces with clean boundaries | Size variance — the longest verse is ~1,500 chars by itself, so either it ships whole or you break your own rule |
| Paragraph-based | Follows the text's visible joints | KJV paragraphs are mostly single verses anyway — you inherit the per-verse problems |
| ± Overlap (repeat a little content across seams) | A thought that straddles a boundary survives in at least one chunk | More vectors, more cost, near-duplicate results |

```visual
chunking | Play with chunk size and overlap — watch precision trade against context before you pick a strategy
```

The tiebreaker is a question most tutorials skip: **who queries this index, and what do they ask?** A quote-hunter ("where does it say *love thy neighbour*?") is served by verse-sized precision. Someone asking "what happens in the flood story?" needs passage-sized context. Your chunk size is a bet on the questions — make the bet, and be able to say why. You don't have to be right; you have to decide *with a reason*.

## Storing it: the practical bits

- `scripts/bible/chunk-smart.ts` is an open stub — a natural home for your script if you don't want to start from a blank file. `PINECONE_INDEX` is read when `lib/pinecone.ts` loads, so set it for the run rather than editing `.env` (your medical index keeps working):

  ```bash
  PINECONE_INDEX=bible-kjv npm run bible:smart
  ```

- Call `ensureIndexExists()` once at the top of your script — it creates the index (1536 dimensions, cosine) if it's missing.
- `upsertChunks()` takes `{ id, content, metadata }[]` and does the embedding and batching for you. `id` must be a string; the metadata type requires a `source` field (`'kjv'` is fine) — put your `reference` in there alongside it.
- Optional but smart: write your chunks to a `.jsonl` file first, skim them, run `npm run bible:audit -- <file>` on them — *then* spend the two cents on embeddings.

## Verify

Open the Pinecone console: your `bible-kjv` index exists, the record count matches what your script reported, and a spot-checked record has content plus a `reference` that reads like a citation. If a chunk in the console can't tell you where it came from, your metadata isn't doing its job.

## The video (2–3 min, phone is fine)

1. **What chunking is**, in your own words
2. **How you approached it here** — your strategy and why
3. **What sentence overlap is and when you'd use it**

Submit via the link pinned in Slack.

The code is the easy half — **the reasoning is the assignment.**

```quiz
[
  {
    "q": "The fixed-size chunker breaks at 500 characters, and bumping it to 800 barely moves the audit numbers. Why?",
    "options": [
      "800 is still too small — chapter-sized chunks would pass the audit",
      "The flaw isn't the size — character positions don't align with meaning, so any byte-offset cut starts mid-word, ends mid-sentence, and carries no idea where it came from",
      "The audit script is calibrated for 500-character chunks, so other sizes score poorly"
    ],
    "answer": 1,
    "explain": "No size fixes cutting at positions instead of joints. The text hands you real boundaries — verses, chapters, books — and whatever you design should cut along meaning, not offsets. Metadata falls out of that for free."
  },
  {
    "q": "Per-verse chunks are perfectly citable and precisely matched. What do they cost you?",
    "options": [
      "Verses are too long for the embedding model's input window",
      "Tiny fragments — 'And he said unto them' matches a query confidently and tells you nothing",
      "Per-verse chunks can't carry a human-readable reference in their metadata"
    ],
    "answer": 1,
    "explain": "Small chunks buy precision and pay in context: a fragment can score high on similarity while being useless to the reader. That's the core trade every strategy in the menu is negotiating from one side or the other."
  },
  {
    "q": "Verse, chapter, packed passages, overlap — what's the tiebreaker for choosing between them?",
    "options": [
      "Whichever produces the fewest vectors, since embedding cost dominates",
      "Who queries this index and what they ask — your chunk size is a bet on the questions",
      "Always the smallest unit the text offers; precision beats context in retrieval"
    ],
    "answer": 1,
    "explain": "A quote-hunter is served by verse-sized precision; 'what happens in the flood story?' needs passage-sized context. There's no correct chunk in the abstract — you make the bet on the expected questions, with a reason you can defend. The reasoning is the assignment."
  }
]
```

## Further reading (optional)

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
