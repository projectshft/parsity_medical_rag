# Homework: Your own system — find the data, write the plan, build it

**Needs: `OPENAI_API_KEY` + a vector store. Everything else depends on what you pick.**

> This is the **build-your-own** capstone track. The other track — [ship one extension to the medical system you already have](w5-04-wrap-up.md) — is smaller and completely legitimate. Pick one. The design doc and postmortem requirements are identical either way; this page covers the part that's different: choosing a problem and getting data for it.

You've spent this course building someone else's system on someone else's data. The data was handed to you: pre-loaded, clean-ish, already shaped like the lesson. That was on purpose — it let the energy go to retrieval and agents instead of ETL.

Real projects don't start there. They start with a pile of data nobody has made searchable yet, and the first hard question is *what pile*.

## Start with the data. Not the idea.

The instinct is to think of a product first and go looking for data that fits it. Do it the other way around. Find data you can actually get, in volume, and let it tell you what it's good for.

The reason is arithmetic. A semantic index over 40 documents is a demo — the nearest neighbour to any query is whatever you happened to have, and you can't tell good retrieval from bad. You need **enough documents that retrieval quality is a real question** — a few hundred at absolute minimum, and more is better. Ideas are free; corpora aren't. Get the corpus, then design.

The other reason: the data answers most of your design questions for you. "I have every Zillow listing in three ZIP codes" already implies who searches it, what metadata matters, and what a good answer looks like. Work in the opposite direction and you'll spend a week on an architecture for data you can't obtain.

## Where the data comes from

Four routes, roughly in descending order of how interesting the result tends to be.

| Route | What it's good for | The catch |
|---|---|---|
| **Data you already have** — work systems, your own notes/journals, exported chats, a club's archives | The most defensible projects. Nobody else has it, and you understand it. | Check what you're allowed to use. If it's your employer's, ask before it leaves their network. |
| **Scraping the web** — a site with structure and volume | Genuinely valuable. "Make this public corpus searchable by meaning" is a real business, not a toy. | Respect `robots.txt` and terms of service. Some sites actively fight scraping; pick one that doesn't. |
| **Media transcripts** — a creator's back catalogue, a podcast, conference talks | Big text volume from a small script. Transcripts chunk beautifully. | Same terms-of-service caveat. Auto-generated captions are noisy — read a few before committing. |
| **A published dataset** — Kaggle, Hugging Face | Fastest path to volume. Fine if you're stuck. | The least interesting option: pre-cleaned, and someone has already built the obvious thing on it. Use it if the alternative is not starting. |

Two scraping tools worth knowing, because they're built for exactly this job — they return **clean markdown instead of raw HTML**, so you skip the Cheerio/BeautifulSoup layer entirely and go straight to chunking:

- **[Firecrawl](https://www.firecrawl.dev/)** — hosted API, 1,000 pages/month free. You give it a URL or a search, it gives you LLM-ready markdown. Fastest thing to get working.
- **[Crawl4AI](https://github.com/unclecode/crawl4ai)** — open source (Apache 2.0), Python, self-hosted. Same output shape, no bill, more setup. If your scraping outgrows a free tier, this is where it goes.

And for transcripts: **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** with `--write-auto-subs --skip-download` pulls captions without touching the video.

Whatever you use, get a sample of **twenty documents first** and read them. Not the count — the actual text. Half of all data projects die because nobody looked at the data until after the pipeline was built.

## Scope: cut it in half, then cut it again

Whatever size you're picturing, it's too big. Two news sources, not twenty. Three ZIP codes, not a country. One creator's transcripts, not a platform.

The target isn't an MVP so much as a **minimally usable product** — the smallest thing where a specific person would rather use it than not. That's a much lower bar than "impressive," and it's the only bar that gets crossed in the time you have. You can always widen the crawl after it works; you cannot narrow a system you never got running.

## The plan doc

**Write this before you write code**, and post it for feedback. It's short — a page is fine.

Five sections:

1. **Data source.** What it is, how you get it, roughly how many documents, and one sentence on why you're allowed to use it.
2. **User flow.** Who asks what, and what comes back. Make it concrete with a worked example: *"User types `3-bed under $900k near a good school` → returns 5 listings ranked by fit, each with the line from the description that matched."* One example beats a paragraph of description.
3. **Vector store, chunking, metadata.** Which store. Whether the documents need chunking at all — and if so, your strategy and the joints you're cutting along. Which metadata fields you'll filter on, and why those.
4. **Keeping it fresh.** How new data gets in after the first load: manual re-run, nightly cron, on-demand. And how you avoid duplicates when the same document is scraped twice. (If your corpus is genuinely static — a finished book, a closed archive — say so. That's an answer.)
5. **Agent architecture.** Which agents, what each one does, and what they hand each other. A five-node diagram is worth more than three paragraphs.

**The test for whether the doc is done:** paste it into Claude or Cursor and say "build this." If the model has to ask you four clarifying questions before it can start, the doc isn't finished — and neither is your thinking. That's not a trick for generating the code; it's a check that the plan is specific enough to be executed by someone who wasn't in your head.

### Common mistakes in the plan

- **An idea with no data source named.** "A chatbot for legal documents" is not a plan; "the 4,300 opinions on CourtListener's bulk API for the 9th Circuit" is.
- **Skipping section 4.** Freshness is the section everyone leaves out and the one that separates a system from a script. A corpus you can't update is a screenshot.
- **Metadata chosen by reflex.** Every field you list should answer "what hard filter does a user actually want here?" Store fields you'll filter on; the rest is noise you pay to embed.
- **An architecture with more agents than the problem has steps.** Every hop costs latency and compounds error — 90% reliable, three hops deep, is 73%. Two good agents beat five speculative ones.

## What you build

The minimum bar, in addition to the retrieval that makes it work:

**One or two agents that do something.** The two easiest wins, both of which you've already built once here:

- **Agentic retrieval** — an agent that reshapes the user's question before searching, and decides *what* to search, rather than passing the raw string to a vector store.
- **Human-in-the-loop** — the system proposes an action and a person confirms it before anything happens. Booking, sending, filing, purchasing. If your project has any action at all, gate it.

**Observability, from the first day it runs.** LangSmith, wired the way you wired it here. Not at the end — you cannot debug a non-deterministic system from console logs, and the trace you need is always the one from before you added tracing.

**Evals.** At least one retrieval eval and one routing eval, in the shape you already have under `lib/evals/` (`npm run test:evals`). Start collecting the pairs *while you build*: every time you ask your system something and the answer is good, save the question and what made it good. That file becomes your eval set, and it costs nothing to keep while it's cheap and everything to reconstruct later.

The reason these two are non-negotiable is not academic. The failure mode is specific and common: someone builds a genuinely clever system entirely with an AI coding tool, deploys it, and it breaks in ways they cannot diagnose — no traces, no regression suite, and no way to tell whether today's prompt edit fixed the thing or broke two others. The code was never the hard part. Knowing whether a change helped is the hard part, and that's what these two buy you.

**Auth: last, and don't write it yourself.** If it's going on the public internet, put a hosted provider in front of it (Clerk, Auth0, whatever) as the final step before deploy. Do not let auth block the build, and do not let an unauthenticated LLM endpoint sit on the open web — people will find it, and you pay for every token they burn. Deploying at all is optional; a local demo is a perfectly good capstone.

## The written artifacts

Same as the other track — see [the wrap-up](w5-04-wrap-up.md) for the full shape:

- **The design doc** (your plan doc, updated to describe what you actually built, including where you diverged from the plan and why).
- **The postmortem** — what broke, what you changed and the number that told you to, what you deliberately didn't build.

The postmortem is the artifact that matters. Your plan doc is a prediction; the postmortem is the evidence of contact with reality. The gap between them is the whole story.

## The video (3–5 min, phone is fine)

Demo the thing, then defend one decision with a measurement — the chunking strategy, the metadata fields, whether reranking earned its cost. Close with one honest limitation: the query shape it handles badly, the eval you named but didn't write, the freshness problem you deferred.

A flawless happy-path demo with no numbers in it is a screen recording. The decision-with-a-number is the part that proves you built it.

```quiz
[
  {
    "q": "Why does this capstone insist you find the data before choosing the idea?",
    "options": [
      "Data collection takes longer than building, so it should start first",
      "Retrieval quality is only a real question at volume, and the data you can actually obtain determines what's buildable — ideas are free, corpora aren't",
      "Vector databases require a minimum document count to function correctly"
    ],
    "answer": 1,
    "explain": "A semantic index over 40 documents can't distinguish good retrieval from bad — the nearest neighbour is just whatever you happened to have. And the corpus answers most design questions for you: who searches it, what metadata matters, what a good answer looks like. Design-first means designing for data you may not be able to get."
  },
  {
    "q": "What's the test for whether your plan doc is finished?",
    "options": [
      "It covers all five required sections",
      "An AI coding tool can start building from it without asking four clarifying questions first",
      "It's under one page"
    ],
    "answer": 1,
    "explain": "The paste-it-into-Claude test isn't a shortcut for generating code — it's a check that the plan is specific enough to be executed by someone who wasn't in your head. If the model needs four clarifications, so would a teammate, and so will you in a week."
  },
  {
    "q": "Why are observability and evals required from the first day the project runs, rather than added at the end?",
    "options": [
      "They're much harder to retrofit into an existing codebase",
      "You can't debug a non-deterministic system from console logs, and the trace you need is always from before you added tracing — without them you can't tell whether a prompt edit helped or broke two other things",
      "Deployment platforms require trace data before accepting a build"
    ],
    "answer": 1,
    "explain": "The code was never the hard part; knowing whether a change helped is. A clever system with no traces and no regression suite breaks in ways its author cannot diagnose — and every prompt edit becomes a coin flip."
  }
]
```

## Further reading (optional)

- [Firecrawl](https://www.firecrawl.dev/) — hosted scrape-to-markdown, 1,000 pages/month free
- [Crawl4AI](https://github.com/unclecode/crawl4ai) — the open-source, self-hosted equivalent
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — transcripts without downloading video (`--write-auto-subs --skip-download`)
