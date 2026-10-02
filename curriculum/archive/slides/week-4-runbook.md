# Week 4 — MCP, PII & human-in-the-loop · Facilitator Runbook

**Block:** MCP, PII & human-in-the-loop · **Week 4 of 5** · **Lessons covered:** w4-01 → w4-06 (MCP intro → PII / channels) · **Session length:** ~110 min · **Deck:** `week-4.html` (17 slides)

**Goal of this session:** the room leaves able to say — in their own words — why the MCP door can stay open with **no login** (narrow tools + always-on obscuring: the emptied room), having *built* the obscuring themselves (`lib/pii.ts`: 31 failing tests → green, then wired at the MCP door), watched a model they don't control discover and call their tools inside Claude Desktop, hunted down a PII format their regex misses **by design**, spec'd a new tool that honors the front-office contract (the deliverable 🎥), and watched the system take its first real *action* — a human-approved Cal.com booking followed by an AI voice call the whole room hears.

> This runbook is backstage — say anything here; the slides are what students see. The single idea to protect all session: **channels and actions.** Which door a request comes through decides what it may see — the MCP door always obscures, the chat door shows the full chart — and when the system finally *acts*, the model **proposes**, a human **approves**, code **executes**. Everything today is one of those two sentences wearing different clothes.

---

## Pre-flight (before the room arrives)

Two rigs in one session: the MCP/Claude Desktop wiring and the Retell/Cal.com action path. Do the full dress rehearsal **the morning of** — the closer is a live phone call, and it deserves a tested runway.

- [ ] Repo cloned, `npm install` done, Node 18+. `.env` has `DATABASE_URL`, `OPENAI_API_KEY`, `PINECONE_API_KEY` — and remember all three must *also* go into the Claude Desktop config's `env` block (the subprocess inherits nothing).
- [ ] **Run the lab from the student-branch state** of `lib/pii.ts` (the stub — every function throws `Not implemented`). Verify the starting point:
      ```bash
      npx vitest run lib/pii.test.ts
      ```
      Expected: **33 tests, 31 failed, 2 passed** — the two `shouldObscurePII` tests pass because that one ships implemented. Keep the instructor solution open in a second window you never screen-share.
- [ ] Claude Desktop installed and signed in. Smoke-test the server *without* it first — the pipe is your "is it my server or the integration?" tool all day:
      ```bash
      echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | npx ts-node mcp-server/index.ts
      ```
      Expected: a JSON-RPC listing of the tools with their schemas (plus `Medical RAG MCP server running` on **stderr** — point at that later; it's the stdout-discipline example).
- [ ] Claude Desktop config staged (macOS): `~/Library/Application Support/Claude/claude_desktop_config.json` — the exact block is in Code-together Part I. Absolute path, real keys in `env`. Fully restart after any edit (Cmd-Q, reopen — config is read at launch).
- [ ] Log tail ready in its own terminal: `tail -f ~/Library/Logs/Claude/mcp-server-medical-rag.log`
- [ ] **Cal.com:** `CAL_API_KEY` + `CAL_EVENT_TYPE_ID` in `.env`. Without them, `/api/schedule` returns a clean **503** — the propose→approve flow still demos, but the wow moment needs a real booking.
- [ ] **Retell pre-flight — the wow moment:**
      1. `RETELL_API_KEY` in `.env` (Retell dashboard → API keys).
      2. Deploy the confirmation agent: `npm run retell:deploy` — expected tail: `Agent created: agent_…` then `RETELL_AGENT_ID=agent_…`. Put that line in `.env` (with it set, `lib/retell.ts` calls with `override_agent_id`, so no dashboard agent-binding is needed).
      3. A phone number bought/imported in the Retell dashboard → `RETELL_FROM_NUMBER`.
      4. `DEMO_PHONE_NUMBER=<your own phone>` — the call rings *you*, not the (synthetic) patient.
      5. **Test the entire loop once:** book through the chat card, take the call, hear it say the patient's name and time. Day of: ringer ON, phone next to your mic, silenced-unknown-callers OFF (you may not have called yourself from that number before).
- [ ] `npm run dev` running; the chat UI loads; `week-4.html` open full-screen (`N` toggles presenter notes).
- [ ] Data reassurance to say out loud before the leak hunt: the dataset is **fully synthetic (zero PHI)** — hunting leaks on screen is safe. The *discipline* is what transfers.

---

## Timed flow (~110 min)

| Time | Arc segment | Slides | What to do |
|---|---|---|---|
| 0:00 | **Cold open — the problem** | 1–3 | The agent works — in *your* app. The front desk lives in Claude Desktop and wants your system inside it. Land the sentence: *you're about to hand your patient database to a model you don't prompt, don't control, and can't see.* Park "add a login" on the whiteboard when someone says it — the breakout comes back for it. |
| 0:08 | **MCP, the concept** | 4 | One server, tools, any client discovers them at connect time. The line to burn in: **your tool descriptions are prompts for a model you don't control.** Mention stdio (subprocess, stdin/stdout) — it explains two of today's live failures. Keep it tight; the wiring teaches it better. |
| 0:16 | **Code together I — wire Claude Desktop** | 5 | Pipe smoke-test first, then the config JSON (absolute path, `env` block, full restart), then the reveal: plain-language question → Claude announces `search_patients`, shows its arguments, waits for approval. Students wire their own; their tool calls **error until the lab** (the pii stub throws) — name it, don't fix it. Live failures + recoveries below. |
| 0:34 | **The two doors + breakout** | 6–8 | The channel diagram: MCP door always obscured, chat door full chart — *which door you came through is your permission.* Breakout (answer key below): is no-login defensible? when do channels beat RBAC? where does it collapse? Debrief into the two guarantees (narrow tool set + always-on scrub), then the pivot: guarantee #2 is a stub in their repo. |
| 0:46 | **Code together II — THE PII LAB** | 9–10 | The week's hands-on spine. `npx vitest run lib/pii.test.ts` → 31 failing. Implement in test-file order: `obscureName` → `obscureDate` → `obscureLocation` → `obscureContent` → `obscurePatient`; each flips its own describe-block green. Then wrap the door: `obscureContent(combined)` in `search_patients`, restart the client, re-ask the question that errored at 0:16 — pseudonyms now, through code they wrote. Run the channel diff. |
| 1:06 | **Break it — hunt the leak** | 11 | The headliner: feed `obscureContent` PII the regexes don't expect (lowercase name, spaced SSN, non-US phone, DD/MM date) and watch it sail through — with all tests green. Frame: imperfect **by design**; a seed for next week, not a bug. Bank entry 1. |
| 1:16 | **Build — the new tool 🎥** | 12 | The contract (non-PII shaped + obscured output), candidates, and the proof sequence (`tools/list` → `tools/call` → the obscuring check). Spec + skeleton in the room; finish at home — this is the deliverable. |
| 1:31 | **HITL + the live call** | 13–15 | Reads vs writes; reversibility × cost. The flow diagram: intent → `findPatientByName` gate → `X-Scheduling-Action` header → card → human confirm → Cal.com → Retell. Then do it live: book, confirm — and the phone rings. Let the room sit in it. Recovery script below if the call doesn't come. |
| 1:45 | **Homework + recap** | 16–17 | Research homework: score `obscureContent` against HHS Safe Harbor's 18 identifiers; write "my scrubber would still leak ___." Recap the two sentences (channels; propose→approve→execute). Deliverable reminder. One tease, no more: next week a document in the index *lies on purpose*. Ends ~1:50. |

Runs long? Compress slide 4 (the wiring teaches MCP anyway) and slide 16 (point at the homework and move). **Never** cut the PII lab, the leak hunt, or the live call — the lab is the spine, the leak is the seed, and the call is the story they'll tell people.

---

## Breakout prompt + answer key (channels vs RBAC)

**Prompt (slide 7):** "The MCP door has no auth at all. (1) Is that a hole or a design — what exactly would a login protect? (2) When do channels beat RBAC — what has to be true of the audiences? (3) Where does the channel model collapse — name one tool or one change that would break it."

- **Is no-login a hole?** No — because there's nothing identifying behind this door to protect. The tool set is deliberately narrow (no `get_patient`, no patient-detail lookup — the most sensitive query shape isn't denied, it's *not offered*) and every response is scrubbed before it leaves. You don't gate a room you already emptied. The sharper framing: a permission system is a **runtime promise** — it holds only while every tool remembers to check and every key stays scoped right. A channel that *cannot emit* PII makes no promise it can break. Security here is structural (what the channel can emit), not procedural (who's allowed to ask).
- **When do channels beat RBAC?** When the audiences split cleanly onto different entry points *and* one audience needs nothing sensitive. Front office vs clinician is exactly that split. Then "which door you used" encodes the trust level with zero per-request checks — and there's no role field on the request to forge, because there are no roles. RBAC is the right tool when **one door must serve people with genuinely different entitlements to the same data** — which is precisely the clinician channel's real-world future ("is the person at the keyboard actually a clinician?" is an *identity* problem, not a channel problem; out of scope for this course, but name it honestly).
- **Where does it collapse?** Three ways, all worth hearing from the room: (a) a tool whose *purpose* can't survive pseudonymization — `get_patient` "just for convenience" (read-only is irrelevant; identifying-vs-not is the property); (b) a caller-controlled off-switch — the day a tool accepts `obscure: false`, the boundary is decoration; (c) the quiet one — commenting out the scrub line to debug and forgetting it (bank entry 4). The wall is *tool set + scrub*; break either and it's not a channel anymore, it's an open door.

**What to listen for:** the "medical data needs RBAC" reflex — push back with *match the control to what's actually behind the door*. Also the opposite over-rotation: "channels are simpler, always use channels" — ask them to design the clinician door with channels alone and watch it fail (you can't make a clinician's tool non-identifying; showing the full chart is its job). The debrief line: *channels when the audiences split onto different doors and one needs nothing sensitive; roles when one door serves different entitlements to the same data.*

---

## Code-together

Three hands-on pieces: wire the client (Part I), build the obscuring and bolt it on the door (Part II — the lab), and the first write (Part III — the live call).

### Part I — wire the MCP server into Claude Desktop (slide 5)

**Pipe first, client second.** Always establish the server works before involving the desktop app:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | npx ts-node mcp-server/index.ts
```

Expected: a JSON-RPC listing of the tools with their zod-derived schemas — this is literally what Claude Desktop sees at connect time. (The friendlier UI for the same thing: `npx @modelcontextprotocol/inspector mcp-server/index.ts`.) Point at `Medical RAG MCP server running` appearing on **stderr** — the one channel the protocol doesn't own.

**The config** — `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "medical-rag": {
      "command": "npx",
      "args": ["ts-node", "/ABSOLUTE/path/to/repo/mcp-server/index.ts"],
      "env": {
        "DATABASE_URL": "your-neon-url",
        "OPENAI_API_KEY": "your-openai-key",
        "PINECONE_API_KEY": "your-pinecone-key"
      }
    }
  }
}
```

Narrate the three details that carry the day: the client **launches your server as a subprocess** (a command, not a URL — server crash = tools vanish); the **path must be absolute** (the subprocess inherits the *client's* working directory); the **`env` block exists because `.env` doesn't travel** (the subprocess inherits nothing from your dev shell). Then Cmd-Q, reopen — config is read at launch.

**The reveal:** fresh conversation, plain language, no tool names — *"How many patients in the medical-rag system have high blood pressure?"* Expected: Claude announces a `search_patients` call, shows the arguments it chose, waits for approval (the client's built-in human-in-the-loop — say that phrase now; it returns at 1:31). Approve → your code runs → the answer reads *your* formatted text, names obscured. Say the beat out loud: **a model you've never prompted just chose your tool from your description alone.**

**Branch reality:** on the student branch, `lib/pii.ts` throws — so a student's tool call comes back with `Error… Not implemented — your turn! (lib/pii.ts → obscureName)`. That's not a wiring failure; **that's the door demanding the lab.** `tools/list` still works (discovery doesn't run handlers) — wiring success = the server appears and tools are discoverable. Full round-trips come alive after the lab, and the re-ask at 0:46 is the payoff.

**Most likely live failures (+ recovery):**
- **Server never appears in the client** → invalid config JSON or a relative path. `tail` the log; the first lines say which.
- **Server appears, every tool errors** → missing `env` keys — the code throws on `process.env.X` being undefined. The log shows your stderr.
- **Tool call hangs forever (works in the pipe)** → stdout pollution — bank entry 2; you'll run it on purpose later.
- **"I changed the config and nothing happened"** → config is read at launch. Cmd-Q, reopen. Almost always this.
- **`npx` can't resolve `ts-node`** → give the config the absolute binary: `/path/to/repo/node_modules/.bin/ts-node`.

### Part II — the PII lab (slides 9–10, ~20 min)

**Start from failure:**

```bash
npx vitest run lib/pii.test.ts
```

Expected: `Tests  31 failed | 2 passed (33)`. The stub's JSDoc + the test file are the spec — read a few cases on screen before anyone types.

**Build order = the test file's describe blocks** (each function flips its own block green; the room feels the progress):

1. **`obscureName`** (7 tests) — `createHash('sha256').update(name.toLowerCase().trim()).digest('hex')`, first 4 hex chars uppercased → `` `Patient-${id}` ``; null/undefined/empty → `Patient-XXXX`. Narrate the two properties the tests pin: **deterministic** (same name → same pseudonym, case-insensitive — records stay *linkable* across responses) and **one-way** (no running a hash backward). A pseudonym, not anonymization.
2. **`obscureDate`** (5 tests) — parse; `isNaN(dateObj.getTime())` guard → `XXXX-XX-XX`; else `` `${year}-XX-XX` ``. Why keep the year: "patients over 60" still works; a full birthday identifies.
3. **`obscureLocation`** (3 tests) — any field present → `[LOCATION REDACTED]`; all empty → `Unknown`. Location narrows a person fast, so it all goes.
4. **`obscureContent`** (14 tests) — the regex pass: SSNs (dashed + `SSN:` prefixed), phones (parens/dashes/dots), emails, `Mr./Mrs./Dr.` names, a full-name pattern, dates (keep the year), MRNs, addresses. Narrate the trap the tests pin from *both* sides: the "preserves non-PII" block demands `hypertension`, `diabetes mellitus`, and `Blood pressure 120/80` survive — a de-identifier that over-redacts the medicine is its own kind of broken. That's what the `NON_NAME_WORDS` guard is for (the name pattern must not eat "Chief Complaint").
5. **`obscurePatient`** (2 tests) — field-by-field orchestration over a patient object; ids and gender survive, names/dates/location don't.

Expected finish: `Tests  33 passed (33)`.

**Then the door (slide 10).** In `mcp-server/index.ts`, follow the in-file idea comment and build `search_patients`: the selector → `runSql` ‖ `runRag` fan-out, join the texts, then the one load-bearing line:

```typescript
const combined = [sqlText, ragText].filter(Boolean).join('\n\n');
const formatted = obscureContent(combined);   // front-office channel — always
```

Say **why the scrub is shape-agnostic**: the SQL side is text-to-SQL — the LLM writes the query and picks whatever columns it likes, so there's no fixed "name field" to pseudonymize. You scrub the *entire rendered text* at the emission point. (The `query_notes` formatter already models the same idea per-label with `obscureName`.)

**The payoff sequence:** restart Claude Desktop (the subprocess is old code until relaunch) → re-ask the 0:16 question that errored → it answers, in pseudonyms, through code they wrote. Then the **channel diff**: the same conceptual question through the chat UI (`/api/chat` — full names, real dates, no scrub anywhere on that path, *on purpose*) vs the MCP tool (`Patient-A7B3 · 1985-XX-XX`). The diff *is* the lesson.

**Most likely live failures (+ recovery):**
- **Format test fails** (`/^Patient-[A-Z0-9]{4}$/`) → they sliced digest *bytes* not hex chars, or forgot `.toUpperCase()`.
- **Case-consistency test fails** → forgot `.toLowerCase().trim()` before hashing.
- **"preserves measurements" fails** → a greedy phone/zip pattern ate `120/80` or a lab value. Recovery: require separators in the pattern, or make the loose ones contextual — over-redaction is a bug the tests refuse.
- **Tests green but Claude Desktop still errors** → old subprocess. Full client restart relaunches the server.

### Part III — the first write: book it and take the call (slides 14–15)

1. **Trigger the proposal.** In the chat UI: *"schedule Abe for tomorrow at 2pm"*. Expected: the streamed answer plus a **confirmation card** with the extracted values. Open the network tab and show the `X-Scheduling-Action` header on the `/api/chat` response — the proposal in transit. Narrate the two gates that already fired: `detectSchedulingIntent` said yes, **and** `findPatientByName` found a real patient. No match → no header → no card.
2. **Edit before confirming.** Change the time on the card, then confirm. Say why: the confirm posts the **card's current values, not the model's extraction** — if it posted the model's raw output, the human gate would be decoration.
3. **The booking.** Expected response from `POST /api/schedule`:
   ```json
   { "success": true, "message": "Appointment scheduled for Abe …", "bookingId": "…", "confirmationCall": { "called": true, "callId": "…" } }
   ```
4. **The call.** Seconds later your phone rings. Speaker on, near the mic. The agent greets the patient by name, states the time, asks if they can make it. Answer "yes." Let the silence in the room do the teaching, then say the boundary sentence: *the model proposed; a human approved; code executed; and the model never held the trigger.*
5. **If the call never comes — recovery, not apology:** the booking still succeeded. Show `bookingId` plus `confirmationCall: { called: false, reason: … }` in the response, and show the `try/catch` in `app/api/schedule/route.ts`: the call is **best-effort by design** — a notification failure must never undo a successful booking. Say the line: *reads fail cheap, writes get gates, notifications get retries-or-shrugs.* Then debug offline: `RETELL_AGENT_ID` missing (re-run `npm run retell:deploy`), `RETELL_FROM_NUMBER` wrong, `DEMO_PHONE_NUMBER` typo'd, or carrier spam-screening (call your phone from the Retell number once beforehand).
6. **If Cal.com isn't configured:** confirm returns a clean **503** (`isCalConfigured()` guards the route). The propose→approve flow already demonstrated the pattern; name what's missing and move on.

---

## Break it / extend bank

Run entries 1 and 2 live (the headliners — a silent PII leak and a hung protocol), 3 with the room, 4 if time remains.

**1. The leak the regex can't see (the headliner — a seed, not a bug).**
- **Sabotage:** with all 33 tests green, feed `obscureContent` PII the patterns don't expect: `maria gonzalez called about her results` (all-lowercase name), `SSN 123 45 6789` (spaces, no dashes), `+44 20 7946 0958` (non-US phone grouping), `seen on 15/03/1985` (DD/MM date — the pattern requires a 1–12 month first).
- **Expected failure:** each sails through untouched. Green tests, leaking scrubber — both true at once.
- **Fix:** there isn't a durable one. You can add a regex per miss forever; the world writes identity in more formats than a list can enumerate. The tests passing means the scrubber handles the formats *we thought of*.
- **Extend:** this is next week seeded — the honest engineering answer is *measuring* the leak rate on realistic inputs, not patching one regex per embarrassment. Don't teach evals now; leave "our tests ≠ the world's inputs" ringing. The research homework (HHS Safe Harbor's 18 identifiers vs what `obscureContent` catches) turns the hunt into an audit.

**2. Stdout pollution — the hanging tool (the transport headliner).**
- **Sabotage:** add `console.log('debug: handler start')` inside a tool handler. Restart Claude Desktop, call the tool.
- **Expected failure:** the call hangs or the client disconnects with a cryptic error — the signature is *hangs in the client, works in the inspector*. The client's MCP log shows the malformed line.
- **Fix:** `console.error` — stderr is yours, stdout is the protocol's. The server's own startup line already models the discipline.
- **Extend:** generalize — stdio transport means protocol and process share one pipe; channels have contracts. Then have them audit every `console.log` reachable from a handler, *including imported `lib/` code* — a stray log in a shared module only fires under the client's call pattern, which is why it survives local testing.

**3. Schedule a ghost — the gate refuses.**
- **Sabotage:** *"schedule Slartibartfast for tomorrow at 2pm."*
- **Expected failure:** none visible — that's the point. `detectSchedulingIntent` fires (`isSchedulingRequest: true`, a name extracted), but `findPatientByName` returns nothing → no `X-Scheduling-Action` header, no card. The model proposed; the system declined to even ask the human.
- **Fix:** nothing to fix — two gates before a card: intent **and** existence. Also probe *"schedule an appointment"* with no name at all → `patientName: null` (nullable schema fields are how the model says "I don't know") → no card. Never a guessed patient.
- **Extend:** the history-contamination probe — discuss patient A for several turns, then say *"yes, schedule him."* `detectSchedulingIntent` reads the last 4 messages: does it grab the right name, or a contextually-present-but-wrong one with full confidence? That's the scariest failure shape in a system that acts; whatever they find goes in their failure notes.

**4. Comment out one line "just to test."**
- **Sabotage:** in `search_patients`, comment out the `obscureContent(combined)` line and return the raw text. Restart the client; ask about a patient.
- **Expected failure:** real names and dates flow out the front-office door. No error, no warning, nothing red — the leak is perfectly silent.
- **Fix:** restore the line. Then say the uncomfortable part out loud: the entire front-office guarantee is **one line per tool at the emission point**. That's why it lives at the door, not scattered through the query path.
- **Extend:** what *would* catch this? A channel-contract test — call the tool handler itself and assert no real patient name appears in the output text. If time remains, write it; it's the strongest artifact of the day and a preview of next week's posture: guarantees you can run.

---

## Misconceptions to preempt

- **"Medical data needs RBAC, so no-login is a hole."** Match the control to what's behind the door. This door only emits pseudonyms; a per-tool permission matrix would guard an emptied room. RBAC belongs where one door serves different entitlements to the *same* data — the clinician channel's real-world future, not this one.
- **"Read-only = safe."** Read-only says nothing about what it reads *out*. `get_patient` is read-only and would hand a foreign model a fully identified chart. The load-bearing property is identifying-vs-not, not read-vs-write.
- **"Patient-A7B3 is anonymous."** It's a pseudonym: deterministic (linkable across responses — a feature) and one-way, but still a stable tag pointing at a real row. De-identification reduces exposure; it doesn't license publishing.
- **"The regex misses are bugs — add more regexes."** They're the design's honest edge. A pattern list can't enumerate every format identity takes; the durable answer is measurement (next week), not one more pattern per embarrassment.
- **"The confirmation card is our auth."** The card is a UX gate; `/api/schedule` is an HTTP endpoint anything can POST to. The card gates the *model*, not the network — which is also why confirm must post the card's current values, or the human gate is decoration.
- **"The model books the appointment."** The model produces a *proposal* — structured, nullable-where-unknown. A human approves the actual parameters; deterministic code calls Cal.com. The model never holds the trigger.

---

## Deliverable 🎥 (end of week)

From the build lesson (w4-04): a **2–3 min video** (phone is fine), pick one:

- **Defend the design:** their new MCP tool — why this tool, what it returns, how it stays non-identifying (which names get obscured and where), and what one call costs. The demo must show a client **discovering and calling it** (`tools/list`, then a `tools/call` or a plain-language ask in Claude Desktop) with the returned text carrying **pseudonyms, never a real name** — not just the source code.
- **Teach back:** explain to a non-engineer why the MCP server can safely answer "how many patients have diabetes?" for any assistant that connects, while the clinician's chat app can't be left open the same way — and how the channel design makes that difference structural.

**Grade against one question:** *does the demo show a client discovering and calling the tool, and getting back obscured, non-PII text?* Source code that returns the right data proves the function works; it does not prove the tool honors the channel. The obscured client round-trip is the deliverable.

(The research homework, slide 16, feeds the final week: audit `obscureContent` against HHS Safe Harbor's 18 identifiers and write the honest sentence — *"my scrubber would still leak ___"* — with a concrete example input.)

---

## Materials

- Deck: `curriculum/slides/week-4.html` (17 slides)
- Lessons this session draws from: `curriculum/w4-01-mcp-intro.md` → `w4-06-pii.md`
- Real code the demos are grounded in (read live if asked):
  - `mcp-server/index.ts` — the front-office door (instructor branch: `search_patients` + `query_notes`, both obscured; student branch: `query_notes` as the worked example plus the in-file idea comment the lab fills in)
  - `lib/pii.ts` — the lab (student = stub) · `lib/pii.test.ts` — the spec (33 tests)
  - `app/api/chat/route.ts` — clinician channel (no scrub, on purpose); intent detection + `findPatientByName` gate; the `X-Scheduling-Action` header
  - `lib/scheduling.ts` — `detectSchedulingIntent` (structured output, nullable fields, today's-date injection) · `lib/patients.ts` — `findPatientByName`
  - `app/api/schedule/route.ts` — the write; `isCalConfigured()` 503 guard; best-effort Retell call in `try/catch`
  - `lib/calendar.ts` — the Cal.com booking · `lib/retell.ts` — the voice call (`DEMO_PHONE_NUMBER` override) · `scripts/retell/deploy-agent.ts` (`npm run retell:deploy`)
- Commands to have on a card: the `tools/list` pipe; `npx @modelcontextprotocol/inspector mcp-server/index.ts`; `npx vitest run lib/pii.test.ts`; `tail -f ~/Library/Logs/Claude/mcp-server-medical-rag.log`
- Config paths: Claude Desktop `~/Library/Application Support/Claude/claude_desktop_config.json` (edit → Cmd-Q → reopen); Cursor `.cursor/mcp.json` at the repo root (launched from the repo, so `.env` loads and the `env` block can go)
- Env this session needs: `DATABASE_URL`, `OPENAI_API_KEY`, `PINECONE_API_KEY` (in `.env` *and* the client config's `env` block); `CAL_API_KEY`, `CAL_EVENT_TYPE_ID`; `RETELL_API_KEY`, `RETELL_FROM_NUMBER`, `RETELL_AGENT_ID`, `DEMO_PHONE_NUMBER`. (`OBSCURE_PII` is the operator's dial — the channels don't consult the caller.)
- Facts to have on hand: **200 patients**, ~21k notes, fully synthetic (zero PHI) — the leak hunt is safe to do on screen; `lib/pii.test.ts` = 33 tests, 31 failing on the student stub; the MCP transport is stdio (stdout = protocol, stderr = yours).
