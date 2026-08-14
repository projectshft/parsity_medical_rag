# Week 2 Runbook — Retrieval, reranking & the selector

**~2h.** Much lower risk than week 1 — say so out loud at the top; people are
still bruised.

**Student guide:** [`../student/week-2-retrieval-reranking.md`](../student/week-2-retrieval-reranking.md)

## Before you start

- [ ] **Confirm everyone's index is populated.** Anyone still at zero from week 1
      gets fixed *before* you start, or they can't follow anything today. Have a
      spare API key + index ready to lend.
- [ ] Decide your HTTP client and say so — Postman, Thunder Client, or curl. Have
      a curl command ready to paste for people with no client installed.
- [ ] Open: `lib/vector-search.ts`, `app/api/search/route.ts`, `lib/agents/selector.ts`,
      the Pinecone console.
- [ ] Have 4–5 queries ready that you *know* behave differently. Cohort 3 used:
      *"Which of my patients are showing signs of cognitive decline?"*,
      *"patients with breathing issues"*, *"what did you eat today"* (off-topic
      baseline), and a named-patient query.

## The arc

| Time | What | Notes |
|---|---|---|
| 0:00 | Homework review | 5–10 min. Ask 2–3 people for their chunking strategy + dimension choice. Great warm-up, and it surfaces who's behind. |
| 0:15 | **`searchClinicalNotes`** | Embed → query → return. Deliberately omit `includeMetadata` first so the useless result lands. |
| 0:35 | **Expose it via a route** | `app/api/search/route.ts`, hit it with the client. |
| 0:50 | **topK** | Start at 5, show it's too few, move to 100. Make the tradeoff explicit. |
| 1:00 | **Metadata filtering** | The Avery Mueller demo (below). This is the memorable moment of the session. |
| 1:15 | **Reranking** | Cross-encoder concept on the whiteboard, then `pinecone.inference.rerank`. |
| 1:35 | **Structured outputs** | Prose answer → unusable. Then Zod + `responses.parse`. |
| 1:50 | **The selector** | Build the schema together. Wire it into the chat route just enough to console.log a plan. |

## Live-coding checkpoints

1. `searchClinicalNotes` **without** `includeMetadata` → run it → ids and floats,
   no text. *"This is useless. Why?"* Then add it.
2. topK 5 → 100. Ask what the cost is before you change it.
3. **The Avery Mueller demo.** Query `"What can you tell me about Avery Mueller?"`
   → results are Avery Kemmer, Avery Baumbach, etc. Let the room sit with it, then
   ask what fixes it. Someone will say metadata. Add the `patientId` filter.
4. `pinecone.inference.rerank` with `topN`. Show what string you build for each
   doc — emphasise that the reranker only sees what you put in the string.
5. Selector: build `planAgentSchema` field by field, taking `.describe()` text from
   the room. Then `openai.responses.parse` with `zodTextFormat`.
6. Ask the selector 3–4 questions and console.log the plan. Include a nonsense one.

## Where it breaks

| Symptom | Cause | Fix |
|---|---|---|
| Results have no text | `includeMetadata` missing | Add it — this is a teaching beat, not an accident |
| `403` on `responses.parse()` | `OPENAI_BASE_URL` | Same as week 1. It resurfaces because it's a *new* call. |
| Pinecone 404 | **`lib/vector-search.ts` has a hardcoded `INDEX_NAME`** | Genuine repo bug. Have them point it at `process.env.PINECONE_INDEX`. Hit multiple people across weeks 2 and 4. |
| `value is not JSON serializable` from the route | returning the raw Pinecone response | Return `docs.matches` / the reranked data |
| Model ignores the schema | using `chat.completions` + `response_format` | `responses.parse` + `text: { format: zodTextFormat(...) }`. Their AI tools will suggest the old API — warn them. |
| Reranker returns garbage | `metadata.content` undefined in the built string | Log one string before sending |

## The reranking honesty problem

**Reranking does not demo well on this corpus.** The notes are long, similar, and
the score deltas are muddy. Cohort 3 spent fifteen minutes trying to make it
visibly better and it mostly wasn't.

Don't fight it. Say plainly: *"this is hard to see here, and that's why the
homework moves it to your Bible index where the chunks are short and distinct."*
Being honest about a weak demo costs nothing and buys credibility. Trying to sell
a result the room can see isn't there costs a lot.

If you want one thing that *does* show: filter to a single patient, rerank, and
watch date-relevant notes move up.

## Discussion prompts

- *"We have 21,000 notes and we're returning 5. What's wrong with that? What's
  wrong with returning 500?"*
- *"Is `Avery Mueller` semantically close to `Avery Kemmer`? Should it be?"* →
  gets at similarity vs identity.
- *"Why can't we just ask the model to return JSON in the prompt?"* → sets up
  structured outputs properly.
- *"What temperature for a router? Why not 0.5?"* → someone will argue for
  creativity in word selection. It's a reasonable-sounding wrong answer; let them
  make it and then take it apart.

## Homework to post

Three parts: rerank on their own `bible-kjv` index (over-fetch ~25 → top 5,
including a zero-keyword-overlap query), read
[Building Effective Agents](https://www.anthropic.com/research/building-effective-agents),
and a two-part video (reranking explained + which pattern should this project use,
defended with a tradeoff).

**The paper is the setup for week 3 and week 5.** Say that. It gives them the
vocabulary — routing, parallelization, prompt chaining — that the whole rest of the
course uses. Cohort 3's videos came back noticeably sharper for it; one student
correctly identified the pipeline as "dependency-aware prompt chaining with
conditional parallelization," which is a better description than the one in the
runbook.

## Notes from cohort 3

- Finished roughly on time. Use the slack to go deeper on structured outputs — it
  pays off enormously in week 3.
- A student shared [chunkviz.com](https://www.chunkviz.com/) — worth surfacing
  again during homework review.
- The office-hours session this week is a good slot for a student to walk through
  their chunking solution. One did (semantic chunking with single-verse overflow)
  and it was better than anything in the lecture. Invite it.
