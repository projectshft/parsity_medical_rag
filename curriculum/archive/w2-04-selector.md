# The Selector: Your First Agent

**Needs: yesterday's structured-output pattern fresh in mind; `OPENAI_API_KEY`**

## Today you will

- Build the **selector** — your first agent: yesterday's pattern pointed at routing
- Meet the `Plan` schema and its four legal routes — including the one that runs *nothing*
- Internalize the design rule that keeps routers debuggable: **route, don't extract**

## Concept

The agent you'll assemble over the coming lessons is a small team of four pieces: a **selector** that routes, two specialists that retrieve (a **SQL agent** for exact facts, a **RAG agent** for meaning-matched notes), and an **aggregator** that writes the final answer. Every user question will enter through the selector, so it goes first — and it's deliberately the smallest agent in the system. Today you build it; the specialists and the wiring come in the lessons ahead.

### Routing as a structured output

Yesterday's ticket extractor pulled urgency out of an email. Point the same four-step pattern at a different target — *retrieval strategy* — and you have the selector. It answers exactly one question: **which store(s) does this question need?** The whole schema (`lib/agents/selector.ts`):

```typescript
const PlanSchema = z.object({
  requiresSQL: z
    .boolean()
    .describe('Structured data is needed — counts, filters by condition/medication/lab/age, or a specific patient.'),
  requiresVector: z
    .boolean()
    .describe('The clinical notes are needed — questions about what notes say / describe / mention.'),
  semanticQuery: z
    .string()
    .nullable()
    .describe('If requiresVector, an expanded clinical phrasing of the question to embed for note search.'),
});
```

Three fields. "How many patients have diabetes?" → SQL (a count). "Notes mentioning chest pain at night" → vector (what the notes *say*). "What do the notes say about sleep for patients with depression?" → both. And "what's a normal A1C range?" → **neither** — a general-knowledge question with no tie to these records, so the pipeline skips retrieval entirely. That both-false case is a real, legitimate route (`needsSearch: false` in the returned `Plan`), not an error — you'll see it short-circuit the pipeline when you wire the agents together.

Notice what the schema *doesn't* have — no `intent` enum, no extracted condition names, no age filters, no entity list. That's deliberate, and it's the design decision worth internalizing:

**Don't extract entities in the router.** It's tempting to make the selector pull out "hypertension" and "under 50" while it's in there anyway. Resist. Next lesson you build the SQL agent — a specialist whose LLM re-derives all of that *better* when it writes the query, because it has the database schema in front of it: it knows there's a `conditions.display` column to match and a `birthDate` to compute age from. Anything the selector extracts is redundant work and a second place to be wrong: now a routing bug *and* an extraction bug can each break the same question. A selector that only routes can only misroute — one failure mode, easy to inspect, easy to fix.

The one piece of content it does produce is `semanticQuery`: an expanded clinical rephrasing for the note search ("trouble sleeping" → "insomnia, poor sleep, waking at night"). Embedding a well-phrased query is the vector store's whole game, and the selector is the last stop where an LLM sees the question before it becomes a vector.

## Implementation

The selector is a stub on your branch, with the plan spelled out in `TODO`s.

### 1. Implement the selector — `lib/agents/selector.ts`

The schema and the `Plan` type are provided; you write the system prompt and the `select` function. Same four steps as yesterday's extractor:

1. `openai.responses.parse` at `temperature: 0` with `zodTextFormat(PlanSchema, 'plan')`. The input is your system prompt (describe the two stores and when each is needed; a pure general question needs neither; when unsure about a records question, prefer the notes), the last few turns of history (`history.slice(-5)` — enough to resolve a follow-up like "what about her medications?"), then the user's query.
2. `PlanSchema.parse(response.output_parsed)`.
3. Map it to the `Plan`: `useSql = requiresSQL`, `useRag = requiresVector`, `needsSearch = useSql || useRag`, and `semanticQuery: semanticQuery || query` (fall back to the raw question).

### 2. Run the routing battery

In a scratch script:

```typescript
import 'dotenv/config';
import { select } from './lib/agents/selector';

const queries = [
  'How many patients have diabetes?',
  'notes mentioning chest pain at night',
  'what do the notes say about sleep for patients with depression?',
  "what's a normal A1C range?",
];

async function main() {
  for (const q of queries) {
    console.log(`\n${q}\n `, await select(q));
  }
}
main();
```

Expect SQL-only, vector-only, both, and neither (`needsSearch: false`) — in that order. If a route is wrong, the fix is a sentence in the system prompt, not code.

### Common mistakes

- **A fat selector.** Adding `conditions: z.array(z.string())` to the plan feels helpful and creates a second extraction pipeline that the downstream specialist will ignore or contradict. Route only.
- **Treating "neither" as a failure.** Both booleans false is the correct route for a greeting or a general-knowledge question. Forcing every message into a store guarantees irrelevant patient records get dragged into answers that never needed them.
- **Skipping `temperature: 0`.** A router that routes the same question differently on Tuesday isn't a component, it's a coin.
- **Ignoring the history.** Without the last few turns, "what about her medications?" has no *her* — the follow-up misroutes to "neither" or guesses. Pass the recent history; that's what it's for.

## Your turn

Spend **no more than 45 minutes** here.

1. Finish the stub and run the battery. Confirm all four routes land as expected.
2. Add five queries of your own, including one follow-up that only works with history. Any misroutes? Fix the prompt, not the caller.
3. Write down two fields you were tempted to add to the schema (an intent enum? extracted conditions?) and one sentence each on why they don't belong. If the sentence is hard to write, reread the route-don't-extract argument.

```quiz
[
  {
    "q": "The SQL specialist downstream clearly needs condition names and age filters. Why doesn't the selector extract them while it's reading the question anyway?",
    "options": [
      "Extracting entities would make the selector's LLM call too slow to run on every message",
      "The Plan schema can't express arrays of entities, so there's nowhere to put them",
      "The SQL agent re-derives them better because it holds the database schema; upstream extraction is done blind and adds a second place for the same question to break"
    ],
    "answer": 2,
    "explain": "The filters are a function of the schema — which columns exist, what the joins are — and only the SQL agent has it. A selector that only routes can only misroute: one failure mode, easy to inspect. A fat selector creates a routing bug AND an extraction bug per question."
  },
  {
    "q": "The selector returns requiresSQL: false and requiresVector: false for \"what's a normal A1C range?\". What is that?",
    "options": [
      "A legitimate route — a general-knowledge question with no tie to these records short-circuits retrieval entirely (needsSearch: false)",
      "A misroute — every question should hit at least one store so the answer is grounded in something",
      "An error state the caller should catch and retry with a more insistent prompt"
    ],
    "answer": 0,
    "explain": "Both-false is a real path, not a failure. Skipping retrieval isn't just cheaper — stuffing irrelevant patient records into a general-knowledge answer is how leaks and hallucinated groundings start. Refusing to route IS a route."
  },
  {
    "q": "The rule is 'route, don't extract' — yet the Plan carries a semanticQuery string the selector wrote. Why isn't that a violation?",
    "options": [
      "It is a violation, tolerated because the vector store can't run without some query text",
      "semanticQuery isn't extraction, it's rephrasing-for-embedding: a well-phrased query is the vector store's whole game, and the selector is the last LLM to see the question before it becomes a vector",
      "The field is optional, so the selector only fills it when extraction happens to be safe"
    ],
    "answer": 1,
    "explain": "Entity extraction duplicates work a schema-holding specialist does better. The semantic expansion is different: no downstream component re-derives it, and the quality of the embedded phrasing directly decides what the note search finds. One is redundant; the other is the selector's only real product besides the booleans."
  }
]
```

## Check yourself

- Why does the selector *not* extract condition names or age filters, when a downstream specialist will clearly need them?
- What are the four legal routes, and which one runs zero retrieval? Why is that one not an error?
- What is `semanticQuery` for, and why doesn't producing it break "route, don't extract"?

<details>
<summary>Solution / discussion</summary>

**Why the selector stays skinny:** the filters the SQL specialist needs are a *function of the database schema* — which columns exist, what the joins are — and that specialist is the only component holding the schema. Extraction done upstream is done blind (the selector doesn't know `display` from `valueNumber`), and it doubles the places one question can break. The finished selector's system prompt is ~20 lines: describe the two stores, give one example of a both-stores question, name the general-question case, and state the tie-breaker ("when unsure, prefer the notes"). Everything else is yesterday's four steps verbatim.

**The four routes:** SQL-only (counts, filters, a specific patient), vector-only (what the notes *say*), both (a structured filter plus a meaning question), and neither (`needsSearch: false`). The neither route is policy, not error — a general question answered from general knowledge, with retrieval skipped on purpose, is the system working.

**`semanticQuery`** is the one artifact only the selector can produce: an expanded clinical phrasing ("trouble sleeping" → "insomnia, poor sleep, waking at night") for the note search to embed. Nothing downstream re-derives it, so writing it here isn't redundant — which is exactly the test that entity extraction fails.

</details>

## Further reading (optional)

- [OpenAI: structured outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs) — the `Plan` is the same mechanism as yesterday's ticket extractor
