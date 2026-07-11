# Week 5 — Privacy & data · Facilitator Runbook

**Block:** Privacy & data (the production gates) · **Session length:** ~100 min · **Deck:** `week-5.html`

**Goal of this session:** the room leaves able to explain why a medical assistant must show identifying detail only where the job needs it — and to build the two controls that enforce it: **de-identification** (`lib/pii.ts`) and a **channel-based access model** (which door a request comes through decides what it sees). They leave convinced that **a control the caller can switch off is decoration** — which is exactly why the front-office channel's obscuring has no off switch — and that de-identification has to happen server-side, before the response crosses the boundary. This is the **final** session — close the course, don't just close the week.

> This runbook is backstage. Say anything here — including the HIPAA framing and the known runnable-state gaps, both named openly below. You do **not** need to have built the system to run this: Pre-flight and Code-together assume you're coming in cold, and the whole code-together runs on the **de-identification specs**, which mock external services and work on any network. The slide deck deliberately never says "HIPAA-compliant" — keep that discipline in the room too.

> **Live cohorts — the poisoned-document lab runs in class this week.** Self-paced learners do `curriculum/homework-poisoned-docs.md` on their own (it's **required** for them); in a live cohort you run it **together**. It's the back-door sequel to Week 2's front-door injection (`w2-07-failure-day`): feel the system get hijacked by a retrieved note, then build defense-in-depth. Materials: `curriculum/homework-poisoned-docs.md` (the arc), `docs/CHALLENGE-POISONED-DOCS.md` (full spec), `scripts/security/demo-poisoned-docs.ts` (the live "watch it obey the attacker" demo), and the three planted attacks in `data/security/poisoned/`. Budget it its **own ~60–90 min block** — as a second Week 5 session, or appended after the PII session below. **Decide the placement for your schedule;** whichever runs last is the real course close (the PII session's "close the course here" beat moves to the end of the lab if you append it).

---

## Pre-flight (before the room arrives)

- [ ] Repo on the **`instructor`** branch (this session demos solutions), `npm install` done.
- [ ] **The de-id spec must be runnable.** Run `npx vitest run lib/pii.test.ts` once yourself and confirm green — it's the spine of the code-together and needs no external services (no DB, no keys, no network). A full `npm run test:run` should also pass.
- [ ] Open in tabs: `lib/pii.ts` (`obscureName`, `obscureDate`, `obscureLocation`, `obscureContent`, `obscurePatient`, `shouldObscurePII`), `lib/pii.test.ts`, `mcp-server/index.ts` (the front-office channel — every tool passes `true` to `formatResultsForLLM`), and `app/api/query/route.ts` (the clinician channel — optional `obscurePII` / `X-Obscure-PII`).
- [ ] `week-5.html` open full-screen. Arrow keys / click to navigate, `N` toggles presenter notes.

**Model note — say this so nobody expects login:** there is **no login, no sessions, no roles** in this system. Access is **channel-based**: the MCP server *is* the front-office (STAFF) channel — it exposes only non-identifying tools and de-identifies every response, with no off switch — and the direct chat/`/api/query` app *is* the clinician channel, which returns full data by default and lets the caller optionally opt into obscuring. If someone asks "where's the login?", the answer is that this system deliberately doesn't have one: the trust boundary lines up with the entry point, so the channel encodes it. Login+RBAC is the heavier tool for when a *single* endpoint must serve many human roles — name that as the alternative you'd reach for then, and a natural extension to discuss.

**Known runnable-state notes (intended consequences of the build order, not bugs):**

- Medication queries ("which patients take aspirin?") return nothing useful — `executeStructuredQuery` filters conditions/labs, not meds. Steer any live UI demo toward condition counts and patient lookups.
- Semantic/notes answers can be thin locally (partial Pinecone index). None of this touches the de-id spec — lean on `npx vitest run lib/pii.test.ts`.

---

## Timed flow (~100 min)

| Time | Arc segment | Slides | What to do |
|---|---|---|---|
| 0:00 | **Problem statement** | 1–3 | Cold open: the assistant *works*, so why isn't it done? Run "look up Maria Gonzalez" in your head — great answer for her doctor, a leak the moment the same tool is wired into a front-desk assistant or an outside integration. Sit in the gap between *works* and *safe to point at real people*. This is medical data; that's the whole frame for the final week. |
| 0:08 | **How it's solved** | 4 | The move in two sentences: de-identify (a real function) + the channel decides who gets it. "The channel is the access level" is the drumbeat — start it here. Field the "why not login?" question with slide 4's cue. |
| 0:14 | **Concept — two doors** | 5 | The front-office channel (MCP: only non-identifying tools, always obscured, no off switch) vs the clinician channel (direct app: full data, optional obscuring). Which door you came through *is* your permission. |
| 0:22 | **Concept — de-identification** | 6, 7 | `lib/pii.ts` is where the shaping happens. Walk the structured/free-text split, then the pseudonym-vs-redaction slide: `obscureName` is deterministic *and* one-way; the date keeps the year; `NON_NAME_WORDS` stops over-redaction. Land "a pseudonym is not anonymization." |
| 0:34 | **Discussion / breakout** | 8 | Given a channel: what should it expose, what must it never hand back, and how would you *try to cheat* it? Breakout if >8 people. Debrief with the answer key below — the cheat-attempt half is the gold. |
| 0:50 | **Concept — the non-negotiable default** | 9 | The front-office channel hard-codes obscuring on; the clinician flag is opt-in convenience, not the boundary. "A control the caller can switch off is decoration." |
| 0:58 | **Code together** | 10 | `npx vitest run lib/pii.test.ts` live → green. Walk the de-id cases, then open the two consumers (MCP passes `true`; `/api/query` threads the optional flag). Same `lib/pii.ts`, two channels. (See Code-together section.) |
| 1:12 | **Concept — de-id is imperfect + minimum-necessary** | 11, 12 | Regex de-id fails both directions (over-redacts medical terms, under-redacts novel formats) — knowing which is the skill. Then the principle under it: minimum-necessary, enforced by the channel that never has the PII. |
| 1:22 | **Break it / extend** | 13 | Run the "can a client force PII off on the front-office channel?" attempt live (the headline one — the answer is no), then turn them loose on the bank below. |
| 1:33 | **Research + send-off** | 14, 15 | The "could you ship this for real?" research prompt (HIPAA lives here, in discussion — never on a slide), then the recap that ties all the way back to Week 1's keyword-vs-meaning problem. **Close the course here.** |

Runs long? Compress the two-doors slide (0:14) or the de-id-imperfect detail (1:12) — never the non-negotiable-default beat (0:50) or the de-id code-together (0:58); those are the proof moments. The send-off (1:33) is non-negotiable — it's the emotional close of the whole course.

---

## Breakout prompt + answer key

**Prompt (slide 8):** "You're handed a channel — half the room takes the front-office (MCP) channel, half takes the direct clinician channel. For your channel: (1) what *should* this door expose? (2) what must it *never* hand back? (3) you're a malicious client — how would you *try to cheat* the boundary and pull identifying data the front-office door shouldn't give?"

**What each channel should expose:**

| | Front-office channel (MCP server) | Clinician channel (direct app) |
|---|---|---|
| Real names, birth dates, locations | no — obscured (`Patient-A7B3`, `1975-XX-XX`) | yes (full by default) |
| Clinical note detail | note text returned with identifiers scrubbed | full |
| Which tools exist | only non-identifying ones (search / notes / condition lists) | the whole query surface |
| Can obscuring be turned off? | **no** — hard-coded on | it's opt-*in* only; full is the default |

- **Not a hierarchy, and not a role field.** The front-office door only *has* de-identified tools — there's no patient-detail lookup on it to abuse, and no "role" the server reads off the request. The channel *is* the trust level. That's the whole idea: you can't send the wrong role if roles don't exist.

**How a client would try to cheat (and why each fails):**
- Pass an `obscure: false` (or any similar) argument to an MCP tool → there's no such parameter; every tool passes `true` to `formatResultsForLLM` unconditionally. The front-office default has no off switch.
- On the clinician channel, send `obscurePII: false` in the body while `X-Obscure-PII: true` is in the header → the header wins (it's the trusted, explicit signal); but note this channel is *meant* to return full data, so the flag isn't a security boundary here anyway.
- Read the data in the browser's network tab after the UI "hides" it → this fails *only if* de-identification is server-side. If a student says "the front-end hides it," that's the bug: the API response already crossed the network unobscured. De-identify before the boundary, or don't call it de-identified.

**What to listen for:** the cheat-attempt half is the gold. The mental model to land: **the server is the only thing in the threat model you trust; everything past its response is the user's machine — and the front-office channel is trustworthy precisely because it offers no knob for the client to turn.**

---

## Code-together (slide 10)

Run in order, narrating each. This whole section mocks external services (the de-id functions are pure), so it works on any network — no DB, no Pinecone, no OpenAI needed.

```bash
npx vitest run lib/pii.test.ts   # the de-identification spec goes green
```

- **Narrate:** "The de-identification isn't a vibe — it's a function with a spec. The counter says `0 failed`, so we don't *believe* names are pseudonymized; we've pinned it."
- **Expected output:** all green — `obscureName`, `obscureDate`, `obscureLocation`, `obscureContent`, `shouldObscurePII`.

Then walk the spec cases — this is the source of truth for the shaping:

- **`obscureName`** — the same name always maps to the same `Patient-XXXX` tag (deterministic, so records stay linkable), case-insensitive, and one-way (SHA-256; you can't recover the name). Point out `Patient-XXXX` for empty/null.
- **`obscureDate`** — `"1985-03-15"` → `"1985-XX-XX"`: keep the year for age math, hide month and day.
- **`obscureContent`** — SSNs, phones, emails, and `Dr./Mr./Mrs.` names get scrubbed to `[…REDACTED]` / `[NAME]`; *and* the "preserves non-PII" cases show "Chief Complaint" and "Blood Pressure" surviving untouched. Both directions matter.

Then open the **two consumers** and show it's the same function wired two ways:

- **`mcp-server/index.ts`** (front-office channel) — every tool calls `formatResultsForLLM(result, true)` and runs patient names through `obscureName`. The file header says it outright: "this is a FRONT-OFFICE (STAFF) tool… every response here is PII-obscured, and only non-identifying tools are exposed." There is no caller-facing flag to turn it off.
- **`app/api/query/route.ts`** (clinician channel) — full data by default; `const shouldObscure = header==='true' ? true : header==='false' ? false : obscurePII;` threads an *optional* flag into `executeQuery`. Opt-in convenience on an already-trusted door.

**Most likely live failure:** you're on `student` (skeleton/failing specs) not `instructor` (solutions) — check the branch. Second: someone asks to see the channel diff in the running app — you *can* (run the MCP tool vs a direct `/api/query`), but if the local Pinecone index is thin, lean on the spec and the code instead; the two consumers make the point without needing live data.

---

## Break it / extend bank

Run at least one live (the front-office-can't-force-PII-off attempt is the headline one), then let the room try the rest.

**1. Can a client force PII off on the front-office channel? (the headline one).**
- **Sabotage:** as an MCP client, try every argument you can think of to make `search_patients` / `query_notes` / `list_patients_by_condition` return a real name — an extra `obscure: false` field, a header, anything.
- **Expected result (the control holds):** every tool still returns `Patient-A7B3`. There is no parameter that disables obscuring — the tools pass `true` to `formatResultsForLLM` unconditionally, and names go through `obscureName` directly.
- **Fix/why:** the front-office default is *hard-coded*, not parameterized — on purpose. The teaching moment is the reverse: if you *could* turn it off from the client, the boundary would be gone. A control the caller can switch off is decoration.
- **Extend:** move the obscuring into the front-end instead of the channel, then open the network tab and read the real name off the raw response — demonstrating *why* de-identification must happen server-side, before the boundary. The browser is inside the threat model.

**2. Break de-identification on real note text.**
- **Sabotage/extend:** feed `obscureContent` a legit clinical note that contains a capitalized non-name ("Chief Complaint", "Blood Pressure") and confirm it's *not* mangled, then one with a real embedded name/phone and confirm those *are* scrubbed. Then find a name the regex misses (an all-lowercase name, or an unusual format).
- **Why:** de-identification is pattern-based and therefore always imperfect — it both over-redacts (false positives on medical terms, which is why `NON_NAME_WORDS` exists) and under-redacts (misses novel formats). Naming one identifier your scrubber would *still* leak is exactly the honest sentence that belongs in the final video. A redactor you trust blindly is worse than one you know the limits of.
- **Extend:** add a failing case to `lib/pii.test.ts` for the identifier you found leaking, then fix the pattern to make it pass. Ship the closed gap *and* the test that proves it.

**3. Add a new front-office tool (extend).**
- **Sabotage/extend:** add a fourth MCP tool — say, "count patients by age band." Wire it so it *cannot* leak a name (no raw patient objects in the response; run anything identifying through `lib/pii.ts`).
- **Why:** the discipline of the front-office channel is that *every* new tool inherits the obscuring by construction. What's the smallest change that keeps that invariant true — and how would you test that your new tool never emits a real name?

**4. Make the clinician channel's obscuring visible in the product (extend).**
- **Sabotage/extend:** the direct app returns full data, but `/api/query` already honors `obscurePII`. Add a toggle in the chat UI that sends it, and watch `Maria Gonzalez · 1975-04-12` flip to `Patient-A7B3 · 1975-XX-XX`.
- **Why:** it makes the de-identification layer tangible end to end, and it's a clean thing to demo in the final video. Note out loud that on this channel the toggle is a *convenience*, not the security boundary — the boundary is the front-office channel's non-negotiable default.

---

## Misconceptions to preempt

- **"There must be a login / roles somewhere."** No — this system has none. Access is channel-based: the MCP server is the front-office (obscured) channel, the direct app is the clinician (full) channel. The trust boundary is the entry point. Login+RBAC is the *alternative* tool, for when one endpoint serves many human roles — name it, don't build it.
- **"Obscuring is a client option."** On the front-office channel it is *not* — it's hard-coded on, and that's what makes it a control. On the clinician channel the flag is opt-*in* convenience on an already-trusted door, not a security boundary. Anything the caller can turn off protects nothing.
- **"Hide the PII in the UI."** The API/tool response already crossed the network unobscured; the browser is part of the threat model. De-identify server-side, before the boundary, or it isn't de-identified. This is the single most common wrong instinct — surface it early.
- **"A pseudonym is anonymization."** It's *pseudonymization* — a stable, one-way tag, useful because it's consistent, but still tied to a real record on the server. De-identification reduces exposure; it doesn't make the data anonymous.
- **"Regex de-identification is complete."** It's pattern-based and imperfect in both directions — over-redacts medical terms (hence `NON_NAME_WORDS`), under-redacts novel identifier formats. A redactor you know the limits of beats one you trust blindly.
- **"We built the privacy features, so this is HIPAA-compliant."** No — and never say it on a slide or in the UI. See the framing below.

---

## HIPAA framing (backstage — for when a student asks "is this compliant?")

This block builds the *technical controls* that a regime like HIPAA requires, on **synthetic** data (Synthea — no real person, so no PHI, so HIPAA doesn't apply). That's deliberate: practice the safeguards a real deployment needs on data that's safe to break.

| HIPAA technical control | Where this block builds it |
|---|---|
| Minimum-necessary access | The channel boundary — the front-office door never has PII to hand out |
| De-identification | PII obscuring (`lib/pii.ts`): pseudonymized names, redacted dates/locations, scrubbed note text |
| Don't overshare / leak | Server-side obscuring at the channel + refusals |

**The honest caveat — teach it, don't hide it:** the course teaches the *controls*, not full compliance. Real compliance also needs BAAs with every vendor (OpenAI, Pinecone, Neon, etc.), HIPAA-eligible service tiers, encryption in transit and at rest, risk assessments, written policies, training, and breach procedures — and the *default consumer setups of these APIs are not HIPAA-compliant*. So: excellent teaching vehicle, **not** deployable on real records as-is. **Never label the system "HIPAA-compliant"** anywhere — the slides deliberately don't; slide 14 routes the question into a research prompt instead. If asked "could we ship this for real patients?": the architecture is sound, but you'd add BAAs + HIPAA tiers + encryption + policies first — and that gap is itself a sharp topic for the final video. (Worth naming: real de-identification is a defined bar — HIPAA recognizes Safe Harbor's 18 identifiers and Expert Determination — and a regex scrubber does *not* meet it.)

---

## Deliverable 🎥 (the FINAL one)

A **3–5 min video** (plus a short written note is a nice-to-have). This is the portfolio artifact the whole course builds toward — and the privacy story is a clean thing to demonstrate because the diff is so visible.

A strong submission:
- **Shows the same question through both channels** — the direct clinician channel returns `Maria Gonzalez · 1975-04-12`, the front-office MCP channel returns `Patient-A7B3 · 1975-XX-XX` — and explains *where* the shaping happens (server-side, in `lib/pii.ts`, at the channel) and *why* it can't live in the client.
- **Tries to cheat the boundary on camera** and shows it hold: hunt for any argument that makes the front-office channel hand back a real name, and show there isn't one, because obscuring is that channel's non-negotiable default. This is the part that proves understanding, not assembly.
- **Names one honest limitation** — an identifier the regex scrubber would still miss, the full login+RBAC layer they scoped out (and why the channel model made it unnecessary here), or the compliance gap between "sound architecture" and "shippable on real records."

**Grade against one thing:** can they explain, in their own words, *why a control the caller can switch off is decoration*, and demonstrate the front-office channel obscuring server-side no matter what the caller sends? If yes — "here's me trying to pull a real name out of the front-office door, and here's it refusing because obscuring is hard-coded on" — they own it. If the video is a flawless happy-path demo with no cheat attempt and no named limitation, it's a press release, not evidence they stressed the system.

---

## Materials

- Code this anchors: `lib/pii.ts` (`obscureName`, `obscureDate`, `obscureLocation`, `obscureContent`, `obscurePatient`, `shouldObscurePII`), `mcp-server/index.ts` (front-office channel), `app/api/query/route.ts` (clinician channel)
- Spec (the spine of the code-together): `lib/pii.test.ts` (pure, no external services — always works); `app/api/query/route.test.ts` (the optional `obscurePII` / `X-Obscure-PII` behavior, no auth)
- Challenge doc the days wrap: `docs/CHALLENGE-PII.md`
- Scripts: `npm run test:run` (full deterministic gate, mocks externals); isolate the de-id with `npx vitest run lib/pii.test.ts`
- Instructor context: `curriculum/INSTRUCTOR-NOTES.md` (HIPAA framing + known runnable-state gaps)
- Deck: `week-5.html`
</content>
