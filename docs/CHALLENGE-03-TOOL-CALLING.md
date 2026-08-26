# Week 3 — Ship both architectures, then pick one with evidence

In class we built the same capability twice: as a **workflow** (your code
routes, the agents run in fixed positions) and as **tool calling** (the model
gets a toolbox and decides). This week you finish both and let the golden set
settle the argument.

You are not being asked which one you like. You're being asked which one wins on
your data, and to be able to say why.

## 1. Finish the workflow path

`selector → (sql ‖ rag) → aggregator`, orchestrated in `app/api/chat/route.ts`.

- **The selector routes and nothing else.** `{ useSql, useRag, needsSearch,
  semanticQuery }`. It does not extract conditions or build filters — the SQL
  agent's own LLM does that when it writes the query.
- **Run SQL and RAG in parallel.** They don't depend on each other. `Promise.all`.
  Cohort 3 left these sequential all the way to the end; it's free latency.
- **Pass metadata to RAG.** Right now `runRag` searches on meaning alone. A
  question about one patient should carry that patient's filter. Extract it
  wherever you think it belongs — the selector, a small dedicated call, or off
  the back of the SQL result — and be ready to defend the choice.
- **Few-shot the selector.** Keep an array of `{ question, expectedPlan }`
  examples and feed them in. This was the single biggest quality win in Cohort 3
  — bigger than any prompt rewrite. When you hit a routing mistake, add it as an
  example rather than growing the system prompt.

## 2. Build the tool-calling path

Same capabilities, handed over instead of orchestrated. Define the tools:

```
search_notes(query, patientId?, topK?)   -> clinical notes, semantically
run_sql(question)                        -> the text-to-SQL agent
get_patient(name)                        -> exact lookup
```

Then loop: send the tools, get back tool calls, execute them, feed results back,
repeat until the model answers. That loop is all "an agent" means.

Two things to get right:

- **The descriptions are the interface.** The model picks tools by reading their
  descriptions and parameter docs, the same way it reads your Zod `.describe()`
  strings. A vague description is a routing bug.
- **Cap the loop.** Max iterations, and a token budget. An agent that decides
  it's not done yet will happily prove it fifteen times.

## 3. Run both against the golden set

For each architecture, record:

| | Workflow | Tool calling |
|---|---|---|
| Correct answers (of 20) | | |
| Exact-count questions right | | |
| Mean tokens per query | | |
| Mean latency | | |
| Times it searched when it shouldn't have | | |

That last row matters more than it looks. In the workflow, *your code* decides
when a patient's notes get read. With tool calling, the model does — and
"the model decides when to touch patient data" is a different privacy posture
than the one you shipped last week.

## 4. Write it up (half a page, in the repo)

`docs/notes/week-3-architecture.md`, or wherever you like:

- Which architecture won on your numbers, and by how much.
- Which pattern from *Building Effective Agents* you're actually using — routing?
  parallelization? orchestrator-workers? Name it precisely.
- One tradeoff you'd accept and one you wouldn't.
- What would change your mind.

## What "done" looks like

- [ ] The workflow answers SQL, note, hybrid and general questions end to end
- [ ] The tool-calling loop does the same, with a cap on iterations
- [ ] Both scored against the week-2 golden set, in a table
- [ ] Few-shot examples in the selector, driven by real failures you hit
- [ ] The write-up

## The video 🎥 (3–4 min)

- **What tool calling is**, plainly.
- **Which one you'd ship for this project**, defended with your numbers and one
  concrete tradeoff — predictability, cost, latency, debuggability, or the
  privacy boundary.
- **A small diagram.** Whiteboard, Excalidraw, paper held up to the camera — all
  fine.

There's no correct side. There is correct *reasoning*. A strong video names the
pattern precisely and argues from a measurement. A weak one says "agents are the
future" and moves on.

## Further reading

- [Anthropic — Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- [OpenAI — Function calling](https://platform.openai.com/docs/guides/function-calling)
