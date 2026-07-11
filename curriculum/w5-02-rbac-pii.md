# PII De-identification and the Channel Access Model

**Needs: the working query system; `lib/pii.ts`; the MCP server from Week 3**

## Today you will

- Give the PII-obscuring layer the consumer it has been waiting for since early in the course
- Read `lib/pii.ts` closely — how each function de-identifies a different kind of data
- Learn the *channel* access model: which door a request comes through decides what it may see

## Concept

Ask *"look up Maria Gonzalez"* and back comes her name, her birth date, her notes. Perfect — **if you're her doctor.** But a medical assistant that hands the same chart to everyone who can type is a leak with a chat box on top. The last gate before a demo becomes a system is this: identifying detail should reach only the people whose job needs it.

There are two honest ways to draw that boundary. One is to build logins, sessions, and roles — prove *who* each caller is, then decide per-person. That's a real approach, and a heavy one. The other — the one this system uses — is simpler and, for a data assistant, often cleaner: **the channel is the access level.** Which door you come through *is* your permission.

| | Front-office channel (the MCP server) | Clinician channel (the direct app) |
|---|---|---|
| How you reach it | MCP tools from Claude Desktop / Cursor | `/api/query`, the chat UI |
| Real names, dates, locations | **always** obscured (`Patient-A7B3`, `1975-XX-XX`) | full by default |
| Which tools exist | only non-identifying ones (search / notes / condition lists) | the whole query surface |
| Who it's for | front-desk staff, external assistants | clinicians who need the chart |

The front-office door only *has* de-identified tools — there is no patient-detail lookup on it to abuse. The clinician door returns full data. **The server decides the default from the channel; there's no role field on the request to forge, because there's no role at all.** This is a smaller idea than login+RBAC and it removes an entire category of bug: you can't send the wrong role if roles don't exist.

And here's the thread that finally ties off. You have `lib/pii.ts` — name pseudonymization, date obscuring, content redaction — and it has sat there, complete, since early in the course. Today it gets its consumer: the front-office channel runs every response through it. The obscuring you built on faith now defends a real boundary.

One nuance to hold onto: **the front-office default is not negotiable, but the clinician channel lets the caller opt *into* obscuring.** A clinician can ask `/api/query` to obscure (via a body flag or a header) — because on that channel, obscuring is a *convenience*, not the security boundary. On the front-office channel there's no toggle at all: it obscures no matter what the caller sends. A control the caller can switch *off* is decoration; the front-office channel simply doesn't offer the switch.

## Implementation

### 1. Read `lib/pii.ts` — the de-identification is real code, not magic

This is the heart of the week. Open it and read every function; each de-identifies a *different shape* of data, and the choices are deliberate:

- **`obscureName`** — SHA-256 of the lowercased name → `Patient-A7B3`. Two properties that matter: **deterministic** (the same name always yields the same pseudonym, so records stay *linkable* across responses) and **one-way** (you can't run the hash backward to recover the name). That's a *pseudonym*, not anonymization — still tied to a real record on the server, just not readable.
- **`obscureDate`** — keeps the year, hides month and day: `1985-03-15` → `1985-XX-XX`. Enough for age-based reasoning ("patients over 60"), nothing for identifying a specific person by birthday.
- **`obscureLocation`** — full redaction of city / state / zip → `[LOCATION REDACTED]`. Location narrows a person fast, so it goes entirely.
- **`obscureContent`** — regex scrub over free-text note bodies: names (`Mr./Mrs./Dr.` patterns and likely full names), SSNs, phone numbers, emails, addresses, MRNs, specific dates → `[NAME]`, `[SSN REDACTED]`, etc. The clinical *meaning* stays; the identifiers go. Note the `NON_NAME_WORDS` set — it stops the name regex from mangling "Chief Complaint" or "Blood Pressure," because a de-identifier that over-redacts the medicine is its own kind of broken.
- **`obscurePatient`** — orchestrates all of the above over a patient object, field by field (name → pseudonym, birth/death dates → year-only, phone → redacted, note content → scrubbed).
- **`shouldObscurePII`** — resolves the flag: an explicit boolean wins, otherwise it falls back to the `OBSCURE_PII` env var.

`lib/pii.test.ts` pins this behavior — consistent pseudonyms, year-only dates, SSN/phone/email scrubbing, and the *non*-redaction of medical terms. Run it and read a few cases:

```bash
npx vitest run lib/pii.test.ts
```

### 2. See where each channel wires it in

The obscuring is *applied* at the channel, by passing `obscurePII` down into the query layer:

```typescript
// executeQuery threads the flag into both retrieval halves
const result = await executeQuery(userQuery, { obscurePII: true });
// and the formatter obscures the rendered text for the LLM
const formatted = formatResultsForLLM(result, /* obscure */ true);
```

**Why the scrub is shape-agnostic.** The SQL side is now *text-to-SQL* — the LLM writes the query and chooses whatever columns it likes, so there's no fixed "name field" to pseudonymize. So `formatResultsForLLM`, when obscuring, runs **`obscureContent` over the entire rendered output** (names, SSNs, phones, dates, addresses) rather than field-by-field. That works for any query shape — and it's honestly imperfect: a regex de-identifier misses novel formats. Knowing *where* it leaks is the skill. (One nudge helps: the SQL agent is told to return a patient's name as a single `name` column, so the full-name regex can actually catch it.)

**Front-office channel (`mcp-server/index.ts`).** Every tool hard-codes obscuring on — there is no way for a caller to turn it off:

```typescript
const result = await executeQuery(query);
const formatted = formatResultsForLLM(result, true);   // always true, front-office
```

The `query_notes` tool likewise runs each note's patient name through `obscureName`. The file's own header says it: *"this is a FRONT-OFFICE (STAFF) tool… every response here is PII-obscured, and only non-identifying tools are exposed."*

**Clinician channel (`app/api/query/route.ts`).** Full data by default; the caller *may* opt into obscuring, header taking precedence over body:

```typescript
const headerObscure = request.headers.get("x-obscure-pii");
const shouldObscure =
  headerObscure === "true" ? true : headerObscure === "false" ? false : obscurePII;
const result = await executeQuery(query, { vectorTopK, obscurePII: shouldObscure });
```

The important reading: on this channel obscuring is *opt-in* and reversible, because the channel itself is the trusted one. The security boundary is the *front-office channel's non-negotiable default* — not this flag.

### Common mistakes

- **Obscuring in the UI instead of at the channel.** If the server *sends* real names and the browser hides them, the data is one dev-tools panel away — replay the request with `curl` and read the raw JSON. De-identification happens server-side, in the response, before it leaves the building. The browser is part of the threat model.
- **Adding an "off switch" to the front-office channel.** The moment the MCP tools accept an `obscure: false` from the caller, the boundary is gone. The front-office default is non-negotiable *on purpose* — don't parameterize it.
- **Thinking a pseudonym is anonymous.** `Patient-A7B3` is stable and one-way, but it still points at a real row on the server. De-identification reduces exposure; it doesn't make the data anonymous. Don't treat obscured output as safe to publish.
- **Logging the pre-obscured object.** Obscuring the *response* doesn't obscure the *internal* objects you traced or logged on the way there. If you log the raw patient before `obscurePatient` runs, the PII left through the back door. (Recall the observability work — audit what your traced `inputs` actually contain.)

## Your turn

1. **Read `lib/pii.ts` end to end** and, in your notes, write one sentence per `obscure*` function: what it takes, what it returns, and *why that particular treatment* (why keep the year? why hash the name instead of dropping it?).
2. **The channel diff.** Run the same conceptual query through both doors — the MCP `search_patients` tool and a direct `POST /api/query` — and paste both outputs. The diff between `Patient-A7B3 · 1975-XX-XX` and `Maria Gonzalez · 1975-04-12` *is* the lesson.
3. **Try to defeat the front-office default.** From the MCP side, is there *any* argument a caller can pass to get an unobscured name back? Confirm there isn't. Then, on the clinician channel, send `obscurePII: false` in the body with `X-Obscure-PII: true` in the header and confirm the header wins.
4. **Find a leak in `obscureContent`.** Feed it a note with an all-lowercase name or an unusual phone format and find one identifier the regex misses. Naming an identifier your scrubber would *still* leak is exactly the honest sentence that belongs in your final video.

## Check yourself

- Why is hiding PII in the front-end a de-identification failure even if users never see the data on screen?
- The front-office channel obscures *by default and offers no override*, while the clinician channel lets the caller opt in. Why is only one of those a security boundary?
- `obscureName` is deterministic — the same name always maps to the same pseudonym. What does that buy you, and why is it still not anonymization?

<details>
<summary>Solution / discussion</summary>

**Front-end obscuring fails** because the API response is the actual artifact, and it traveled over the network to a client you don't control. Anyone who opens the network tab, replays the request with `curl`, or reads the JSON the page received gets the unobscured data — the front-end "hiding" never touched it. Boundaries live where the trusted system ends, and the trusted system ends at your server's response. De-identify before that boundary or don't call it de-identified.

**Only the front-office default is a boundary** because the caller cannot turn it off — that's the whole definition of a control. The clinician-channel flag is a *convenience* on an already-trusted door: the caller can flip it either way, so it protects nothing on its own. A control the caller can switch off is decoration; the security lives in the channel whose default the caller can't reach.

**Deterministic pseudonyms** let you keep records *linkable* — two responses that mention `Patient-A7B3` are talking about the same person, so you can still reason across notes — without ever exposing the name. It's still not anonymization: the hash is a stable one-way *tag* pointing at a real row on the server. De-identification lowers exposure; only removing the underlying linkage would make it anonymous.

**Why the channel model over login+RBAC here:** for a data assistant, "which door you came through" already encodes the trust level — the MCP server is exposed to external tools, the direct app is the clinician's own surface. Modeling that as a channel removes the whole apparatus of sessions, roles, and per-request role fields (and the forgery bugs that come with them). Fewer moving parts, same boundary. Login+RBAC is the right tool when *one* endpoint must serve many distinct human roles; when the trust boundary lines up with the *entry point*, the channel is simpler and harder to get wrong.

</details>

## Further reading (optional)

- [OWASP: broken access control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/) — the #1 web vulnerability of 2021. The channel model sidesteps a big slice of it by never trusting a client-sent access level in the first place.
- [HHS: de-identification of PHI](https://www.hhs.gov/hipaa/for-professionals/privacy/special-topics/de-identification/index.html) — the two recognized methods (Safe Harbor's 18 identifiers, and Expert Determination). Read it against what `obscureContent` actually catches — and what it misses.
</content>
</invoke>
