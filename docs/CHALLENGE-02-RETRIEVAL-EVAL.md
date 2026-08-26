# Week 2 — Prove your retrieval works

In class we built search, added a metadata filter, and bolted on a reranker.
Whether any of that actually *helped* is currently a vibe. This week you replace
the vibe with a number.

This is the assignment the rest of the course leans on. Every decision from week
3 onward gets defended against the golden set you build here.

## 1. Build the golden set

Create `lib/evals/golden-set.ts` — **20 questions with known-correct answers**,
drawn from your own database. Not made up: run the SQL, look at the notes, write
down what's true.

Cover all four kinds, because they fail differently:

| Kind | Example | What "correct" means |
|---|---|---|
| **Exact count** | "How many patients have hypertension?" | One number. 63 is right, 61 is wrong. |
| **Named lookup** | "What can you tell me about Avery Mueller?" | Facts about *that* patient, nobody else. |
| **Semantic** | "Which patients are struggling to breathe?" | Notes about dyspnea, shortness of breath, COPD — none of which share a word with the question. |
| **Not in the corpus** | "What's the weather in France?" | The system says it doesn't know. An answer here is a failure. |

For the semantic ones you need **relevant note ids**, not just prose — that's
what lets you compute recall. Pull them with `npm run db:studio` or a quick
query, and record 3–10 ids per question.

Shape it however you like; this works:

```ts
export type GoldenCase = {
  id: string;
  question: string;
  kind: 'count' | 'lookup' | 'semantic' | 'unanswerable';
  expectedAnswer?: string;      // for count / lookup
  relevantNoteIds?: string[];   // for semantic — the recall denominator
};
```

The lay-term ones matter most. "Heart attack" has to find `Myocardial
Infarction`; "smoker" has to find `Smokes tobacco daily`. Those are the queries
that expose whether your grounding works.

## 2. Measure recall@10, with and without reranking

Write a script or a test that, for every semantic case:

1. Searches with **cosine only** (no rerank) and records recall@10 —
   *how many of the known-relevant notes made the top 10.*
2. Searches with **over-fetch + rerank** (fetch 100, keep 10) and records the same.

Print a table. Two columns, one row per query, and a mean at the bottom.

**Report the mean.** It might go up. It might go down — reranking a
`patientId`-filtered search made things *worse* in class, and understanding why
is worth more than a win. Either way you now have a baseline, and every change
you make for the rest of the course moves a number you can see.

## 3. Find the moment reranking earns its keep

Reranking was hard to *see* in class. Fix that on your own `bible-kjv` index,
where you know the text.

Search plain cosine, then rerank the same candidates. Keep trying queries until
you find **one where reranking visibly changes the ordering** — a passage
promoted from deep in the candidate pool to the top. Bonus points if the query
shares zero keywords with the passage it finds.

That moment is the whole concept. Hunt for it.

While you're hunting, get the *why* straight: a reranker reads the query and the
document **together, at query time**. Embeddings compressed each side
**separately**, before the query existed. That's the entire difference, and it's
also why you must over-fetch — rerank the top 10 and there's nothing to promote.

## 4. Turn on tracing

One line in `.env` (`LANGSMITH_TRACING=true`) plus your key. `wrapOpenAI` in
`lib/openai.ts` already does the rest. Confirm you can see a trace with its
prompt, response, token count and latency.

You'll be debugging from these for the next four weeks. Getting it working now
is cheap; getting it working while chasing a bug is not.

## What "done" looks like

- [ ] `lib/evals/golden-set.ts` with 20 cases across all four kinds
- [ ] A runnable comparison that prints recall@10 with and without reranking
- [ ] Your mean recall for both, written down somewhere you'll find it in week 3
- [ ] One bible query where reranking demonstrably reordered the results
- [ ] A LangSmith trace you can point at

## The video 🎥 (3–4 min)

1. **What reranking is**, and how it differs from embedding search.
2. **Why you over-fetch** — what breaks if you don't.
3. **Your number.** Recall before, recall after, and what you make of it.

If reranking made your results worse, say so and say why. That's a better video
than a clean win, and it's the one that'll come up in an interview.

## Further reading

- [Pinecone — Rerankers](https://docs.pinecone.io/guides/search/rerank-results)
- [Pinecone — Retrieval evaluation metrics](https://www.pinecone.io/learn/offline-evaluation/)
- [Anthropic — Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) (read before week 3)
