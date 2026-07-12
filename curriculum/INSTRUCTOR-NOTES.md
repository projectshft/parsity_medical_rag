# Instructor Notes

Teaching context and talking points that are NOT in the student-facing day
files. Instructor-only — lives on the `instructor` branch with the rest of
`curriculum/`, never ships to `student`.

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
"we added PII features" into "we understand the law behind them":

| HIPAA requirement | Where the course builds it |
|---|---|
| Minimum-necessary access | The **channel access model** (Week 5): the front-office (MCP) channel exposes only non-identifying tools and never surfaces PII; the direct app is the clinician channel. Enforced by the entry point, not by roles. |
| De-identification | PII obscuring (`lib/pii.ts`, CHALLENGE-PII): pseudonymized names, redacted dates/locations, scrubbed note text |
| Don't overshare / leak | Grounding + refusals (w2-06 / w2-07), injection defenses (poisoned-docs homework / the Week 5 session) |

> **Not built:** an audit trail and RBAC/login. Earlier drafts had role-based
> access + audit logging; both were removed. Minimum-necessary is now enforced
> by the **channel** (which door a request comes through), not by roles, and
> there is no access log. If you want to teach "accountable access / audit," name
> it as a control a real deployment would add — it isn't in this build.

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
- An explicit HIPAA sentence inside w5-02 connecting the channel model to
  "minimum necessary" and naming the audit-trail requirement as not-built.

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
