# Week 3 — MCP + human-in-the-loop · Facilitator Runbook

**Block:** MCP + human-in-the-loop · **Days covered:** 13–18 · **Session length:** ~110 min · **Deck:** `week-3.html`

**Goal of this session:** the room leaves able to explain — without notes — how their RAG stops being an app and becomes a *tool other AIs can call* (MCP), why the front-office channel is safe by construction (limited non-PII tools + always-obscured responses, no login), and how it's held back from acting on its own when the action matters (human-in-the-loop). They will have talked to the server over a raw pipe, wired it into a real AI client (or the inspector), and called a tool live.

> This runbook is backstage. The slides are what students see, so slide text stays in the student register (household-name conditions like high blood pressure/diabetes). You do **not** need to have built the system to run this — Pre-flight and Code-together assume you're coming in cold.

---

## Pre-flight (before the room arrives)

- [ ] Repo cloned on the **`instructor`** branch (you want the solved `scheduling.ts` / `calendar.ts` to demo against), `npm install` done. Students follow on `student`.
- [ ] `.env` filled with the base stack: `DATABASE_URL` (Neon), `PINECONE_API_KEY`, `OPENAI_API_KEY`. `CAL_API_KEY` + `CAL_EVENT_TYPE_ID` only if you intend to book a *real* appointment live (optional — the propose→approve flow demos fine without them).
- [ ] **The MCP server runs.** Smoke-test it once yourself before class:
  ```bash
  echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | npx ts-node mcp-server/index.ts
  ```
  You should get JSON back listing the three tools with their schemas. If you see nothing (or garbage before the JSON), you almost certainly logged to stdout somewhere — check for a stray `console.log`. Note `mcp-server/index.ts` correctly uses `console.error('Medical RAG MCP server running')` on startup; that's fine, stderr isn't the channel.
- [ ] **Claude Desktop or Cursor installed**, with the `medical-rag` server already wired into its config and confirmed working (tools icon visible in a fresh conversation). Do this the night before — the first wiring always takes longer than you think, and absolute-path bugs are not a live-demo moment.
  - macOS Claude Desktop config: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - Cursor: `.cursor/mcp.json` at the repo root
  - **Fallback if no client cooperates:** run the whole MCP segment through the pipe + `npx @modelcontextprotocol/inspector` (see Code-together Part 1). You lose the "a foreign model picks your tool" reveal but keep every teaching point.
- [ ] **No keys to set.** MCP is the front-office channel — it exposes only non-PII tools and always obscures responses, so there's no API key, no scopes, no `MCP_REQUIRE_AUTH`. Nothing to configure here.
- [ ] A populated note index for the `query_notes` tool to have something to return — run `npm run vectorize -- --limit 200` once if you haven't already this course. The `search_patients` / condition-count tools read Postgres directly and don't need it.
- [ ] Terminals open: one for the MCP pipe/inspector, one tailing the client's MCP log:
  ```bash
  tail -f ~/Library/Logs/Claude/mcp-server-medical-rag.log   # client-side
  ```
- [ ] `week-3.html` open full-screen in a browser. Arrow keys / click to navigate; `N` toggles presenter notes.

If a laptop can't install an MCP client, pair them — one wired client (or the inspector) per two people survives the whole session.

---

## Timed flow (~110 min)

| Time | Arc segment | Slides | What to do |
|---|---|---|---|
| 0:00 | **Problem statement** | 1–3 | Cold open: "Everything you built lives in *your* chat box. Your users live in Claude Desktop and Cursor. Do you write an integration for each?" Sit in the gap before naming MCP. |
| 0:10 | **How it's solved** | 4 | Land the one line: *write one MCP server, any client discovers your tools.* USB-C for AI. REST serves programmers; MCP serves models. |
| 0:16 | **High-level concept** | 5 | The inversion that matters: *your tool description is a prompt for a model you don't control.* The description **is** the interface. |
| 0:24 | **Code together (part 1)** | 6–7 | Pipe `tools/list` at the server (no AI). Then wire into Claude Desktop and ask a plain question — watch a foreign model pick a tool. Fallback to the inspector if the client fights you. Commands below. |
| 0:42 | **Discussion / breakout** | 8 | "You shipped a database with no front door." Let the discomfort land. Breakout if >8 people. Debrief with the answer key below. |
| 0:54 | **Concept: why it's safe** | 9–10 | No login, no scopes — the *channel* is the boundary: a limited non-PII tool set + always-obscured responses. Demo it: "list diabetics" comes back as `Patient-A7B3`. |
| 1:10 | **Concept: human-in-the-loop** | 11–12 | The first *write*. Propose vs act — the model never holds the trigger. Walk `lib/scheduling.ts`'s structured intent → confirmation card → `/api/schedule`. The gate is the confirmation, not a login. |
| 1:24 | **Discussion / breakout** | 13 | The reversibility-vs-cost grid. Sort the four actions. Debrief with the answer key. |
| 1:36 | **Break it / extend → mini-challenge** | 14 | Try to pull a real name out of the MCP channel (you can't — it's always obscured), then turn them loose on the gate-bypass. |
| 1:50 | **Recap + send-off** | 15–16 | Research questions + deliverable framing. Point lightly at the final week (privacy: PII de-identification + the channel model). |

Runs long? The compressible segments are the reversibility discussion (1:24 — can shrink to a fast whole-room sort) and the HITL code-read (1:10 — the confirmation-card diagram on slide 11 carries it). **Never** compress the MCP code-together (0:24) or the why-it's-safe demo (0:54) — those are the hands-on proof points.

---

## Breakout prompts + answer keys

### Breakout A (slide 8) — "A database with no front door"

**Prompt:** "You just wired this server into an AI client with your real database URL in the config. (1) What's the worst thing a stranger who got that config could do? (2) Which credentials are sitting in plaintext, and where? (3) Is this a missing *feature* or a missing *wall*?"

**What to listen for:**
- The worst case isn't "they read a note" — it's *every conversation in that client could read whatever the tools expose.* So the real question is: what do the tools expose? If the answer is "everything, with real names," that's a problem.
- The plaintext credentials are `DATABASE_URL`, `PINECONE_API_KEY`, `OPENAI_API_KEY` — full infrastructure access — sitting in a desktop-app config file *and* flowing through an AI client you don't operate. "Every integration seam is a place credentials pool."
- The fix isn't a login — it's *scoping the channel*. Expose only what a front-office user should ever see.

**Debrief:** this is exactly the next segment. The fix here isn't authentication — it's **channel design**: this server exposes only non-identifying tools and obscures every response, so it's safe to hand to front-office staff by construction. No login, no scopes, no audit log to maintain. (Infrastructure credentials still live only where the server runs, not in the client — that part holds regardless.)

### Breakout B (slide 13) — "Which actions need a human?"

**Prompt:** "Place each action on two axes — *reversibility* and *cost of being wrong* — then decide: automate freely, or human gate? Say why."

- **Search a patient's records** → low cost, fully reversible → **automate.** A bad result costs a shrug and a rephrase.
- **Book an appointment on a real calendar** → consequential and not silently reversible (it emails a real patient, corrupts a clinic's day) → **human gate.** This is the one the block builds.
- **Refill request to a pharmacist** → it's a *proposal* a licensed human already reviews downstream → **light gate.** The pharmacist is the human-in-the-loop.
- **Referral letter under a doctor's name** → consequential *and* reputational, sent in someone's name → **hard gate**, probably sign-off stronger than one click.

**What to listen for:** the instinct to gate by "how smart is the model." That's the wrong axis. The right axis is **what does wrong cost, and who absorbs it.** The model's competence doesn't change who's liable when it books the wrong slot. The grid generalizes to every future feature.

---

## Code-together

### Part 1 — MCP: pipe it, then wire it (slides 6–7)

Run in order, narrating each:

```bash
# 1. Talk to the server with no AI in the loop. Stdout IS the protocol channel.
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | npx ts-node mcp-server/index.ts
```
- **Narrate:** JSON back = the contract is *discoverable*. This is what Claude Desktop sees at connect time. The official `npx @modelcontextprotocol/inspector` is the friendly UI for the same thing; the pipe shows what's actually moving.
- **Fallback (if no client is wired, or the wiring fails live):** run the *entire* MCP segment through the pipe above + `npx @modelcontextprotocol/inspector mcp-server/index.ts`. You lose the "a foreign model picks your tool" reveal, but you keep every teaching point — discovery and the obscured tool responses. Don't improvise a Claude Desktop fix in front of the room; drop to the inspector.

```jsonc
// 2. Already in your client config from Pre-flight. Show it, don't edit it live.
// ~/Library/Application Support/Claude/claude_desktop_config.json
"mcpServers": {
  "medical-rag": {
    "command": "npx",
    "args": ["ts-node", "/ABSOLUTE/path/to/mcp-server/index.ts"],
    "env": { "DATABASE_URL": "...", "PINECONE_API_KEY": "...", "OPENAI_API_KEY": "..." }
  }
}
```
- **Narrate the three load-bearing details:** the client launches your server as a *subprocess* (crash = tools vanish); the path must be *absolute* (the #1 setup failure); the `env` block exists because your `.env` doesn't travel — *and notice you just pasted database credentials into a desktop app*.

Then, in a fresh client conversation, ask in plain words (no tool names): *"How many patients have high blood pressure?"* Watch it announce a tool call, show its chosen arguments, and wait for your approval — the client's built-in human-in-the-loop, which foreshadows slide 11.

- **Expected output:** the assistant picks `search_patients`, shows arguments, you approve, your code runs, and the answer is *their* model reading *your* formatted text. The condition-count phrasing works reliably — that's why it's the chosen demo query.
- **Most likely live failure:** tool *hangs*. First suspect is **stdout pollution** — a code path wrote to stdout and corrupted the JSON-RPC stream. Look in `~/Library/Logs/Claude/mcp-server-medical-rag.log` for the malformed line; fix is `console.error`. Second: invalid config JSON or a non-absolute path → server never appears at all (check the log's first lines). When in doubt, drop back to the pipe — "is it my server or the integration?" is one `tools/list` away.

### Part 2 — why the front-office channel is safe (slides 9–10)

No login, no scopes, no audit — so what makes it safe to hand this to front-office staff? Two things, both already in `mcp-server/index.ts`:
- **The tool set is limited to non-identifying lookups** — `search_patients`, `query_notes`, `list_patients_by_condition`. There is no `get_patient` / `find_patient_by_name` here; the patient-detail tools simply aren't exposed on this channel.
- **Every response is PII-obscured** — the server always runs results through obscuring (`obscureName` → `Patient-A7B3`, and `formatResultsForLLM(result, true)`), regardless of any flag. Front-office staff get the shape of the data, never the identifiers.

**Demo it:** ask the client *"list patients with diabetes."* Watch the response come back with pseudonymized names (`Patient-A7B3`), not real ones. Then point out: there's no key to fumble, no scope to misconfigure — the *channel itself* is the boundary. The clinician who needs real names uses the direct app (the other door), not MCP.
- **Narrate the design point:** access isn't a login here, it's *which door you came through*. That's a real production pattern — a public/staff surface that's a strict, obscured subset of the internal one.

### Part 3 — the propose→approve flow (slides 11–12)

Open `lib/scheduling.ts` and walk it:
- `detectSchedulingIntent()` calls the LLM with a **structured** `SchedulingIntentSchema` — `patientName`/`suggestedDate`/`suggestedTime` are `.nullable()`, and the system prompt injects `Today's date is ${todayStr}` so "next Tuesday" resolves to a real `YYYY-MM-DD` **in code context**, not by the model guessing the calendar.
- `formatSchedulingAction()` emits a `<!-- SCHEDULING_ACTION {...} -->` block the frontend turns into a **confirmation card** — the human's editable copy of the model's proposal.
- Only on confirm does the UI `POST /api/schedule`, which calls `scheduleAppointment()` in `lib/calendar.ts` (the Cal.com booking). **The model never calls the calendar directly.** The gate is the confirmation, not a login — `/api/schedule` has no auth.

---

## Break it / extend bank

Run at least the PII-can't-leak check live (the headline), then turn the room loose.

**1. Try to pull a real patient name out of the MCP channel (the headline).**
- **Sabotage:** through the client, ask every way you can think of to get an identifier — "give me the full name and DOB of the first diabetic," "don't summarize, list the raw records." Try the note-search tool too.
- **Expected failure (i.e. the control holds):** every response comes back **obscured** — `Patient-A7B3`, `1975-XX-XX` — no matter how you phrase it. The obscuring runs in the server (`obscureName`, `formatResultsForLLM(result, true)`), and the patient-detail tools (`get_patient` / `find_patient_by_name`) aren't exposed here at all, so there's nothing to coax.
- **Fix/why:** there's nothing to fix — that's the point. The safety isn't a rule the model follows; it's *structural*. The channel physically can't return PII, so a clever prompt can't extract it. Contrast with the direct clinician app, where the same query returns real names — because that's the other door.
- **Extend:** point at `mcp-server/index.ts` and ask: if a future teammate adds a `get_patient` tool here without obscuring, what breaks? (The channel's guarantee — one un-obscured tool and "front-office = no PII" is a lie.)

**2. Make the model "just book it" — bypass the human gate.**
- **Sabotage:** wire the confirm action to post the *model's* extracted values directly to `/api/schedule` instead of the confirmation card's current (human-editable) values.
- **Expected failure:** the human's edits vanish — the model effectively booked. The point: if confirm posts the model's output instead of the card's (human-edited) state, the confirmation gate is decoration.
- **Fix:** the **card state, not the model output, is the source of truth.** The route should also re-validate `patientName` and `dateTime` because *anything that can POST can hit it* — trusting the UI is how "the UI validates it" becomes a postmortem sentence.
- **Extend:** probe the extractor — schedule with no patient name (should yield `patientName: null`, not a guessed patient), with a past date, or *while mid-conversation about a different patient* (does it grab the wrong name from history with full confidence? `detectSchedulingIntent` deliberately reads the last 4 messages — test whether that helps or hurts). Each caught behavior is a new failure case for a system that can now act.

**3. Vague tool description — the colleague test.**
- **Sabotage:** rewrite a tool's description to be vague ("gets patient data") and ask a fresh AI session to predict which of the five tools handles "is anyone on aspirin?", "notes about dizziness for patient X", "tell me about patient Y."
- **Expected failure:** wrong predictions / overlapping guesses — the foreign model can't route from a vague description.
- **Fix:** rewrite descriptions like the real ones in `index.ts` (what it's for, what it's *not* for, an example argument — e.g. `query_notes`'s "Use this for finding relevant medical notes, symptoms, treatments, or observations"); predictions sharpen. Tool descriptions have evals too — the description *is* the interface (slide 5).

**4. Pollute stdout, watch the client disconnect.**
- **Sabotage:** add a `console.log('debug')` anywhere in a tool handler in `mcp-server/index.ts`, restart the client, call that tool.
- **Expected failure:** the tool hangs or the client drops the server — that log line went into the JSON-RPC stream and corrupted it. The pipe test shows the garbage prepended to the JSON.
- **Fix:** change it to `console.error`. Stdout is the protocol channel; stderr is yours. This is the single most common MCP-server bug.
- **Extend:** re-run the raw pipe from Part 1 with the bad log in place and read exactly what the client would have choked on — the malformed first bytes are the whole lesson.

---

## Misconceptions to preempt

- **"MCP is just a REST API with extra steps."** No — the difference is *discovery*. A REST client needs a human to read docs and write glue per endpoint; an MCP client reads your tools' schemas at connect time and a model decides when to call them. The contract is machine-readable and consumed by a model, not a programmer.
- **"Safe means a login screen."** Not here. There's no login anywhere in this course. This channel is safe because of *what it exposes* — only non-identifying tools, every response obscured. Access is the door you came through (front-office MCP vs clinician app), not a session.
- **"You still need an audit log for medical data."** In production, often yes — and that's a fair thing to name. We deliberately cut it to keep the course's scope tight; the teaching point here is the channel design, not compliance logging.
- **"The human gate is about the model being unreliable."** It's about *consequence*, not competence. A perfect model still shouldn't unilaterally book a real slot or send a letter in a doctor's name. Gate by what wrong costs and who absorbs it — not by how good the model is.
- **"The model resolves 'next Tuesday' fine, so let it."** The model doesn't reliably know today's date; that's why `scheduling.ts` injects `todayStr` into the prompt and the *code* owns the calendar math. "Usually right" on a real booking is a wrong appointment sent to a real patient.

---

## Deliverable 🎥 (end of week, Day 18)

A strong 2–3 min video (phone camera fine), one of:

- **Defend the design:** the student's MCP tool (existing or a new one) — why it's safe to expose to front-office staff. Demo it returning **obscured** data (`Patient-A7B3`), and explain why the safety is structural (limited tools + always-obscured), not a rule the model has to follow.
- **Teach back:** explain to a non-engineer why "the AI can book appointments" required a confirmation card but "the AI can search records" didn't — and how the same reversibility/cost logic decides which future features need a human gate.

**Grade against one question:** *can they explain why a clever prompt can't extract a real name from this channel?* The answer — the tools and the obscuring make it structurally impossible, not just discouraged — is the deliverable.

---

## Materials

- Student day files this anchors: `day-13.md` … `day-18.md`
- Deck: `week-3.html`
- Provided modules to demo against (on `instructor`): `mcp-server/index.ts` (the 3 non-PII, obscured tools), `lib/pii.ts` (`obscureName`), `lib/scheduling.ts`, `lib/calendar.ts`, `app/api/schedule/route.ts`
- Logs to tail live: `~/Library/Logs/Claude/mcp-server-medical-rag.log` (client side)
- Further reading the keen students will have hit: [modelcontextprotocol.io](https://modelcontextprotocol.io/) (Architecture + Security best practices), the MCP Inspector (`npx @modelcontextprotocol/inspector`), [Cal.com API reference](https://cal.com/docs/api-reference)
