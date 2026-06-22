# Day Zero — Foundations: LLMs and Vector Math

**Needs: nothing — a browser and curiosity. No accounts or keys yet.**

> **This is optional pre-work.** If the words *embedding*, *vector*, and *cosine similarity* already mean something to you, skim this and move on. If they don't, spend an unhurried evening here before Day 1 — the rest of the course assumes the intuitions below, and they're far easier to build now, with no code in the way. Everything here you will later prove with your own hands; today is just the map.

## Today you will

- Be able to say, in one plain sentence each, what an LLM does and what an embedding does
- Understand cosine similarity well enough to predict whether two sentences will score high or low
- Finish the two assignments — one written, one watched

## 1. What is a Large Language Model?

An LLM is an AI trained on an enormous amount of text to understand and generate language. Strip away the mystique and the core is almost mundane:

- **It's a next-token predictor.** Given the text so far, it estimates the probability of what comes next — one token (a word or word-piece) at a time — and emits the likely continuation. Everything it does, from translation to code, is that one trick applied at scale.
- **The architecture is the Transformer.** Its key move is *attention*: when processing a word, the model weighs every other word in the input by relevance, so it can connect "it" to the noun three sentences back. That's how it tracks meaning across distance.
- **What that buys you:** summarizing, translating, extracting, coding, following multi-step instructions. Impressive — but notice the gap that defines this whole course: **a prediction engine has no idea what's in *your* database.** It can brilliantly *read* records you hand it; it cannot *fetch* them. Closing that gap is what we build.

## 2. How vectors work — the math behind the machine

Computers don't compare meanings; they compare numbers. So step one of every meaning-based system is turning text into numbers called a **vector** — a list of numbers that names a point in space.

- **Embeddings.** Turning text into a vector is called *embedding* it. The whole point: text with similar meaning gets placed close together in that space. "Heart attack" and "myocardial infarction" land near each other; "heart attack" and "quarterly earnings" land far apart — with no synonym list anywhere, just geometry learned from data.
- **Dimensions.** A vector with 1,536 numbers lives in 1,536-dimensional space. You can't picture that; you don't have to. Picture two dimensions and the intuition transfers exactly.
- **Cosine similarity.** To ask "how similar are these two texts?" we measure the **angle** between their vectors — same direction means same meaning. The measure is cosine similarity:

$$\text{similarity} = \cos(\theta) = \frac{\mathbf{A} \cdot \mathbf{B}}{\lVert \mathbf{A} \rVert \, \lVert \mathbf{B} \rVert}$$

In words: the **dot product** of the two vectors, divided by the product of their **lengths**. A result near **1** means they point almost the same way (nearly identical meaning); **0** means unrelated. (A small note you'll cash in later: the models we use return vectors that are already length-1, so the dot product *alone* gives the same ranking — which is why some systems skip the division entirely.)

That single formula is the engine under "search that understands meaning." When you meet it again later in the course, you'll write it in about four lines and rank real clinical notes with it by hand — before any database does it for you.

## Your turn

### Assignment A — research `text-embedding-3-small`

In a few sentences, explain the role of OpenAI's `text-embedding-3-small` model. Cover:

- Its job: turning text into vectors for **Retrieval-Augmented Generation (RAG)** — the fetch-the-records pattern from §1
- Its **dimensionality** (1,536) and what that number even refers to
- How it **trades off** quality against cost and speed versus larger embedding models — and why "smaller" is often the right production call

Keep your answer; it's the kind of decision you'll have to defend later.

### Assignment B — visualize the linear algebra

Watch these (a coffee's worth of time, and the best money-free upgrade to your intuition there is):

1. **3Blue1Brown — Vectors, what even are they?** (Essence of Linear Algebra, Ch. 1) — what a vector actually *is*, the picture behind "a point in space."
2. **3Blue1Brown — Dot products and duality** (Ch. 9) — the geometric meaning of the dot product that powers cosine similarity.
3. **3Blue1Brown — But what is a GPT?** — a visual tour of the Transformer from §1.

## Check yourself

Answer without scrolling up:

- In one sentence each: what does an LLM fundamentally do, and what does an embedding produce?
- Two sentences score a cosine similarity of **0.95**. Roughly what does that tell you — and what does it *not* tell you on its own?
- Why can a computer compare two vectors but not two sentences directly?

## Further reading (optional)

- [OpenAI — Embeddings guide](https://developers.openai.com/api/docs/guides/embeddings) — the model from Assignment A, in the vendor's own words
- [3Blue1Brown — Vectors, what even are they? (Ch. 1)](https://www.youtube.com/watch?v=fNk_zzaMoSs)
- [3Blue1Brown — Dot products and duality (Ch. 9)](https://www.youtube.com/watch?v=LyGKycYT2v0)
- [3Blue1Brown — But what is a GPT?](https://www.youtube.com/watch?v=yMQPQuz5WpA)
