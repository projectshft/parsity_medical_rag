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
- [ ] Record the tool-calling refactor walkthrough **ahead of time** and post it —
      cohort 3 did this as a Loom and it worked better than teaching it live,
      because it's a compare-two-implementations thing people need to pause and
      scrub.
- [ ] Have the data-sourcing tools ready to demo: Firecrawl, Crawl4AI, yt-dlp.

## The arc

| Time | What | Notes |
|---|---|---|
| 0:00 | **Tool-calling refactor** | 20 min. They watched the video; this is Q&A + the tradeoff argument. |
| 0:25 | **Scope triage, out loud** | Go round the room: one sentence each on what they're building. Cut what's too big, publicly and kindly. |
| 0:50 | **Data sourcing demo** | Firecrawl live on a site someone names. Show markdown-not-HTML. |
| 1:10 | **The non-negotiables** | Observability + evals. Tie back to the week-3 query log. |
| 1:25 | **Clinic** | Open floor. Screen shares, unblocking. |

## The tool-calling conversation

The refactor inverts control: instead of `if (plan.useSql)`, hand the model a tool
list and let it loop.

**Don't sell it.** Present both and let them argue. The honest position — and the
one that holds up — is that for a clinic assistant with four known jobs, the
workflow is defensible: predictable, cheap, debuggable. Tool calling wins when
you can't enumerate the requests in advance.

This closes the loop on the week-2 reading and the week-3 video. Several cohort 3
students had already argued this well in their videos; **call them out by name and
let them make the case.** It lands differently from a peer.

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
