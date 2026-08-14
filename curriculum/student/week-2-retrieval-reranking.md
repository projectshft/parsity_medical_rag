# Week 2 — Retrieval, reranking & your first agent

**Session:** Saturday · [recording posted in Slack]
**Needs:** everything from week 1, plus a populated medical index

## What we built

Week 1 filled the index. This week we read from it — and then discovered that
reading from it naively isn't good enough.

### 1. `searchClinicalNotes`

The retrieval function, in `lib/vector-search.ts`. Three steps, no cleverness:

```ts
const embeddedQuery = await createEmbedding(query);      // same model, same dims

const docs = await pinecone.Index(INDEX_NAME).query({
  vector: embeddedQuery,
  topK,
  includeMetadata: true,                                  // ← see below
  ...(filter ? { filter } : {}),
});
```

We exposed it through `app/api/search/route.ts` so it could be poked with Postman
or curl while building.

**`includeMetadata: true` is the gotcha.** Leave it off and Pinecone returns ids,
scores, and raw vectors — mathematically correct and completely useless. The note
text lives in the metadata. Everyone hits this once.

**`topK` is a real decision.** We started at 5 and it was obviously too few
against 21,000 notes. We moved to 100. The number isn't sacred; the reasoning is —
you are trading recall against cost and context-window pressure.

### 2. Filtering, because similarity can't do exact

We asked *"What can you tell me about Avery Mueller?"* and got back Avery Kemmer,
Avery Baumbach, and friends. Of course we did: `Avery Mueller` and `Avery Kemmer`
are extremely close in embedding space.

That's not a bug to prompt your way out of. It's the shape of the tool. Similarity
is fuzzy; identity is exact. So we passed a metadata filter:

```ts
const filter = patientIds?.length
  ? patientIds.length === 1
    ? { patientId: patientIds[0] }
    : { patientId: { $in: patientIds } }
  : undefined;
```

Now the semantic search runs *within* one patient's notes. This is the week-1
metadata paying off, and it's why we collected those fields.

### 3. Reranking — the two-stage funnel

Vector search trades accuracy for speed. It has to: it's comparing your query
against every vector in the index, so the comparison has to be cheap. The query
was embedded alone, the notes were embedded alone, and nothing ever looked at the
two *together*.

A **reranker** does look at them together. It's a cross-encoder — it takes
`(query, document)` as a pair and scores how well that specific document answers
that specific query. Far more accurate, far too slow to run over 21,000 documents.

So you build a funnel:

```
query → vector search (wide, cheap, topK=100) → rerank (narrow, careful, topN=10) → answer
```

**Over-fetch, then rerank.** Pinecone hosts a reranker, free, no extra vendor:

```ts
const reranked = await pinecone.inference.rerank(
  'bge-reranker-v2-m3',
  query,
  docs.matches.map(doc => `Patient note: ${doc.metadata.content}
    Current medications: ${doc.metadata.currentMedications.join(', ')}
    Race: ${doc.metadata.race}  Gender: ${doc.metadata.gender}  Age: ${doc.metadata.age}`),
  { topN: 10 },
);
```

Note what gets handed to the reranker: not just the note text, but the metadata
too. The reranker reads plain strings, so anything you want it to weigh has to be
*in* the string.

Honest note from the session: **reranking was hard to see working live.** The
medical notes are long and similar to each other, and the score changes were
muddy. That's exactly why the homework moves it to your Bible index, where the
chunks are short and distinct and the reordering is obvious.

### 4. Structured outputs — the LLM as a typed function

Then we changed register entirely. An "agent" is just an API call to a language
model. The problem is that it hands back prose, and you can't branch on prose.

Ask a model *"should this query use SQL or the vector store?"* and you get back
*"This query should be answered by the vector store, as it pertains to..."* — now
what? Regex it? Search for the word "vector"? That's how systems rot.

**Structured outputs** fix this. Define the shape with Zod, pass it to the
Responses API, get back a typed object:

```ts
const planAgentSchema = z.object({
  useSql: z.boolean().describe('Whether to use the SQL database...'),
  useRag: z.boolean().describe('Whether to use the vector store...'),
  reason: z.string().describe('Why you chose this'),
  agentQuery: z.string().describe('Cleaned-up query for the RAG agent').nullable(),
  clarificationQuery: z.string().describe('If unclear, what to ask').nullable(),
});

const answer = await openai.responses.parse({
  model: 'gpt-4o-mini',
  text: { format: zodTextFormat(planAgentSchema, 'plan') },
  input: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: query }],
  temperature: 0,
});

const plan = planAgentSchema.parse(answer.output_parsed);
```

Two things carry more weight than they look like they do:

- **`.describe()` on every field.** That text is shipped to the model. It is
  prompt, not documentation. Vague descriptions produce vague routing.
- **`temperature`.** Zero for anything that classifies or extracts. Creativity is
  a bug when you're picking a branch.

That gave us the **selector** — the first agent in the pipeline, and the one that
decides what runs next. It routes; it does not extract entities or write queries.
Keeping it small is the point.

## Homework

### 1. See reranking work — on your own `bible-kjv` index

Reranking was hard to *see* in class. Fix that on your own index, where the chunks
are short enough that reordering is visible.

Search `bible-kjv`, **over-fetch the candidates (grab ~25), then rerank and keep
the top 5.** A quick script or an API endpoint — your call. Run a few queries,
including **at least one that shares zero keywords with the passage it should
find.**

> **Hint:** rerank the *same number* you retrieved to see how the order changes.
> You don't need a dramatic result — you need to watch the funnel work.

### 2. Read: Building Effective Agents

[Anthropic — Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)

Pay attention to:

- **Workflows** (LLM calls orchestrated through fixed code paths) vs **agents**
  (the LLM directs its own tool use in a loop)
- The five workflow patterns: **prompt chaining, routing, parallelization,
  orchestrator-workers, evaluator-optimizer**
- Where tool calling fits into each

### 3. The video

**Part 1 — Reranking, explained by you.** What it is, how it differs from
embedding search, and why you over-fetch before it. Use what you saw on your Bible
index as the example.

**Part 2 — Your opinion: what pattern should THIS project use?** Using the paper's
vocabulary: which named pattern(s) is our pipeline (selector → SQL ‖ RAG in
parallel → aggregator) using today? Which pattern would genuinely improve *this*
project, and why?

**Defend it with a tradeoff** — predictability, cost, latency, debuggability. Name
patterns, argue from a tradeoff. There's no right answer; there is a difference
between an opinion and a defended one.

## When it breaks

- **Results come back with no text.** `includeMetadata: true` is missing.
- **`403` on `openai.responses.parse()`.** `OPENAI_BASE_URL` again — the proxy is
  strict about it, and the failure surfaces at the first *new* call you write.
- **404 on the Pinecone index.** `lib/vector-search.ts` shipped with a hardcoded
  `INDEX_NAME`. Point it at `process.env.PINECONE_INDEX` or edit it to your index
  name — it will not match yours by default.
- **The reranker returns nothing useful.** Check what you're actually passing it.
  It sees only the strings you build; if `metadata.content` is undefined, you're
  reranking empty templates.
- **The model ignores your schema.** You're on the old API. It's
  `openai.responses.parse()` with `text: { format: zodTextFormat(...) }` — not
  `chat.completions` with `response_format`. Most AI coding tools get this wrong
  because their training data predates it.

## Check yourself

- On your Bible index, you can show a query with **zero keyword overlap** with the
  passage it correctly retrieves.
- You can explain why over-fetching is required for reranking to help at all.
- Your selector returns a typed object, and you can point at the `.describe()`
  string that drove one specific routing decision.
