# Week 5 Runbook — Capstone build

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
      found the workflow winning is worth three minutes of the room's time.
- [ ] Have the data-sourcing tools ready to demo: Firecrawl, Crawl4AI, yt-dlp.

## The arc

| Time | What | Notes |
|---|---|---|
| 0:00 | **Week-4 debrief** | 15 min. Their comparison tables — where did the graph win, where did the workflow? Short, and it's a warm-up, not a lecture. |
| 0:20 | **Scope triage, out loud** | Go round the room: one sentence each on what they're building. Cut what's too big, publicly and kindly. |
| 0:50 | **Data sourcing demo** | Firecrawl live on a site someone names. Show markdown-not-HTML. |
| 1:10 | **The non-negotiables** | Observability + evals. Tie back to the week-3 query log. |
| 1:25 | **Clinic** | Open floor. Screen shares, unblocking. |

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

## The non-negotiables, and why to insist

Observability and evals. Ten minutes, and be direct about the failure mode:

> Someone builds a genuinely clever system entirely with an AI coding tool,
> deploys it, and it breaks in ways they cannot diagnose — no traces, no
> regression suite, no way to tell whether today's prompt edit fixed the thing or
> broke two others. The code was never the hard part.

Tie it straight back to the week-3 query/response log: **that's their eval set.**
If they collected it, this is nearly free. If they didn't, this is the moment they
find out why it was asked for — and the honest instruction is to start now, because
it's cheaper than reconstructing later.

## Discussion prompts

- *"What's the smallest version of your project that someone would actually use?"*
- *"How do you know your retrieval is good? What would tell you it got worse?"*
- *"What are you deliberately not building?"* → sets up the postmortem, and it's
  the question most students have never been asked.

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
