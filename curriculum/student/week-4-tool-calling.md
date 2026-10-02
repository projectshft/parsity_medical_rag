# Week 4 — Tool calling: let the model drive

**Session:** Saturday · [recording posted in Slack]
**Needs:** everything so far, plus a working `/api/chat`

> **Cohort 4, first run.** This session replaces cohort 3's MCP week, which has
> been retired. Unlike weeks 1–3, this guide was written
> *before* the session rather than from a recording, so "When it breaks" is
> predicted from the code, not yet observed in a room. It'll be rewritten from
> what actually happens.

## What we built

Week 3 ended with a pipeline where **your code** decides what runs:

```ts
const plan = await select(query, messages);
if (plan.useSql) sqlResult = await runSql(query, messages);
if (plan.useRag) ragResult = await runRag(plan.semanticQuery);
```

Read those three lines again, because they're the entire thing we're replacing.
Not the agents — the `if`s. `runSql`, `runRag`, the reranker, the aggregator all
survive this session untouched.

### 1. The inversion

In the *Building Effective Agents* vocabulary you read in week 2, what you built
is a **workflow**: routing plus conditional parallelization, orchestrated through
fixed code paths. The alternative is an **agent**: hand the model a list of tools
and let it choose, in a loop, until it decides it's done.

| | Workflow (week 3) | Tool calling (today) |
|---|---|---|
| Who picks the path | your code, from booleans | the model, from descriptions |
| Hops per question | exactly one round | as many as it wants |
| When it's wrong | you read the `if` | you reread a string |
| Cost | predictable | depends on the model's mood |
| Handles what you didn't anticipate | no | sometimes |

Neither one is the advanced version of the other. That's the argument your week-3
video was making; today you get to check it against a running system.

### 2. What a tool actually is

```ts
const searchClinicalNotes = tool(
  async ({ semanticQuery }) => runRag(semanticQuery),
  {
    name: 'search_clinical_notes',
    description:
      "Search the clinical notes by MEANING. Use this for anything a doctor would " +
      "have written in prose — symptoms, how a visit went, what the patient reported. " +
      "There is no 'short of breath' column, so questions like that belong here.",
    schema: z.object({
      semanticQuery: z.string().describe('What to search the notes for, in clinical language.'),
    }),
  },
);
```

Four parts, and the body is one line — it calls the function you already wrote.

**The description is the routing logic.** That's the thing to sit with. In week 3
your routing lived in a typed boolean you could read, test, and step through in a
debugger. Now it lives in an English paragraph with no type, no test, and no
error when it's wrong. Two tools whose descriptions both sound plausible for the
same question produce a coin flip, and nothing anywhere will tell you.

This is the same lesson as `.describe()` on the selector schema in week 2, with
much higher stakes.

### 3. The graph

The loop itself — call model, run tool, feed the result back, repeat until done —
is what LangGraph runs for you. Two nodes and one condition:

```
START ──▶ agent ──(wants a tool?)──▶ tools ──┐
            │                                │
            └◀───────────────────────────────┘
            │
         (done) ──▶ END
```

```ts
new StateGraph(MessagesAnnotation)
  .addNode('agent', agentNode)
  .addNode('tools', new ToolNode(tools))
  .addEdge(START, 'agent')
  .addConditionalEdges('agent', toolsCondition, { tools: 'tools', [END]: END })
  .addEdge('tools', 'agent')     // ← forget this one and it retrieves, then never speaks
  .compile();
```

`MessagesAnnotation` is the prebuilt state: a list of messages that
**accumulates**. That accumulation is the whole reason the loop works — it's how
the model knows it already called a tool and what came back. Nobody threads
state through by hand.

The one function you write is `agentNode`: bind the tools to the model, invoke it
with `state.messages`, return `{ messages: [reply] }`.

### 4. Reading the trace

`result.messages` is the part worth staring at. It holds, in order: the model's
tool request, the tool's result, and the final answer. Log it once.

That array is the thing you could not see in week 3. The selector gave you
`{ useSql: true, useRag: false }` and a `reason` string it made up after the fact.
This shows you the actual decisions, in sequence, including the ones it changed
its mind about.

### 5. Where it goes in the repo

`/api/chat` stays exactly as it is. The graph is a **second** route,
`/api/chat-graph`, with the same request and response shape. That's deliberate:
you need both alive to do the homework, and "the new thing broke the working
thing" is not a lesson anyone needs twice.

## Homework

Three things, and the third one is the one with a deadline.

### 1. Build it — `docs/CHALLENGE-LANGGRAPH.md`

The model and one working tool (`search_clinical_notes`) are provided as the
pattern. You add the SQL tool, write `buildGraph()`, and wire the route.

### 2. Compare them — five questions, one table

Pull **five** questions out of the query log you started last week. Include at
least one exact-number question and at least one follow-up that depends on the
previous turn.

| # | Question | `/api/chat` | `/api/chat-graph` | Tools called | Better? |
|---|---|---|---|---|---|

Then **three or four sentences total** on the biggest difference you saw — not
per row. The table is the deliverable; the prose just proves you read it.

This is what the week-3 logging was for. Two things worth checking specifically:
the follow-ups, where the selector routes once and the graph can search, look,
and search again — and the exact-number questions, where "63" is either right or
wrong and a model that *chooses* to skip the SQL tool will answer from the notes
instead.

### 3. The capstone plan doc

**Do this one first if you're short on time.** Next week is the capstone build
session and it doesn't work for anyone without a plan — the graph can slip a few
days, this can't.

Make a copy of the [capstone plan template](https://docs.google.com/document/d/1CoJvxoJkfzFb_V3hXYE-YC08wH8a_N8QU1fMDlq4Td0/edit?usp=sharing)
and fill it in. Post it in the channel. Two tracks — pick one:

**Track A — extend this system.** One real addition, shipped and measured.
**Track B — build your own** on data you choose. Most people pick this, and it
makes the better portfolio piece.

If you're going Track B, **the data decides your project, not the idea.** Find
data you can actually get, in volume — a few hundred documents minimum, because a
semantic index over 40 documents is a demo where you cannot tell good retrieval
from bad. See [the capstone guide](week-5-capstone-build.md).

Five sections: data source, user flow, vector store + chunking + metadata, how the
data stays fresh, agent architecture.

**The test for whether it's done:** paste it into Claude or Cursor and say "build
this." If the model needs four clarifying questions first, the doc isn't
finished — and neither is your thinking.

### The video

Short, a few minutes.

- **Demo the same question on both routes.** Show the difference.
- **Walk your table** — where tool-calling won, where it lost.
- **One thing that surprised you.**

Last week you argued for tool-calling in theory. Tell us what changed once you ran
it.

### Optional, if you have time

- **Break it on purpose.** Make `search_clinical_notes`'s description vague —
  `"searches medical data"` — re-run your five questions, count the misroutes,
  change it back. Ten minutes, and it shows you how much of your system's
  behavior lives in an untested string.
- **Does `schedule_appointment` become a tool?** It writes to the real world, and
  week 3's whole point was that a human confirms first. Worth thinking through
  even if you don't build it — we'll argue about it in class.

## Reading

- [LangGraph JS — tool calling](https://langchain-ai.github.io/langgraphjs/how-tos/tool-calling/)
- [OpenAI — Function calling](https://developers.openai.com/api/docs/guides/function-calling)
- [Anthropic — Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — you read it in week 2. Read the workflow-vs-agent section again now that you've built both.

## When it breaks

Predicted from the code, not yet observed — this session hasn't run.

- **`buildGraph is not implemented`.** It throws on purpose. That's the exercise.
- **The graph answers with nothing, or "I searched the notes."** You're missing
  `.addEdge('tools', 'agent')`. The tool ran, the result went into state, and the
  model never got another turn to talk about it.
- **`Recursion limit reached`.** The loop never ends — usually the conditional
  edge sends it back to `tools` when it should go to `END`. Use `toolsCondition`
  rather than hand-writing the check.
- **The model never calls the SQL tool.** Its description doesn't distinguish it
  from the notes tool. Say what kind of question it answers — counts, exact
  lookups, anything with its own column — and say what it's *not* for.
- **`schema` vs `parameters`.** LangGraph v1's `tool()` takes `schema:`. If you
  paste an AI-SDK example you'll write `parameters:` and get a tool the model
  can't call. Both libraries are installed; don't mix them in one file.
- **`401` / `403` from the model.** `OPENAI_BASE_URL` again. `ChatOpenAI` takes it
  as `configuration: { baseURL }`, not as a top-level option.
- **Exact-number answers got worse.** Expected, and worth reporting rather than
  fixing quietly. The selector was *forced* to call SQL; the model merely thinks
  it should.

## Check yourself

- The same question, asked on both routes, and you can explain why the answers
  differ.
- You can point at `result.messages` and narrate the model's decisions in order.
- Your five-row comparison table is filled in.
- Your capstone plan doc is posted.

