# Side Project: Chunking the Bible (two parts)

**Needs: `data/bible/kjv.txt` (downloaded in the chunking-intro lesson); later, `OPENAI_API_KEY` + `PINECONE_API_KEY`**

This is a two-part side project that runs alongside the main course. Our clinical notes don't need chunking — you proved that: one note is already a retrieval-sized piece. But *most* corpora aren't so tidy, and chunking is a core RAG skill you'll reach for constantly. So you learn it on a corpus that genuinely demands it: the King James Bible — one enormous, beautifully structured public-domain document, the opposite shape of our notes.

- **Part 1 (this week):** research chunking strategies, propose one for the Bible, and record a short video explaining what chunking *is*.
- **Part 2 (next week):** actually chunk the Bible with the lab scripts, measure the results, and upload the chunks to a vector store so you can search them.

The whole point of doing it on two opposite corpora — notes (don't chunk) and Bible (must chunk) — is the transferable lesson: **decide from the corpus in front of you, not from habit.**

---

## The corpus

If you haven't already:

```bash
mkdir -p data/bible
curl -o data/bible/kjv.txt https://www.gutenberg.org/cache/epub/10/pg10.txt
```

That's the full King James Bible — about **4.4 million bytes in one file** (`data/bible/` is gitignored; like all data here, it's downloaded, not committed). Three features you'll reckon with:

- A Project Gutenberg license header before `*** START OF THE PROJECT GUTENBERG EBOOK ***` — **not scripture; strip it** before processing.
- Book titles as plain lines: `The First Book of Moses: Called Genesis`.
- Every verse prefixed `chapter:verse` — `1:1 In the beginning…` — machine-readable structure markers.

The lab scripts already exist in `scripts/bible/` — you'll *run* them in Part 2, not write them from scratch:

- `npm run bible:fixed` — the naive chunker (fixed-size character windows)
- `npm run bible:smart` — the structure-aware chunker (packs whole verses, never splits one, never crosses a book, with overlap)
- `npm run bible:audit -- <file.jsonl>` — turns "these chunks look bad" into numbers

---

## Part 1 — research and propose (this week)

No coding required. The deliverable is a **decision and a video**, not a chunker.

### 1. Understand the one question

Chunking answers: **what is one piece?** A piece too big matches everything weakly (a whole book "mentions" creation, law, and prophecy — a mediocre match for each). A piece too small is precise but useless (`"And he said unto them"` — said what? to whom?). Chunking finds the size in between, *for this corpus*.

### 2. Survey the strategies

Read the Pinecone chunking guide (linked below) and note the main families:

- **Fixed-size** — slice every N characters. Simple, structure-blind.
- **Recursive/separator-based** — split on a cascade (paragraphs → sentences → words). The common general-purpose default; good when a corpus has no reliable structure.
- **Structure-aware** — cut along the document's own declared joints (here: verses, chapters, books).
- **Overlap** — repeat a little content across a seam so a thought that straddles two chunks survives in at least one.

### 3. Propose one for the Bible — and defend it

Write, in your notes:

- **The joints.** What's the "verse" (smallest self-contained unit) and what's the "book" (hard boundary you must never blend across)? The Bible hands you both explicitly — use them.
- **The trade-off.** Every strategy trades something. If you pack whole verses to a ~500-character target and never split one, what happens to the longest verse? (The longest, Esther 8:9, is ~1,500 characters by itself.) Name the cost you're accepting.
- **Overlap.** How much, and what does it buy versus what it costs?

You don't have to be right — you have to *decide with a reason*. Next week you run it and find out.

### 4. Deliverable 🎥 — "what is chunking?"

Record **2–3 minutes** (phone is fine). Explain, to a non-engineer:

- What chunking *is*, and the one question it answers.
- Why "split every 500 characters" ruins a search system (use the mid-word cut as your prop: character 500 lands in the middle of "houses," and neither half owns the word).
- The strategy you're proposing for the Bible and the **one trade-off** it makes.

Grade yourself against: *did you explain the trade-off, or just recite "chunk the text"?* A weak video says "you break the document into smaller parts." A strong one shows *why the naive way breaks* and *what your strategy gives up to avoid it*.

**Submit:** [Typeform — submission](https://form.typeform.com/to/PLACEHOLDER-BIBLE-P1) <!-- PLACEHOLDER: replace with real Typeform URL -->

---

## Part 2 — chunk, measure, upload (next week)

Now you run it and let the numbers judge your Part 1 proposal.

### 1. Feel the naive failure

```bash
npm run bible:fixed
npm run bible:audit -- data/bible/chunks-fixed.jsonl
```

Expected audit:

```
chunks:               8,616
starts mid-word:      7,634 (88.6%)
ends mid-sentence:    8,339 (96.8%)
has metadata:         0 (0.0%)
```

Nearly every piece is damaged at an edge, and *none* can be cited — it threw away book and chapter. Try `--size 800`; the percentages barely move. The flaw isn't the size, it's that **character positions don't align with meaning**.

### 2. Chunk along the structure

```bash
npm run bible:smart
npm run bible:audit -- data/bible/chunks-smart.jsonl
```

| metric | fixed | structure-aware |
|---|---|---|
| starts mid-word | **88.6%** | **0.0%** |
| ends mid-sentence | **96.8%** | **3.5%** |
| has metadata | 0% | **100%** |
| size min / median / max | 201 / 500 / 500 | 379 / 594 / **1,675** |

Read the trade honestly: you bought boundary integrity and citability, and paid with **size variance** — the max chunk is 1,675 chars because the longest verse ships whole (never split a verse). That's the cost you predicted in Part 1. Sweep overlap (`npm run bible:smart -- --overlap-verses 0`, `2`, `5`) and watch the chunk count balloon with near-duplicates — overlap is insurance, not a virtue.

### 3. Metadata: the three jobs

Every structure-aware chunk carries metadata, and that's not decoration — it's the difference between a quote and a *sourced* quote:

| Job | Question | Field |
|---|---|---|
| **Filter** | "search only Psalms" | `book` |
| **Cite** | "where's this from?" | `reference` (e.g. `Psalms 48:10-49:1`) |
| **Debug** | "why did this match?" | trace `reference` back to `kjv.txt` |

This is the *exact* design our medical pipeline uses: `book` is `patientId`, `reference` is the citation a clinician sees. Metadata is where retrieval meets accountability — and you decide it *at chunking time*, when the source context is cheaply in hand, never in a second pass.

### 4. Upload and search

Now make the chunks searchable — the same round trip you did with the notes, on cargo you can judge by eye. Load a slice into the vector store with `upsertChunks` (from `lib/pinecone.ts`, the same function `vectorize` uses), then search it with `searchChunks`:

```typescript
import 'dotenv/config';
import * as fs from 'fs';
import { upsertChunks, searchChunks, MedicalChunk } from '../lib/pinecone';

async function main() {
  const chunks: MedicalChunk[] = fs
    .readFileSync('data/bible/chunks-smart.jsonl', 'utf-8')
    .split('\n')
    .filter(Boolean)
    .slice(0, 2000) // a cheap, searchable slice
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
  await upsertChunks(chunks);

  for (const q of ['the creation of the world', 'love thy neighbour', 'forgiveness of sins']) {
    const results = await searchChunks(q, 3);
    console.log(`\n=== ${q}`);
    for (const r of results) {
      console.log(`${r.score.toFixed(3)}  [${r.metadata.reference}]  ${r.content.slice(0, 80)}…`);
    }
  }
}
main();
```

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/bible/upload-and-search.ts
```

> **Heads up:** this shares the `medical-notes` index with the notes. Use a separate index (set `PINECONE_INDEX` to something like `bible-test` before running) so the scripture doesn't mix into your medical search. The Bible is *test cargo* — keep it out of the clinical corpus.

Judge the results the way you judged the chunks: did "the creation of the world" surface Genesis 1? Does every hit carry a `reference` you can verify against `data/bible/kjv.txt`? That round trip — query → match → reference → source — is the metadata payoff, live. Then try a query the corpus *can't* answer ("how do I file my taxes") and note the scores are lower but **not zero** — vector search always returns *something*, which is why "it returned results" isn't "it's right."

### The five failure modes (keep this)

Everything the side project shows compresses into five modes. Memorize them; they'll show up your whole career wearing different clothes:

| # | Mode | Looks like | Measurement |
|---|---|---|---|
| 1 | **Fragmentation** | cuts mid-word / mid-sentence | % mid-word starts / mid-sentence ends |
| 2 | **Context orphaning** | whole but meaningless alone (`"And he said unto them"`) | min size; manual sampling |
| 3 | **Boundary straddling** | the answer spans a seam | overlap setting |
| 4 | **Anonymity** | can't cite, filter, or trace | % with metadata |
| 5 | **Wrong granularity** | too big (matches all weakly) / too small (precise, empty) | size distribution vs the natural unit |

The point isn't to zero out every mode — you *can't*: fixing fragmentation (never split a verse) *created* size variance. Chunking isn't a problem you solve; it's dials you balance, **for this corpus, with measurements**.

### Stretch: prove the skill transfers

If you want to show the method isn't Bible-specific, chunk a corpus with *different* structure — the U.S. Constitution (`https://www.gutenberg.org/cache/epub/5/pg5.txt`, ~45k chars, nested Articles → Sections instead of verses). Adapt `chunk-smart.ts`: the "verse" becomes a Section, the "book" becomes an Article. Same method — measure, find the joints, respect them, carry the address, audit — different document. *The method is the skill; the scripts are scaffolding.*

---

## Done when

- **Part 1:** your notes contain a chunking strategy for the Bible with its joints and its named trade-off; your "what is chunking" video is submitted.
- **Part 2:** you've run both chunkers and reproduced the audit contrast; you can state the trade the structure-aware chunker made; and you've uploaded a slice and verified a search result against `kjv.txt` by its `reference`.

## Further reading (optional)

- [Pinecone: Chunking strategies](https://www.pinecone.io/learn/chunking-strategies/) — your Part 1 reading; reread it after Part 2 and count which failure modes each strategy trades against.
- [Anthropic: Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval) — enriching each chunk with generated context before storage, the idea taken to its logical end.
</content>
