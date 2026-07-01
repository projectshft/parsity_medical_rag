# Week 6 — Production gates & capstone · Facilitator Runbook

**Block:** Production gates & capstone · **Days covered:** 31–36 · **Session length:** ~110 min · **Deck:** `week-6.html`

**Goal of this session:** the room leaves able to name the four gates that turn a working RAG demo into a defensible system — additive/idempotent ingestion, server-side RBAC, PII de-identification, and injection defense — and they understand the capstone deliverable: ship one measured extension and write the postmortem that proves they built (and stressed) the system, not just assembled it.

> This runbook is backstage. Say anything here — including HIPAA framing and the known runnable-state gaps, both of which are named openly below. You do **not** need to have built the system to run this; Pre-flight and Code-together assume you're coming in cold. This is the **final** session — close the course, don't just close the week.

---

## Pre-flight (before the room arrives)

- [ ] Repo on the **`instructor`** branch (this session demos solutions), `npm install` done.
- [ ] `.env` filled: `DATABASE_URL` (Neon), `OPENAI_API_KEY`, `PINECONE_API_KEY`, and **`AUTH_SECRET`** (a real random value — `jose` throws at sign time without it and every auth test fails opaquely).
- [ ] **The test suite must be runnable.** Run `npm run test:run` once yourself and confirm it's green — the RBAC and upload specs are the spine of the code-together. If you want to show evals too, `npm run test:evals` runs the paid LLM checks (`RUN_EVALS=1 vitest run lib/evals`) — do this once before class so you know the headline numbers and the wait time.
- [ ] Open in tabs: `app/api/upload/route.ts`, `lib/auth.ts` (the `requireAuth` guard), `lib/pii.ts`, `lib/security/content-validator.ts`, and `data/security/poisoned/`.
- [ ] `week-6.html` open full-screen. Arrow keys / click to navigate.

**Known runnable-state gaps — name these openly so a live demo doesn't surprise you (all are intended consequences of the build order, not bugs):**

- **Scheduling from the chat UI returns "Authentication required" (401) — EXPECTED and correct.** Day 33 gates `/api/schedule` to `requireAuth(['STAFF'])`, but there's no sign-in UI, the `users` table is empty, and there's no `seed-users.ts` on instructor — so the Confirm button POSTs with no session and gets a 401, shown in the card. This is correct post-RBAC behavior; scheduling *should* require a STAFF login. Closing the gap (a `seed-users.ts` + a minimal sign-in POSTing to `/api/auth/login`) is a natural exercise — call it out as one.
- **Medication queries return nothing useful — unwired feature gap.** "Which patients take aspirin?" — the analyzer extracts the medication, but `executeStructuredQuery` (`lib/sql-queries.ts`) only filters on conditions and lab thresholds, not medications. The LLM gets no data and improvises. Steer demos toward condition counts, patient lookups, and semantic note search.
- **Semantic/notes answers can be thin locally.** Pinecone bulk writes intermittently EPIPE from some networks, so a local index may be only partially populated (Postgres loads fully). Counts and lookups are unaffected. Works cleanly from Vercel / a stable network.

If you're tight on a stable network, lean the live demo on `npm run test:run` (which mocks external services and always works) rather than the running UI.

---

## Timed flow (~110 min)

| Time | Arc segment | Slides | What to do |
|---|---|---|---|
| 0:00 | **Problem statement** | 1–3 | Cold open: "your app already answers real questions — so why isn't it done?" Sit in the gap between *demo* and *system* before naming the four gates. This is the framing for the entire final week. |
| 0:08 | **Gate 1 — ingestion** | 4 | Additive + idempotent. Make them feel the catastrophe: one naive upload that clears-then-reloads wipes 1,278 patients to insert 1. Land the Week 1 callback — FHIR id as primary key is why idempotency is nearly free. |
| 0:15 | **Code: upload route** | 5 | Walk `app/api/upload/route.ts`. Spend the time on the **can't-happen test** — the `deleteMany`/`deleteAllChunks` assertion. "data gone" beats "wrong answer" as the failure you test against. |
| 0:23 | **Gate 2 — who is this** | 6, 7 | Login → signed JWT → httpOnly cookie → `requireAuth`. Then the quiet rule: identical 401 for unknown-email and wrong-password. Let the enumeration attack land before moving on. |
| 0:33 | **Discussion / breakout** | 8 | STAFF vs DOCTOR — who sees/does what, and how a client would try to cheat the boundary. Breakout if >8 people. Debrief with the answer key below. |
| 0:50 | **Gate 3 — role decides** | 9, 10 | `lib/pii.ts` finally gets its consumer. The override-proof line; the body+header attack; the 403 that names the category, never the contents. |
| 1:00 | **Code together** | 10 | `npm run test:run` live → green. Show STAFF getting PII-redacted output + a 403 on scheduling for DOCTOR. (See Code-together section.) |
| 1:12 | **Gate 4 — poisoned doc** | 11, 12 | The note that fights back. Get hijacked on purpose, then defense-in-depth — land sandboxing as the load-bearing layer. |
| 1:25 | **Break it / extend** | 13 | Run one break-it entry live (re-upload idempotency or the header-override bypass), then turn them loose. |
| 1:38 | **Evals as the spine + cost** | 14, 15 | The course's recurring rule, now explicit. Two lanes; add the cost gate. This is the intellectual close. |
| 1:45 | **Capstone + send-off** | 16, 17, 18 | The deliverable, the HIPAA research prompt, and the recap that ties back to Week 1's two-engine problem. Close the course here. |

Runs long? Compress Gate 1's code slide (0:15) and the evals slide (1:38) — never the RBAC code-together or the poisoned-doc break-it; those are the proof moments. The capstone framing (1:45) is non-negotiable — it's the whole point of Friday.

---

## Breakout prompt + answer key

**Prompt (slide 8):** "You're handed a role — half the room is STAFF (front desk), half is DOCTOR. For your role: (1) what *should* you be able to see and do? (2) what must you be blocked from? (3) you're a malicious client — how would you *try* to cheat the boundary and get data your role shouldn't have?"

**What each role should see/do:**

| | STAFF (front desk) | DOCTOR |
|---|---|---|
| Demographics, phone | full — they call patients | full |
| Conditions, meds, notes | blocked | full |
| Make appointments | **yes** | no |
| See PII (real names/dates) | no — obscured (`Patient-A7B3`, `1975-XX-XX`) | yes |

- **Not a hierarchy.** STAFF can schedule and can't read clinical content; DOCTOR reads charts and can't schedule. Each does something the other can't — so a single integer "permission level" could never express it. That's the lesson: roles, not a ranking. (Day 33's both-directions point.)

**How a client would try to cheat (and why each fails):**
- Send `obscurePII: false` in the **request body** → server ignores it for a STAFF session (`session.role === 'STAFF' ? true : ...`). The role wins.
- Send `X-Obscure-PII: false` in a **header** → same. Two doors, both locked; there's a test for each, because a half-locked control is an unlocked control.
- Claim a different role from the client (a `role: DOCTOR` field or header) → the role comes from the **signed, server-issued session**, not from anything the client sends. A client can't mint a DOCTOR session without `AUTH_SECRET`.
- Read the data in the browser's network tab after the UI "hides" it → fails *only if* redaction is server-side. If a student says "the front-end hides it," that's the bug: the API response already crossed the network unobscured. Redact before the boundary or don't redact at all.

**What to listen for:** the cheat-attempt half is the gold. The students who reach for a client-supplied role or header are reproducing the #1 web vulnerability class (broken access control) in real time — name it. The right mental model: **the server is the only thing in the threat model you trust; everything past its response is the user's machine.**

---

## Code-together (slides 5, 10, 12)

Run in order, narrating each. This whole section mocks external services, so it works on any network.

```bash
npm run test:run        # the RBAC + upload specs go green
```

- **Narrate:** "This counter read `24 failed` since Day 2 — the progress bar of the whole course. RBAC complete means it reads `0 failed`. The tests were the spec; we discovered the behavior by making them pass."
- **Expected output:** all green, including the upload `never clears existing data` test and the RBAC role/override tests.

Then show the role-shaped behavior **via the RBAC specs** (`lib/auth.test.ts` + the query/schedule route tests) — not the running product: there's no login UI to assume a STAFF vs DOCTOR role in the app yet (the `seed-users` gap; closing it is a natural capstone extension). The specs pin all three:

- **STAFF response** → name pseudonymized (`Patient-A7B3`), birth date `1975-XX-XX`, clinical content blocked. Same query as DOCTOR, *differently shaped* output — the diff is the lesson.
- **STAFF asks for "diabetic patients"** → **403**, message names the category ("this query requires clinical access"), and deliberately does **not** count or hint at the matches. ("I can't show you the 14 diabetics" has already leaked that 14 match.)
- **DOCTOR POSTs `/api/schedule`** → **403**. Scheduling is `requireAuth(['STAFF'])`. The inverse gate proves authorization is per-action, not a global rank.

Then the poisoned-document defense (slide 12):

- Show one doc from `data/security/poisoned/` (the instruction-override one), then `lib/security/content-validator.ts`: `validateContent` (detection), `sanitizeContent` (strip fake `SYSTEM:` markers), `buildSandboxedContext` (the structural fix — wrap retrieved text in delimiters, tell the model it's *data to analyze, never instructions*).
- **Narrate the load-bearing point:** detection/sanitization are pattern-based and always one rephrase behind; **sandboxing** removes the instruction-vs-data ambiguity the attack depends on, so it defends even against attacks you haven't seen.

**Most likely live failure:** `AUTH_SECRET` missing → every auth test fails opaquely at `jose` sign time. Check `.env` first. Second most likely: you're on `student` (failing specs) not `instructor` (solutions) — check the branch. Third: a thin local Pinecone index makes the *running UI's* notes answers weak — fall back to `test:run`, which doesn't touch Pinecone.

---

## Break it / extend bank

Run at least one live (the header-override bypass is the headline one), then let the room try the rest.

**1. Re-upload the same document — idempotency.**
- **Sabotage:** POST the exact same FHIR bundle to `/api/upload` twice. Naively you'd expect a duplicate patient.
- **Expected failure:** *no* duplicate — patient count is identical after the second POST.
- **Fix/why:** the FHIR id is the primary key, so the upsert updates-in-place instead of inserting. You get idempotency for free *because* you didn't generate a fresh id. (If a student's route calls `uuid()` on insert, watch idempotency evaporate — every retry becomes a new patient. That's the bug to plant and catch.)
- **Extend:** add a *second, different* bundle and confirm it's additive — the new patient lands without touching the first. Additive + idempotent, both proven with a count.

**2. Cheat the RBAC boundary from the client (the headline one).**
- **Sabotage:** as a STAFF session, send `obscurePII: false` in the request body; if that's blocked, try `X-Obscure-PII: false` as a header; if that's blocked, try sending a `role: DOCTOR` field/header from the client.
- **Expected failure (i.e. the control holds):** all three still return `Patient-A7B3`. The server reads the role from the signed session and decides obscuring itself; nothing the client sends can override it.
- **Fix/why:** `const obscure = session.role === 'STAFF' ? true : clientRequestedObscure`. The teaching moment is the *reverse* — if any of these *succeeds*, you've found a real broken-access-control bug; fix it and add the test. A control the caller can switch off is decoration.
- **Extend:** move the obscuring into the front-end instead of the API, then open the network tab and read the real name off the raw response — demonstrating *why* redaction must happen server-side, before the boundary.

**3. Feed the poisoned note — with the defense off, then on.**
- **Sabotage:** ingest the instruction-override doc from `data/security/poisoned/`, ask an innocent question that retrieves it, with `buildSandboxedContext` **disabled**.
- **Expected failure:** the model **obeys the note** — answers "patient is in perfect health," ignoring the real records. *This is the teaching moment* — the system got hijacked by data it retrieved, and the front-door "ignore override attempts" prompt rule didn't help, because the attack arrived in the context slot, not the user slot.
- **Fix:** re-enable the sandbox; the same query now refuses the injected instruction and answers from the real records. Record which layer caught it.
- **Extend:** run a batch of *clean* notes through the same defenses and confirm none are falsely flagged or mangled — including a legit note that says "the patient was told to disregard the previous medication instructions." A filter that breaks real clinical notes has traded a rare attack for a daily outage. Then name one attack your defenses would *still* miss (a payload with no recognizable patterns that respects the delimiters but subtly biases the answer) — that sentence is gold in a postmortem.

**4. Add a cost number to a query (extend).**
- **Sabotage/extend:** you've measured latency but never cost. Count LLM calls per chat turn (~2: analyzer + answerer, plus embeddings on retrieval), estimate tokens × model price, log a per-request cost. Then compute what one full `npm run test:evals` run costs.
- **Why:** an LLM system with no cost metric is one that surprises you with an invoice. "No metric, no decision" applies to cost too — a reranker that adds 18 points of hit@5 and triples per-query cost is a *decision*, made with both numbers in hand.

---

## Misconceptions to preempt

- **"Re-running an upload obviously duplicates data."** Only if you generate fresh ids. With the FHIR id as primary key, the upsert makes re-delivery a no-op — and re-delivery is a *when*, not an *if* (retries, double-clicks, queue redelivery).
- **"RBAC is a permission ladder — doctor > staff."** No. Neither role is above the other; each can do something the other can't. A single integer "level" can't express it, which is exactly why real systems use roles + scoped checks.
- **"Hide the PII in the UI."** The API response already crossed the network unobscured; the browser is part of the threat model. Redact server-side, before the boundary, or it isn't redacted.
- **"The 'ignore override attempts' prompt rule stops poisoned documents."** It guards the *user* turn; the poisoned doc arrives in the *context* turn wearing the costume of trusted retrieved data. You can't tell the model "trust the context" and "distrust the context" at once — only a structural fix (sandboxing) resolves it.
- **"A green eval run means done."** An eval is a *habit*, not an event. Its value is the next time a number you weren't watching moves. And don't gate commits on paid, noisy LLM evals — gate on deterministic tests, *track* the evals over time.
- **"We built the HIPAA features, so this is HIPAA-compliant."** No — and never say it on a slide or in the UI. See the HIPAA framing below.

---

## HIPAA framing (backstage — for when a student asks "is this compliant?")

This block builds the *technical controls* HIPAA requires, on **synthetic** data (Synthea — no real person, so no PHI, so HIPAA doesn't apply). That's deliberate: practice the safeguards a real deployment needs on data that's safe to break.

| HIPAA requirement | Where this block builds it |
|---|---|
| Minimum-necessary access | RBAC (Days 32–33): STAFF can't see PII; role-shaped responses |
| De-identification | PII obscuring (`lib/pii.ts`): pseudonymized names, redacted dates/locations |
| Audit trail | Audit logging (`mcp-server/audit.ts`, Day 30): who accessed which patient |
| Don't overshare / leak | Grounding + refusals, injection defenses (Day 34) |

**The honest caveat — teach it, don't hide it:** the course teaches the *controls*, not full compliance. Real compliance also needs BAAs with every vendor (OpenAI, Pinecone, Neon, etc.), HIPAA-eligible service tiers, encryption, risk assessments, written policies, and breach procedures — and the *default consumer setups of these APIs are not HIPAA-compliant.* So: excellent teaching vehicle, **not** deployable on real records as-is. **Never label the system "HIPAA-compliant"** anywhere — the slides deliberately don't; slide 17 routes the question into a research prompt instead. If asked "could we ship this for real patients?": the architecture is sound, but you'd add BAAs + HIPAA tiers + encryption + policies first — and that gap is itself a sharp capstone/postmortem topic.

---

## Deliverable 🎥 (Friday, Day 36 — the FINAL one)

The capstone: a **3–5 min video + a written postmortem** (plus a one-page design doc). This is the portfolio artifact the whole course builds toward.

A strong submission:
- **Ships one extension**, end to end, *gated on the student's own eval suite* — reranking decided with a number, a fourth MCP tool, a second data source, or a researcher role. Small and complete beats large and half-built.
- **Demos it**, then — the part that matters — **presents one failure from the postmortem:** what broke, the number that revealed it, what they changed, and how they knew the change worked. Closes with a gap they deliberately left, and why.
- **The postmortem names real failures**, ties each fix to its measurement, and states what they *deliberately did not build*.

**Grade against one thing:** can they show an **eval**, a **failure it caught**, and a **decision they made from a number**? If yes — "I measured +18 hit@5 against 2.4× cost and kept it because latency had room," or "the poisoned doc got through until I added the sandbox, here's the before/after" — they own the system. If the video is a flawless happy-path demo with no failures and no numbers, it's a press release, not a postmortem, and they haven't yet proven they stressed the system. A model can write their code; it cannot write their postmortem — that asymmetry *is* the deliverable's value.

---

## Materials

- Student day files this anchors: `day-31.md` … `day-36.md`
- Challenge docs the days wrap: `docs/CHALLENGE-UPLOAD-API.md`, `docs/CHALLENGE-RBAC.md` (parts 1–4), `docs/CHALLENGE-POISONED-DOCS.md`
- Code: `app/api/upload/route.ts`, `app/api/auth/login/route.ts`, `lib/auth.ts` (the `requireAuth` guard), `lib/pii.ts`, `lib/security/content-validator.ts`, `lib/evals/`, `data/security/poisoned/`
- Scripts: `npm run test:run` (deterministic gate), `npm run test:evals` (paid LLM evals — `RUN_EVALS=1`)
- Instructor context: `curriculum/INSTRUCTOR-NOTES.md` (HIPAA framing + known runnable-state gaps)
- Deck: `week-6.html`
- Final deliverable: the capstone video + written postmortem (students submit via the link in their own day-36 materials — a student-facing detail, not the facilitator's concern)
