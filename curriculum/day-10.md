# Day 10 — Metadata: The Part Everyone Skips

**Needs: `data/bible/chunks-smart.jsonl` from yesterday**

## Today you will

- Understand why a chunk without metadata is a quote without a source
- Use chunk metadata to filter, cite, and debug — the three jobs text alone can't do
- Map the Bible lab's metadata design onto the medical system you're building

## Concept

Look at one chunk from yesterday's output:

```json
{
  "id": 5000,
  "text": "48:10 According to thy name, O God, so is thy praise unto the ends of the earth...",
  "metadata": {
    "book": "The Book of Psalms",
    "chapter": 48,
    "verseStart": 10,
    "verseEnd": 1,
    "reference": "The Book of Psalms 48:10-49:1"
  }
}
```

The `text` is what gets *matched*. The `metadata` is everything else a retrieval system has to do with a match:

| Job | Question it answers | Without metadata |
|---|---|---|
| **Cite** | "Where does this come from?" | "Somewhere in 4.3 million characters" |
| **Filter** | "Search only in Psalms" | Impossible — you'd search everything, always |
| **Debug** | "Why did *this* chunk match?" | You can't even find it in the source to check |

Yesterday's audit line `has metadata: 0%` for the naive chunker wasn't cosmetic. Naive chunks are *anonymous*: when one matches, you cannot tell a user where the answer came from, cannot scope a search, and cannot trace a bad result back to its source. The text is there; the *accountability* is gone.

### The medical parallel

This isn't a Bible quirk — it's the exact design our medical pipeline uses. Every clinical note stored for search carries:

```
patientId    → filter:  "search only this patient's notes"
patientName  → cite:    show who the note belongs to
type         → filter:  "History and physical note" vs other kinds
date         → filter + cite: "notes from 2020 onward"
```

Same three jobs, different domain. `book` is `patientId`. `reference` is the citation a doctor sees. A "search only in Psalms" filter is "search only this patient" — and getting *that* one wrong in medicine isn't a bad search result, it's showing one patient's chart in another patient's answer. **Metadata is where retrieval meets accountability.**

> **Decide metadata at chunking time, not later.** The chunker is the last moment the source context (which book? which verses?) is cheaply in hand. Try to add it afterward and you're re-deriving provenance from anonymous text — somewhere between expensive and impossible. This is why `metadata` is built inside `buildChunk()` in `scripts/bible/chunk-smart.ts`, not bolted on by a second pass.

## Implementation

Work directly against yesterday's output with `jq` (or Node if you prefer).

### 1. Filter: search scoped to one book

```bash
# how many chunks per book? (top 5)
cat data/bible/chunks-smart.jsonl | jq -r '.metadata.book' | sort | uniq -c | sort -rn | head -5

# pull only Psalms chunks into a working set
cat data/bible/chunks-smart.jsonl | jq -c 'select(.metadata.book == "The Book of Psalms")' | wc -l
```

That second command is a metadata filter — the same operation as "only this patient's notes," done with a field instead of a full-text guess.

### 2. Cite: turn a match into a source

```bash
# grab one chunk and format a citation a reader could verify
cat data/bible/chunks-smart.jsonl | jq -r 'select(.id == 5000) | "\"\(.text[0:80])...\" — \(.metadata.reference)"'
```

### 3. Debug: trace a result to its source

Pick any chunk, take its `reference`, and find that passage in `data/bible/kjv.txt` by hand. That round trip — result → reference → source — is what debugging retrieval looks like, and it only exists because the chunker recorded the address.

### Common mistakes

- **Stuffing metadata into the text.** Prepending `"Book: Psalms, Chapter 48 —"` to the text *can* help matching (more on that in the reading below), but it is not a substitute for structured fields. You can't `select()` on prose. Store fields as fields; enrich text deliberately, separately, or both.
- **Hoarding fields you'll never filter on.** Metadata isn't free — every field is something to populate correctly for 10,000 chunks. `book` earns its keep (you'll filter on it); `translationCommitteeName` doesn't. Add fields for the three jobs, not for completeness.
- **Inconsistent values.** If half your chunks say `"Psalms"` and half `"The Book of Psalms"`, your filter silently returns half the data. Metadata is a contract; the chunker enforces it in one place precisely so it can't drift.

## Your turn

Spend **no more than 45 minutes** here.

1. Using `jq`, produce: total chunks in Genesis, the chunk count for the *shortest* book, and a formatted citation for any chunk in Revelation.
2. Yesterday you mapped markdown docs to verse/book. Now design the metadata: you're chunking your company's internal documentation for search. Write the 3–5 fields you'd attach to every chunk, and for each, which of the three jobs (cite / filter / debug) it serves.
3. One of your fields probably serves *no* job. Find it and cut it. (If they all survive, say why.)

## Check yourself

- A teammate says "we'll add metadata in a second pass after chunking." What breaks?
- For the medical system: which metadata field makes the difference between a useful answer and a privacy incident?

<details>
<summary>Solution / discussion</summary>

**jq answers (yours should be close):** Genesis lands around 450–500 chunks; the shortest books (2 John, 3 John, Obadiah, Jude) produce only 2–4 chunks each — small books are nearly "one chunk = one book," which is itself a sanity check that chunking respects boundaries. A Revelation citation looks like: `"22:20 He which testifieth these things saith..." — The Revelation of Saint John the Divine 22:20-21`.

**Documentation metadata, one defensible design:**

| field | job |
|---|---|
| `docPath` (e.g. `guides/onboarding.md`) | cite + debug — the round trip back to source |
| `section` (the heading trail) | cite — humans navigate by headings |
| `team` or `product` | filter — "search only the billing docs" |
| `lastUpdated` | filter — stale docs are the #1 doc-search complaint |
| `author` | usually the cut: you'll never filter by it, and `docPath` already locates blame for debugging |

**"Second pass" breakage:** after chunking, the mapping from chunk back to source location is gone — chunk 7,012's text exists nowhere *addressable*. You'd be re-parsing the corpus and fuzzy-matching text to guess provenance. The first pass had it for free.

**The medical field:** `patientId`. Filtering by it is what keeps patient A's notes out of patient B's answers — that's not relevance tuning, that's the privacy boundary itself.

</details>

## Further reading (optional)

- [Anthropic: Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval) — the "enrich the text deliberately" idea taken to its logical end: prepending generated context to each chunk before storage
