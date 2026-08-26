# Week 4 — Let the agent change something

Everything the agent has done so far is read-only. This week it starts writing —
carefully, reversibly, and never without a human clicking a button.

The database is yours, so a mistake here is real. That's the point. `npm run
db:reset` puts it back.

## The rule

**Nothing in this codebase issues a `DELETE`.** Removing a record means stamping
`deletedAt` and filtering it out on read. A soft delete you forget to filter on
is just a lie, so the filter is as much of the assignment as the write.

Three properties every write tool must have:

1. **Reversible** — the prior value is recorded, so the change can be undone.
2. **Audited** — a row in `audit_log` saying who, what, when, and why.
3. **Confirmed** — the model *proposes*; a human clicks; then it happens.

## 1. Finish scheduling (the human-in-the-loop you already half-built)

"Schedule him for Tuesday" should detect intent, resolve *him* from the
conversation, and pop the confirm card. Only when the user clicks does
`/api/schedule` call Cal.com.

Cohort 3 smuggled the card through a response header because the route always
streamed. Don't. **Return normal JSON when there's a card to show, stream when
there's prose to say.** The route knows which it is.

## 2. Build the write tools

Three of them, in `lib/agents/tools/` (or wherever fits your architecture):

### `flag_patient_for_follow_up(patientId, reason)`
Sets `followUpFlag` and `followUpReason`. The gentlest possible write — start here.

### `soft_delete_note(noteId, reason)`
Stamps `notes.deletedAt`. **And deletes the vector from Pinecone.**

This is the interesting one. It's *two* writes to two systems, and they can't be
made atomic. So:

- Which order? (Hint: which failure leaves you worse off — a note that's gone
  from search but still in Postgres, or one retracted in Postgres that's still
  answering questions?)
- What happens when the second write fails? Retry, queue, or reconcile later?
- How would you detect the drift if it happened silently at 3am?

Write your answer down. It's two paragraphs and it's the most transferable thing
in this week.

### `update_patient_contact(patientId, phone)`
A plain field update — reversible only because `audit_log.before` holds the old
value. Prove it: change a phone number, then restore it from the audit row alone.

## 3. Wire the confirmation

Every one of these returns a **proposal**, not a result. The model says what it
wants to do; the UI renders it; the user confirms; a separate route performs it
and writes the audit row with `humanConfirmed: true`.

The gap between "the model called the tool" and "the row changed" is where the
whole pattern lives.

## 4. Prove the boundary holds

Add tests. These are the ones that matter:

- [ ] A confirmed write updates the row **and** writes an audit row with `before` populated
- [ ] An unconfirmed proposal changes **nothing** in the database
- [ ] A soft-deleted note never comes back from `searchClinicalNotes`
- [ ] A soft-deleted note never appears in a SQL agent answer
- [ ] A soft-deleted patient's notes don't get re-indexed by `npm run vectorize`
- [ ] `assertReadOnly` refuses the write the model wasn't supposed to make

That last one: your database is writable now. Read `lib/agents/read-only.ts`,
then genuinely try to get a write past it via the chat box. If you find a way
through, that's a great video and a fix worth sharing.

## 5. Your own action

Add one more write tool of your own design. Same three properties. Something a
clinic would actually want: merging duplicate patients, correcting a
misattributed note, adding a care-team annotation.

## What "done" looks like

- [ ] Scheduling works end to end, confirm card → Cal.com booking
- [ ] Three write tools, all reversible, audited and confirmed
- [ ] One write tool of your own
- [ ] The tests above, green
- [ ] Your two paragraphs on the two-write ordering problem
- [ ] **Capstone design doc in Slack** — see [CHALLENGE-06-CAPSTONE.md](CHALLENGE-06-CAPSTONE.md)

## The video 🎥 (3–4 min)

- Demo one write, from the model proposing to the audit row landing.
- **The one thing you would never let an agent do without a human**, and what
  test you'd write to guarantee it can't.
