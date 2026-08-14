# Week 6 — Demo day

**Session:** Saturday · the last one
**Needs:** something to show

## The format

**~5 minutes each, then questions.** The only hard rule is the time — keep it to
about five minutes so there's room for Q&A. Everything below is a suggested
outline, not a requirement.

1. **What you built** — demo, design, or both
2. **High-level architecture** — vector DB, agents, evals, chunking
3. **What did you learn?** Pitfalls? What would you do differently? Any cool new
   technology you found?
4. **Q & A**

## How to make it land

**Demo the thing first, briefly.** Thirty seconds of it working buys you four
minutes of attention. If a live demo is risky — and it usually is — record it
beforehand and play the recording.

**Then defend one decision with a number.** This is the part that separates a
walkthrough from an engineering presentation. Chunk size, metadata fields, whether
reranking earned its cost, which model and why. One decision, one measurement.

**Close with one honest limitation.** The query shape it handles badly. The eval
you named but didn't write. The freshness problem you deferred. This is not
self-deprecation — it's the strongest signal in the whole talk. A flawless
happy-path demo with no numbers and no named limitation is a screen recording.

**Don't apologise for scope.** A small system you measured is a better
presentation than a large one you didn't. Everyone in the room has shipped
something half-finished; nobody is impressed by feature count.

## Questions you'll probably get

Worth having answers ready:

- Why that chunking strategy? What would you change if the corpus doubled?
- Why that vector store / that embedding model / those dimensions?
- Where does it hallucinate, and how would you know?
- What happens when the data goes stale?
- What breaks first if this got 100× the traffic?
- Would tool-calling have been better here than a fixed workflow?

## What you've actually done

Worth naming, because six weeks compresses in memory.

You started with a problem that keyword search cannot solve — `LIKE '%heart
attack%'` never matching a note that says *myocardial infarction*. You built the
index that fixes it, by hand, from a database you didn't create. You made ranking
earn its keep with a reranker. You turned a language model into a typed component
and used it to route. You built a pipeline of specialists that retrieve in
parallel and an aggregator that refuses to invent. You gated a real-world action
behind a human. You exposed the whole thing to a foreign model through MCP, with
de-identification the caller can't switch off. And you measured enough of it to
know when a change helped.

Then you did it again, on data you chose yourself.

The person who can describe RAG but never confronted a system that lied to them is
the one who falls apart on the job. You confronted yours, repeatedly, with numbers.

## After this

- **The recordings and this material stay yours.** Lifetime access.
- **The self-paced track in `archive/`** goes deeper than the live sessions had
  time for — evals, PII, poisoned documents, chunking failure modes. Bonus, not
  homework, but it's there.
- **Post what you build next.** The channel doesn't close when the course does,
  and the most useful thing in it has always been other people's work.

Go build something, and measure it.
