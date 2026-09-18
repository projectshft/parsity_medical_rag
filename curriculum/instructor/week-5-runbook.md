# Week 5 Runbook — Evals, security & capstone build

**~2h, loosely structured.** Half teaching, half clinic. The shape depends on
where the room is.

**Student guide:** [`../student/week-5-capstone-build.md`](../student/week-5-capstone-build.md)

## Before you start

- [ ] **Read every capstone plan doc posted** and leave comments before the
      session. This is the highest-value hour you'll spend on the whole course —
      a bad scope caught on Saturday is a salvaged capstone; caught on Thursday
      it's a rewrite.
- [ ] **Chase the people who haven't posted one.** In cohort 3 several hadn't by
      the session, and those were the students who struggled at demo day.
- [ ] **Skim the week-4 comparison tables** people posted. Tool calling is a full
      session now, so this week is no longer where it gets introduced — but the
      tables tell you who actually ran both implementations, and a student who
      found the workflow winning is worth three minutes of the room's time. They're
      five rows each — this is a quick skim, not an evening.
- [ ] Have the data-sourcing tools ready to demo: Firecrawl, Crawl4AI, yt-dlp.

## The arc

| Time | What | Notes |
|---|---|---|
| 0:00 | **Week-4 debrief** | 10 min. Their comparison tables — where did the graph win, where did the workflow? A warm-up, not a lecture. |
| 0:10 | **Evals** | 25 min. Their week-3 query log becomes a test suite. `lib/evals/`, `npm run test:evals`. The payoff for three weeks of logging. |
| 0:35 | **Security: poisoned documents** | 25 min. Run the attack, watch it work, then defend it. `npm run security:poisoned`, `lib/security/content-validator.ts`. |
| 1:00 | **Scope triage, out loud** | 20 min. One sentence each on what they're building. Cut what's too big, publicly and kindly. |
| 1:20 | **Data sourcing demo** | 10 min. Firecrawl live on a site someone names. Show markdown-not-HTML. |
| 1:30 | **Clinic** | Open floor. Screen shares, unblocking. |

Two new blocks this cohort. Evals and security used to be ten rushed minutes of
"you should really do this" plus an archived deep-dive nobody read; they're now
half the session, because they're the two things that separate a demo from
something a student can defend at demo day. The capstone content that used to
fill this slot survives — scope triage is still the highest-value twenty minutes
you'll spend — it just doesn't own the whole session.

**PII is no longer taught.** It lived in cohort 3's MCP session and went with it.
`lib/pii.ts` and its 31-test contract are still in the repo as bonus; if a student
asks why the suite is red on a fresh clone, that's the answer.

## The week-4 debrief

Tool calling moved to [week 4](week-4-runbook.md) as a full build session, so this
is a debrief, not a lecture. Fifteen minutes, and the only thing you're fishing
for is **evidence**.

Ask for a table where the **workflow beat the graph** and have that person walk
it. That's the conversation worth having: in cohort 3 this argument was theory
in a video, and the honest position — for a clinic assistant with four known
jobs, the predictable, cheap, debuggable workflow is defensible — was something
they had to take on trust. Now they measured it.

**Don't sell either one.** If nobody found a case where the workflow won, that's
worth naming too, and it should make you curious rather than pleased.

Then move on. Scope triage is the real job this week.

## Scope triage — the actual job this week

Go around the room. One sentence: what are you building, on what data.

The failure patterns to catch, all of which appeared in cohort 3:

- **An idea with no data source named.** "A chatbot for legal documents" is not a
  plan. Push for the specific corpus and how they get it.
- **Too big.** Twenty news sources, a whole platform, a country of listings. Cut
  it in half in front of them, then in half again. Give them the phrase:
  *minimally usable product* — the smallest thing where a specific person would
  rather use it than not.
- **No freshness answer.** How does new data get in after the first load? If the
  corpus is genuinely static, that's a fine answer — but it has to be an answer.
- **Building the architecture before having the data.** The most common and most
  expensive error. Redirect hard: get twenty documents and *read them* first.

## Evals — the payoff for the logging

Twenty-five minutes, and open with the failure mode, directly:

> Someone builds a genuinely clever system entirely with an AI coding tool,
> deploys it, and it breaks in ways they cannot diagnose — no traces, no
> regression suite, no way to tell whether today's prompt edit fixed the thing or
> broke two others. The code was never the hard part.

Then make it concrete, because they already have the raw material:

1. **Their week-3 query log IS the eval set.** Three weeks of "keep this list"
   pays off here. Anyone who collected it is nearly done; anyone who didn't finds
   out now why it was asked for, and the honest instruction is to start today
   because reconstructing it later is miserable.
2. **Walk `lib/evals/retrieval.test.ts`** — a golden question, the documents that
   should come back, an assertion. That's the whole idea. A retrieval eval is not
   exotic; it's a test with fuzzy matching.
3. **Then `lib/evals/llm-judge.ts`** — when the correct answer can't be string-
   matched, you score it with a model. Be honest that this is a weaker
   instrument: the judge has its own failure modes, and you calibrate it by
   spot-checking its verdicts against your own.
4. **Run `npm run test:evals`** on screen.

The line to land: **an eval is how you find out a change helped.** Without one,
every prompt edit is a vibe and every regression is a surprise from a user.

## Security — poisoned documents

Twenty-five minutes, and it demos beautifully, so lead with the attack.

1. **`npm run security:poisoned`.** A document in the corpus contains
   instructions rather than information, gets retrieved as context, and the model
   follows them. Let the room watch it happen before you explain anything.
2. **Name why it works.** Retrieved text arrives in the same channel as your
   instructions. The model has no way to tell "content I was given" from "orders
   I was issued" unless you build that boundary.
3. **Tie it back to week 3's aggregator** — the `<retrieved-data>` tags. That was
   the first, weakest version of this boundary, and now they can see what it was
   for.
4. **Then defend it**: `lib/security/content-validator.ts`, and the deeper point
   that detection is a filter, not a fix. Defense in depth — validate on the way
   in, mark boundaries in the prompt, and don't give the model authority it
   doesn't need.

Best discussion hook: *"who can put a document in your corpus?"* For the clinic,
anyone who writes a note. For their capstone scraping public pages, **anyone on
the internet.**

## Discussion prompts

- *"What's the smallest version of your project that someone would actually use?"*
- *"How do you know your retrieval is good? What would tell you it got worse?"*
- *"What are you deliberately not building?"* → sets up the postmortem, and it's
  the question most students have never been asked.
- *"Who can put a document into your corpus?"* → the poisoned-docs question that
  matters most for a scraped capstone.
- *"Your eval passes. What does that actually prove?"* → good, uncomfortable.
  Lands on: it proves you didn't regress the cases you thought of.

## Homework to post

Build it. Design doc + postmortem. Presentation next Saturday, ~5 minutes.

Post the presentation outline **now**, not on the day — students who know the
format a week out prepare a talk instead of a tour:

1. What you built (demo or design or both)
2. High-level arch (vector DB, agents, evals, chunking)
3. What did you learn? Pitfalls? What to do differently, or cool new tech?
4. Q&A

**Only hard rule: keep it to ~5 minutes so there's room for questions.**

## Notes from cohort 3

- Attendance dips this week — people are heads-down. That's fine; it's a clinic.
  Record it anyway.
- The bonus voice-AI session ran midweek here (Retell, ~$25). Optional, well
  received, and a strong capstone differentiator for anyone whose project ends in
  "and then tell someone." Register link goes out separately.
- Push the postmortem framing early and repeatedly. Students default to writing a
  press release. The sentence that lands: *"a postmortem with no failures in it
  reads as 'I never stressed this.'"*
