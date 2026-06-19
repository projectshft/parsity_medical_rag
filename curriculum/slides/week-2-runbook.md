# Week 2 — Chunking (the Bible lab) · Facilitator Runbook

**Block:** Chunking (the Bible lab) · **Days covered:** 7–12 · **Session length:** ~100 min · **Deck:** `week-2.html`

**Goal of this session:** the room leaves able to make the chunking decision *from a measurement* — whether to chunk at all, where to cut, and how much to overlap — and they've run the naive chunker, watched the audit numbers collapse when they cut on structure, and can name the five failure modes by their metrics.

> This runbook is backstage. Say anything here; the slides are what students see. You do **not** need to have built the lab to run this — Pre-flight and Code-together assume you're coming in cold. The single idea to protect all session: **chunking is a decision you make from data, not a default step you run by habit.** The Bible is the teaching corpus *precisely because* our medical notes don't need chunking — the contrast is the whole lesson.

---

## Pre-flight (before the room arrives)

- [ ] Repo cloned on the **`student`** branch, `npm install` done. No API keys needed this week — chunking is all local file work (no Neon, no OpenAI, no Pinecone).
- [ ] **Download the corpus yourself first** so you're not waiting on Gutenberg live:
      ```bash
      mkdir -p data/bible
      curl -o data/bible/kjv.txt https://www.gutenberg.org/cache/epub/10/pg10.txt
      ```
      Confirm it's ~4.4 MB (`4,455,950 bytes`). `data/bible/` is gitignored — downloaded, never committed.
- [ ] Run the full happy path once before class and confirm the numbers match the deck:
      ```bash
      npm run bible:fixed
      npm run bible:audit -- data/bible/chunks-fixed.jsonl
      npm run bible:smart
      npm run bible:audit -- data/bible/chunks-smart.jsonl
      ```
      You want `chunks-fixed.jsonl` and `chunks-smart.jsonl` both sitting in `data/bible/` before the room arrives.
- [ ] `jq` installed (`jq --version`) — Thursday's metadata work and several break-it entries use it.
- [ ] A terminal open in the repo; `data/bible/chunks-fixed.jsonl` open in an editor so you can scroll to chunk ~1000 live.
- [ ] `week-2.html` open full-screen in a browser. Arrow keys / click to navigate.

If `curl` to Gutenberg is slow or blocked in the room, hand out the pre-downloaded `kjv.txt` on a share — the lab survives one copy passed around.

---

## Timed flow (~100 min)

| Time | Arc segment | Slides | What to do |
|---|---|---|---|
| 0:00 | **Problem statement** | 1–3 | Cold open with the question every corpus forces: *what is one piece?* Read the two failure shapes aloud — the 40-page "mentions everything" chunk, and `"And he said unto them"`. Sit in the gap before naming the fix. |
| 0:08 | **How it's solved (the twist)** | 4 | The move: decide from data, not habit. Land the contrast — notes are *already* a piece (450 chars), the Bible is *one* 4.3M-char document. We learn on the Bible **because** the notes don't need it. |
| 0:15 | **Discussion / breakout** | 5 | "Chunk it or not?" Sort the four corpora from their numbers. Breakout if >8 people. The discharge-summary trap is the debrief. Answer key below. |
| 0:28 | **High-level concept** | 6 | The two ways a piece is wrong (too big / too small). Kill "just use 512/50" here. |
| 0:33 | **Code together I — naive + audit** | 7–9 | Download (or show pre-downloaded), `bible:fixed`, then the audit. Scroll to chunk 1000 live and find the torn word. Let the 88.6% land. |
| 0:50 | **Discussion — the size knob** | 10 | "Will a better size fix it?" Let them bet, then run `--size 200` / `--size 2000` and audit. The percentages don't move. This is the day's core finding. |
| 0:58 | **Concept — structure + overlap** | 11–12 | Cut on the document's own joints; never split a verse, never cross a book. Overlap as seam insurance and a cost. |
| 1:05 | **Code together II — smart + compare** | 13 | `bible:smart`, audit it, put the two audits side by side. 88.6% → 0%, metadata 0% → 100%, max jumps to 1,675. Read the trade honestly. |
| 1:18 | **Concept — metadata + five modes** | 14–15 | Why anonymous chunks can't cite/filter/debug; `book` = `patientId`. Then the five-mode table — each failure has a number. |
| 1:28 | **Break it / extend** | 16 | Run the zero-overlap seam experiment live (entry 1), then turn them loose. |
| 1:38 | **Research + recap + send-off** | 17–18 | Research question, where they are, Friday's Constitution deliverable. Tease next week vaguely: "what actually happens to these chunks." |

Runs long? Compress the size-knob discussion (0:50) and the metadata concept (1:18) — never the two code-togethers or the break-it.

---

## Breakout prompt + answer key

**Prompt (slide 5):** "For each corpus, decide chunk-or-not *from the number you're given*. For the trap, say what number you'd actually need to decide."

- **Clinical notes — avg 450, max ~3,000** → **don't chunk.** Every document is already an acceptable piece; one note = one encounter, one date, self-contained.
- **Support transcripts — avg 80,000** → **chunk.** Way past any retrieval-sized unit; an 80k-char "piece" matches everything weakly.
- **Tweets — avg 120** → **don't chunk** (and arguably they're *too small* already — chunking finer would manufacture mode-2 orphans).
- **Notes, but 1-in-1,000 is a 40,000-char discharge summary** → **the trap.** The average (still ~450) says "don't," but the *max* says the long tail needs handling. The rule isn't "is the average small" — it's "is **every** document an acceptable piece." You need the max/distribution, not the mean.

**What to listen for:** the instinct to decide from the average alone. The whole point of Day 7's measurement script is that it prints **max**, not just mean — because an average of 450 can hide a 50,000-char monster. Don't resolve the discharge-summary one too fast; the argument is the lesson.

---

## Code-together (slides 7–9 and 13)

### Part I — naive chunking and the audit (slides 7–9)

```bash
npm run bible:fixed                                 # slice every 500 chars
npm run bible:audit -- data/bible/chunks-fixed.jsonl
```

- **Narrate `bible:fixed`:** three lines of logic, no parsing — the right *starting point*, not because it's good, but because its failures define "good." Expected: `Corpus: 4,307,701 characters` · `Chunks: 8,616 (size=500, overlap=0)`. (Corpus char count is lower than the 4.4M download because the Gutenberg header/footer are stripped.)
- **Scroll to chunk 1000 live** in `chunks-fixed.jsonl` (`sed -n '1000p' data/bible/chunks-fixed.jsonl`) and point at `uses of the cities…` — the word "houses" cut in half. Don't tell them, let them spot it.
- **Narrate the audit:** `starts mid-word: 88.6%`, `ends mid-sentence: 96.8%`, `has metadata: 0%`. The line to say out loud: *a chunk is what gets matched and what gets read; a broken edge makes the model guess the missing half and mislead.*
- **Then the size-knob discussion (slide 10):** run `npm run bible:fixed -- --size 200` and `--size 2000`, audit each. Mid-word rate stays in the 85–90% band. The knob doesn't control the broken thing.

### Part II — structure-aware chunking + compare (slide 13)

```bash
npm run bible:smart                                 # pack whole verses, ~500 target, 1-verse overlap
npm run bible:audit -- data/bible/chunks-smart.jsonl
```

- **Before running, glance at `scripts/bible/parse.ts`** if asked: it strips the Gutenberg header and recovers **31,081 verses across 66 books** (canonical 31,102 — the gap is merged continuations). The teaching beat: *check your parser against known totals when totals are known.* Real text is never as clean as the format suggests.
- **Expected output:** `Verses: 31,081` · `Chunks: 9,737 (target=500, overlapVerses=1)`. Every chunk now prints an address like `[The Book of Psalms 48:10-49:1]`.
- **Put the two audits side by side** (the deck's slide 13 cards mirror this): mid-word `88.6% → 0.0%`, ends mid-sentence `96.8% → 3.5%`, metadata `0% → 100%`, max size `500 → 1,675`. Read the trade: we bought integrity + citability, we paid in size variance. The 1,675 is Esther 8:9, the longest verse, shipped whole rather than split.

**Expected output (both parts):** new/overwritten `data/bible/chunks-fixed.jsonl` and `chunks-smart.jsonl`; audit tables matching the deck.

**Most likely live failures (+ recovery):**
- **`kjv.txt` not found** → the download didn't complete or someone's in the wrong cwd. Re-run the `curl` from Pre-flight; confirm `data/bible/kjv.txt` exists.
- **Numbers slightly off from the deck** → fine and expected if Gutenberg reships the file; the *percentages and the direction of change* are the point, not the exact 8,616. Say so out loud.
- **Wrong branch** → if the `bible:*` scripts are missing, someone's on `main`/`instructor` not `student` (or didn't `npm install`). Check the branch first.
- **`jq` missing** on the size-knob/metadata bits → `brew install jq` or pivot to reading the `.jsonl` lines in the editor.

---

## Break it / extend bank

Run at least one live (entry 1 is the headline), then let the room try the rest. Each is grounded in the five failure modes from Days 8 and 11.

**1. Boundary straddling — kill the overlap (the headline one).**
- **Sabotage:** rebuild with zero overlap: `npm run bible:smart -- --overlap-verses 0`, then look at two adjacent chunks at a seam: `sed -n '5000,5001p' data/bible/chunks-smart.jsonl | jq -r '.metadata.reference'`.
- **Expected failure:** the two references now share **no verse** — the seam content lives in neither chunk. Write a question whose answer needs the last verse of one *and* the first verse of the next; it's unanswerable from any single chunk in the store.
- **Fix:** rebuild with overlap restored — `npm run bible:smart` (defaults to `--overlap-verses 1`) — and confirm the seam verse now appears in both chunks. **Re-audit to prove it.**
- **Extend:** sweep `--overlap-verses 0 / 2 / 5` and record chunk count at each (~8,400 → 9,737 → ~11,300 → ~17,000+). At 5, roughly half the stored text is duplicate. Overlap is insurance; you don't insure a house for ten times its value.

**2. Wrong granularity — "just pick a better size."**
- **Sabotage:** re-run the naive chunker at `--size 200` then `--size 2000`, auditing each.
- **Expected failure:** the mid-word-start rate stays in the **85–90%** band at every size. The chunk *count* changes (~21,500 at 200, ~2,150 at 2000) but the damage rate doesn't.
- **Fix:** there is no size that fixes it — the flaw is that *character offsets don't align with meaning*. The fix is structural chunking (Part II), not a better number.
- **Extend:** ask which direction of mode-5 each setting risks — `--size 200` manufactures orphaned fragments (too-small, mode 2/5); `--size 2000` makes each chunk match more queries less precisely (too-big, mode 5).

**3. Anonymity — the naive chunks have no address.**
- **Sabotage:** `sed -n '3000p' data/bible/chunks-fixed.jsonl | jq 'keys'` and compare to the same on `chunks-smart.jsonl`.
- **Expected failure:** the fixed chunk has no `metadata` — you cannot cite it ("somewhere in 4.3M chars"), cannot scope a search to one book, cannot trace a bad result back to source. The text is there; the *accountability* is gone.
- **Fix:** structure-aware chunking builds `metadata` inside the chunker (`buildChunk()` in `chunk-smart.ts`), not in a second pass — the chunker is the last moment provenance is cheaply in hand.
- **Extend:** make the medical stakes explicit — `book` here is `patientId` in our system. A broken filter isn't a bad search result; it's one patient's chart showing up in another patient's answer. That's the privacy boundary, not relevance tuning.

**4. Inconsistent metadata — the silent half-empty filter.**
- **Sabotage (thought experiment or hand-edit a few lines):** imagine half the chunks store `"Psalms"` and half `"The Book of Psalms"`, then filter `jq -c 'select(.metadata.book == "Psalms")'`.
- **Expected failure:** the filter silently returns *half* the data and looks like it worked — the worst kind of bug, no error, just quietly wrong.
- **Fix:** the chunker enforces the value in one place precisely so it can't drift. Metadata is a contract.
- **Extend:** connect to mode 4 (anonymity's quieter cousin) and to the Day 10 rule — store fields as fields, don't stuff provenance into the text where you can't `select()` on it.

---

## Misconceptions to preempt

- **"Chunking is step 2 of every RAG pipeline."** No — whether you chunk *at all* is a property of the corpus. For short self-contained documents the right chunk count is **one**. Splitting 450-char notes into 200-char fragments destroys meaning for nothing. This is the whole reason the Bible (not more medical data) is the teaching corpus.
- **"The chunk size is the important knob."** Students reach for the size parameter first. Day 8's finding: at every size, ~88% still start mid-word. Size doesn't control the thing that's broken — *boundary choice* does.
- **"Bigger chunks = more context = better."** They're attacking orphaning (mode 2) but risking too-big granularity (mode 5): each chunk matches more queries, each less precisely. Measure first — if retrieval misses trace to *seams*, overlap is the targeted fix; bigger chunks are the blunt one.
- **"We'll add metadata in a second pass after chunking."** After chunking, the map from chunk back to source location is gone — you'd be re-parsing the corpus and fuzzy-matching text to guess provenance. The first pass had it for free.
- **"There's a correct chunk size (512/50)."** That's a recited default, not a decision. There is no universally correct size; you balance the five dials *for this corpus, with measurements*.

---

## Deliverable 🎥 (Friday, Day 12 — the Constitution)

Solo build day, wheels off: students chunk the **US Constitution** (`pg5.txt`, ~45,000 chars, structured as Articles → Sections, no verse markers), write `scripts/bible/chunk-constitution.ts` by adapting `chunk-smart.ts`, attach cite/filter/debug metadata, and run `npm run bible:audit -- data/bible/chunks-constitution.jsonl`. Then record **2–3 min** (phone is fine), either *defend a decision* (their joint, dials, and the audit numbers that justify them, plus the alternative they rejected) or *teach back* (why "split every 500 chars" ruins search, with one concrete broken chunk as a prop).

**Grade against one question:** *can they justify every dial with a number — and name what they rejected and why?* A strong video says "I cut at Section, not paragraph, because paragraph-level orphaned clauses (mode 2) and Article-level made one chunk half the document (mode 5); my audit shows 0% mid-word, 100% metadata, and a 100→several-thousand-char size spread that's *honest* because it mirrors the real structure." A weak one recites "I used 500 with 50 overlap" with no measurement behind it — that's a default, not a decision, and it's the exact habit this block exists to break.

---

## Materials

- Student day files this anchors: `day-07.md` … `day-12.md`
- Deck: `week-2.html`
- Lab scripts (read live if asked): `scripts/bible/parse.ts`, `chunk-fixed.ts`, `chunk-smart.ts`, `audit.ts`
- npm scripts: `bible:fixed`, `bible:smart`, `bible:audit`
- Corpora: KJV Bible — Gutenberg #10 (`pg10.txt`); US Constitution — Gutenberg #5 (`pg5.txt`). Both land in the gitignored `data/bible/`.
- Further reading the keen students will have hit: Pinecone "Chunking strategies"; Anthropic "Contextual Retrieval" (the enrich-the-text-before-storage idea behind the second research question).
