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

## 3. Compare them — five questions, one table

Pull **five** questions out of the query log you started last week. Make sure at
least one is an exact-number question ("how many patients have…") and at least
one is a follow-up that depends on the previous turn.

Send each to both routes and fill this in:

| # | Question | `/api/chat` | `/api/chat-graph` | Tools called | Better? |
|---|----------|-------------|-------------------|--------------|---------|
| 1 | How many patients have hypertension? | 63 ✅ | | | |

Then **three or four sentences total** — not per row — on the biggest difference
you saw. If one route was better, say which and why you think so.

That's the whole written deliverable. The table is the point; the prose is just
enough to prove you looked at it.

## The video 🎥 (the required deliverable)

Short — a few minutes, screen recording is fine.

- **Demo the same question on both routes.** Show the difference.
- **Walk your table.** Where did tool-calling win, where did it lose?
- **One thing that surprised you.**

Last week you argued for tool-calling in theory. Tell us what changed once you
ran it.

## Also due this week: the capstone plan doc

Posted separately in Slack, and it's the one with a real deadline — next week is
the capstone build session and it doesn't work for anyone without a plan. Do that
one first if you're short on time; the graph can slip a few days, the plan can't.

## Bonus

- **Break it on purpose.** Change `search_clinical_notes`'s description to
  something vague — `"searches medical data"` — re-run your five questions, count
  the misroutes, change it back. Ten minutes, and it shows you how much of your
  system's behavior is sitting in an untested string.
- **Does scheduling become a tool?** `/api/chat` keeps a human in the loop: the
  model proposes, a person confirms, *then* it hits the calendar. A
  `schedule_appointment` tool in the list can be called mid-loop on its own.
  Worth thinking through even if you don't build it — we'll argue about it in
  class.
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
