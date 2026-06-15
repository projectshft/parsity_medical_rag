# Day 11 — The Five Chunking Failure Modes, Measured

**Needs: both chunk files from this week (`chunks-fixed.jsonl`, `chunks-smart.jsonl`)**

## Today you will

- Name the five ways chunking fails, and connect each to a number you already know how to measure
- Hunt down a live specimen of each failure in your own lab output
- Turn this week's findings into a reusable checklist you'll apply to any future corpus

## Concept

Everything this week showed you compresses into five failure modes. Memorize the names; the rest of your career they'll show up wearing different clothes.

| # | Failure mode | What it looks like | The measurement |
|---|---|---|---|
| 1 | **Fragmentation** | Cuts mid-word / mid-sentence; both halves damaged | % chunks starting mid-word, ending mid-sentence |
| 2 | **Context orphaning** | The chunk is grammatically whole but meaningless alone — `"And he said unto them..."` (who? where?) | min size, % under a floor; manual sampling |
| 3 | **Boundary straddling** | The answer spans a seam; no single chunk contains it | overlap setting (0 = fully exposed) |
| 4 | **Anonymity** | Chunk can't be cited, filtered, or traced to source | % with metadata |
| 5 | **Wrong granularity** | Pieces too big (match everything weakly) or too small (match precisely, deliver nothing) | size distribution vs corpus's natural unit |

Two things to notice about the table.

**Each failure has a number.** That's not a coincidence — it's this course's spine. "The chunks feel bad" starts arguments; "88.6% start mid-word" ends them. The audit script measures 1, 2 (partially), and 4 directly. 3 you control by construction (the overlap dial). 5 is the size distribution *interpreted against the corpus* — 1,675 characters was fine for an unsplittable verse, and would be a red flag for tweet-sized source data.

**The failures trade against each other.** Fixing fragmentation (never split a verse) *created* size variance (a 1,675-char max). Fixing straddling (overlap) inflates chunk count. Chunking isn't a problem you solve; it's a set of dials you balance — *for this corpus, with measurements*. There is no universally correct chunk size, and anyone who tells you "just use 512 with 50 overlap" is reciting a default, not making a decision.

## Implementation

Today is a specimen hunt. For each failure mode, you'll capture one live example from your own lab files — failure modes you've *held* stick better than ones you've read about.

```bash
# 1. Fragmentation — easy pickings in the naive output
sed -n '1000p' data/bible/chunks-fixed.jsonl | jq -r '.text[0:120]'

# 2. Context orphaning — short chunks are suspects; read a few and judge
cat data/bible/chunks-smart.jsonl | jq -c 'select(.text | length < 420)' | head -3

# 3. Boundary straddling — rebuild with NO overlap, then look at any seam
npm run bible:smart -- --overlap-verses 0
sed -n '5000,5001p' data/bible/chunks-smart.jsonl | jq -r '.metadata.reference'
# (rebuild with overlap 1 afterward to restore the week's working file)

# 4. Anonymity — the naive chunks, any of them
sed -n '3000p' data/bible/chunks-fixed.jsonl | jq 'keys'

# 5. Granularity — both size distributions side by side
npm run bible:audit -- data/bible/chunks-fixed.jsonl
npm run bible:audit -- data/bible/chunks-smart.jsonl
```

For #3, the seam test: the two adjacent references with `--overlap-verses 0` share no verse — write down a question whose answer needs the last verse of one *and* the first verse of the next. That question is unanswerable from any single chunk in the store. That's the failure, made concrete.

### Common mistakes

- **Optimizing one dial to zero.** You *can* drive fragmentation to 0%, overlap exposure to 0, and metadata to 100% — we did. You cannot also hold size variance at zero. Declare which failures matter most *for your corpus and queries*, then spend your budget there.
- **Measuring once.** The audit was run after every change this week — that's the habit. A chunking "improvement" that isn't re-measured is a chunking *change*.
- **Forgetting mode 5 has two directions.** Everyone fears too-big. Too-small is quieter and just as costly: a store full of confident, useless fragments. The medical corpus dodged both because the natural unit (one note) was already right-sized — *that's why measuring before chunking mattered*.

## Your turn

Spend **no more than 60 minutes** here. Build your **chunking decision checklist** — one page, in your notes, written as questions you'll ask of the *next* corpus you ever chunk:

1. What is the natural unit, and what does the size distribution say about it? (mode 5)
2. What structure does the corpus declare, and what's the strongest joint to cut at? (mode 1)
3. What's the smallest unit that's self-contained? (mode 2)
4. What questions might straddle seams, and how much overlap insures them? (mode 3)
5. What must every chunk carry to be cited, filtered, and debugged? (mode 4)

Under each question, add one line: *the measurement that answers it*. Then — the real test — answer all five **for the medical clinical notes**, citing numbers from your Day 7 measurement where you have them.

## Check yourself

- A teammate proposes increasing chunk size to "give the model more context." Which failure mode are they fixing, which are they risking, and what would you measure before agreeing?
- Why was "one note = one chunk" the right call for the medical corpus, stated in terms of the five modes?

<details>
<summary>Solution / discussion</summary>

**Bigger chunks:** they're attacking context orphaning (mode 2) and possibly straddling (mode 3 — fewer seams). They're risking wrong granularity in the too-big direction (mode 5): each chunk matches more queries, each less precisely. Measure first: the size distribution and a sample of retrieval *misses* — are misses actually caused by missing context, or is that a guess? If misses trace to seams, overlap is the targeted fix; bigger chunks are the blunt one.

**The medical answer, by the numbers:**
1. Natural unit = one note; Day 7 measurement: average ~450 chars, max in the low thousands — already retrieval-sized (mode 5 ✓)
2. Strongest joint = the note boundary itself; no cutting needed, so fragmentation is impossible by construction (mode 1 ✓)
3. A note is self-contained — one encounter, one date, headed sections (mode 2 ✓)
4. Straddling: questions span *notes* (a patient's history), not points *within* a note; that's a retrieval-layer concern (fetch several notes), not an overlap concern (mode 3 ✓)
5. Every note carries `patientId`, `patientName`, `type`, `date` (mode 4 ✓)

Five modes, five checks, zero chunking — and every check is a measurement or a structural fact, not a preference. That's what "decide from the corpus" means.

</details>

## Further reading (optional)

- [Pinecone: Chunking strategies](https://www.pinecone.io/learn/chunking-strategies/) — reread it end to end now; count how many of the five modes each strategy is implicitly trading against
