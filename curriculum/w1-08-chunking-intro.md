# Chunking: Why Our Notes Don't Need It (and Most Text Does)

**Needs: nothing new — a notes file and the intuition from this week**

## Today you will

- Name the one question chunking answers, and see why our notes already answer it
- Understand why a giant document embedded whole "means everything and matches nothing"
- Set up the two-part side project: chunking the Bible

## Concept

Every meaning-based search operates on **pieces of text**. A question gets matched against stored pieces, and the best-matching pieces are what the system retrieves. That forces a question someone has to answer for every corpus:

**What is one piece?**

You already made this decision this week — without agonizing over it — when you vectorized. Each note became **one vector**. That was the right call, and here's why.

A piece that's **too big** matches everything a little and nothing well: a 40-page document "mentions" diabetes, sleep, surgery, and billing, so it's a mediocre match for all of them. A piece that's **too small** is precise but useless on arrival: `"And he said unto them"` matches confidently and tells you nothing — said what? to whom?

A clinical note sits in the sweet spot. It's one encounter, one date, one topic, ~450 characters, self-contained. Splitting it would only break it; padding several together would blur it. So **one note = one piece**, and the "chunking step" is a no-op. You proved that by measuring: the notes average ~450 characters, max in the low thousands — already the right size.

**Chunking** is the act of splitting documents into retrieval-sized pieces. The part most tutorials skip: *whether you need it at all is a property of your corpus, not a mandatory pipeline step.* Our corpus is pre-jointed into notes, so we don't.

### The opposite corpus

To *learn* chunking you need a corpus that actually demands it — the opposite shape of our notes. The King James Bible is perfect:

| | Our clinical notes | The King James Bible |
|---|---|---|
| Documents | ~143,946 separate notes | **1** document |
| Size each | ~450 characters | **4.3 million** characters |
| Natural piece | the whole note | ??? — that's the question |
| Chunking needed? | **No** — already a piece | **Yes** — unavoidably |

Embed the whole Bible as a single vector and it "means" the average of everything ever written in it — creation, law, poetry, genealogy, apocalypse. It matches *every* query weakly and *no* query strongly. Same failure as concatenating one patient's 113 notes into one blob. You must split it. But **where?** Every 500 characters (slicing words in half)? At every verse? Every chapter? That decision — where to cut, and what to carry with each piece — *is* chunking, and it's a craft with real trade-offs.

That contrast is the whole point: **decide from the corpus in front of you, not from habit.** Our notes taught you "don't chunk." The Bible will teach you "how to chunk when you must."

## Implementation

There's no build today — this lesson sets up a side project. Take five minutes to see the shape of the corpus you'll work with:

```bash
mkdir -p data/bible
curl -o data/bible/kjv.txt https://www.gutenberg.org/cache/epub/10/pg10.txt
head -120 data/bible/kjv.txt
```

Notice three things you'll reckon with in the side project:

- A Project Gutenberg license header before `*** START OF THE PROJECT GUTENBERG EBOOK ***` — **not scripture; must be stripped** before any processing.
- Book titles as plain lines: `The First Book of Moses: Called Genesis`.
- Every verse prefixed `chapter:verse` — `1:1 In the beginning…` — built-in structure markers you can cut along, if you choose to.

The scaffolding for the hands-on part lives in `scripts/bible/`. You'll run it during the second half of the side project. For now, just skim what's there.

### Common mistakes

- **Chunking by habit.** "Step 2 of every RAG tutorial is chunking" — no. It's a *decision*. For short, self-contained documents the right chunk count is one. Blindly splitting 450-character notes into 200-character fragments destroys meaning for nothing.
- **Trusting the average alone.** An average of 450 characters could hide a few 50,000-character monsters. You need the distribution — the *max*, not just the mean — before you decide.
- **Thinking "bigger piece = more context = better."** A too-big piece matches everything weakly. Granularity is a trade-off with two bad ends, not a dial you turn up.

## Your turn

Spend **no more than 20 minutes** here — this is orientation, not the assignment.

1. Download `kjv.txt` and confirm its size (`wc -c data/bible/kjv.txt` — about 4.4 million bytes).
2. In your notes, answer: our notes are ~450 chars and we made each one a piece. If a corpus averaged 80,000 characters per document, chunk or not? What if it averaged 300? State the rule you're using.
3. Read the side-project brief in `homework-bible-chunking.md` so you know what's coming.

## Check yourself

- In one sentence: what goes wrong when a piece is too big? Too small?
- Why is "one note = one piece" correct for our notes but wrong for the whole Bible?
- What decision, exactly, is "chunking"?

<details>
<summary>Solution / discussion</summary>

**Too big** matches everything weakly (a 40-page doc is a mediocre match for each of its many topics). **Too small** matches precisely but delivers nothing usable (`"And he said unto them"`). Chunking is the search for the size in between — *for this corpus*.

**One note vs the whole Bible:** a note is already one self-contained encounter at ~450 chars — the natural piece. The Bible is one 4.3-million-character document spanning every topic; as a single vector it means the average of all of them and matches nothing sharply. The corpus decides, and these two corpora decide oppositely.

**Chunking** is deciding *where to split a document into retrieval-sized pieces* — and what metadata each piece carries so it can be cited, filtered, and traced. It's a set of trade-offs, not a default step.

</details>

## Deliverable 🎥 (end of week)

Record **2–3 minutes** (phone is fine): explain, in your own words, **why keyword/SQL search isn't enough, and what a vector fixes.**

A strong one uses this week's concrete case — *"a clinician searches 'shortness of breath'; the note says 'dyspnea on exertion'; `LIKE` returns 0 rows; the embedding puts them ~0.7 apart, so meaning-search finds it"* — and names the mental model: **Postgres is the source of truth, the vector store is a derived, searchable projection of it.** Bonus if you mention that cosine measures direction, not keyword overlap.

Graded against one question: *can you explain the keyword-vs-meaning gap with a real example, not just repeat "vectors are numbers"?* A weak video defines an embedding as "a list of 1,536 numbers" and stops — that's a definition, not an understanding. A strong one shows the *miss* keyword search makes and *why* the vector doesn't.

**Submit:** [Typeform — submission](https://form.typeform.com/to/PLACEHOLDER-W1) <!-- PLACEHOLDER: replace with real Typeform URL -->

Your other deliverable this block is the chunking side project — see `homework-bible-chunking.md`. Part 1 is due alongside this video.

## Further reading (optional)

- [Pinecone: Chunking strategies](https://www.pinecone.io/learn/chunking-strategies/) — a map of the strategy space the side project walks through.
</content>
