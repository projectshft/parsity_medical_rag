# Bonus session — Voice AI

**Optional. Midweek, recorded.** Not part of the six-session arc and not required
for anything.

**Needs:** a [Retell AI](https://www.retellai.com/) account and a phone number
purchased through them — **roughly $25 total.**

## Why this exists

Week 3 gave the system a human-gated action: propose an appointment, a person
confirms, cal.com books it. The obvious next move is to *tell the patient* — and
the interesting version of that is a phone call placed by a voice agent.

It's a genuine capability with a short runway right now. Most people building RAG
systems have not wired one up, and it demos extremely well.

## What we cover

- How a voice agent actually works: speech-to-text → LLM → text-to-speech, with
  latency budgets that make every architectural decision you've made so far look
  relaxed
- Configuring a Retell agent — prompt, voice, and the tools it can call
- Wiring it to the scheduling flow from week 3, so a confirmed appointment
  triggers a real outbound call
- `scripts/retell/deploy-agent.ts` and `lib/retell.ts` in this repo

## Worth knowing before you spend

**You don't have to buy in to attend.** The session is recorded and the concepts
transfer to any provider — ElevenLabs and others do the same job with different
ergonomics. Watching how the pieces fit is most of the value.

**If you do buy in**, the phone number is the cost that isn't optional. Budget the
$25 and expect to spend an evening on it.

**The same human-in-the-loop rule applies, harder.** An agent that calls a real
person is meaningfully more consequential than one that writes a calendar row.
Everything in week 3 about proposing rather than executing goes double here.

## For your capstone

If your project has any action that ends in "and then tell someone," this is a
strong differentiator. It is also exactly the kind of thing to scope out
deliberately and *name* in your postmortem if you don't get to it — a documented
non-build is worth more than a half-working phone call.
