# Week 5 — Privacy & data · Facilitator Runbook

**Block:** Privacy & data (the production gates) · **Session length:** ~100 min · **Deck:** `week-5.html`

**Goal of this session:** the room leaves able to explain why a medical assistant must shape its answer to *who is asking* — and to build the controls that enforce it: authentication (a signed session), server-side authorization (role-shaped, redacted responses), and de-identification via `lib/pii.ts`. They leave convinced that **a control the caller can switch off is decoration**, and that redaction has to happen on the server, before the response crosses the boundary. This is the **final** session — close the course, don't just close the week.

> This runbook is backstage. Say anything here — including the HIPAA framing and the known runnable-state gaps, both named openly below. You do **not** need to have built the system to run this: Pre-flight and Code-together assume you're coming in cold, and the whole code-together runs on the **specs**, which mock external services and work on any network. The slide deck deliberately never says "HIPAA-compliant" — keep that discipline in the room too.

---

## Pre-flight (before the room arrives)

- [ ] Repo on the **`instructor`** branch (this session demos solutions), `npm install` done.
- [ ] `.env` has **`AUTH_SECRET`** set to a real random value. Without it, `jose` throws at sign time and *every* auth test fails opaquely — this is the #1 live failure. (`DATABASE_URL` / `OPENAI_API_KEY` / `PINECONE_API_KEY` matter only if you also demo the running UI, which you can skip — see the gap note.)
- [ ] **The test suite must be runnable.** Run `npm run test:run` once yourself and confirm green — the RBAC specs are the spine of the code-together. If you want to isolate them: `npx vitest run lib/auth.test.ts app/api/query/route.test.ts app/api/schedule/route.test.ts`.
- [ ] Open in tabs: `lib/auth.ts` (`requireAuth`, `AuthError`, `createSessionToken`), `lib/pii.ts` (`obscurePatient`, `obscureName`, `obscureDate`, `obscureContent`), `app/api/query/route.ts` (the override-proof line), `app/api/schedule/route.ts` (the STAFF-only gate), and the three RBAC spec files.
- [ ] `week-5.html` open full-screen. Arrow keys / click to navigate, `N` toggles presenter notes.

**Known runnable-state gap — name it openly so a live demo doesn't surprise you (it's an intended consequence of the build order, not a bug):**

- **There is no login UI and no `seed-users.ts` on `instructor`.** The `users` table is empty and nothing in the running app assumes a STAFF vs DOCTOR identity, so you **cannot** demo role-shaped behavior by clicking around the product. Two visible consequences: (1) scheduling from the chat UI returns **401 "Authentication required"** — the Confirm button POSTs with no session; this is *correct* post-RBAC behavior, scheduling *should* require a STAFF login. (2) You demonstrate the role-shaping through the **RBAC specs**, which build STAFF and DOCTOR sessions directly with `createSessionToken`. **Say this plainly to the room** — then point out that closing the gap (a `seed-users.ts` seeding one STAFF + one DOCTOR, plus a minimal sign-in POSTing to `/api/auth/login`) is a natural final-week extension, and a good deliverable.
- Secondary: medication queries ("which patients take aspirin?") return nothing useful — `executeStructuredQuery` filters conditions/labs, not meds. Steer any live UI demo toward condition counts and patient lookups. Semantic/notes answers can be thin locally (partial Pinecone index). None of this touches the specs — lean on `npm run test:run`.

---

## Timed flow (~100 min)

| Time | Arc segment | Slides | What to do |
|---|---|---|---|
| 0:00 | **Problem statement** | 1–3 | Cold open: the assistant *works*, so why isn't it done? Run "look up Maria Gonzalez" in your head — great answer for her doctor, a privacy leak for the front desk. Sit in the gap between *works* and *safe to point at real people*. This is medical data; that's the whole frame for the final week. |
| 0:08 | **How it's solved** | 4 | The move in two sentences: authenticate (who is asking) + authorize (server decides the shape). "Never the client" is the drumbeat of the whole session — start it here. |
| 0:14 | **Concept — identity** | 5 | Login → signed JWT (8h) → httpOnly cookie → `requireAuth`. Land *why* httpOnly: if JS can read the token, one injected script steals the session. One reusable guard, `lib/auth.ts`. |
| 0:22 | **Concept — roles** | 6, 7 | Roles, not a ranking (neither outranks the other). Then the payoff slide: same query, two shapes. STAFF gets a *useful* de-identified answer, not an error — redaction, not denial. |
| 0:32 | **Discussion / breakout** | 8 | Given a role: what should you see, what are you blocked from, and how would you *try to cheat* the boundary? Breakout if >8 people. Debrief with the answer key below — the cheat-attempt half is the gold. |
| 0:48 | **Concept — server-enforced** | 9 | The override-proof line. Body flag + header flag both ignored for STAFF; a test for each door. "A control the caller can switch off is decoration." |
| 0:56 | **Code together** | 10 | `npm run test:run` live → green. Walk the three specs; show STAFF forced-obscured and DOCTOR blocked on scheduling. (See Code-together section — this runs on specs, not the UI.) |
| 1:10 | **Concept — de-identification** | 11, 12 | `lib/pii.ts` is where the shaping happens: pseudonymized names, redacted dates/locations, regex-scrubbed note text. Then the two principles under it — minimum-necessary + accountable access. |
| 1:20 | **Break it / extend** | 13 | Run the header-override bypass live (the headline one), then turn them loose on the bank below. |
| 1:33 | **Research + send-off** | 14, 15 | The "could you ship this for real?" research prompt (HIPAA lives here, in discussion — never on a slide), then the recap that ties all the way back to Week 1's keyword-vs-meaning problem. **Close the course here.** |

Runs long? Compress the identity slide (0:14) or the de-identification detail (1:10) — never the server-enforced beat (0:48) or the RBAC code-together (0:56); those are the proof moments. The send-off (1:33) is non-negotiable — it's the emotional close of the whole course.

---

## Breakout prompt + answer key

**Prompt (slide 8):** "You're handed a role — half the room is STAFF (front desk), half is DOCTOR. For your role: (1) what *should* you be able to see and do? (2) what must you be blocked from? (3) you're a malicious client — how would you *try to cheat* the boundary and get data your role shouldn't have?"

**What each role should see/do:**

| | STAFF (front desk) | DOCTOR |
|---|---|---|
| Real names, birth dates, locations | no — obscured (`Patient-A7B3`, `1975-XX-XX`) | yes |
| Clinical note detail | note text returned with identifiers scrubbed | full |
| Run a query (`/api/query`) | yes — PII-scrubbed | yes — full |
| Make appointments (`/api/schedule`) | **yes** | no (403) |

- **Not a hierarchy.** STAFF can schedule and can't see PII; DOCTOR sees the chart and can't schedule. Each does something the other can't — so a single integer "permission level" could never express it. Roles, scoped per action. (This is the both-directions point: the schedule gate proves authorization is per-action, not a global rank.)

**How a client would try to cheat (and why each fails):**
- Send `obscurePII: false` in the **request body** → server ignores it for a STAFF session (`session.role === 'STAFF' ? true : clientRequested`). The role wins.
- Send `X-Obscure-PII: false` in a **header** → same. Two doors, both locked; there's a test for each, because a half-locked control is an unlocked control.
- Claim a different role from the client (a `role: DOCTOR` field or header) → the role comes from the **signed, server-issued session**, not from anything the client sends. A client can't mint a DOCTOR session without `AUTH_SECRET`.
- Read the data in the browser's network tab after the UI "hides" it → this fails *only if* redaction is server-side. If a student says "the front-end hides it," that's the bug: the API response already crossed the network unobscured. Redact before the boundary, or don't call it redacted.

**What to listen for:** the cheat-attempt half is the gold. Students who reach for a client-supplied role or header are reproducing the #1 web-security vulnerability class (broken access control) in real time — name it. The mental model to land: **the server is the only thing in the threat model you trust; everything past its response is the user's machine.**

---

## Code-together (slide 10)

Run in order, narrating each. This whole section mocks external services, so it works on any network — no DB, no Pinecone, no OpenAI needed.

```bash
npm run test:run        # the RBAC specs go green
```

- **Narrate:** "The tests are the spec — they were written first, and we discovered the behavior by making them pass. We don't *believe* the routes are safe; the counter says `0 failed`."
- **Expected output:** all green, including the auth, query-route, and schedule-route specs.

Then walk the three specs — this is the source of truth, **not** the running product (there's no login UI to assume a role; see the Pre-flight gap):

- **`lib/auth.test.ts`** — a created token round-trips back to the same session; `requireAuth` throws **401** with no session and **403** when the role isn't allowed (two different failures, both asserted); a tampered token and plain garbage both return `null` (never throw). Point at line: `getSession` "finds the session cookie among other cookies" — real cookie headers carry `theme=dark; session=…; tracking=no`.
- **`app/api/query/route.test.ts`** — the heart of the session. STAFF queries *always* run with `obscurePII: true`; STAFF sending `{ obscurePII: false }` in the body **still** gets `true`; STAFF sending `X-Obscure-PII: false` as a header **still** gets `true`; DOCTOR is *not* forced on. Unauthenticated → **401** and `executeQuery` is never called. Same query, differently shaped — the diff *is* the lesson.
- **`app/api/schedule/route.test.ts`** — STAFF can schedule; a DOCTOR POST returns **403**. The inverse gate proves authorization is per-action, not a global rank.

Then open `lib/pii.ts` briefly and show the shaping is real code, not magic: `obscureName` (SHA-256 → `Patient-A7B3`, deterministic, one-way), `obscureDate` (keep the year, hide month/day), `obscureContent` (regex scrub of names/SSNs/phones/emails/addresses), all orchestrated by `obscurePatient`.

**Most likely live failure:** `AUTH_SECRET` missing → every auth test fails opaquely at `jose` sign time. Check `.env` first. Second most likely: you're on `student` (skeleton/failing specs) not `instructor` (solutions) — check the branch. Third: someone asks to see it in the running app — redirect to the specs and name the no-login-UI gap; the product can't assume a role yet, and that's the intended state.

---

## Break it / extend bank

Run at least one live (the header-override bypass is the headline one), then let the room try the rest.

**1. Cheat the RBAC boundary from the client (the headline one).**
- **Sabotage:** as a STAFF session, send `obscurePII: false` in the request body; if that's blocked, try `X-Obscure-PII: false` as a header; if that's blocked, try sending a `role: DOCTOR` field/header from the client.
- **Expected result (the control holds):** all three still return `Patient-A7B3`. The server reads the role from the signed session and decides obscuring itself; nothing the client sends can override it. The query-route spec pins the body and header cases directly.
- **Fix/why:** `const shouldObscure = session.role === 'STAFF' ? true : clientRequested`. The teaching moment is the *reverse* — if any of these *succeeds*, you've found a real broken-access-control bug; fix it and add the test. A control the caller can switch off is decoration.
- **Extend:** move the obscuring into the front-end instead of the API, then open the network tab and read the real name off the raw response — demonstrating *why* redaction must happen server-side, before the boundary. The browser is inside the threat model.

**2. Forge / tamper with the session.**
- **Sabotage:** take a valid STAFF token from a cookie and flip a character in the signature; or hand-craft a JWT claiming `role: DOCTOR` without signing it with `AUTH_SECRET`; present either on `/api/query`.
- **Expected result:** `getSession` returns `null` (verification fails), so `requireAuth` throws **401** — the forged/tampered token buys nothing. `auth.test.ts` pins both the tampered-token and garbage-string cases.
- **Fix/why:** the JWT is *signed* server-side; verification is what makes the role trustworthy. Without the secret you can put any claim you like in the token — you just can't get it to verify.
- **Extend:** delete `AUTH_SECRET` from `.env` and re-run — watch *every* auth test fail at sign time. Name it: the secret is the root of trust; losing it (or committing it) collapses the whole scheme. Where should it actually live in production?

**3. The empty-role / missing-guard leak.**
- **Sabotage:** comment out the `requireAuth(request)` line at the top of `app/api/query/route.ts` (or remove the `['STAFF']` argument from the schedule route's guard).
- **Expected failure:** the query route now serves anyone with no session (the "rejects unauthenticated with 401" spec goes red); the schedule route now lets a DOCTOR book (the 403 spec goes red). The tests catch the removed gate immediately.
- **Fix:** restore the guard. Teaching point: authorization is a line you have to *add to every protected route* — forgetting it on one endpoint is the whole breach. The spec suite is what stops a silent omission from shipping.
- **Extend:** add a *third* role (e.g. `RESEARCHER` who sees de-identified data across all patients but can't schedule or see names) — write the spec first, then make it pass. What does its response shape look like, and which existing test would you copy?

**4. Break de-identification on real note text (extend).**
- **Sabotage/extend:** feed `obscureContent` a legit clinical note that contains a capitalized non-name ("Chief Complaint", "Blood Pressure") and confirm it's *not* mangled, then one with a real embedded name/phone and confirm those *are* scrubbed. Then find a name the regex misses (an all-lowercase name, or an unusual format).
- **Why:** de-identification is pattern-based and therefore always imperfect — it both over-redacts (false positives on medical terms, which is why `NON_NAME_WORDS` exists) and under-redacts (misses novel formats). Naming one identifier your scrubber would *still* leak is exactly the honest sentence that belongs in the final video. A redactor you trust blindly is worse than one you know the limits of.

---

## Misconceptions to preempt

- **"RBAC is a permission ladder — doctor > staff."** No. Neither role is above the other; each can do something the other can't. A single integer "level" can't express "can schedule but can't read charts," which is exactly why real systems use roles + per-action scoped checks.
- **"Role-shaped means STAFF gets an error."** No — STAFF gets a real, working, *de-identified* answer. Denial (403) and redaction (`Patient-A7B3`) are different tools; the query route redacts, the schedule route denies. Know which one each situation wants.
- **"Hide the PII in the UI."** The API response already crossed the network unobscured; the browser is part of the threat model. Redact server-side, before the boundary, or it isn't redacted. This is the single most common wrong instinct — surface it early.
- **"`obscurePII` is a privacy feature."** As a client-controlled flag it's *not a security control at all* — anything the caller can turn off protects nothing. It only becomes a control once the server forces it from the signed role.
- **"A pseudonym is anonymization."** It's *pseudonymization* — a stable, one-way tag, useful because it's consistent, but it's still tied to a real record on the server. De-identification reduces exposure; it doesn't make the data anonymous.
- **"We built the privacy features, so this is HIPAA-compliant."** No — and never say it on a slide or in the UI. See the framing below.

---

## HIPAA framing (backstage — for when a student asks "is this compliant?")

This block builds the *technical controls* that a regime like HIPAA requires, on **synthetic** data (Synthea — no real person, so no PHI, so HIPAA doesn't apply). That's deliberate: practice the safeguards a real deployment needs on data that's safe to break.

| HIPAA technical control | Where this block builds it |
|---|---|
| Minimum-necessary access | RBAC — STAFF can't see PII; role-shaped responses |
| De-identification | PII obscuring (`lib/pii.ts`): pseudonymized names, redacted dates/locations, scrubbed note text |
| Audit trail | Access logging — who accessed which patient, when (the "accountable access" principle on slide 12) |
| Don't overshare / leak | Server-enforced redaction + refusals |

**The honest caveat — teach it, don't hide it:** the course teaches the *controls*, not full compliance. Real compliance also needs BAAs with every vendor (OpenAI, Pinecone, Neon, etc.), HIPAA-eligible service tiers, encryption in transit and at rest, risk assessments, written policies, training, and breach procedures — and the *default consumer setups of these APIs are not HIPAA-compliant*. So: excellent teaching vehicle, **not** deployable on real records as-is. **Never label the system "HIPAA-compliant"** anywhere — the slides deliberately don't; slide 14 routes the question into a research prompt instead. If asked "could we ship this for real patients?": the architecture is sound, but you'd add BAAs + HIPAA tiers + encryption + policies first — and that gap is itself a sharp topic for the final video.

---

## Deliverable 🎥 (the FINAL one)

A **3–5 min video** (plus a short written note is a nice-to-have). This is the portfolio artifact the whole course builds toward — and the privacy story is a clean thing to demonstrate because the diff is so visible.

A strong submission:
- **Shows the same query returning two shapes** — DOCTOR sees `Maria Gonzalez · 1975-04-12`, STAFF sees `Patient-A7B3 · 1975-XX-XX` — and explains *where* in the request path the shaping happens (the server, off the signed role) and *why* it can't be the client.
- **Tries to cheat the boundary on camera** and shows it hold: the body flag, the header flag, the forged role — all still return the pseudonym. This is the part that proves understanding, not assembly.
- **Names one honest limitation** — the no-login-UI gap they'd close, an identifier the regex scrubber would still miss, or the compliance gap between "sound architecture" and "shippable on real records."

**Grade against one thing:** can they explain, in their own words, *why a control the caller can switch off is decoration*, and demonstrate their system enforcing the boundary server-side? If yes — "here's STAFF trying three ways to see the real name, and here's it failing all three because the role comes from the signed session" — they own it. If the video is a flawless happy-path demo with no cheat attempt and no named limitation, it's a press release, not evidence they stressed the system.

---

## Materials

- Code this anchors: `lib/auth.ts` (`requireAuth`, `AuthError`, `createSessionToken`, `getSession`), `lib/pii.ts` (`obscurePatient`, `obscureName`, `obscureDate`, `obscureLocation`, `obscureContent`, `shouldObscurePII`), `app/api/query/route.ts`, `app/api/schedule/route.ts`
- Specs (the spine of the code-together): `lib/auth.test.ts`, `app/api/query/route.test.ts`, `app/api/schedule/route.test.ts`, `app/api/auth/login/route.test.ts`
- Challenge docs the days wrap: `docs/CHALLENGE-RBAC.md`, `docs/CHALLENGE-PII.md`
- Scripts: `npm run test:run` (deterministic gate, mocks externals — always works); isolate with `npx vitest run lib/auth.test.ts app/api/query/route.test.ts app/api/schedule/route.test.ts`
- Instructor context: `curriculum/INSTRUCTOR-NOTES.md` (HIPAA framing + known runnable-state gaps — the no-login-UI / `seed-users.ts` gap in particular)
- Deck: `week-5.html`
