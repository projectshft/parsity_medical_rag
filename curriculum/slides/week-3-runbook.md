# Week 3 — MCP + human-in-the-loop · Facilitator Runbook

**Block:** MCP + human-in-the-loop · **Days covered:** 13–18 · **Session length:** ~110 min · **Deck:** `week-3.html`

**Goal of this session:** the room leaves able to explain — without notes — how their RAG stops being an app and becomes a *tool other AIs can call* (MCP), gated by keys with the right permissions (scopes), on the record for every call (audit), and held back from acting on its own when the action matters (human-in-the-loop). They will have talked to the server over a raw pipe, wired it into a real AI client (or the inspector), called a tool live, and watched the auth layer refuse an under-scoped key — cleanly, and in the log.

> This runbook is backstage. Say anything here — HIPAA framing, the planted 401, the audit-log specifics. The slides are what students see, so slide text stays in the student register (household-name conditions like high blood pressure/diabetes, no HIPAA jargon on the slide face). You do **not** need to have built the system to run this — Pre-flight and Code-together assume you're coming in cold.

---

## Pre-flight (before the room arrives)

- [ ] Repo cloned on the **`instructor`** branch (you want the solved `auth.ts` / `audit.ts` / `scheduling.ts` / `calendar.ts` to demo against), `npm install` done. Students follow on `student`.
- [ ] `.env` filled with the base stack: `DATABASE_URL` (Neon), `PINECONE_API_KEY`, `OPENAI_API_KEY`. `CAL_API_KEY` + `CAL_EVENT_TYPE_ID` only if you intend to book a *real* appointment live (optional — see the 401 note below; the propose→approve flow demos fine without them).
- [ ] **The MCP server runs.** Smoke-test it once yourself before class:
  ```bash
  echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | npx ts-node mcp-server/index.ts
  ```
  You should get JSON back listing the five tools with their schemas. If you see nothing (or garbage before the JSON), you almost certainly logged to stdout somewhere — check for a stray `console.log`. Note `mcp-server/index.ts` correctly uses `console.error('Medical RAG MCP server running')` on startup; that's fine, stderr isn't the channel.
- [ ] **Claude Desktop or Cursor installed**, with the `medical-rag` server already wired into its config and confirmed working (tools icon visible in a fresh conversation). Do this the night before — the first wiring always takes longer than you think, and absolute-path bugs are not a live-demo moment.
  - macOS Claude Desktop config: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - Cursor: `.cursor/mcp.json` at the repo root
  - **Fallback if no client cooperates:** run the whole MCP segment through the pipe + `npx @modelcontextprotocol/inspector` (see Code-together Part 1). You lose the "a foreign model picks your tool" reveal but keep every teaching point.
- [ ] **Scope-demo keys set in `.env`** — there is **no key-minting step**; the keys are just strings you choose, and the server reads them from the environment (`mcp-server/auth.ts` → `checkEnvironmentKeys`):
  ```bash
  MCP_API_KEY=mcp_demo_read       # auth.ts maps this to read + read_pii
  MCP_ADMIN_KEY=mcp_demo_admin    # → read + read_pii + admin
  MCP_REQUIRE_AUTH=true           # turn the gate ON (unset/false = open server)
  ```
  The scope layout you're demoing (from `TOOL_SCOPES`): `search_patients`/`query_notes` need `read`; `get_patient`/`find_patient_by_name` need `read_pii`; `list_patients_by_condition` needs `admin`. So `MCP_API_KEY` can search *and* read patient detail but is **refused on the admin tool** — that's your clean boundary. (There's no env var for a `read`-only key; to demo the read→read_pii line specifically you'd `registerApiKey` one in-process — optional, see the break-it bank.)
- [ ] A populated note index for the `query_notes` tool to have something to return — run `npm run ingest -- --limit 50` once if you haven't already this course. The `search_patients` / condition-count tools read Postgres directly and don't need it.
- [ ] Terminals open: one for the MCP pipe/inspector, one tailing the client's MCP log, one for the audit log:
  ```bash
  tail -f ~/Library/Logs/Claude/mcp-server-medical-rag.log   # client-side
  ls logs/mcp-audit-*.jsonl                                   # server-side audit (JSONL, one file per day)
  ```
- [ ] `week-3.html` open full-screen in a browser. Arrow keys / click to navigate; `N` toggles presenter notes.

**Known runnable-state gap — flag this so you're not surprised live:** on the finished system the **chat-UI "schedule" button returns 401.** This is *expected*, not a bug. `app/api/schedule/route.ts` calls `requireAuth(request, ['STAFF'])` — RBAC (built in the final block) gates scheduling to STAFF, and there is **no login UI yet** and no seeded users, so a normal browser session is unauthenticated. The propose → approve → execute *flow* is fully built (`lib/scheduling.ts` detects intent and emits the confirmation card; `lib/calendar.ts` does the booking); it's the RBAC wall in front of `/api/schedule` that returns 401. If you want to demo booking end-to-end live, either (a) walk the flow conceptually and show the confirmation card appearing (the model's propose step works regardless), or (b) hit the route directly with a STAFF-authenticated request / temporarily relax the role check on a throwaway branch. Do **not** debug the 401 in front of the room as if it were broken — name it as the seam where this block (HITL) meets next block (RBAC for people, not just keys).

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
| 0:54 | **Concept: securing it** | 9–10 | The three layers (authN / authZ / audit) + least privilege. Then the live two-keys demo — same admin call, two callers, two worlds. |
| 1:10 | **Concept: human-in-the-loop** | 11–12 | The first *write*. Propose vs act — the model never holds the trigger. Walk `lib/scheduling.ts`'s structured intent → confirmation card → `/api/schedule`. **Name the 401 / RBAC seam here** (see Pre-flight). |
| 1:24 | **Discussion / breakout** | 13 | The reversibility-vs-cost grid. Sort the four actions. Debrief with the answer key. |
| 1:36 | **Break it / extend → mini-challenge** | 14 | Run the under-scoped-key refusal live (the headline), grep the audit log for the denial, then turn them loose on the gate-bypass. |
| 1:50 | **Recap + send-off** | 15–16 | Research questions + deliverable framing. Point lightly at the final block (production gates: auth for *people*, PII, adversarial inputs, evals). |

Runs long? The compressible segments are the reversibility discussion (1:24 — can shrink to a fast whole-room sort) and the HITL code-read (1:10 — the confirmation-card diagram on slide 11 carries it). **Never** compress the MCP code-together (0:24) or the two-keys demo (0:54) — those are the hands-on proof points.

---

## Breakout prompts + answer keys

### Breakout A (slide 8) — "A database with no front door"

**Prompt:** "You just wired this server into an AI client with your real database URL in the config. (1) What's the worst thing a stranger who got that config could do? (2) Which credentials are sitting in plaintext, and where? (3) Is this a missing *feature* or a missing *wall*?"

**What to listen for:**
- The worst case isn't "they read a note" — it's *every conversation in that client can now read the entire patient database, with no record of who asked.* No identity, no permissions, no audit. For real PHI that's a reportable event, not a rough edge.
- The plaintext credentials are `DATABASE_URL`, `PINECONE_API_KEY`, `OPENAI_API_KEY` — full infrastructure access — sitting in a desktop-app config file *and* flowing through an AI client you don't operate. "Every integration seam is a place credentials pool."
- "Missing wall" is the right framing. It's not a feature you forgot; it's the load-bearing wall, absent.

**Debrief:** this is exactly the securing segment. The fix is three layers — authentication (keys), authorization (scopes), audit (a log of every call). The quiet win of the day: clients stop holding raw `DATABASE_URL` and start holding a scoped, individually-revocable application key; infrastructure credentials live only where the server runs.

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
- **Fallback (if no client is wired, or the wiring fails live):** run the *entire* MCP segment through the pipe above + `npx @modelcontextprotocol/inspector mcp-server/index.ts`. You lose the "a foreign model picks your tool" reveal, but you keep every teaching point — discovery, scopes, and the audit trail. Don't improvise a Claude Desktop fix in front of the room; drop to the inspector.

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

- **Expected output:** the assistant picks `search_patients` (or `list_patients_by_condition` if auth is off), shows arguments, you approve, your code runs, and the answer is *their* model reading *your* formatted text. The condition-count phrasing works reliably — that's why it's the chosen demo query.
- **Most likely live failure:** tool *hangs*. First suspect is **stdout pollution** — a code path wrote to stdout and corrupted the JSON-RPC stream. Look in `~/Library/Logs/Claude/mcp-server-medical-rag.log` for the malformed line; fix is `console.error`. Second: invalid config JSON or a non-absolute path → server never appears at all (check the log's first lines). When in doubt, drop back to the pipe — "is it my server or the integration?" is one `tools/list` away.

### Part 2 — the scope boundary (slides 9–10)

This is the security demo; it earns its slot. The two env keys give you two callers (make sure `MCP_REQUIRE_AUTH=true`):

```bash
# MCP_API_KEY   → read + read_pii: can search AND read full patient detail,
#                 but is DENIED on the admin tool
# MCP_ADMIN_KEY → read + read_pii + admin: the same admin call succeeds
```
Call the **admin-scoped** tool `list_patients_by_condition` with each key (swap the key in the client's `env` block, or hit the server via the inspector's auth field). Same tool, two callers, two outcomes.
- **Narrate:** same system, two callers, two worlds. `MCP_API_KEY` gets a clean **denial** — "Access denied: Tool 'list_patients_by_condition' requires one of [admin] scope(s). Your key has: [read, read_pii]" — readable text the model relays to its human, not a crash (`withAuth` in `auth.ts` throws a descriptive `Error`). `MCP_ADMIN_KEY` gets the data. That's scopes working, and it's a HIPAA technical control (minimum-necessary access + per-call audit) even though the slides don't say "HIPAA."
- **Most likely live failure:** you edited the client config but didn't fully restart it — clients read config at *startup*. Edit → full restart → test. (Second suspect: `MCP_REQUIRE_AUTH` not `true`, so every call sails through and nothing is ever denied.)

### Part 3 — the propose→approve flow (slides 11–12)

You're reading code here, not necessarily running the booking (see the 401 note). Open `lib/scheduling.ts` and walk it:
- `detectSchedulingIntent()` calls the LLM with a **structured** `SchedulingIntentSchema` — `patientName`/`suggestedDate`/`suggestedTime` are `.nullable()`, and the system prompt injects `Today's date is ${todayStr}` so "next Tuesday" resolves to a real `YYYY-MM-DD` **in code context**, not by the model guessing the calendar.
- `formatSchedulingAction()` emits a `<!-- SCHEDULING_ACTION {...} -->` block the frontend turns into a **confirmation card** — the human's editable copy of the model's proposal.
- Only on confirm does the UI `POST /api/schedule`, which calls `scheduleAppointment()` in `lib/calendar.ts` (the Cal.com booking). **The model never calls the calendar directly.**
- **Name the 401 seam out loud** (Pre-flight): the finished `/api/schedule` sits behind `requireAuth(request, ['STAFF'])`, so a browser with no login returns 401. That's the RBAC wall of the *next* block landing early — the HITL flow itself is complete.

---

## Break it / extend bank

Run at least the under-scoped-key refusal live (the headline), then turn the room loose.

**1. Call the server with no API key — or an under-scoped one (the headline).**
- **Sabotage:** call `list_patients_by_condition` (the admin tool) with no key at all, then with `MCP_API_KEY` (read + read_pii, but *not* admin).
- **Expected failure:** no key → refused, "API key is required." `MCP_API_KEY` → refused, "requires one of [admin] scope(s). Your key has: [read, read_pii]." Crucially, *both refusals are clean readable text the calling model receives* — not a thrown crash the client swallows — **and both land in the audit log** (`logToolInvocation` / `logSecurityEvent` in `audit.ts`).
- **Fix:** present a key with the required scope (`MCP_ADMIN_KEY`); the same call now succeeds.
- **Extend:** `grep`/`jq` the audit log and answer *"who tried to access patient X today, and were they denied?"* with a one-liner:
  ```bash
  jq -c 'select(.success==false)' logs/mcp-audit-$(date +%F).jsonl
  ```
  A denial that isn't logged is a security bug — failed access is the most interesting access. (Want the read→read_pii denial too? `registerApiKey('mcp_test_read','test',['read'])` in a small script in the *same process* and call `get_patient` — registered keys live only in that process, so this is a script, not an env var.)

**2. Make the model "just book it" — bypass the human gate.**
- **Sabotage:** wire the confirm action to post the *model's* extracted values directly to `/api/schedule` instead of the confirmation card's current (human-editable) values.
- **Expected failure:** the human's edits vanish — the model effectively booked. (On the finished system you'll *also* hit the 401 RBAC wall first; name that, then make the point conceptually: even past RBAC, if confirm posts model output instead of card state, the gate is decoration.)
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
- **"Auth means a login screen."** Not here. The caller is a *process* (Claude Desktop, a script, another service), so it's machine-to-machine: per-client API keys, individually revocable, with scopes — not user sessions. (User-facing auth/RBAC *is* coming — that's the final block, and it's why the schedule route already 401s.)
- **"Logging that a tool ran is an audit trail."** Logging *that* it ran is trivial. A trail is designed *backwards from questions someone asks under pressure*: who touched patient X, what did the revoked key do while live, who's hitting denials. If the entries can't answer those, it's a diary, not a trail — which is why the denial path logs too.
- **"The human gate is about the model being unreliable."** It's about *consequence*, not competence. A perfect model still shouldn't unilaterally book a real slot or send a letter in a doctor's name. Gate by what wrong costs and who absorbs it — not by how good the model is.
- **"The model resolves 'next Tuesday' fine, so let it."** The model doesn't reliably know today's date; that's why `scheduling.ts` injects `todayStr` into the prompt and the *code* owns the calendar math. "Usually right" on a real booking is a wrong appointment sent to a real patient.

---

## Deliverable 🎥 (end of week, Day 18)

A strong 2–3 min video (phone camera fine), one of:

- **Defend the design:** the student's MCP tool (an existing one they secured, or a new one) — why these scopes (and the alternative scope they rejected), what its audit entry contains and what it deliberately omits. The demo shows it **refusing, recording, and recovering** — an under-scoped key denied *and* that denial visible in the audit log — not just working.
- **Teach back:** explain to a non-engineer why "the AI can book appointments" required a confirmation card but "the AI can search records" didn't — and how the same reversibility/cost logic decides which future features need a human gate.

**Grade against one question:** *does the demo show a refusal that is both denied **and** logged?* A happy-path demo proves the tool runs; it does not prove the tool is secured. The denial (under-scoped key refused cleanly, and the denial visible in `logs/mcp-audit-*.jsonl`) is the deliverable.

---

## Materials

- Student day files this anchors: `day-13.md` … `day-18.md`
- Deck: `week-3.html`
- Provided modules to demo against (on `instructor`): `mcp-server/index.ts`, `mcp-server/auth.ts` (+ `mcp-server/auth.test.ts` if present), `mcp-server/audit.ts`, `lib/scheduling.ts`, `lib/calendar.ts`, `app/api/schedule/route.ts`
- Read the auth module's spec from its test names if a suite exists: `npx vitest run mcp-server/auth.test.ts`
- Logs to tail live: `~/Library/Logs/Claude/mcp-server-medical-rag.log` (client side) · `logs/mcp-audit-<YYYY-MM-DD>.jsonl` (server-side audit trail)
- Further reading the keen students will have hit: [modelcontextprotocol.io](https://modelcontextprotocol.io/) (Architecture + Security best practices), the MCP Inspector (`npx @modelcontextprotocol/inspector`), [Cal.com API reference](https://cal.com/docs/api-reference)
