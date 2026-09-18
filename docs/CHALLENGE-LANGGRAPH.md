# Homework: Let the model drive — tool-calling with LangGraph

Last week you made a video arguing for tool-calling and sketching how *this*
project would change. This week you build it, run it against the same questions
as the pipeline you already have, and find out whether you were right.

The thing you're replacing is small and specific. In `/api/chat`, **your code**
decides what runs: the selector returns `{ useSql, useRag }` and the route calls
the specialists. That's it. Everything else — `runSql`, `runRag`, the
aggregator, the reranker — stays exactly as it is. Tool-calling doesn't replace
your agents. It replaces the `if` statements.

```
        what you have                          what you're building

  selector ──▶ { useSql, useRag }        START ──▶ agent ──(wants a tool?)──▶ tools ──┐
       │                                             │                                │
       ├──▶ runSql   ┐                               └◀───────────────────────────────┘
       └──▶ runRag   ├──▶ aggregator                 │
                     ┘                            (done) ──▶ END

  YOUR CODE picks the path,               THE MODEL picks the path,
  always the same shape                   as many hops as it wants
```

Both routes stay live. `/api/chat` is the one that works; `/api/chat-graph` is
the new one. You need both to do step 3.

## 0. Setup

Already installed — `@langchain/langgraph`, `@langchain/openai`,
`@langchain/core`. Nothing to add.

## 1. Build the graph — `lib/graph.ts`

The model and one working tool (`search_clinical_notes`) are provided as the
pattern. Your job:

- **Add the SQL tool.** `runSql(query, history)` already exists and already
  grounds itself in the real column values. You're writing its *description*.
- **Build `buildGraph()`** — two nodes (`agent`, `tools`), one conditional edge,
  and the edge back. Every symbol you need is imported at the top of the file
  with a note on what it does.

The descriptions are the whole exercise. They are the only thing the model sees
when it decides. `"Searches the database"` is not a description — it's a
coin-flip between your two tools. Be specific about *what kind of question*
each one answers, and draw the line against the other.

## 2. Wire the route — `app/api/chat-graph/route.ts`

Body parsing and error mapping are done. You invoke the graph and return the
answer. Get `graph.invoke()` working and printing before you try to stream.

**Log `result.messages` once and actually read it.** That array is the model's
tool requests, the tool results, and the final answer, in order. It is the
clearest look at tool-calling you'll get, and it's the thing you can't see in
the selector version.

## 3. Prove it — run your query log through both (don't skip this)

You collected 10+ query/response pairs last week. That's your eval set. Send
each one to **both** routes and record what came back:

| # | Question | `/api/chat` | `/api/chat-graph` | Tools the model called | Better? |
|---|----------|-------------|-------------------|------------------------|---------|
| 1 | How many patients have hypertension? | 63 ✅ | | | |

Fill in every row. Then answer these in writing — three or four sentences each,
this is the deliverable that matters:

- **Where did tool-calling win?** Look hardest at the multi-hop questions and
  the follow-ups ("what about her notes?"). The selector routes once. The graph
  can search, look at what it got, and search again.
- **Where did it lose?** Check latency and check your exact-number questions.
  "63" is either right or it's wrong, and a model that decides to skip the SQL
  tool will happily answer from the notes instead.
- **Where did it call the wrong tool, and what fixed it?** If the answer was
  "I rewrote the description," say what you changed and why that worked. That's
  the actual skill here.

Keep the table. It's your before/after, and it's the most portfolio-ready thing
you'll produce this week.

## 4. Break it on purpose

Change `search_clinical_notes`'s description to something vague — `"searches
medical data"` — and re-run your 10 questions. Note how many now route wrong.
Change it back.

You just measured how much of your system's behavior is sitting in a string
with no type checking, no test, and no error when it's wrong. That's the trade
you made when you let the model drive: the routing logic got more capable and
much less inspectable.

## 5. One call to make: does scheduling become a tool?

`/api/chat` keeps a human in the loop — the model proposes an appointment, a
person confirms, *then* it hits the calendar. If `schedule_appointment` is just
another tool in the list, the model can call it mid-loop on its own.

Decide, implement your decision, and be ready to defend it. There's a right
answer here and it isn't about LangGraph.

## The video 🎥 (the required deliverable)

Short — a few minutes, screen recording is fine.

- **Demo the same question on both routes.** Show the difference.
- **Walk your comparison table.** Where tool-calling won, where it lost.
- **Show one tool description you had to rewrite**, and what it fixed.
- **Your call on scheduling**, and why.

Last week you argued for tool-calling in theory. Tell us what changed once you
ran it.

## Bonus

- **Stream it** — `graph.stream(input, { streamMode: 'messages' })` so the graph
  route feels like the other one.
- **Add a third tool** the selector never had (patient lookup by name —
  `findPatientByName` in `lib/patients.ts`) and see if the model finds a use for it.
- **`createReactAgent`** from `@langchain/langgraph/prebuilt` is this entire
  graph in one function call. Build yours by hand first, then swap it in and
  diff the behavior — that's the fastest way to learn what the prebuilt hides.
- **Trace it in LangSmith.** The graph shows up as nested runs; compare the
  trace shape to the selector pipeline's.

## Further reading

- [LangGraph JS — tool calling](https://langchain-ai.github.io/langgraphjs/how-tos/tool-calling/)
- [Why workflows beat agents (most of the time)](https://www.anthropic.com/engineering/building-effective-agents) — we debated this in class; re-read it now that you've built both.
