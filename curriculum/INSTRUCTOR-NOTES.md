# Instructor Notes

Cross-cutting teaching context that doesn't belong to any one session — the HIPAA
framing, the data story, standing talking points. Instructor-only; lives on the
`instructor` branch and never ships to `student`.

> **Per-session prep, timings, and failure modes live in
> [`instructor/`](instructor/)** — one runbook per Saturday. This file is for the
> things you might be asked in any session.
>
> Some references below point at the pre-cohort self-paced lesson files, now in
> [`archive/`](archive/). The teaching content still holds; the file paths and
> week numbers refer to the archived track, not the six live sessions.

---

## HIPAA & PHI (medical-data framing)

A medical-records assistant invites the question "is this HIPAA-compliant?"
Here's how to handle it in class.

### What HIPAA is (one paragraph for students)
HIPAA (Health Insurance Portability and Accountability Act, 1996) is the US
law governing **PHI** — individually identifiable health information. Anyone
handling real PHI (providers, insurers, and their software "business
associates") must enforce: **minimum-necessary access**, **safeguards**
(access control, encryption in transit/at rest, **audit logs**), **patient
rights** (access/correction/deletion), **Business Associate Agreements
(BAAs)** with every vendor that touches PHI, and **breach notification** —
with real per-violation penalties.

### Does it apply to this course? No — and that's deliberate
Every patient is **synthetic** (Synthea). No real person → no PHI → HIPAA
doesn't apply. That's the point: students practice the exact safeguards a
real deployment needs, on data that's safe to break.

### The course already teaches the HIPAA *technical controls*
Name this connection when you teach the production-gates block — it turns
"we wrote some code" into "we understand which controls a real deployment owes
its patients" — including the ones this build skips:

| HIPAA requirement | Where the course builds it |
|---|---|
| Minimum-necessary access | **Not built in cohort 4.** Cohort 3 had a second, front-office channel (the MCP server) that exposed only non-identifying tools — access enforced by the entry point rather than by roles. That channel is gone, so there's one channel and it's clinician-facing. Worth *describing* when you draw the map: the idea that the door you come through decides what you can see is the cheapest access control there is, and it's the shape a real clinic deployment would need. |
| De-identification | **Not built in cohort 4.** `lib/pii.ts` and its tests were deleted along with the MCP channel that consumed them. Name it as a required control this build doesn't implement, same as the audit trail below — the honest version is more useful than a lab with no consumer. |
| Don't overshare / leak | Grounding + refusals (w3-04-chat-agent / w3-06-failure-day), injection defenses (poisoned-docs homework) |

> **Not built:** an audit trail, RBAC/login, de-identification, and
> minimum-necessary access. Earlier drafts had role-based access + audit logging;
> both were removed. Cohort 3 enforced minimum-necessary by the **channel** (which
> door a request comes through); cohort 4 removed the second channel and the PII
> obscuring with it.
>
> That leaves the technical-controls story thinner than it was, and you should say
> so rather than overclaim. Name each of these as a control a real deployment
> adds — it's a genuinely good discussion, and "here's what we did NOT build and
> why it would matter" is a stronger answer at a job interview than a
> half-implemented regex de-identifier.

### The honest caveat (teach this — don't hide it)
The course teaches the **technical controls**, not full compliance. Real
HIPAA compliance also requires: **BAAs with every vendor** (OpenAI,
Pinecone, Neon, LangSmith, Cal.com, Retell), **HIPAA-eligible
service tiers** (e.g. OpenAI's zero-retention/BAA path; Pinecone/Neon HIPAA
tiers), encryption, risk assessments, written policies, training, and breach
procedures. The **default consumer setups of these APIs are NOT
HIPAA-compliant** — sending real PHI through them as-is would be a
violation. So: excellent teaching vehicle, **not** deployable on real
records as-is.

### Rules of thumb
- **Never label the system "HIPAA-compliant"** anywhere (UI, README, demos).
  It teaches the controls; it isn't compliant.
- The student-facing framing already lives in `curriculum/README.md` (the
  "A note on the data and HIPAA" callout) — synthetic data, why it's safe,
  real PHI would be regulated, safeguards built in the final block.
- If anyone asks "could we ship this for real patients?": yes, the
  *architecture* is sound, but you'd add BAAs + HIPAA tiers + encryption +
  policies first. That gap is itself a good capstone/discussion topic.

### Optional additions not yet made (decided to keep as notes for now)
- A one-line UI disclaimer ("Demo on synthetic data — not for real patient
  records").
- An explicit HIPAA sentence naming de-identification, audit trail and
  minimum-necessary access as controls this build doesn't implement. Week 5's
  security block is the natural home now that PII and the second channel are gone.

---

## Known runnable-state gaps (when demoing the full instructor build)

These surface only when you actually run the finished system (the test
suite passes because it mocks external services). They are *intended
consequences of the build order*, not bugs — but know them before a live
demo.

### Scheduling (no auth — the gate is the human confirmation)
- There is **no login anywhere** in the course. `/api/schedule` is open; the
  gate on it is the human-in-the-loop confirmation card, not a session. So the
  Confirm button POSTs and books (when Cal.com is configured) — no 401, no
  role. If Cal.com isn't configured the route returns 503; the propose→approve
  flow still demos (the confirmation card appears regardless).

### Text-to-SQL vocabulary: medications aren't grounded
- The SQL agent (`lib/agents/sql.ts`) grounds its prompt with real DISTINCT
  values for **conditions and observations only** — `getVocab` never samples
  `medications.display`. Exact drug names usually work anyway (`ILIKE
  '%lisinopril%'` matches the RxNorm display), but lay/class terms — "blood
  pressure medication", "blood thinners" — can silently match nothing and
  produce a confident "none." That's the lesson of the day (vocabulary
  grounding), but know it before a live demo: steer toward named drugs, or
  extend `getVocab` with a medications sample on your own build.

### Semantic/notes answers are thin locally
- Pinecone bulk writes intermittently EPIPE from some networks, so a local
  `npm run vectorize` may only partially populate the vector index (Postgres
  is pre-loaded and unaffected). Counts and lookups are fine; notes-based
  answers improve after a complete vectorize run (works cleanly from Vercel /
  a stable network).
