# Day 33 — RBAC II: Role-Shaped Responses and PII

**Needs: yesterday's working auth; the remaining RBAC specs**

## Today you will

- Make the same endpoint return different data to different roles
- Give the PII-obscuring layer the consumer it has been waiting for since early in the course
- Clear the last of the auth tests — and watch a course-long counter hit zero

## Concept

Yesterday answered "who is this." Today answers "what may *this person* see" — and the answer is not just "more" or "less," it is *differently shaped*. Two roles, two genuinely different needs:

| | STAFF (front desk) | DOCTOR |
|---|---|---|
| Demographics, phone | full — they call patients | full |
| Conditions, meds, notes | blocked | full |
| Make appointments | yes | no |
| See PII | no — obscured | yes |

Notice this is not a hierarchy. Staff can do something doctors cannot (schedule) and vice versa (read clinical content). "Permissions" is the wrong mental model; "different jobs, different views" is right. Front-desk staff need a real name and phone number to call a patient — but have no business reading their clinical notes. A doctor reads charts but does not book their own calendar.

Here is where a thread from early in the course finally ties off. You built `lib/pii.ts` — name pseudonymization, date obscuring, content redaction — and it has sat there, complete and unused, the entire time. Today it gets its consumer: the STAFF view runs every response through it. The obscuring you built on faith now defends a real boundary.

And the gate that makes it a *security control* rather than a UI preference: **the role decides, and the client cannot override it.** Today the query endpoint takes an `obscurePII` flag from the request — which means it is not a security control at all, because anyone can set it to false. After today, a STAFF session is obscured no matter what the body or headers say. A control the caller can switch off is decoration.

## Implementation

The full spec is `docs/CHALLENGE-RBAC.md` Part 4. The shape:

### 1. Role-shaped query responses

In the query route, after `requireAuth` gives you the session, the role drives the response:

- DOCTOR: full data, as today
- STAFF: PII obscured, and clinical content (conditions, meds, notes) stripped or refused. If the query *requires* clinical data ("patients with diabetes"), a STAFF caller gets a 403 — that query needs clinical access they do not have

The override-proof part, in one line of intent:

```
const obscure = session.role === 'STAFF' ? true : clientRequestedObscure;
```

The role wins. A STAFF caller sending `obscurePII: false` still gets `Patient-A7B3`. The tests attack this from both the body and the `X-Obscure-PII` header — both must fail to override.

### 2. Role-gated actions

The schedule route becomes STAFF-only (`requireAuth(request, ['STAFF'])`); a DOCTOR gets 403. This is the inverse gate from the query route, and together they prove the point: authorization is per-action, not a global rank.

### 3. Zero

```bash
npm run test:run
```

If RBAC is complete, the counter that read `24 failed` on Day 2 reads `0 failed`. Every assignment the course shipped as a failing test is now satisfied. Sit with that for a second — the progress bar you have watched for a month is full.

### Common mistakes

- **Obscuring in the UI instead of the API.** If the server *sends* real names and the browser hides them, the data is one dev-tools panel away. The redaction happens server-side, in the response, before it leaves the building. The browser is part of the threat model.
- **A STAFF 403 that leaks what it is hiding.** "You cannot see the diabetes diagnosis for these 3 patients" tells staff exactly what they were not allowed to learn. The refusal names the *category* ("this query requires clinical access"), never the contents.
- **Forgetting the header override.** Students plug the body flag and miss `X-Obscure-PII`. Two doors, both locked — and a test for each, because a half-locked control is an unlocked control.
- **Treating obscured data as safe to log.** Obscuring the *response* does not obscure the *internal* objects you might log along the way. If you trace or log the pre-obscured data, the PII left through the back door. (Recall the observability day: audit what your `inputs` contain.)

## Your turn

The challenge Part 4 is the your-turn. Additionally, in your notes:

1. The same query, run as DOCTOR and as STAFF, with both responses pasted — the diff *is* the lesson.
2. Your attempt to defeat your own control: send a STAFF request with `obscurePII: false` in the body and `X-Obscure-PII: false` in the header. Confirm both fail. If either succeeds, you have found a real bug — fix it and add the test.
3. One sentence: which role can do something the other cannot, in *both* directions — and why that proves authorization is not a ranking.

## Check yourself

- Why is hiding PII in the front-end a security failure even if users never see the data on screen?
- A STAFF user requests a list of diabetic patients. What does your endpoint return, and what does it deliberately not say?

<details>
<summary>Solution / discussion</summary>

**Front-end obscuring fails** because the API response is the actual artifact, and it traveled over the network to a client you do not control. Anyone who opens the network tab, replays the request with `curl`, or reads the JSON the page received gets the unobscured data — the front-end "hiding" never touched it. Security boundaries live where the trusted system ends, and the trusted system ends at your server's response. Everything past that is the user's machine, the user's browser, the user's choice. Redact before the boundary or do not redact at all.

**The diabetic-patients request as STAFF** returns a 403 whose message says the query requires clinical access — and deliberately does not return, hint at, or count the matching patients. The trap is a "helpful" refusal: "I can't show you the 14 diabetic patients' details" has already leaked that 14 patients match, which is clinical information a front-desk role should not extract. The refusal is informative about *the rule*, silent about *the data*. This is the same discipline as yesterday's identical-login-errors: the failure path is an information channel, and you close it.

**The both-directions answer:** STAFF can schedule and cannot read clinical notes; DOCTOR can read clinical notes and cannot schedule. Neither is "above" the other — they are different cross-sections of the system's capabilities, which is why a single integer "permission level" could never express this and why real systems use roles and scoped checks. You built the small version; the shape is exactly how hospital systems, banks, and every multi-role product actually work.

</details>

## Further reading (optional)

- [OWASP: broken access control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/) — the #1 web vulnerability of 2021, and precisely the class of bug today's role checks defend against
