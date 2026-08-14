# PII De-identification and the Channel Access Model

**Needs: the working chat pipeline; `lib/pii.ts`; the MCP server you built**

## Today you will

- Give the PII-obscuring layer the consumer it has been waiting for since early in the course
- Read `lib/pii.ts` closely — how each function de-identifies a different kind of data
- Learn the *channel* access model: which door a request comes through decides what it may see

## Concept

Ask *"look up Maria Gonzalez"* and back comes her name, her birth date, her notes. Perfect — **if you're her doctor.** But a medical assistant that hands the same chart to everyone who can type is a leak with a chat box on top. The last gate before a demo becomes a system is this: identifying detail should reach only the people whose job needs it.

There are two honest ways to draw that boundary. One is to build logins, sessions, and roles — prove *who* each caller is, then decide per-person. That's a real approach, and a heavy one. The other — the one this system uses — is simpler and, for a data assistant, often cleaner: **the channel is the access level.** Which door you come through *is* your permission.

| | Front-office channel (the MCP server) | Clinician channel (the direct app) |
|---|---|---|
| How you reach it | MCP tools from Claude Desktop / Cursor | the chat UI (`/api/chat`) |
| Real names, dates, locations | **always** obscured (`Patient-A7B3`, `1975-XX-XX`) | full |
| Which tools exist | only non-identifying ones (patient search / note search) | the full agent pipeline, unscrubbed |
| Who it's for | front-desk staff, external assistants | clinicians who need the chart |

The front-office door only *has* de-identified tools — there is no patient-detail lookup on it to abuse. The clinician door returns full data. **The server decides the default from the channel; there's no role field on the request to forge, because there's no role at all.** This is a smaller idea than login+RBAC and it removes an entire category of bug: you can't send the wrong role if roles don't exist.

And here's the thread that finally ties off. You have `lib/pii.ts` — name pseudonymization, date obscuring, content redaction — and it has sat there, complete, since early in the course. Today it gets its consumer: the front-office channel runs every response through it. The obscuring you built on faith now defends a real boundary.

One nuance to hold onto: **there is no caller-facing switch anywhere.** The front-office channel obscures no matter what the caller sends — no argument turns it off. The clinician channel doesn't scrub at all — showing the full chart is its job. The only toggle in the codebase is server-side: `shouldObscurePII` falls back to an `OBSCURE_PII` env var, an *operator's* dial in `.env`, not a field on any request. That's the shape to internalize: a control the caller can switch *off* is decoration; the real boundary is a channel that simply doesn't offer the switch.

## Implementation

### 1. Read `lib/pii.ts` — the de-identification is real code, not magic

This is the heart of the lesson. Open it and read every function; each de-identifies a *different shape* of data, and the choices are deliberate:

- **`obscureName`** — SHA-256 of the lowercased name → `Patient-A7B3`. Two properties that matter: **deterministic** (the same name always yields the same pseudonym, so records stay *linkable* across responses) and **one-way** (you can't run the hash backward to recover the name). That's a *pseudonym*, not anonymization — still tied to a real record on the server, just not readable.
- **`obscureDate`** — keeps the year, hides month and day: `1985-03-15` → `1985-XX-XX`. Enough for age-based reasoning ("patients over 60"), nothing for identifying a specific person by birthday.
- **`obscureLocation`** — full redaction of city / state / zip → `[LOCATION REDACTED]`. Location narrows a person fast, so it goes entirely.
- **`obscureContent`** — regex scrub over free-text note bodies: names (`Mr./Mrs./Dr.` patterns and likely full names), SSNs, phone numbers, emails, addresses, MRNs, specific dates → `[NAME]`, `[SSN REDACTED]`, etc. The clinical *meaning* stays; the identifiers go. Note the `NON_NAME_WORDS` set — it stops the name regex from mangling "Chief Complaint" or "Blood Pressure," because a de-identifier that over-redacts the medicine is its own kind of broken.
- **`obscurePatient`** — orchestrates all of the above over a patient object, field by field (name → pseudonym, birth/death dates → year-only, phone → redacted, note content → scrubbed). Nothing on the live query path calls it anymore — the shape-agnostic scrub below replaced field-by-field obscuring — but it's the clearest read of "one treatment per shape of data."
- **`shouldObscurePII`** — resolves the flag: an explicit boolean wins, otherwise it falls back to the `OBSCURE_PII` env var.

`lib/pii.test.ts` pins this behavior — consistent pseudonyms, year-only dates, SSN/phone/email scrubbing, and the *non*-redaction of medical terms. Run it and read a few cases:

```bash
npx vitest run lib/pii.test.ts
```

### 2. See where each channel wires it in

**Front-office channel (`mcp-server/index.ts`).** `search_patients` runs the same selector → SQL/RAG fan-out the chat route uses, then scrubs the *entire* rendered text before it leaves — there is no way for a caller to turn it off:

```typescript
const combined = [sqlText, ragText].filter(Boolean).join('\n\n');
// Front-office channel — always obscure PII in the rendered results.
const formatted = obscureContent(combined);
```

**Why the scrub is shape-agnostic.** The SQL side is *text-to-SQL* — the LLM writes the query and chooses whatever columns it likes, so there's no fixed "name field" to pseudonymize. So the channel runs **`obscureContent` over the entire rendered output** (names, SSNs, phones, dates, addresses) rather than field-by-field. That works for any query shape — and it's honestly imperfect: a regex de-identifier misses novel formats. Knowing *where* it leaks is the skill. (One nudge helps: the SQL agent's schema prompt tells it to return a patient's name as a single `name` column — read the last rules in `SCHEMA` in `lib/agents/sql.ts` — so the full-name regex can actually catch it.)

The `query_notes` tool likewise runs each note's patient label through `obscureName`. The file's own header says it: *"this is a FRONT-OFFICE (STAFF) tool… every response here is PII-obscured, and only non-identifying tools are exposed."*

**Clinician channel (`app/api/chat/route.ts`).** Full data — the route hands the specialists' text straight to the aggregator, and nothing on the path calls the scrubber:

```typescript
const [sqlText, ragText] = plan.needsSearch
  ? await Promise.all([
      plan.useSql ? runSql(query, messages) : undefined,
      plan.useRag ? runRag(plan.semanticQuery) : undefined,
    ])
  : [undefined, undefined];
// …straight into the aggregator — no obscureContent anywhere on this path
```

The important reading: full data here is not an oversight or a TODO — the channel itself is the trusted one, and a clinician's tool that hid names would be broken. The security boundary is the *front-office channel's non-negotiable scrub* — not anything on this route.

### Common mistakes

- **Obscuring in the UI instead of at the channel.** If the server *sends* real names and the browser hides them, the data is one dev-tools panel away — replay the request with `curl` and read the raw JSON. De-identification happens server-side, in the response, before it leaves the building. The browser is part of the threat model.
- **Adding an "off switch" to the front-office channel.** The moment the MCP tools accept an `obscure: false` from the caller, the boundary is gone. The front-office default is non-negotiable *on purpose* — don't parameterize it.
- **Thinking a pseudonym is anonymous.** `Patient-A7B3` is stable and one-way, but it still points at a real row on the server. De-identification reduces exposure; it doesn't make the data anonymous. Don't treat obscured output as safe to publish.
- **Logging the pre-obscured object.** Obscuring the *response* doesn't obscure the *internal* objects you traced or logged on the way there. If you log the raw patient before `obscurePatient` runs, the PII left through the back door. (Recall the observability work — audit what your traced `inputs` actually contain.)

## Your turn

1. **Read `lib/pii.ts` end to end** and, in your notes, write one sentence per `obscure*` function: what it takes, what it returns, and *why that particular treatment* (why keep the year? why hash the name instead of dropping it?).
2. **The channel diff.** Run the same conceptual query through both doors — the MCP `search_patients` tool and the chat UI (or a direct `POST /api/chat`) — and paste both outputs. The diff between `Patient-A7B3 · 1975-XX-XX` and `Maria Gonzalez · 1975-04-12` *is* the lesson.
3. **Try to defeat the front-office default.** From the MCP side, is there *any* argument a caller can pass to get an unobscured name back? Read both tool handlers and confirm there isn't. Then read `app/api/chat/route.ts` and confirm the reverse: nothing on the clinician path ever calls the scrubber — full data is the channel's design, not an oversight.
4. **Find a leak in `obscureContent`.** Feed it a note with an all-lowercase name or an unusual phone format and find one identifier the regex misses. Naming an identifier your scrubber would *still* leak is exactly the honest sentence that belongs in your final video.

```quiz
[
  {
    "q": "Why does the front-office channel run obscureContent over the ENTIRE rendered output instead of pseudonymizing a name field?",
    "options": [
      "Scrubbing everything is faster than finding the right fields",
      "The SQL agent is text-to-SQL — the LLM chooses the columns, so there's no fixed shape to obscure field-by-field",
      "obscurePatient was deprecated because field-level obscuring is insecure by definition"
    ],
    "answer": 1,
    "explain": "When a model writes the query, you can't know in advance which columns come back — so the scrub has to be shape-agnostic, applied to the rendered text. The honest cost: a regex de-identifier misses novel formats, and knowing WHERE it leaks is the skill."
  },
  {
    "q": "OBSCURE_PII in .env is acceptable; an obscure: false flag in the request body would not be. Why?",
    "options": [
      "Env vars are encrypted at rest while request bodies travel in plaintext",
      "A boundary is only a boundary if the party being kept out can't move it — the env var lives on the operator's side of the trust line; a request flag comes from the caller's",
      "Request flags can't be typed strictly enough with zod"
    ],
    "answer": 1,
    "explain": "Same bit of configuration, opposite sides of the line. A control the caller can switch off is decoration — which is why the front-office scrub is hard-coded in the tool handlers rather than parameterized."
  },
  {
    "q": "A teammate suggests hiding patient names in the React UI instead of on the server. What's wrong?",
    "options": [
      "Client-side rendering of redactions is too slow for large result sets",
      "Nothing, as long as the component never displays the raw field",
      "The API response is the artifact — anyone with the network tab or curl reads the unobscured data the page received"
    ],
    "answer": 2,
    "explain": "Boundaries live where the trusted system ends, and that's your server's response. The browser is part of the threat model — de-identify before the data leaves the building, or don't call it de-identified."
  }
]
```

## Check yourself

- Why is hiding PII in the front-end a de-identification failure even if users never see the data on screen?
- There's no `obscure` flag on any request, on either channel — the only switch is `OBSCURE_PII` in `.env`. Why is a server-side env var acceptable where a caller-sent flag would not be?
- `obscureName` is deterministic — the same name always maps to the same pseudonym. What does that buy you, and why is it still not anonymization?

<details>
<summary>Solution / discussion</summary>

**Front-end obscuring fails** because the API response is the actual artifact, and it traveled over the network to a client you don't control. Anyone who opens the network tab, replays the request with `curl`, or reads the JSON the page received gets the unobscured data — the front-end "hiding" never touched it. Boundaries live where the trusted system ends, and the trusted system ends at your server's response. De-identify before that boundary or don't call it de-identified.

**The env var vs a caller flag:** a boundary is only a boundary if the party being kept out can't move it. `OBSCURE_PII` lives in `.env` on the server — the operator's side of the trust line — so a caller can't reach it. A flag in the request body or a header comes from the *caller's* side, which means the entity you're protecting against controls the protection. Same bit of configuration, opposite sides of the line. That's why the front-office scrub is hard-coded in the tool handlers rather than parameterized: a control the caller can switch off is decoration.

**Deterministic pseudonyms** let you keep records *linkable* — two responses that mention `Patient-A7B3` are talking about the same person, so you can still reason across notes — without ever exposing the name. It's still not anonymization: the hash is a stable one-way *tag* pointing at a real row on the server. De-identification lowers exposure; only removing the underlying linkage would make it anonymous.

**Why the channel model over login+RBAC here:** for a data assistant, "which door you came through" already encodes the trust level — the MCP server is exposed to external tools, the direct app is the clinician's own surface. Modeling that as a channel removes the whole apparatus of sessions, roles, and per-request role fields (and the forgery bugs that come with them). Fewer moving parts, same boundary. Login+RBAC is the right tool when *one* endpoint must serve many distinct human roles; when the trust boundary lines up with the *entry point*, the channel is simpler and harder to get wrong.

</details>

## Further reading (optional)

- [OWASP: broken access control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/) — the #1 web vulnerability of 2021. The channel model sidesteps a big slice of it by never trusting a client-sent access level in the first place.
- [HHS: de-identification of PHI](https://www.hhs.gov/hipaa/for-professionals/privacy/special-topics/de-identification/index.html) — the two recognized methods (Safe Harbor's 18 identifiers, and Expert Determination). Read it against what `obscureContent` actually catches — and what it misses.
