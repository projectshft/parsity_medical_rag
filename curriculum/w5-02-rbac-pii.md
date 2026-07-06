# RBAC II — Role-Shaped Responses and PII

**Needs: the working auth from the previous lesson; the remaining RBAC specs**

## Today you will

- Make the same endpoint return different data to different roles
- Give the PII-obscuring layer the consumer it has been waiting for since early in the course
- Clear the last of the auth tests — and watch a course-long counter hit zero

## Concept

Last time answered "who is this." Today answers "what may *this person* see" — and the answer isn't just "more" or "less," it's *differently shaped*. Two roles, two genuinely different jobs:

| | STAFF (front desk) | DOCTOR |
|---|---|---|
| Real names, birth dates, locations | no — obscured (`Patient-A7B3`, `1975-XX-XX`) | yes |
| Clinical content (conditions, meds, notes) | blocked / scrubbed | full |
| Run a query (`/api/query`) | yes — PII-scrubbed | yes — full |
| Make appointments (`/api/schedule`) | yes | no |

Notice this is **not a hierarchy**. STAFF can do something DOCTOR cannot (schedule) and vice versa (read clinical content). "Permissions ladder" is the wrong mental model; "different jobs, different views" is right. Front-desk staff need a real name and phone number to call a patient — but have no business reading their clinical notes. A doctor reads charts but doesn't book their own calendar. A single integer "permission level" could never express "can schedule but can't read charts," which is exactly why real systems use roles plus per-action scoped checks.

And here's the crucial part: for STAFF, the shaped response isn't an *error* — it's a real, working, *de-identified* answer. STAFF asking "look up this patient" gets back `Patient-A7B3` and a birth date of `1975-XX-XX`, not a wall. **Redaction, not denial.** A 403 (denial) and a pseudonym (redaction) are different tools for different situations, and you'll use both today: the query route redacts, the schedule route denies.

This is where a thread from early in the course finally ties off. You have `lib/pii.ts` — name pseudonymization, date obscuring, content redaction — and it has sat there, complete and unused, the whole time. Today it gets its consumer: the STAFF view runs every response through it. The obscuring you built on faith now defends a real boundary.

And the gate that makes it a *security control* rather than a UI preference: **the role decides, and the client cannot override it.** Right now the query endpoint takes an `obscurePII` flag from the request — which means it's not a security control at all, because anyone can set it to `false`. After today, a STAFF session is obscured no matter what the body or headers say. **A control the caller can switch off is decoration.**

## Implementation

The full spec is `docs/CHALLENGE-RBAC.md` Part 4. The shape:

### 1. Role-shaped query responses

In `app/api/query/route.ts`, after `requireAuth` gives you the session, the role drives the obscuring. The override-proof line, and it's exactly this small:

```typescript
const session = await requireAuth(request);
// ... read the client's requested flag from body and header ...
// The role wins: STAFF are always obscured; doctors may opt in.
const shouldObscure = session.role === 'STAFF' ? true : clientObscure;
```

The route already reads the client's wish from both the request body (`obscurePII`) and an `X-Obscure-PII` header. That wish is *advisory for a DOCTOR* and *ignored for STAFF*. A STAFF caller sending `obscurePII: false` still gets `Patient-A7B3`. The tests attack this from both the body and the header — both must fail to override.

The actual obscuring is done by `lib/pii.ts`, which `executeQuery` calls when you pass `obscurePII: true`. It's real code, not magic:

- `obscureName` — SHA-256 of the name → `Patient-A7B3`. Deterministic (same name, same pseudonym, so records stay linkable) and one-way (you can't run it backward to the name)
- `obscureDate` — keep the year, hide month/day: `1975-04-12` → `1975-XX-XX`, so age-based queries still work
- `obscureLocation` — full redaction of city/state/zip
- `obscureContent` — regex scrub of names, SSNs, phones, emails, and addresses inside free-text note bodies
- `obscurePatient` — orchestrates all of the above over a patient object

### 2. Role-gated actions

`app/api/schedule/route.ts` becomes STAFF-only:

```typescript
await requireAuth(request, ['STAFF']);
```

A DOCTOR POST returns 403, and the calendar is never called for a rejected request. This is the *inverse* gate from the query route, and together they prove the point: authorization is per-action, not a global rank.

### 3. Zero

```bash
npm run test:run
```

If RBAC is complete, the counter that read `24 failed` for weeks reads `0 failed`. Every assignment the course shipped as a failing test is now satisfied. Sit with that — the progress bar you've watched for a month is full.

> **Note on running the product vs. running the specs.** The system has a login *API* but no login *UI* yet, and the users table starts empty — so you demonstrate role-shaping through the **specs**, which build STAFF and DOCTOR sessions directly with `createSessionToken`. The three files to read are `lib/auth.test.ts`, `app/api/query/route.test.ts`, and `app/api/schedule/route.test.ts`. (Closing that gap — a `seed-users.ts` plus a minimal sign-in form POSTing to `/api/auth/login` — is a natural extension, and a good capstone.)

### Common mistakes

- **Obscuring in the UI instead of the API.** If the server *sends* real names and the browser hides them, the data is one dev-tools panel away — replay the request with `curl` and read the raw JSON. Redaction happens server-side, in the response, before it leaves the building. The browser is part of the threat model.
- **A STAFF 403 that leaks what it's hiding.** "You can't see the diagnosis for these 3 patients" tells staff exactly what they weren't allowed to learn. The refusal names the *category* ("this query requires clinical access"), never the contents — and never the count.
- **Forgetting the header override.** Students plug the body flag and miss `X-Obscure-PII`. Two doors, both locked — and a test for each, because a half-locked control is an unlocked control.
- **Treating obscured data as safe to log.** Obscuring the *response* doesn't obscure the *internal* objects you might trace or log along the way. If you log the pre-obscured data, the PII left through the back door. (Recall the observability work: audit what your `inputs` contain.)

## Your turn

The challenge Part 4 is the your-turn. Additionally, in your notes:

1. The same query, run as DOCTOR and as STAFF, with both responses pasted — the diff *is* the lesson.
2. Your attempt to defeat your own control: send a STAFF request with `obscurePII: false` in the body **and** `X-Obscure-PII: false` in the header. Confirm both fail. If either succeeds, you've found a real bug — fix it and add the test.
3. One sentence: which role can do something the other cannot, in *both* directions — and why that proves authorization is not a ranking.

## Check yourself

- Why is hiding PII in the front-end a security failure even if users never see the data on screen?
- A STAFF user requests a list of diabetic patients. What does your endpoint return, and what does it deliberately not say?

<details>
<summary>Solution / discussion</summary>

**Front-end obscuring fails** because the API response is the actual artifact, and it traveled over the network to a client you don't control. Anyone who opens the network tab, replays the request with `curl`, or reads the JSON the page received gets the unobscured data — the front-end "hiding" never touched it. Security boundaries live where the trusted system ends, and the trusted system ends at your server's response. Everything past that is the user's machine, the user's browser, the user's choice. Redact before the boundary or don't call it redacted.

**The diabetic-patients request as STAFF** returns a 403 whose message says the query requires clinical access — and deliberately doesn't return, hint at, or count the matching patients. The trap is a "helpful" refusal: "I can't show you the 14 diabetic patients' details" has already leaked that 14 patients match, which is clinical information a front-desk role shouldn't extract. The refusal is informative about *the rule*, silent about *the data*. Same discipline as the identical-login-errors: the failure path is an information channel, and you close it.

**The both-directions answer:** STAFF can schedule and cannot read clinical notes; DOCTOR can read clinical notes and cannot schedule. Neither is "above" the other — they're different cross-sections of the system's capabilities, which is why a single integer "permission level" could never express this and why real systems use roles and scoped checks. You built the small version; the shape is exactly how hospital systems, banks, and every multi-role product actually work.

**One more distinction worth keeping:** `obscureName` produces a *pseudonym*, not anonymization. `Patient-A7B3` is a stable, one-way tag — useful *because* it's consistent — but it's still tied to a real record on the server. De-identification reduces exposure; it doesn't make the data anonymous.

</details>

## Further reading (optional)

- [OWASP: broken access control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/) — the #1 web vulnerability of 2021, and precisely the class of bug today's role checks defend against
</content>
