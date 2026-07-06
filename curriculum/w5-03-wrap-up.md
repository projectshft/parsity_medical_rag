# Wrap-Up — Ship One Thing, Then Write the Postmortem

**Needs: the whole system; everything you have built and measured**

## Today you will

- Ship one real extension to the system, end to end, the way you now know how
- Write the postmortem — the single most valuable artifact this course produces
- Finish

This is the final stretch, and it's different. The earlier build days handed you a target. This one hands you the keys. The deliverable isn't "make the tests pass" — it's *evidence that you can stress a real system and decide from measurement*, packaged so someone who wasn't here can see it.

## Look how far the problem came

Cast all the way back to the first thing you saw: a clinic has a question, and the answer lives half in structured rows and half in free-text notes, and no keyword search bridges them. `LIKE '%shortness of breath%'` never matches a note that says "dyspnea" — same meaning, zero shared letters. That was the whole problem. Search by *letters* can't find *meaning*.

Everything you built answers that opening problem and then keeps going:

- **Meaning-based search** over the clinical notes — the vector index that finds "dyspnea" when you ask about shortness of breath. The thing keyword search couldn't do.
- **The structured half** it was always paired with — counts, filters, lookups the database already served — and an **agent that routes** each question to the right engine, or both.
- **A grounding contract**: answers point at real records, and the system *refuses* rather than guesses.
- **Exposure to other tools** through an MCP server with scoped auth and an audit trail, plus tracing so you can debug the past.
- **A human-gated action** — proposing an appointment a person confirms.
- **The production gates** you just finished: it knows *who is asking* and shapes what they see, server-side, in a way the client can't switch off.
- **A regression suite** measuring most of it — so "it feels better" became a number.

That last clause is the through-line. The distance between the keyword-search demo you started with and the system you have now is not features — it's *evidence*. You can prove each claim.

## Concept

Here's the thing about systems: anyone can screen-record a happy path. What proves you *built* this — what an employer or a school can't get from watching a video — is the documented judgment behind it. The two artifacts that carry that judgment are a **design doc** and a **postmortem**, and the postmortem is the one that can't be faked, because you have to have *lived* the system to write it.

## Implementation

### 1. Ship one extension

Pick one. Small and complete beats large and half-built — the point is to run the full loop one more time, unaided:

- **A login UI + `seed-users.ts`** — the system has an auth *API* but no sign-in *form*. Seed one STAFF and one DOCTOR, add a minimal login that POSTs to `/api/auth/login`, and make the role-shaping *visible in the running product*: DOCTOR sees the real name, STAFF sees `Patient-A7B3`. This closes the most concrete gap in the build.
- **Reranking, decided properly** — wire reranking into the live retrieval path and let your eval suite decide whether it stays. Ship the *decision*, with the number.
- **A new MCP tool** — a fourth tool, fully scoped and audited.
- **A third role** — a `RESEARCHER` who sees de-identified data across all patients but can't schedule or see names, giving `lib/pii.ts` a second consumer. Write the spec first, then make it pass.
- **Your own idea** — if you have one, it's probably better than this list.

Whatever you pick: build it, measure it, and gate it on the suite. One extension, run the way the whole course taught — that's the ship.

### 2. The design doc (one page)

Architecture and the *why* behind it. Not "what the code does" — the tradeoffs you'd defend in a review:

- The two-engine split (structured store + meaning-based search) and why not one store
- One chunking decision — including the call that the medical notes *don't* need chunking, justified by the measurement (they average a few hundred characters), against the Bible corpus that *did*
- One security decision (role-shaping? the override-proof flag? the schedule gate?) and the alternative you rejected
- One thing you'd build differently starting over

### 3. The postmortem (the real deliverable)

This is the credibility artifact. It's not a summary; it's an *honest account of contact with a system that fought back*. Structure:

- **What broke.** Real failures you hit — a hybrid query that returned the wrong patient's notes, a reranker that didn't help, a login that leaked which emails existed, a STAFF response that almost leaked a count. Name them.
- **What you changed, and the number that told you to.** Each fix tied to its measurement. "I added a few-shot example and analyzer accuracy went 84% → 92%." This is where "no metric, no decision" becomes your voice, not the course's.
- **What you deliberately did not build, and why.** The injection attack your defenses still miss. The eval you named but didn't write. The login UI you scoped out. *Naming what you chose not to do is the strongest possible signal of judgment* — it proves you saw the whole board and made calls, rather than building until you ran out of time.
- **What you'd do differently.** The decision you'd remake with what you know now.

A model can write your code. A model cannot write your postmortem, because it wasn't the one who watched the system lie and decided what to do about it. That asymmetry is the entire value of the document — and of the month you just spent.

### Common mistakes

- **A postmortem with no failures in it.** "Everything worked great" isn't a postmortem; it's a press release, and it reads as "I never stressed this." The failures are the content. A reviewer trusts the doc that admits the attack it still misses far more than the one that claims immunity.
- **Decisions without numbers.** "I added reranking because it improves quality" is the tutorial-finisher's sentence. "I measured +18 points hit@5 against +2.4x per-query cost and kept it because our latency budget had room" is the engineer's. Every claim earns a number or becomes an opinion.
- **Shipping the extension untested.** The capstone extension gated on your own suite is the proof the suite was real. An extension you didn't measure undoes the whole point on the last day.
- **Hiding the deliberate gaps.** The instinct is to present a finished, flawless system. Resist it. The documented gap is worth more than the hidden one — it's the difference between "I think this is done" and "I know exactly where this ends," and only one of those is a senior signal.

## Your turn

The capstone is the your-turn, and it's the portfolio:

1. One extension, shipped and gated on the suite.
2. The one-page design doc.
3. The postmortem — failures, fixes-with-numbers, deliberate non-builds, do-overs.

Take the time it needs. This is the thing you point to.

## Check yourself

- Could a stranger read your postmortem and tell you *stressed* this system rather than just assembled it? If not, the failures are too sanitized.
- For your shipped extension: can you state, in one sentence with a number, why it's in the system?
- Can you explain, in your own words, why a control the caller can switch off is decoration — and point at the line in your code that enforces the role server-side?

## Deliverable 🎥

The final one. Record 3–5 minutes (a little longer is fine for the capstone):

- **The walkthrough:** Demo your shipped extension. Then — and this is the part that matters — show the privacy boundary holding: the same query returning two shapes (DOCTOR sees the real name and full birth date, STAFF sees `Patient-A7B3` and `1975-XX-XX`), and *try to cheat it on camera* — send the body flag, the header flag, a forged role — and show all three fail because the role comes from the signed session, not the client. Close with one honest limitation: an identifier your regex scrubber would still miss, the login UI you'd add, or the gap between "sound architecture" and "shippable on real records."

Grade yourself against one thing: can you explain *why a control the caller can switch off is decoration*, and demonstrate your system enforcing the boundary server-side? A flawless happy-path demo with no cheat attempt and no named limitation is a press release, not evidence you stressed the system.

This video plus your three written artifacts is your portfolio. It's what you show a school, an employer, or yourself in six months.

**Submit:** [Typeform — final capstone submission](https://form.typeform.com/to/PLACEHOLDER-DAY36) <!-- PLACEHOLDER: replace with real Typeform URL -->

## You're done

You started able to *describe* RAG. Now you've built one: two retrieval engines feed it, it routes its own queries, it refuses what it should, other AIs can call it through a scoped and audited door, it books real appointments behind a human gate, it knows who's asking and shapes what they see server-side, and you can *prove* every one of those claims because you measured it.

One honest closing note, because this is medical-shaped data: what you built are the *technical controls* a real deployment needs — minimum-necessary access, de-identification, an audit trail, refusals — practiced on fully synthetic patients so they were safe to break. Real-world deployment on actual records would need more around this architecture: vendor agreements, compliance-eligible service tiers, encryption, policies. That gap between "the architecture is sound" and "this is shippable on real people" is worth naming — it's a sharp discussion, and a sharp line in your postmortem.

The person who can articulate concepts but never confronted a system that lied to them is the one who falls apart on the job. You confronted yours. Repeatedly. With numbers.

Go build something, and measure it.

## Further reading (optional)

- [How to write a good postmortem](https://sre.google/sre-book/postmortem-culture/) — Google SRE's chapter; the blameless, fact-driven posture is exactly what makes your capstone postmortem credible
</content>
