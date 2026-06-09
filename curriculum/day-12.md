# Day 12 — Your Turn: Chunk a Document You've Never Seen

**Needs: this week's checklist; an internet connection**

## Today you will

- Apply the full chunking method — measure, choose joints, chunk, audit — to a brand-new corpus, alone
- Defend every dial setting with a number
- Record this block's deliverable video

This is a **build day**. The Bible lab had training wheels: the scripts existed, the structure was famous, the numbers were in the day files. Today the wheels come off.

## The brief

Your corpus is the **United States Constitution** — also public domain, also structured, but structured *differently*: no verse markers, instead nested **Articles → Sections** with prose paragraphs inside.

```bash
curl -o data/bible/constitution.txt https://www.gutenberg.org/cache/epub/5/pg5.txt
```

(It lands in `data/bible/` to stay inside the gitignored lab directory — mildly mislabeled, deliberately ignored.)

Deliver, in your notes and code:

1. **The measurement.** Size of the document, count and size of its natural units. (It's ~45,000 characters — three orders of magnitude smaller than the Bible. Does it even need chunking? Prove your answer either way, then chunk it anyway for the exercise.)
2. **The joint decision.** What's the "verse" here? What's the "book"? Write it down *before* coding — Articles, Sections, paragraphs? Defend the choice in two sentences.
3. **The chunker.** Write `scripts/bible/chunk-constitution.ts`. Steal shamelessly from `chunk-smart.ts` — adapting a working pattern to new structure is the actual job skill. Attach metadata fit for the three jobs (cite / filter / debug).
4. **The audit.** Run `npm run bible:audit -- data/bible/chunks-constitution.jsonl`. Then apply the five-mode checklist from yesterday and write one line per mode.

Rules of engagement: use AI assistants exactly as much as you would at work. Spend **no more than 30 minutes** stuck on parsing before reading the hints. The deliverable is the *decisions and numbers*, not heroic regex.

## Hints (read only when needed)

- The Gutenberg header/footer problem is identical — `extractBody` from `parse.ts` already solves it if you adjust nothing but your expectations.
- Section headers look like `Section 1.` on their own line; articles like `Article 1.` A two-level split (article, then section) gets you addressable units.
- The Constitution's sections vary wildly in size — Article 1 Section 8 (the powers of Congress) is enormous; some sections are one sentence. Your audit will show size variance. *Is that a failure?* Yesterday's mode-5 discussion is your guide.
- Don't forget the audit script accepts any `.jsonl` with `{text, metadata}` lines — it doesn't care that this isn't the Bible.

## Check yourself

You're done when:

- `chunk-constitution.ts` runs clean and writes a `.jsonl`
- The audit shows 0% mid-word starts and 100% metadata
- Your notes contain: the measurement, the joint decision with rationale, the five-mode checklist answers, and a citation example (e.g. *"No Bill of Attainder…" — Article 1, Section 9*)

<details>
<summary>Solution / discussion</summary>

**The measurement first:** ~45k characters total. At that size the *whole document* fits in a single LLM context easily — so does it need chunking for retrieval? Arguably yes anyway: questions like "what does the Constitution say about treason?" deserve a *section*, not the whole text, both for precision and for citation. This is the nuance: chunking serves precision and accountability, not just size limits. Saying "it's small, send it all" is defensible for some applications and you were asked to defend, not guess.

**A solid joint decision:** Section as the chunk (self-contained legal thought, the unit lawyers cite), Article as the boundary never to blend across. Paragraph-level is too fine (orphaned clauses — mode 2); Article-level too coarse (Article 1 alone is ~half the document — mode 5).

**Metadata that earns its keep:**

```typescript
type ConstitutionChunk = {
  id: number;
  text: string;
  metadata: {
    article: number;        // filter: "only Article 3"
    section: number | null; // cite: the unit of legal citation (null: preamble/signatures)
    reference: string;      // "Article 1, Section 9" — the human-facing citation
  };
};
```

**Expected audit shape:** few dozen chunks; sizes from ~100 chars (one-line sections) to several thousand (Art. 1 §8). Mid-word starts 0%, metadata 100%. The size variance is *honest* — it mirrors the document's real structure, exactly like the 1,675-char verse chunk did. A "fix" that split §8 into uniform 500-char pieces would trade mode-5 tidiness for mode-1/mode-2 damage on the single most-cited section of the document.

**The transfer lesson:** you just chunked two corpora with completely different structure using one method — measure, find the joints, respect them, carry the address, audit. The method is the skill. The Bible scripts are scaffolding you'll throw away; the checklist isn't.

</details>

## Deliverable 🎥

Record **2–3 minutes**, phone camera is fine. Pick one:

- **Defend a decision:** Walk through your Constitution chunking choices — the joint you cut at, the dial settings, and the audit numbers that justify them. Name the alternative you rejected and why.
- **Teach back:** Explain to a non-engineer why "split the document every 500 characters" ruins a search system, and what to do instead — using one concrete broken chunk from this week as your prop.

**Submit:** [Typeform — submission](https://form.typeform.com/to/PLACEHOLDER-DAY12) <!-- PLACEHOLDER: replace with real Typeform URL -->

## Rest day next

That's the chunking block. You took one corpus that needed no chunking and proved it, mangled another with the naive approach and *measured* the damage, fixed it by respecting structure, attached accountability, named the five ways it all fails, and then did the whole dance solo on a document you'd never processed. **Tomorrow is a rest day.** When you return: what actually happens to these chunks — how text becomes searchable by meaning.

## Further reading (optional)

- [The U.S. Constitution, Project Gutenberg eBook #5](https://www.gutenberg.org/ebooks/5) — your corpus, in context
