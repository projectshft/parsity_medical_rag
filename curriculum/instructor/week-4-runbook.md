# Week 4 Runbook — Tool calling with LangGraph

**~2h.** Replaces cohort 3's MCP session, which ate itself on environment setup
(see [`bonus-mcp-runbook.md`](bonus-mcp-runbook.md) — worth reading before you
teach this, because the failure mode you're avoiding is documented there).

**Student guide:** [`../student/week-4-tool-calling.md`](../student/week-4-tool-calling.md)

> **This session has not been delivered.** Everything below is planned, not
> observed. Fill in "Notes from cohort 4" the same day you teach it — that section
> is the highest-value thing in this file and you cannot reconstruct it a month
> later.

## Why this replaces MCP

Worth being explicit with yourself about the trade, because a student will ask.

MCP taught one real idea — a model you never prompted picks your tool — wrapped
in about ninety minutes of stdio transports, `.js` extensions, Node version
mismatches and desktop-app restart cycles. Most of cohort 3 never got a server
connected in the room.

Tool calling teaches the *same* idea with none of that: no subprocess, no
protocol, no second app, and it runs inside the repo they already have working.
And it sets up a comparison MCP never could — the same question through a
hand-rolled workflow and a model-driven loop, side by side.

MCP stays as bonus. Point the two or three people who want Claude Desktop at it.

## Before you start

- [ ] **Confirm deps are on the canonical branch**: `@langchain/langgraph`,
      `@langchain/openai`, `@langchain/core`. Have someone who did a fresh clone
      run `npm install` midweek and confirm.
- [ ] **Your own `buildGraph()` working, on a branch you don't screen-share.**
      You need it for the payoff demo; you do not want to paste the solution.
- [ ] **A question you know routes wrong** with a vague tool description, and the
      rewritten description that fixes it. This is the session's best ten minutes
      and it is much better rehearsed than improvised.
- [ ] **A multi-hop question** that the week-3 selector genuinely handles badly —
      ideally a follow-up like *"and what do her notes say?"* Verify it beforehand.
- [ ] Open: `app/api/chat/route.ts` (to read the three `if` lines), `lib/graph.ts`,
      `app/api/chat-graph/route.ts`, `docs/CHALLENGE-LANGGRAPH.md`.
- [ ] Ask midweek in Slack who actually finished week 3. Anyone whose `/api/chat`
      doesn't work cannot do the comparison homework, which is the point of the
      week. Triage those people first.

## The arc

| Time | What | Notes |
|---|---|---|
| 0:00 | Homework review — the tool-calling videos | 15 min. These were the deliverable; play one or two. Great cold open: they already argued the thing you're about to build. |
| 0:15 | **The three `if` lines** | Open `route.ts`, read them aloud. "This is what we're replacing. Not the agents — these." |
| 0:25 | **Workflow vs agent** | The table from the student guide. Reference the week-2 paper. Do NOT frame tool-calling as the upgrade. |
| 0:40 | **Anatomy of a tool** | name / description / schema / handler. Handler is one line — it calls `runRag`. |
| 0:50 | **The description IS the routing logic** | The set piece. See below. |
| 1:05 | **The graph** | Two nodes, one condition, one edge back. Whiteboard it before any code. |
| 1:20 | **Build it together** | Add the SQL tool + `buildGraph`. Hands on keyboards. |
| 1:40 | **Read `result.messages`** | Log the whole array on screen and narrate it. |
| 1:50 | **Same question, both routes** | The payoff. Use your rehearsed multi-hop question. |
| 1:58 | Homework | Build + comparison table + capstone doc. |

## The set piece: descriptions as routing logic

Ten minutes, and it's the thing they'll remember.

1. Show the good description for `search_clinical_notes`.
2. Replace it live with `"searches medical data"`.
3. Ask the question you rehearsed. Watch it call the wrong tool.
4. Ask the room *why* — don't tell them.
5. Put it back. Ask again. It works.

Then land it: **in week 3, routing was a typed boolean you could test. Now it's an
English paragraph with no type, no test, and no error when it's wrong.** That is
what you traded for the model's flexibility. Not better, not worse — different,
and you should know which one you're buying.

## Live-coding checkpoints

1. **The SQL tool.** Let them write the description first, before any code, then
   compare three of them out loud. Descriptions get better when read aloud next to
   a competitor.
2. **`agentNode`.** `model.bindTools(tools)`, `invoke(state.messages)`, return
   `{ messages: [reply] }`. Three lines; say why it returns an array (the state
   reducer appends).
3. **The graph wiring.** Deliberately omit `.addEdge('tools', 'agent')` first. It
   retrieves and then says nothing. Let them find it. This is the single most
   instructive bug in the session.
4. **`result.messages`.** `console.log(JSON.stringify(result.messages, null, 2))`
   and read it as a story: *it asked for this tool, with these arguments, got this
   back, then wrote this.*
5. **Both routes, same question.** Keep `/api/chat` open in a second tab the whole
   session so this is one click.

## Where it breaks

Predicted from the code — this session hasn't run. Update after you teach it.

| Symptom | Cause | Fix |
|---|---|---|
| Graph retrieves, then answers with nothing | missing `.addEdge('tools', 'agent')` | Add it. Teach it as checkpoint 3. |
| `Recursion limit reached` | conditional edge never routes to `END` | Use `toolsCondition`, don't hand-write it |
| `tool()` call rejected / model can't call it | wrote `parameters:` (AI SDK v4) instead of `schema:` (LangGraph v1) | Both libs are installed; don't mix in one file |
| `401`/`403` from `ChatOpenAI` | `baseURL` at top level | `configuration: { baseURL: process.env.OPENAI_BASE_URL }` |
| Model never calls the SQL tool | description doesn't distinguish it from the notes tool | The set piece above, applied |
| Exact-number answers got worse | the model *chooses* SQL; the selector was forced | Not a bug. Make them report it. |
| `buildGraph is not implemented` | it throws by design | That's the assignment |

## Discussion prompts

- *"Who decides what runs now?"* → the model. Push until someone is uncomfortable
  about it. That discomfort is correct.
- *"Your selector returned a `reason` string. Was it true?"* → it was generated
  after the decision, to look like a justification. `result.messages` is the
  actual record. Good, slightly unsettling distinction.
- *"Should `schedule_appointment` be a tool?"* → the best argument of the session.
  Week 3 said a human confirms before anything hits the calendar. A tool in the
  list can be called mid-loop. Someone will propose "make the tool only *propose*"
  — that's the right answer and let them get there.
- *"We deleted 4 lines of routing and added a paragraph of English. Better?"* →
  no single answer. Make them commit to one and give a tradeoff: latency, cost,
  debuggability, handling the unanticipated.
- *"Which would you ship at work?"* → most will say the workflow, and they should
  be able to say why without sounding like they're avoiding the hard thing.
- *"What would you need to see to change your mind?"* → the eval-set question,
  one week early. It sets up week 5.

## Homework to post

Four parts. The full text is in the student guide.

1. **Build the graph** (`docs/CHALLENGE-LANGGRAPH.md`)
2. **Run the week-3 query log through both routes** — the comparison table
3. **Break one description on purpose** and count the misroutes
4. **The capstone plan doc** — the template link, both tracks, *find the data
   before you choose the idea*, and the completeness test (*paste it into Claude
   and say "build this"; if it needs four clarifying questions, it isn't done*)

**Sell part 2 hardest.** It's the payoff for the logging you pushed in week 3, and
it's the first time their own eval set does real work. Cohort 3 under-collected
those pairs and few had a usable log by capstone; if the log is thin, this
homework is what makes them care.

**Part 4 is the one with a deadline attached** — week 5 is the capstone build
session and it's wasted for anyone without a plan. Say that explicitly.

## Notes from cohort 4

*(Fill this in the day you teach it. Suggested: did the description set piece
land? Did anyone's comparison table show the workflow winning? Did the
`schedule_appointment` argument go anywhere good? How long did the graph wiring
actually take?)*
