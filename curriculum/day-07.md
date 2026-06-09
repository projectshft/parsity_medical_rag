# Day 7 — Why Chunking Exists (and Why Our Medical Notes Don't Need It)

**Needs: the medical dataset from earlier; an internet connection to download one new file**

## Today you will

- Understand what chunking is and the one question it answers
- Measure your own corpus and make the chunking decision *from the measurement*
- Download the corpus we'll deliberately mangle all week: the Bible

## Concept

The meaning-based search you'll build operates on **pieces of text**. A user's question gets matched against stored pieces, and the best-matching pieces are what the system retrieves and hands to the LLM. That creates a question someone has to answer for every corpus:

**What is one piece?**

A piece that's too big matches everything a little and nothing well — a 40-page document "mentions" diabetes, sleep, surgery, and billing, so it's a mediocre match for all of them. A piece that's too small is precise but useless on arrival — `"And he said unto them"` matches confidently and tells the reader nothing. Said? Who? Them?

**Chunking** is the act of splitting documents into retrieval-sized pieces. And here's the part most tutorials skip: *whether you need it at all is a property of your corpus, not a default step in a pipeline.*

### Two corpora, two answers

| | Our clinical notes | The King James Bible |
|---|---|---|
| Documents | ~144,000 separate notes | 1 document |
| Size each | ~450 characters average | 4.3 **million** characters |
| Natural retrieval unit | the whole note | ??? — that's this week's work |
| Chunking needed? | **No** — one note is already a piece | **Yes** — unavoidably |

A clinical note *is already chunk-sized*. It's one encounter, one topic, one date, self-contained. Splitting it would only break it. So our medical pipeline stores **one note = one piece**, and the "chunking step" is a no-op.

But you can't learn chunking from a corpus that doesn't need it. So this week we borrow one that desperately does: the Bible. One enormous public-domain document with beautiful internal structure (books → chapters → verses) that we can chunk well, chunk badly, and *measure the difference*.

> **Why the Bible and not more medical data?** Because it's open, it's one giant document (the opposite shape of our notes), its structure is famous enough that you can *see* when a chunk is broken — and using a different corpus proves the skill transfers. Chunking decisions belong to the corpus in front of you. Learning that on two very different corpora is the lesson.

## Implementation

### 1. Download the corpus

```bash
mkdir -p data/bible
curl -o data/bible/kjv.txt https://www.gutenberg.org/cache/epub/10/pg10.txt
```

That's the full King James Bible from Project Gutenberg — **4,455,950 bytes** in one file (`data/bible/` is gitignored; like all data here, it's downloaded, not committed).

### 2. Read its shape

```bash
head -120 data/bible/kjv.txt
```

Notice three things:

- A Project Gutenberg header (license boilerplate) before `*** START OF THE PROJECT GUTENBERG EBOOK ***` — **not scripture, must be stripped** before any processing
- Book titles as plain lines: `The First Book of Moses: Called Genesis`
- Every verse prefixed `chapter:verse`, like `1:1 In the beginning…` — built-in structure markers, which will matter a great deal in two days

### Common mistakes

- **Chunking by habit.** "Step 2 of every RAG tutorial is chunking" — no. It's a decision, and for short self-contained documents the right chunk count is *one*. Pipelines that blindly split 450-character notes into 200-character fragments destroy meaning for nothing.
- **Trusting the average alone.** An average of 450 characters could hide a few 50,000-character monsters. You need the distribution — that's why the exercise below computes the max, not just the mean.
- **Processing the Gutenberg header as content.** The first ~3,000 characters of the download are license text. Every Bible script this week strips it; if you roll your own, you must too.

## Your turn

Spend **no more than 45 minutes** here. Today you justify our medical no-chunking decision with your own measurement — the "no metric, no decision" rule applied to architecture.

Write a small script that:

1. Reads 50–100 patient bundle files from your data directory
2. Finds every `DocumentReference`, base64-decodes `content[0].attachment.data` (you did one by hand earlier — now automate it)
3. Prints: note count, average length, median, and **max** length in characters

Then answer in your notes: given your numbers, is one-note-one-piece justified? What max length would have changed your mind?

## Check yourself

- In one sentence: what goes wrong when pieces are too big? Too small?
- Your corpus has documents averaging 80,000 characters. Chunk or not? What if it averages 300?

<details>
<summary>Solution / discussion</summary>

A working measurement script (run with `npx ts-node --compiler-options '{"module":"CommonJS"}' measure-notes.ts`):

```typescript
import * as fs from 'fs';
import * as path from 'path';

const dir = 'data/coherent/fhir'; // or data/subset
const lengths: number[] = [];

for (const file of fs.readdirSync(dir).slice(0, 100)) {
  const bundle = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
  for (const entry of bundle.entry ?? []) {
    const r = entry.resource;
    if (r.resourceType !== 'DocumentReference') continue;
    const data = r.content?.[0]?.attachment?.data;
    if (!data) continue;
    lengths.push(Buffer.from(data, 'base64').toString('utf-8').trim().length);
  }
}

lengths.sort((a, b) => a - b);
const avg = Math.round(lengths.reduce((s, n) => s + n, 0) / lengths.length);
console.log(`notes: ${lengths.length}`);
console.log(`avg: ${avg} | median: ${lengths[Math.floor(lengths.length / 2)]} | max: ${lengths[lengths.length - 1]}`);
```

Typical result on this dataset: averages in the mid-hundreds of characters, max in the low thousands. **Verdict: one note = one piece.** Even the longest notes are well within what a single retrieval piece can carry.

**What would change the answer:** a max in the tens of thousands — say, discharge summaries running 40,000 characters. Then the *long tail* needs splitting even if the average looks fine. The decision rule isn't "is the average small" but "is every document an acceptable piece."

**80,000-char average → chunk.** **300-char average → don't.** Both answers take one measurement and zero ideology.

</details>

## Further reading (optional)

- [Pinecone: Chunking strategies](https://www.pinecone.io/learn/chunking-strategies/) — a map of the strategy space we'll walk through this week
