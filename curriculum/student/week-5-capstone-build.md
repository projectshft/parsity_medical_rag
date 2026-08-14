# Week 5 — Capstone build

**Session:** Saturday · [recording posted in Slack]
**Needs:** whatever your project needs

The last working session. No new architecture — this one is for unblocking, and
for the one refactor that reframes everything you've built.

## What we covered

### The tool-calling refactor

Posted as a walkthrough video ahead of the session ([Loom](https://www.loom.com/share/5cce88f56dc7429fb5a861aaa23761b9), code in the Slack thread).

Everything you built routes with **code**: the selector returns booleans, the
route reads them, `if (plan.useSql)` calls the SQL agent. That's a **workflow** in
the *Building Effective Agents* vocabulary — routing plus conditional
parallelization.

The alternative is **tool calling**: hand the model a list of tools and let *it*
decide which to invoke, in a loop, until it's done. Same components, inverted
control.

Worth understanding, worth trying — and worth being skeptical about. What you give
up is predictability, cost control, and debuggability. What you gain is handling
requests you didn't anticipate. For a clinic assistant with four known jobs, the
workflow is defensible; that argument is exactly what the week-2 video asked you
to make. Now you can see both implementations and judge.

### Everything else was your project

Working session. Bring what's broken.

## The capstone

Two tracks — you picked one in your plan doc last week.

**Track A — extend the medical system.** One real addition, shipped and measured.
**Track B — build your own RAG system** on data you choose. Most people pick B.

Track A students: skip to [the artifacts](#the-written-artifacts). Track B
students, the rest of this page is for you.

---

## Track B: start with the data, not the idea

The instinct is to think of a product and then go looking for data that fits it.
Do it the other way around.

The reason is arithmetic. A semantic index over 40 documents is a demo — the
nearest neighbour to any query is whatever you happened to have, and you cannot
tell good retrieval from bad. You need **enough documents that retrieval quality
is a real question** — a few hundred at minimum. Ideas are free; corpora aren't.

The other reason: the data answers most of your design questions for you. "I have
every listing in three ZIP codes" already implies who searches it, what metadata
matters, and what a good answer looks like. Work the other direction and you'll
spend a week architecting for data you can't obtain.

### Where the data comes from

| Route | Good for | The catch |
|---|---|---|
| **Data you already have** — work systems, your own notes, exported chats, a club's archives | The most defensible projects. Nobody else has it and you understand it. | Check what you're allowed to use. If it's your employer's, ask before it leaves their network. |
| **Scraping** — a site with structure and volume | Genuinely valuable. "Make this public corpus searchable by meaning" is a real business. | Respect `robots.txt` and terms of service. Some sites fight scraping; pick one that doesn't. |
| **Media transcripts** — a creator's back catalogue, a podcast, conference talks | Big text volume from a small script. Transcripts chunk beautifully. | Same ToS caveat. Auto-captions are noisy — read a few first. |
| **A published dataset** — Kaggle, Hugging Face | Fastest path to volume. | Least interesting: pre-cleaned, and someone already built the obvious thing on it. Use it if the alternative is not starting. |

Two scraping tools worth knowing, because both return **clean markdown instead of
raw HTML** — you skip the Cheerio/BeautifulSoup layer entirely and go straight to
chunking:

- **[Firecrawl](https://www.firecrawl.dev/)** — hosted, 1,000 pages/month free. URL or search in, LLM-ready markdown out. Fastest thing to get working.
- **[Crawl4AI](https://github.com/unclecode/crawl4ai)** — open source (Apache 2.0), Python, self-hosted. Same output, no bill, more setup.

For transcripts: **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** with
`--write-auto-subs --skip-download` pulls captions without touching the video.

**Get twenty documents first and read them.** Not the count — the actual text.
Half of all data projects die because nobody looked at the data until after the
pipeline was built.

### Scope: cut it in half, then cut it again

Two news sources, not twenty. Three ZIP codes, not a country. One creator's
transcripts, not a platform.

The target is a **minimally usable product** — the smallest thing where a specific
person would rather use it than not. Much lower bar than "impressive," and the only
one that gets crossed in the time you have. You can widen the crawl after it works;
you cannot narrow a system you never got running.

### The floor

Whatever you build, these are not optional:

**One or two agents that do something.** The two easiest wins, both of which you
have already built once: **agentic retrieval** (an agent reshapes the question and
decides what to search, rather than passing the raw string to a vector store) and
**human-in-the-loop** (the system proposes, a person confirms, then it acts). If
your project has any action at all, gate it.

**Observability from the first day it runs.** LangSmith, wired the way you wired
it in week 3. Not at the end — the trace you need is always the one from before
you added tracing.

**Evals.** At least one retrieval eval and one routing eval. You already started
this: the query/response pairs from week 3 are your eval set. That's why you were
asked to log the bad ones.

The failure mode these prevent is specific and common: someone builds a genuinely
clever system entirely with an AI coding tool, deploys it, and it breaks in ways
they cannot diagnose — no traces, no regression suite, no way to tell whether
today's prompt edit fixed the thing or broke two others. The code was never the
hard part. Knowing whether a change helped is the hard part.

**Auth last, and don't write it yourself.** If it's going on the public internet,
put a hosted provider in front of it as the final step. Do not let auth block the
build — and do not leave an unauthenticated LLM endpoint on the open web; people
find them, and you pay for every token. Deploying at all is optional; a local demo
is a perfectly good capstone.

---

## The written artifacts

Both tracks, both documents.

### The design doc (one page)

Your plan doc, updated to describe what you actually built — including where you
diverged from the plan and why. Architecture and the *why*, not what the code
does:

- The two-engine split (or your equivalent) and why not one store
- One chunking decision, justified by the corpus — including "it needed none"
- One privacy or access decision and the alternative you rejected
- One thing you'd build differently starting over

### The postmortem (the real deliverable)

This is the credibility artifact. Not a summary — an honest account of contact
with a system that fought back:

- **What broke.** Real failures. A hybrid query that returned the wrong patient's
  notes. A reranker that didn't help. A response that almost leaked a real name.
  Name them.
- **What you changed, and the number that told you to.** *"I added one example to
  the selector prompt and routing accuracy went 84% → 92%."*
- **What you deliberately did not build, and why.** The eval you named but didn't
  write. The injection your defenses still miss. Naming what you chose not to do
  is the strongest signal of judgment in the document — it proves you saw the whole
  board and made calls.
- **What you'd do differently.**

A model can write your code. A model cannot write your postmortem, because it
wasn't the one who watched the system lie and decided what to do about it. That
asymmetry is the entire value of the document.

**A postmortem with no failures in it is a press release.** It reads as "I never
stressed this." The failures are the content.

## When it breaks

- **Scope panic on Wednesday.** Expected. Cut the feature, keep the measurement.
  A small thing you measured beats a large thing you demoed.
- **The corpus is smaller than you thought.** Widen the crawl or narrow the claim —
  but say which you did, in the postmortem.
- **You can't get the data at all.** Fall back to a published dataset and spend the
  saved time on the agent layer. Say so in the design doc; a documented fallback is
  a decision, not a failure.

## Check yourself

- You can state, in one sentence with a number, why one thing in your system is
  there.
- A stranger reading your postmortem can tell you *stressed* the system rather
  than assembled it.
