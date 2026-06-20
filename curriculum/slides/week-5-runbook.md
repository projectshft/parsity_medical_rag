# Week 5 — MCP, observability, human-in-the-loop · Facilitator Runbook

**Block:** MCP, observability, human-in-the-loop · **Days covered:** 25–30 · **Session length:** ~110 min · **Deck:** `week-5.html`

**Goal of this session:** the room leaves able to explain — without notes — how their RAG stops being an app and becomes *infrastructure*: a tool other AIs can call (MCP), gated by keys with the right permissions (scopes), watched by a trace they can replay (observability), and held back from acting on its own when the action matters (human-in-the-loop). They will have wired the server into a real AI client, called a tool live, read a trace, and watched the auth layer refuse an under-scoped key.

> This runbook is backstage. Say anything here — HIPAA framing, the planted 401, the audit-log specifics. The slides are what students see, so slide text stays in the student register (household-name meds, no week numbers on the data). You do **not** need to have built the system to run this — Pre-flight and Code-together assume you're coming in cold.

---

## Pre-flight (before the room arrives)

- [ ] Repo cloned on the **`instructor`** branch (you want the solved `auth.ts` / `audit.ts` / `langsmith.ts` to demo against), `npm install` done. Students follow on `student`.
- [ ] `.env` filled with the full stack used this week: `DATABASE_URL` (Neon), `PINECONE_API_KEY`, `OPENAI_API_KEY`, plus `LANGSMITH_API_KEY` + `LANGSMITH_PROJECT` for the tracing segment. `CAL_API_KEY` + `CAL_EVENT_TYPE_ID` only if you intend to book a real appointment live (optional — see below).
- [ ] **The MCP server runs.** Smoke-test it once yourself before class:
  ```bash
  echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | npx ts-node mcp-server/index.ts
  ```
  You should get JSON back listing the tools with schemas. If you see nothing, you almost certainly logged to stdout somewhere — check for a stray `console.log`.
- [ ] **Claude Desktop or Cursor installed**, with the `medical-rag` server already wired into its config and confirmed working (tools icon visible in a fresh conversation). Do this the night before — the first wiring always takes longer than you think, and absolute-path bugs are not a live-demo moment.
  - macOS Claude Desktop config: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - Cursor: `.cursor/mcp.json` at the repo root
- [ ] **A LangSmith project with at least one real trace already in it.** Run a few chat queries against the app before class so the tracing segment has something to open — don't generate the first trace live and hope it lands.
- [ ] **Scope-demo keys set in `.env`** — there is no key-minting step; the keys are just strings you choose, and the server reads them from the environment (`mcp-server/auth.ts` → `checkEnvironmentKeys`):
  ```bash
  MCP_API_KEY=mcp_demo_read       # auth.ts maps this to read + read_pii
  MCP_ADMIN_KEY=mcp_demo_admin    # → read + read_pii + admin
  MCP_REQUIRE_AUTH=true           # turn the gate ON (unset/false = open server)
  ```
  The scope layout you're demoing (from `TOOL_SCOPES`): `search_patients`/`query_notes` need `read`; `get_patient`/`find_patient_by_name` need `read_pii`; `list_patients_by_condition` needs `admin`. So `MCP_API_KEY` can search *and* read patient detail but is **refused on the admin tool** — that's your clean boundary. (There's no env var for a `read`-only key; to demo the read→read_pii line specifically you'd register one in-process — optional, see the break-it bank.)
- [ ] Terminals open: one for the MCP pipe/inspector, one tailing the client's MCP log:
  ```bash
  tail -f ~/Library/Logs/Claude/mcp-server-medical-rag.log
  ```
- [ ] `week-5.html` open full-screen in a browser. Arrow keys / click to navigate.

**Known runnable-state gap — flag this so you're not surprised live:** on the finished system the **chat-UI "schedule" button returns 401.** This is *expected*. `app/api/schedule/route.ts` calls `requireAuth(request, ['STAFF'])` — RBAC (built in the final block) gates scheduling to STAFF, and there is **no login UI yet**, so a normal browser session is unauthenticated. The propose → approve → execute *flow* is fully built; it's the RBAC wall in front of `/api/schedule` that returns 401, not a bug in the scheduling code. If you want to demo the booking end-to-end live, either (a) walk the flow conceptually and show the confirmation card appearing (the model's propose step works regardless), or (b) hit the route directly with a STAFF-authenticated request / temporarily relax the role check on a throwaway branch. Do **not** debug the 401 in front of the room as if it were broken — name it as the seam where this block (HITL) meets next block (RBAC for people, not just keys).

If a laptop can't install an MCP client, pair them — one wired client per two people survives the wiring and tracing segments.

---

## Timed flow (~110 min)

| Time | Arc segment | Slides | What to do |
|---|---|---|---|
| 0:00 | **Problem statement** | 1–3 | Cold open: "Everything you built lives in *your* chat box. Your users live in Claude Desktop and Cursor. Do you write an integration for each?" Sit in the gap before naming MCP. |
| 0:08 | **How it's solved** | 4 | Land the one line: *write one MCP server, any client discovers your tools.* USB-C for AI. REST serves programmers; MCP serves models. |
| 0:15 | **High-level concept** | 5 | The inversion that matters: *your tool description is a prompt for a model you don't control.* The description **is** the interface. |
| 0:22 | **Code together (part 1)** | 6–7 | Pipe `tools/list` at the server (no AI). Then wire into Claude Desktop and ask a plain question — watch a foreign model pick a tool. Commands below. |
| 0:40 | **Discussion / breakout** | 8 | "You shipped a database with no front door." Let the discomfort land. Breakout if >8 people. Debrief with the answer key below. |
| 0:52 | **Concept: securing it** | 9–10 | The three layers (authN / authZ / audit) + least privilege. Then the live two-keys demo — same question, two callers, two worlds. |
| 1:06 | **Concept: observability** | 11 | "You can't fix what you can't see." A trace is a debugger for the past. LLM failures are statistical and silent. |
| 1:12 | **Code together (part 2)** | 12 | Open a real LangSmith trace; read the **rendered context** field aloud. Show `traced()`'s no-key fallback (observability never breaks the pipeline). |
| 1:24 | **Concept: human-in-the-loop** | 13 | The first *write*. Propose vs act. The model never holds the trigger. (Here is where you name the 401 / RBAC seam — see Pre-flight.) |
| 1:30 | **Discussion / breakout** | 14 | The reversibility-vs-cost grid. Sort the four actions. Debrief with the answer key. |
| 1:42 | **Break it / extend → build day** | 15 | Run one break-it entry live (an under-scoped key being refused is the best one), then frame Friday's build-day tool + adversarial demo. |
| 1:52 | **Recap + send-off** | 16–17 | Research questions + Friday deliverable framing. Point lightly at the final block (production gates: auth for people, PII, adversarial inputs, evals). |

Runs long? The compressible segments are the observability code-together (1:12 — one trace read-through is enough) and the reversibility discussion (1:30 — it can shrink to a fast whole-room sort). **Never** compress the MCP code-together (0:22) or the two-keys demo (0:52) — those are the hands-on proof points.

---

## Breakout prompt + answer key

### Breakout A (slide 8) — "A database with no front door"

**Prompt:** "You just wired this server into an AI client with your real database URL in the config. (1) What's the worst thing a stranger who got that config could do? (2) Which credentials are sitting in plaintext, and where? (3) Is this a missing *feature* or a missing *wall*?"

**What to listen for:**
- The worst-case isn't "they read a note" — it's *every conversation in that client can now read the entire patient database, with no record of who asked.* No identity, no permissions, no audit. For real PHI that's a reportable event, not a rough edge.
- The plaintext credentials are `DATABASE_URL`, `PINECONE_API_KEY`, `OPENAI_API_KEY` — full infrastructure access — sitting in a desktop-app config file *and* flowing through an AI client you don't operate. "Every integration seam is a place credentials pool."
- "Missing wall" is the right framing. It's not a feature you forgot; it's the load-bearing wall, absent.

**Debrief:** this is exactly Wednesday. The fix is three layers — authentication (keys), authorization (scopes), audit (a log of every call). The quiet win of the day: clients stop holding raw `DATABASE_URL` and start holding a scoped, individually-revocable application key; infrastructure credentials live only where the server runs.

### Breakout B (slide 14) — "Which actions need a human?"

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
# 1. Talk to the server with no AI in the loop. Stdout is the protocol channel.
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | npx ts-node mcp-server/index.ts
```
- **Narrate:** JSON back = the contract is *discoverable*. This is what Claude Desktop sees at connect time. The official `npx @modelcontextprotocol/inspector` is the friendly UI for the same thing; the pipe shows what's actually moving.

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

Then, in a fresh client conversation, ask in plain words (no tool names): *"How many patients have high blood pressure?"* Watch it announce a tool call, show its chosen arguments, and wait for your approval — the client's built-in human-in-the-loop, which foreshadows slide 13.

- **Expected output:** the assistant picks `search_patients` (or `query_notes`), shows arguments, you approve, your code runs, and the answer is *their* model reading *your* formatted text.
- **Most likely live failure:** tool *hangs*. First suspect is **stdout pollution** — a code path under the client's call pattern wrote to stdout and corrupted the JSON-RPC stream. Look in `~/Library/Logs/Claude/mcp-server-medical-rag.log` for the malformed line; fix is `console.error`. Second: invalid config JSON or a non-absolute path → server never appears at all (check the log's first lines). When in doubt, drop back to the pipe — "is it my server or the integration?" is one `tools/call` away.

### Part 2 — the scope boundary (slides 9–10)

This is the security demo; it earns its slot. The two env keys give you two callers:

```bash
# MCP_API_KEY   → read + read_pii: can search AND read full patient detail,
#                 but is DENIED on the admin tool
# MCP_ADMIN_KEY → read + read_pii + admin: the same admin call succeeds
```
Call the **admin-scoped** tool `list_patients_by_condition` with each key (swap the key in the client's `env` block, or hit the server via the inspector). Same tool, two callers, two outcomes.
- **Narrate:** same system, two callers, two worlds. `MCP_API_KEY` gets a clean **denial** — "this key lacks the `admin` scope" — readable text the model relays to its human, not a crash. `MCP_ADMIN_KEY` gets the data. That's scopes working, and it's a HIPAA technical control (minimum-necessary access + per-call audit) even though the slides don't say "HIPAA."
- **Most likely live failure:** you edited the client config but didn't fully restart it — both clients read config at *startup*. Edit → full restart → test. (Second suspect: `MCP_REQUIRE_AUTH` not `true`, so every call sails through and nothing is ever denied.)

### Part 3 — read a trace (slide 12)

```bash
# verify the no-key fallback: unset the var, app still works untraced
# then re-set it and open the project in LangSmith
```
Open one real hybrid-query trace and read it end to end. Point at, in order: the analysis (intent + entities, the first stack frame now permanent), the retrieved patient/note counts, **the exact rendered context** (read it aloud — this is the field that pays for the whole setup), and which step dominates the duration.
- **Narrate the two error rules of `traced()`:** it must **re-throw** the function's error (record the crime, don't swallow it) and must **never throw its own** (observability never takes down the pipeline). One principle from both sides: a trace is a *witness*, not a participant.
- **Most likely live failure:** no traces appear → `LANGSMITH_API_KEY`/`LANGSMITH_PROJECT` not set, or the project name in `.env` doesn't match the project you're looking at in the UI. This is why Pre-flight says seed a trace before class.

---

## Break it / extend bank

Run at least one live (the under-scoped key is the headline), then turn the room loose.

**1. Call the server with no API key — or an under-scoped one (the headline).**
- **Sabotage:** call `list_patients_by_condition` (the admin tool) with no key at all, then with `MCP_API_KEY` (read + read_pii, but *not* admin).
- **Expected failure:** no key → refused, "API key is required." `MCP_API_KEY` → refused, "this key lacks the `admin` scope." Crucially, *both refusals are clean readable text the calling model receives* — not a thrown crash — **and both land in the audit log.**
- **Fix:** present a key with the required scope (`MCP_ADMIN_KEY`); the same call now succeeds.
- **Extend:** `grep`/`jq` the audit log and answer *"who tried to access patient X today, and were they denied?"* with a one-liner. A denial that isn't logged is a security bug — failed access is the most interesting access. (Want the read→read_pii denial too? Register a `['read']`-only key in the *same process* and call `get_patient` — registered keys live only in that process, so this is a small script, not an env var.)

**2. Make the model "just book it" — bypass the human gate.**
- **Sabotage:** wire the confirm action to post the *model's* extracted values directly to `/api/schedule` instead of the confirmation card's current (human-editable) values.
- **Expected failure:** the human's edits vanish — the model effectively booked. (On the finished system you'll *also* hit the 401 RBAC wall first; name that, then make the point conceptually: even past RBAC, if confirm posts model output instead of card state, the gate is decoration.)
- **Fix:** the **card state, not the model output, is the source of truth.** The route also re-validates `patientName` and `dateTime` because *anything that can POST can hit it* — trusting the UI is how "the UI validates it" becomes a postmortem sentence.
- **Extend:** probe the extractor — schedule with no patient name (should yield `patientName: null`, not a guessed patient), with a past date, or *while mid-conversation about a different patient* (does it grab the wrong name from history with full confidence?). Each caught behavior is a new failure-battery case for a system that can now act.

**3. Break tracing and watch the blindness.**
- **Sabotage:** corrupt or unset `LANGSMITH_API_KEY` (or point `traced()` at a dead endpoint).
- **Expected failure (the *good* kind):** the app keeps working — answers still stream — but the trace project goes silent. You've gone blind without going down. That's the failure-isolation rule working as designed: observability degrades to nothing rather than taking the request with it.
- **Fix:** restore the key; traces resume. Then deliberately make `traced()` *throw* its own error on a bad key and re-run — now observability takes the pipeline down with it. Compare the two. That contrast *is* the lesson.
- **Extend:** wrap one more pipeline step (`searchClinicalNotes` as `runType: 'retriever'`, or `analyzeQuery` as `'llm'`) and watch the trace tree grow another box. Count the LLM calls in one chat turn from the trace — most students are surprised it's 2 (analyzer + answerer).

**4. (If time) Tool-description eval — the colleague test.**
- **Sabotage:** rewrite a tool's description to be vague ("gets patient data") and ask a fresh AI session to predict which of the three tools handles "is anyone on insulin?", "notes about dizziness for patient X", "tell me about patient Y."
- **Expected failure:** wrong predictions / overlapping guesses — the foreign model can't route from a vague description.
- **Fix:** rewrite descriptions like analyzer few-shots (what it's for, what it's *not* for, an example argument); predictions sharpen. Tool descriptions have evals too.

---

## Misconceptions to preempt

- **"MCP is just a REST API with extra steps."** No — the difference is *discovery*. A REST client needs a human to read docs and write glue per endpoint; an MCP client reads your tools' schemas at connect time and a model decides when to call them. The contract is machine-readable and consumed by a model, not a programmer.
- **"Auth means a login screen."** Not here. The caller is a *process* (Claude Desktop, a script, another service), so it's machine-to-machine: per-client API keys, individually revocable, with scopes — not user sessions. (User-facing auth/RBAC *is* coming — that's the final block, and it's why the schedule route already 401s.)
- **"Logging that a tool ran is an audit trail."** Logging *that* it ran is trivial. A trail is designed *backwards from questions someone asks under pressure*: who touched patient X, what did the revoked key do while live, who's hitting denials, did we serve PII and to whom. If the entries can't answer those, it's a diary, not a trail.
- **"The human gate is about the model being unreliable."** It's about *consequence*, not competence. A perfect model still shouldn't unilaterally book a real slot or send a letter in a doctor's name. Gate by what wrong costs and who absorbs it — not by how good the model is.
- **"Tracing is just logging."** Logging is lines; a trace is a *tree* with each step's inputs, outputs, duration, and errors — and it stores the exact context the model received. That last field is what turns "the AI hallucinated" into "retrieval handed it the wrong context," in thirty seconds.

---

## Deliverable 🎥 (Friday, Day 30)

A strong 2–3 min video (phone camera fine), one of:

- **Defend the design:** the student's *fourth* MCP tool — why this tool, why these scopes (and the alternative scope they rejected), what its audit entry contains and what it deliberately omits, and what one call costs. The demo shows it **refusing, recording, and recovering** — not just working.
- **Teach back:** explain to a non-engineer why "the AI can book appointments" required a confirmation card but "the AI can search records" didn't — and how the same reversibility/cost logic decides which future features need a human gate.

**Grade against one question:** *does the demo show a refusal that is both denied **and** logged?* A happy-path demo proves the tool runs; it does not prove the tool is secured. The denial (under-scoped key refused cleanly, and the denial visible in the audit log) is the deliverable. Second-order tell of mastery: they can state what one call to their tool *costs* (LLM/embedding calls counted from the trace) — a price tag is part of a tool's spec, same as its scopes.

---

## Materials

- Student day files this anchors: `day-25.md` … `day-30.md`
- Deck: `week-5.html`
- Challenge doc (Day 27's actual spec): `docs/CHALLENGE-MCP-AUTH.md`
- Provided modules to demo against (on `instructor`): `mcp-server/index.ts`, `mcp-server/auth.ts` (+ `mcp-server/auth.test.ts`), `mcp-server/audit.ts`, `lib/langsmith.ts`, `lib/scheduling.ts`, `lib/calendar.ts`, `app/api/schedule/route.ts`
- Run the auth test suite to read the module's spec from its test names: `npx vitest run mcp-server/auth.test.ts`
- Logs to tail live: `~/Library/Logs/Claude/mcp-server-medical-rag.log`
- Further reading the keen students will have hit: [modelcontextprotocol.io](https://modelcontextprotocol.io/) (Architecture + Security best practices), [LangSmith observability docs](https://docs.langchain.com/langsmith/observability), [Cal.com API reference](https://cal.com/docs/api-reference)
