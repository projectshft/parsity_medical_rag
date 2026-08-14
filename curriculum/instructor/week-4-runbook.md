# Week 4 Runbook — MCP

**~2h, and it will feel like more.** This session went worse than any other in
cohort 3. Most of the room never got a server connected during the session.

**Student guide:** [`../student/week-4-mcp.md`](../student/week-4-mcp.md)

> **Read this whole runbook before teaching it.** The concept takes twenty
> minutes. The remaining ninety are environment failures, and they are
> *predictable* — which means they're preventable. Cohort 3 lost roughly 45
> minutes to three specific problems, all listed below.

## Before you start — do this the week before, not on the day

- [ ] **Poll Node versions in Slack midweek.** `node -v`. Anyone on 22/24 fixes it
      before Saturday. This alone recovers most of the lost time.
- [ ] **Confirm the npm scripts exist** on the canonical branch:
      ```json
      "mcp": "npx ts-node mcp-server/index.ts",
      "mcp:inspect": "npx @modelcontextprotocol/inspector npx ts-node mcp-server/index.ts"
      ```
      If they don't, add them first. Cohort 3 had students typing the raw
      invocation and getting it subtly wrong. `tsconfig.json` already carries the
      `ts-node` CommonJS + `transpileOnly` block that makes it work.
- [ ] **Ask who has Claude Desktop.** It's paid. Plan for a mixed room and lead
      with the Inspector, not the desktop app.
- [ ] **Fix the hardcoded `INDEX_NAME` in `lib/vector-search.ts`** or warn about it
      again. It 404s people here for the second time.
- [ ] Have your own server working *and* a screen-share of it working, in case
      yours breaks live (it did in cohort 3).

## The arc

| Time | What | Notes |
|---|---|---|
| 0:00 | Homework review | Light — last week's was big. |
| 0:10 | **What MCP is** | API for agents, RPC underneath. Ask who's used Figma/GitHub MCP — most have. |
| 0:20 | **The front-office framing** | Why STAFF sees no PII; the channel *is* the permission. |
| 0:30 | **Anatomy of a tool** | name / description / inputSchema / handler. Emphasise description-as-interface. |
| 0:45 | **Build one together** | Walk the provided `query_clinical_notes`, then everyone writes their own. |
| 1:05 | **Everyone writes a tool** | 15 min hands-on. Calculator, BMI, schedule — anything. |
| 1:20 | **Run it in the Inspector** | This is where it breaks. Budget generously. |
| 1:45 | **Claude Desktop** (if time) | Config, restart, the "foreign model picks your tool" moment. |
| 1:55 | Homework: the capstone doc | |

## The three failures that will eat your session

Have these on a slide. Say them **before** anyone runs anything.

**1. `Unknown file extension ".ts"`** — Node 22/24. `nvm use 20`. Most common by
far.

**2. Dropping `.js` from the SDK imports.** It must be
`@modelcontextprotocol/sdk/server/mcp.js`. Several students removed the extension
because "it's a TypeScript file." The SDK's package exports resolve `./*`
verbatim; nothing appends it. Say this preemptively — it's unintuitive and costs
twenty minutes to diagnose.

**3. The Inspector's transport.** It does not default to STDIO. Students sat on a
connect screen that never connected. **Point at the dropdown and say "STDIO"
before anyone clicks connect.**

Then the second tier:

| Symptom | Cause | Fix |
|---|---|---|
| `OPENAI_API_KEY is missing` in the Inspector | it doesn't read `.env` | Add vars in its env panel, or `export` them inline |
| Pinecone 404 | hardcoded `INDEX_NAME` | Point at `process.env.PINECONE_INDEX` |
| Tool hangs in Claude Desktop, fine in Inspector | **stdout pollution** | Something wrote to stdout — which *is* the JSON-RPC stream. `console.error`, and `config({ quiet: true })` for dotenv's banner |
| Server never appears in Claude Desktop | relative path or invalid JSON | Absolute path; check `~/Library/Logs/Claude/mcp-server-medical-rag.log` |
| Config edited, nothing changed | read at launch | Full Cmd-Q and reopen |
| `searchClinicalNotes not implemented` | student's own week-2 stub | Their week 2 wasn't finished |

**Teaching move that works:** when a student's server fails, have them share
screen and debug it in front of everyone. Cohort 3 did this repeatedly and each
fix generalised to two or three other people silently stuck. It's slower for one
person and much faster for the room.

## The payoff moment — don't skip it

If anyone gets Claude Desktop working, put it on screen. Ask it, in plain
language, *"what patients have dementia and what are the trends?"* and let the room
watch a model nobody prompted find the tool, call it, and render a formatted table.

That moment is why the session exists. If your own setup is broken, borrow a
student's screen.

## Discussion prompts

- *"Who owns the prompt that decides whether your tool gets called?"* → nobody in
  this room. That's why descriptions are the interface.
- *"What could go wrong exposing this to any AI on the machine?"* → good, real
  security discussion; leads into the PII framing.
- *"Why not just let the caller pass `showPII: true`?"* → a control the caller can
  switch off is decoration.
- *"Would you deploy this at your company?"* → cohort 3 had a student building
  something adjacent for a real clinic; that conversation was worth ten minutes.

## Homework to post

**The capstone plan doc, and nothing else.** No code. Post the Google Doc template
link and tell people to copy it and fill it in.

Explicitly offer both tracks — extend the medical system, or build their own. Say
that most people pick their own and it makes the better portfolio piece. Then give
them the one instruction that matters: **find the data before you choose the
idea.**

And the completeness test: *paste the doc into Claude and say "build this." If it
needs four clarifying questions, the doc isn't done.*

## Notes from cohort 3

- Brian's own MCP server failed to connect during the session while several
  students' worked. Handle it the way he did — keep moving, debug after. The
  Inspector fallback is what saved the segment.
- Roughly half the room stayed 45+ minutes after. Expect it and don't schedule
  anything after.
- The Slack post afterwards — *"MCP!!! Holy moly that was tougher than
  anticipated"* — was the right tone. Naming the difficulty publicly kept nobody
  feeling singularly incompetent.
- Consider splitting this into concept (30 min) + a separate hands-on clinic, or
  moving MCP earlier while energy is higher. It's the strongest candidate for
  restructuring in cohort 4.
