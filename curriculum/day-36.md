# Day 36 — Capstone: Ship It, Then Write the Postmortem

**Needs: the whole system; everything you have built and measured**

## Today you will

- Ship one real extension to the system, end to end, the way you now know how
- Write the postmortem — the single most valuable artifact this course produces
- Finish

This is the final build day, and it is different. The earlier build days handed you a target. This one hands you the keys. The deliverable is not "make the tests pass" — it is *evidence that you can stress a real system and decide from measurement*, packaged so someone who was not here can see it.

## Concept

You have built a hybrid RAG system: two retrieval engines, an LLM router, a chat agent with a grounding contract, an MCP server with scoped auth and an audit trail, request tracing, a human-gated action, role-based access control, ingestion that cannot corrupt data, defenses against poisoned documents, and a regression suite measuring most of it. That is not a demo. That is a system.

But here is the thing about systems: anyone can screen-record a happy path. What proves you *built* this — what an employer or a school cannot get from watching a video — is the documented judgment behind it. The two artifacts that carry that judgment are a **design doc** and a **postmortem**, and the postmortem is the one that cannot be faked, because you have to have *lived* the system to write it.

## Implementation

### 1. Ship one extension

Pick one. Small and complete beats large and half-built — the point is to run the full loop one more time, unaided:

- **Reranking, decided properly** — wire `lib/reranker.ts` into the live retrieval path, and let your eval suite decide whether it stays. Ship the *decision*, with the number.
- **A new MCP tool** — the fourth-tool spec you have been carrying, fully secured and audited.
- **A new data source** — ingest a second corpus through your additive, idempotent, injection-defended upload path.
- **PII as a researcher role** — a third role that sees fully-obscured data, giving `lib/pii.ts` a second consumer.
- **Your own idea** — if you have one, it is probably better than this list.

Whatever you pick: build it, measure it, and gate it on the suite. One extension, run the way the whole course taught — that is the ship.

### 2. The design doc (one page)

Architecture and the *why* behind it. Not "what the code does" — the tradeoffs you would defend in a review:

- The two-engine split and why not one store
- One chunking decision (including the medical no-chunking call, justified by measurement)
- One security decision (scopes? role-shaping? the sandbox?) and the alternative you rejected
- One thing you would build differently if starting over

### 3. The postmortem (the real deliverable)

This is the credibility artifact. It is not a summary; it is an *honest account of contact with a system that fought back*. Structure:

- **What broke.** Real failures you hit — a hybrid query that returned a stranger's notes, a reranker that did not help, a poisoned doc that got through, a login that leaked which emails existed. Name them.
- **What you changed, and the number that told you to.** Each fix tied to its measurement. "I added a few-shot example and analyzer accuracy went 84% → 92%." This is where "no metric, no decision" becomes your voice, not the course's.
- **What you deliberately did not build, and why.** The injection attack your defenses still miss. The eval you named but did not write. The cost optimization you skipped. *Naming what you chose not to do is the strongest possible signal of judgment* — it proves you saw the whole board and made calls, rather than building until you ran out of time.
- **What you would do differently.** The decision you would remake with what you know now.

A model can write your code. A model cannot write your postmortem, because it was not the one who watched the system lie and decided what to do about it. That asymmetry is the entire value of the document — and of the month you just spent.

### Common mistakes

- **A postmortem with no failures in it.** "Everything worked great" is not a postmortem; it is a press release, and it reads as "I never stressed this." The failures are the content. A reviewer trusts the doc that admits the poisoned attack it still misses far more than the one that claims immunity.
- **Decisions without numbers.** "I added reranking because it improves quality" is the tutorial-finisher's sentence. "I measured +18 points hit@5 against +2.4x per-query cost and kept it because our latency budget had room" is the engineer's. Every claim earns a number or becomes an opinion.
- **Shipping the extension untested.** The capstone extension gated on your own suite is the proof the suite was real. An extension you did not measure undoes the whole point on the last day.
- **Hiding the deliberate gaps.** The instinct is to present a finished, flawless system. Resist it. The documented gap is worth more than the hidden one — it is the difference between "I think this is done" and "I know exactly where this ends," and only one of those is a senior signal.

## Your turn

The capstone is the your-turn, and it is the portfolio:

1. One extension, shipped and gated on the suite.
2. The one-page design doc.
3. The postmortem — failures, fixes-with-numbers, deliberate non-builds, do-overs.

Take the time it needs. This is the thing you point to.

## Check yourself

- Could a stranger read your postmortem and tell you stressed this system rather than just assembling it? If not, the failures are too sanitized.
- For your shipped extension: can you state, in one sentence with a number, why it is in the system?

<details>
<summary>Solution / discussion — the standard your work is held to</summary>

The work this course was built to produce is judged adversarially, the way a good reviewer (or a sharp interviewer) would push on it. Hold your own capstone to these:

- **Show me your eval. Show me where it failed.** A system with no failures shown has not been stressed. The credible artifact contains its own counterexamples.
- **Defend this architecture against the alternative you rejected.** Every real decision had a runner-up. If you cannot name what you did not choose and why, you did not decide — you defaulted.
- **Where does it break, and what does that cost?** Cost blowups, injection surface, data leakage, eval validity — the blind spots experienced engineers have been burned by. Your postmortem should already answer these before anyone asks.

If your three artifacts survive that questioning, you have the thing the course set out to give you: not a description of RAG, but evidence — a system you built on messy real-shaped data, stressed with planted adversarial inputs, secured and instrumented, with documented judgment behind every decision including the failures. That is an AI engineer. The version who articulates concepts well but never confronted a system that lied to them is the one that falls apart on the job. You confronted yours. Repeatedly. With numbers.

That is the whole point. That was always the point.

</details>

## Deliverable 🎥

The final one. Record 3–5 minutes (a little longer is fine for the capstone):

- **The walkthrough:** Demo your shipped extension, then — and this is the part that matters — present one failure from your postmortem: what broke, the number that revealed it, what you changed, and how you knew the change worked. Close with the gap you deliberately left and why.

This video plus your three written artifacts is your portfolio. It is what you show a school, an employer, or yourself in six months. Make it the one where you sound like someone who has built and broken and measured a real system — because you have.

**Submit:** [Typeform — final capstone submission](https://form.typeform.com/to/PLACEHOLDER-DAY36) <!-- PLACEHOLDER: replace with real Typeform URL -->

## You're done

Thirty-six days ago you could describe RAG. Now you have built one that two retrieval engines feed, that routes its own queries, that refuses what it should, that other AIs can call through a scoped and audited door, that books real appointments behind a human gate, that knows who is asking and shapes what they see, that cannot corrupt its own data, that defends against documents trying to hijack it — and that you can *prove* works, because you measured every claim.

No rest day after this one. Go build something, and measure it.

## Further reading (optional)

- [How to write a good postmortem](https://sre.google/sre-book/postmortem-culture/) — Google SRE's chapter; the blameless, fact-driven posture is exactly what makes your capstone postmortem credible
