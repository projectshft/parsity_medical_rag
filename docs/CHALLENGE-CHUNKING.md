# Challenge: Chunk the Bible — and defend your strategy

You're going to take a 4-million-character book, decide how to cut it into searchable pieces, build those pieces, and store them in your own vector index. Then you'll explain your choices on video — with a reason. (Querying the index comes next class — this week is chunk + store.)

> **Why this text?** Nothing religious about this exercise. The King James Bible happens to be a perfect chunking corpus: it's public domain, heavily quoted, and structured half a dozen ways at once (books → chapters → verses → paragraphs → topical passages) — so there are _many_ defensible chunking strategies, and you have to pick one and justify it. Popular products do exactly this for real (semantic Bible search/study apps are a whole category). We just need a big, structured, quotable text — this is the one everyone has.

## Setup

```bash
npm run bible:fetch    # downloads kjv.txt from Project Gutenberg (~4.2 MB)
npm run bible:fixed    # the provided NAIVE chunker — run it and READ the output
```

Look at what `bible:fixed` produces. It slices every 500 characters, mid-verse, mid-sentence, mid-word. That damage is your baseline — whatever you build has to beat it, and `npm run bible:audit -- <file>` will measure both.

## Part 1 — Research (~30–45 min, before you write code)

Read up on chunking. You're looking for answers to three questions:

1. What chunking strategies exist? (fixed-size, sentence, paragraph, structural/document-aware, semantic)
2. **What is chunk overlap** (sometimes "sentence overlap"), and what problem does it solve?
3. How does the way people will _query_ an index change how you should chunk it?

Good starting points:

- Pinecone — [Chunking Strategies for LLM Applications](https://www.pinecone.io/learn/chunking-strategies/)
- LangChain — [Text splitters concepts](https://python.langchain.com/docs/concepts/text_splitters/)
- Greg Kamradt — [5 Levels of Text Splitting](https://github.com/FullStackRetrieval-com/RetrievalTutorials/blob/main/tutorials/LevelsOfTextSplitting/5_Levels_Of_Text_Splitting.ipynb)

## Part 2 — Design your strategy

Decide how _you_ will chunk the KJV. Some of your options (all legitimate — the defense is the assignment):

| Strategy                               | Rough count    | Tradeoff to think about                                                                                                      |
| -------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| One chunk per **verse**                | ~31,000        | Precise citations, but tiny fragments — does "Jesus wept" carry enough meaning to embed? And is a 31k-vector index overkill? |
| One chunk per **chapter**              | ~1,189         | Big coherent units, but a chapter covers many topics — matches everything a little (remember the too-vague-query lesson)     |
| **Packed verses** toward a size target | a few thousand | The middle path — but now _you_ pick the size and what to do at boundaries                                                   |
| **Paragraph / passage** groupings      | varies         | Closest to how the text is actually read and quoted — but paragraphs aren't marked in this file; how do you find them?       |
| Any of the above **+ overlap**         | +10–20%        | Content near a cut is findable from both sides — at the cost of duplication                                                  |

**Before you build, write down two things** (they go in your video):

1. **Who uses this index and what do their queries look like?** "Find that verse about love being patient" wants different chunks than "what does the book say about money?" Your strategy should serve _your_ imagined user.
2. **Your rule at the boundaries.** Do chunks cross chapters? Books? Why or why not?

## Part 3 — Build it

Implement your strategy in `scripts/bible/chunk-smart.ts` (it's a stub; `loadVerses()` from `./parse` hands you every verse as `{ book, chapter, verse, text }`). Requirements:

- Write your chunks to `data/bible/chunks-smart.jsonl` — one JSON chunk per line
- Every chunk carries **metadata**: at minimum a human-readable reference (e.g. `"Genesis 1:1-5"`) — you learned in class why metadata decides what an index can do
- Then measure it:

```bash
npm run bible:smart
npm run bible:audit -- data/bible/chunks-fixed.jsonl
npm run bible:audit -- data/bible/chunks-smart.jsonl
```

Compare the two audits. If your numbers aren't better than the naive slicer's, that's information — figure out why.

## Part 4 — Store it

Now do to your chunks what we did to the medical notes in class: embed them and put them in a vector index.

- Write a small script (or adapt your vectorize work): read your `.jsonl`, embed each chunk, upsert. Reuse `upsertChunks` + `ensureIndexExists` from `lib/pinecone.ts` — set `PINECONE_INDEX=bible-kjv` so you don't write into your medical index. The whole book is ~1M embedding tokens ≈ **$0.02**, and it fits your free tier alongside `medical-notes`.
- **Verify it landed:** open the index in the Pinecone console (or fetch a vector by id) and check the count matches your chunk count and the metadata (your references) came through intact.

We haven't covered *searching* an index yet — that's next class, and your `bible-kjv` index is exactly what we'll query when we get there.

## Part 5 — The video (2–3 min, phone is fine)

Record yourself covering three things:

1. **Your strategy and why** — tied to your imagined user and their queries, not "it seemed reasonable"
2. **One researched concept, explained in your own words** — chunk overlap is the default pick (what failure does it prevent? when is it wasted duplication?), but any strategy/concept from your research works: semantic chunking, why chunk size interacts with embedding quality...
3. **Show your work** — a couple of real chunks from your `.jsonl` (read one out — does it stand alone?), your audit numbers vs. the naive slicer's, and your `bible-kjv` index in the Pinecone console with the vector count + metadata

Submit the video via the link in Slack.

## What a strong submission looks like

- A strategy with a **reason** — you can say who queries this index and why your chunk shape serves them
- Audit numbers for naive vs. yours, and you can read them out loud
- Your chunks visible in Pinecone with the reference metadata intact
- An explanation of overlap (or your chosen concept) that would survive a follow-up question

A weak submission chunks "however the example did it" and can't say why. The code here is the easy half — **the reasoning is the assignment.**
