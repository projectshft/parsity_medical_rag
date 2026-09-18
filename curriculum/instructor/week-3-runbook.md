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
| 0:35 | **The SQL agent** | Hand out the file. Walk the schema + grounding, then the guardrail gap (below). |
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
   **Check `LANGSMITH_TRACING=true` is in their `.env` first** — the key alone
   produces no traces and no error, and you will burn ten minutes on it in front
   of the room. It's in `.env.example` now; older clones don't have it.

## Where it breaks

| Symptom | Cause | Fix |
|---|---|---|
| Aggregator fails on some patients only | **`gpt-4` has an 8K context window** | Already `gpt-4o` on the canonical branch as of cohort 4. If someone's on an older clone, this is it. Teach the diagnostic anyway: measure input size before touching the prompt. |
| `value is not JSON serializable` | `JSON.stringify` on the Pinecone response inside the RAG agent | Return the docs directly |
| Reranked docs are `undefined` | wrong property — it's `.document`, not `.text` on the rerank result | Log one result and read it |
| Scheduling card never appears | returning `NextResponse.json` instead of `.toTextStreamResponse({ headers })` | The header can only ride a stream response |
| Confirm button 404s | cal.com **v1 vs v2** API shape | v2 docs link is in Slack; a student found this and it saved the room |
| First name / last name undefined in reranker string | snake_case vs camelCase metadata keys | `metadata.firstName`, not `metadata.first_name` |
| Everything routes to RAG | thin selector prompt | Write few-shot examples live — see below |

## The guardrail gap — teach it as a gap, not a feature

Know the state of the code before you open the file, because the two branches
disagree:

- **`instructor` has `assertReadOnly`** (`lib/agents/sql.ts:108`), wired in inside
  the `try` so a refused query returns a bad answer rather than a 500.
- **The student branch does not.** It has a marked TODO above the
  `$queryRawUnsafe` call and nothing else. `DATABASE_URL` → `student_ro` (SELECT
  only) is the sole live defense.

Don't paper over that. It's the better lesson:

1. Open `lib/agents/sql.ts` and read the `$queryRawUnsafe(sql)` line out loud.
   *"This is a string a language model wrote, and we are executing it."*
2. Ask what's stopping it from being a `DROP TABLE`. Someone will say "the
   prompt says SELECT only." → **a prompt is a request, not a constraint.**
3. Ask what IS stopping it. Walk them to the role. Note where that guardrail
   lives: in the database, not the code — outside the blast radius of any prompt
   change or model upgrade.
4. Then assign the validator, and be clear about why you'd still write one when
   the role already blocks the damage: a permission error is a 500 at 2am; a
   validator is a message that says what happened.

**Order matters when you say it:** the database enforces, the validator explains.
A student who leaves with those reversed has learned something actively dangerous.

## Few-shot examples — write them live, there's no scaffold

⚠️ **Correction to earlier versions of this runbook:** it claimed
`lib/agents/selector.ts` ships a commented-out `FEW_SHOT` array of 11 typed
examples. It doesn't, on any branch. There *was* one — it was deleted in `6e95a1d`
when the selector was simplified to pure routing, and the runbook was never
updated. Don't go looking for it in the file and don't tell the room to uncomment
it.

Still worth ten minutes, just typed rather than revealed:

- Zero-shot vs few-shot, one sentence each.
- Why examples beat more prose *for routing specifically*: the failure is a
  classification error, and a labelled example is a classification correction.
- Take a misroute the room just watched. Write the example for it live, in an
  array, serialised into the system prompt. Re-run. Two lines of typing.
- The discipline: ~2 per category across `sql | rag | hybrid | calendar |
  clarify`. A bloated array means the categories are wrong, not that you need
  more examples.

Frame it as cheaper than fine-tuning.

## Discussion prompts

- *"Why not one agent that does everything?"* → then the 90% arithmetic.
- *"Why is the scheduler human-gated? It's just a calendar row."* → push until
  someone generalises to irreversible actions.
- *"Should the model be allowed to write SQL at all?"* → good, real disagreement.
  Land on: yes, with a read-only role **and** a validator — and be honest that
  only the first of those is in their repo today.
- *"What's in a note that SQL can't answer?"* → reinforces the whole premise.

## Homework to post

Three parts — the full text is in the student guide:

1. **Get the app working**, all of it (+ metadata search as bonus)
2. **Collect ≥10 query/response pairs, good AND bad** — with the worked example
   format
3. **Tool-calling video** — what it is, why it matters, how you'd refactor *this*
   project, plus a diagram

**Part 2 is the one to sell.** Say explicitly: *"Keep this list — **next week**
you pick five of these, run them through a second implementation, and compare."*
Tell them to log more than five so they get to choose which. In
cohort 3 the payoff was vague and distant ("a couple of weeks") and few students
had a usable log by capstone. In cohort 4 it's week 4's homework, so the promise
is concrete. Make it.

**Part 3 (the tool-calling video) is now a prediction they get to check.** Week 4
builds the thing they're sketching. Say that too — it changes how carefully people
think about the sketch.

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
