# Week 6 Runbook — Demo day

**~2h for 8–10 students.** The easiest session to run and the one most worth
running well.

**Student guide:** [`../student/week-6-demo-day.md`](../student/week-6-demo-day.md)

## Before you start

- [ ] **Post the running order** the day before so nobody is surprised.
- [ ] Confirm who's presenting. Chase silence — the students most likely to ghost
      are the ones who'd benefit most from presenting something small.
- [ ] Remind people a **recorded demo is fine**. Live demos fail and burn their
      five minutes.
- [ ] Have a timer visible. Be gentle but real about it.
- [ ] Recording on — this is the artifact students share.

## The format

**~5 minutes each + Q&A.** Only hard rule is the time. The outline is suggested:

1. What you built (demo or design or both)
2. High-level architecture — vector DB, agents, evals, chunking
3. What did you learn? Pitfalls? What would you do differently? Cool new tech?
4. Q&A

## Running it

**Keep questions warm and specific.** After each talk, ask one question yourself
before opening the floor — it sets the register and gives quieter people a model.
Good defaults:

- *"Why that chunk size? What would change if the corpus doubled?"*
- *"Where does it hallucinate, and how would you know?"*
- *"What did you cut, and why that thing?"*
- *"If this got 100× the traffic, what breaks first?"*

**Reward the honest limitation.** When someone names a gap, say out loud that it's
the strongest part of the talk. It reframes the room fast and the presenters after
them will follow suit.

**Don't let it become a feature parade.** If someone is touring UI, redirect:
*"show me the decision you're least sure about."*

## What you're listening for

Not polish. Three things:

1. **A decision defended with a measurement.** Even a rough one. This is the whole
   course in one sentence and it's the difference between a tutorial finisher and
   an engineer.
2. **A named limitation.** Evidence they stressed it rather than assembled it.
3. **Vocabulary used correctly** — routing vs. chaining, over-fetch and rerank,
   grounding, human-in-the-loop. It's how you know the concepts stuck.

## Closing the course

Ten minutes at the end. Worth naming what they did, because six weeks compresses
in memory: keyword search couldn't find *myocardial infarction* from "heart
attack," and they built the index that fixes it, the reranker that sharpens it,
the router that chooses, the aggregator that refuses to invent, the human gate on
real actions, the MCP channel that de-identifies by default — and enough
measurement to know when a change helped.

Then the practical bits:

- Recordings and materials are theirs for good.
- The self-paced track in `archive/` goes deeper than the sessions had time for.
- Rounds / job referrals for anyone looking.
- The channel stays open. Ask them to post what they build next.

## Notes from cohort 3

- The 5-minute cap is right. Without it the first two talks eat forty minutes.
- Several students had built something genuinely unexpected on their own data.
  Leave room for it; the projects are the best advertisement for the next cohort
  (with permission).
- Ask permission at the end to reference their work publicly. Easier now than
  chasing later.
- **Do a retro while it's fresh.** What broke, what to move, what to cut. The
  standing candidates from cohort 3: front-load Node-version checks, split the MCP
  session, and push the query/response log harder in week 3 so evals aren't
  starting from zero at capstone time.
