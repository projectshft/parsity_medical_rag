# Week 6 — LangGraph, and your capstone

Two tracks: a refactor that exposes you to an agent framework, and the project
you demo.

---

## Part 1 — Refactor into LangGraph

You already wrote a tool-calling loop by hand in week 3. You wrote the loop, the
tool dispatch, the state passing, and the human-confirm step in week 4. Now
build the same thing on a framework and see what you get and what you give up.

`@langchain/langgraph` is already installed.

### The mapping

| Yours | LangGraph |
|---|---|
| The `while` loop over tool calls | the graph's own execution |
| Passing results between agents by hand | shared `State`, reduced per node |
| `if (plan.useSql)` | a conditional edge |
| Your confirm card round-trip | `interrupt()` + a checkpointer |
| Conversation history you sliced to 5 | state that persists across turns |

### Do this

1. Model your state — messages, retrieved notes, the plan, any pending proposal.
2. One node per thing you already have: `select`, `runSql`, `runRag`,
   `aggregate`.
3. Conditional edges for routing, so the graph decides where to go next.
4. Add a checkpointer, then use `interrupt()` for the week-4 human confirmation.
   This is where the framework earns its money — you hand-rolled a whole
   round-trip for that, and it's a built-in.
5. **Run your golden set against it.** Same behaviour, or did the refactor break
   something? You have the tooling to know; use it.

### Then be honest about it

Half a page in the repo:

- What did the framework genuinely give you? (checkpointing, resumability,
  streaming state, a graph you can draw)
- What did it cost? (a dependency, indirection, stack traces through someone
  else's abstraction, another set of docs to track)
- Would you use it for the capstone? For work? Where's the line?

There's no house answer. Frameworks are a real trade and you're now one of the
few people who has built it both ways and can say so.

### Reading

- [LangGraph.js docs](https://langchain-ai.github.io/langgraphjs/)
- [LangGraph — human-in-the-loop](https://langchain-ai.github.io/langgraphjs/concepts/human_in_the_loop/)

---

## Part 2 — The capstone

**Design doc was due end of week 4. Build is weeks 5–6. Demo is week 6.**

### Start with the data

If you don't have a dataset you find interesting, you don't have a project yet.
Spend your time here, not on picking a framework.

Where to look:

- **Your own work** — if you can get permission, this is the highest-value
  option by a distance. Build it in a lower environment, show a screen recording
  rather than the repo if that's what compliance requires.
- **Scrape it** — [Firecrawl](https://firecrawl.dev) (paid, has a free tier,
  returns clean markdown) or [Crawl4AI](https://github.com/unclecode/crawl4ai)
  (open source, more setup, far cheaper at volume).
- **Transcripts** — [yt-dlp](https://github.com/yt-dlp/yt-dlp) pulls YouTube
  transcripts. A past student vectorised 10,000 transcripts from creators he
  followed and asked them questions. Simple, clever, demos well.
- **Existing datasets** — [Hugging Face](https://huggingface.co/datasets) or
  [Kaggle](https://kaggle.com). The least interesting option, but you'll still
  learn plenty cleaning it up.

You need real volume. A few hundred documents is the floor.

### The design doc

Short. The test is whether you could paste it into Claude and get a sane build
plan back.

1. **Data source** — what it is, how you get it, roughly how much.
2. **General user flow** — a user types X, gets back Y. Two or three concrete
   examples with the actual expected output.
3. **Vector DB, chunking, metadata** — which store, how you split, what you'd
   filter on. (Consider [Qdrant](https://qdrant.tech) if you need complex
   metadata filters with `and`/`or`; its visualiser is also genuinely useful.
   Otherwise Pinecone is fine.)
4. **Keeping it fresh** — a static import is fine to start. Then what? Nightly
   cron? On demand? How do you dedupe? What if a source document *changes*?
5. **Agent architecture** — workflow or tool calling, which agents, what tools.

Post it in Slack and tag the instructor. Earlier is better — the feedback loop
is the point.

### Required, whatever you build

- **Observability.** LangSmith wired up.
- **Evals.** A golden set and a suite. Not optional — this is the thing that
  separates your project from a demo.
- **Either agentic RAG or a human-in-the-loop action.** Both if it fits.

### Not required

Auth and deployment. If you *do* deploy publicly, put auth in front of it —
use Clerk or Auth0, don't roll your own — because an open endpoint on your API
key is someone else's free LLM. Do it last, and don't let it block the build.

### Scope

Whatever you're picturing, halve it. Two news sources, not twenty. One city's
listings, not the country. Minimum *usable* product: what's the smallest thing
someone would actually get value from?

Then, if the goal is interviews, over-engineer one dimension deliberately — the
eval suite, the agent architecture, the ingestion pipeline — and be able to talk
about it in depth. Depth in one place beats breadth in five.

## The demo (week 6)

Five minutes. What it does, one thing that surprised you, and one number from
your evals.
