# Week 3 Runbook — The agent pipeline

**~2h 15m.** The densest session. You will not finish everything cleanly, and
that's the design — set expectations at the top.

**Student guide:** [`../student/week-3-agent-pipeline.md`](../student/week-3-agent-pipeline.md)

> **Say this out loud in the first two minutes:** *"This will not work perfectly
> today. We're getting to a shoddy MVP and then iterating all week. That's the
> job."* Cohort 3 got this framing and the room stayed calm through some genuinely
> broken intermediate states. Without it, a half-working demo reads as failure.

## Before you start

- [ ] **Have `lib/agents/sql.ts` ready to hand out** as a gist or paste. Text-to-SQL
      is too much to type live and the implementation isn't the lesson — the
      *guardrails* are.
- [ ] LangSmith account + project created; API key ready.
- [ ] cal.com account with an event type; have the event type ID findable.
- [ ] Open: `app/api/chat/route.ts`, all four files in `lib/agents/`,
      `lib/scheduling.ts`, `app/page.tsx`.
- [ ] A patient name you know has lots of notes, and one you know is deceased.

## The arc

| Time | What | Notes |
|---|---|---|
| 0:00 | Homework review + expectation setting | The "this won't work today" line. 10 min. |
| 0:10 | **Anatomy of an agent** | The five-part table. Whiteboard. |
| 0:25 | **Why not chain agents** | The 0.9⁴ = 66% arithmetic. Short, but it justifies the whole architecture. |
| 0:35 | **The SQL agent** | Hand out the file. Walk the schema + grounding + `assertReadOnly`. |
| 0:55 | **The RAG agent** | Barely an agent. Fast. |
| 1:05 | **The aggregator + streaming** | The only streamer. Get an answer on screen. |
| 1:25 | **Human-in-the-loop scheduling** | Intent extraction → header → confirm card → cal.com. |
| 1:50 | **LangSmith** | 3 lines. Show a real trace. |
| 2:00 | Homework | The three parts. |

## Live-coding checkpoints

1. Build the route's `if (plan.useSql)` / `if (plan.useRag)` branches — console.log
   both results before wiring the aggregator. **Seeing the raw blobs matters**: it
   makes the case for the aggregator viscerally, because the raw output is
   unreadable.
2. SQL agent: run *"How many patients have hypertension?"* → 63. Then *"How many
   patients over 100 are in our system?"* Then let someone point out it should
   exclude the deceased, and ask the follow-up so the room sees **history** doing
   real work.
3. Aggregator: `streamText`, the `NEVER INVENT` system prompt, the XML-ish tags.
   Get text streaming into the UI.
4. Scheduling: `detectSchedulingIntent` → `buildSchedulingAction` → the
   `X-Scheduling-Action` header → the card appears.
5. LangSmith: wrap the client, ask one question, open the trace together.

## Where it breaks

| Symptom | Cause | Fix |
|---|---|---|
| Aggregator fails on some patients only | **`gpt-4` has an 8K context window** | Switch to `gpt-4o`. This silently ate a chunk of cohort 3's session. |
| `value is not JSON serializable` | `JSON.stringify` on the Pinecone response inside the RAG agent | Return the docs directly |
| Reranked docs are `undefined` | wrong property — it's `.document`, not `.text` on the rerank result | Log one result and read it |
| Scheduling card never appears | returning `NextResponse.json` instead of `.toTextStreamResponse({ headers })` | The header can only ride a stream response |
| Confirm button 404s | cal.com **v1 vs v2** API shape | v2 docs link is in Slack; a student found this and it saved the room |
| First name / last name undefined in reranker string | snake_case vs camelCase metadata keys | `metadata.firstName`, not `metadata.first_name` |
| Everything routes to RAG | thin selector prompt | Add few-shot examples — see below |

## The few-shot beat

`lib/agents/selector.ts` ships with a **commented-out `FEW_SHOT` array** — 11
examples across `sql | rag | hybrid | calendar | clarify`, each `output` typed to
`PlanOutput` so a malformed example fails to compile.

Cohort 3 discovered mid-week that this was the single highest-leverage fix for bad
routing, and it was never taught in the session. **Teach it here.** Ten minutes:

- Zero-shot vs few-shot, one sentence each.
- Why examples beat more prose *for routing specifically*: the failure is a
  classification error, and a labelled example is a classification correction.
- Point at the file. Uncomment it live, add one example from a misroute the room
  just watched, re-run.
- The discipline: ~2 per category. A bloated array means the categories are wrong,
  not that you need more examples.

Frame it as cheaper than fine-tuning — and note that OpenAI deprecated fine-tuning
for exactly this reason.

## Discussion prompts

- *"Why not one agent that does everything?"* → then the 90% arithmetic.
- *"Why is the scheduler human-gated? It's just a calendar row."* → push until
  someone generalises to irreversible actions.
- *"Should the model be allowed to write SQL at all?"* → good, real disagreement.
  Land on: yes, with `assertReadOnly` and a read-only role.
- *"What's in a note that SQL can't answer?"* → reinforces the whole premise.

## Homework to post

Three parts — the full text is in the student guide:

1. **Get the app working**, all of it (+ metadata search as bonus)
2. **Collect ≥10 query/response pairs, good AND bad** — with the worked example
   format
3. **Tool-calling video** — what it is, why it matters, how you'd refactor *this*
   project, plus a diagram

**Part 2 is the one to sell.** Say explicitly: *"Keep this list. We build on it in
a couple of weeks."* It's the seed of their eval set, it costs nothing to collect
while building, and it's painful to reconstruct later. Cohort 3 under-emphasised
it and few students had a usable log by capstone time. Push harder.

## Notes from cohort 3

- Ran long. The scheduling section is the one to compress if you're behind — the
  concept lands in five minutes, the wiring can be homework.
- Post the working files as a gist immediately after. Cohort 3 got chat route,
  page, aggregator, rag, selector, sql, openai, and scheduling — students who fell
  behind used them to catch up rather than dropping out.
- Someone will try to schedule a dead patient. Cohort 3 did, in Slack, publicly,
  and it was one of the best teaching moments of the course: the model does what's
  *asked*, not what's *sensible*. Have the live-patients list ready to post.
- Expect a 403 wave when people first call `responses.parse` in a new file. It's
  always `OPENAI_BASE_URL`.
