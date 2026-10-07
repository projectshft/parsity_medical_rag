# Model migration — why cohort 4 is still on 4o, and what moving costs

**Researched 2026-10-07. Decision: cohort 4 ships on `gpt-4o` / `gpt-4o-mini`.**
Migrate between cohorts, not a week before one starts.

This exists so the next person — including a future me — doesn't either redo the
research or "modernise" the model strings in an afternoon and break every agent
in the course.

## Don't go to GPT-5. It is already end-of-life.

| Model | Shutdown |
|---|---|
| `gpt-5-2025-08-07` | **2026-12-11** |
| `gpt-5-mini-2025-08-07` | **2026-12-11** |
| `gpt-5-nano-2025-08-07` | 2026-12-11 |
| `gpt-5-chat-latest`, `gpt-5-codex` | already gone (2026-07-23) |
| `gpt-5.1` | 2027-04-01 |

A six-week cohort starting mid-October would cross that December date. "Use 5"
was the obvious ask and it is the wrong target.

## The current line is GPT-6

| Model | Role |
|---|---|
| `gpt-6-astra` | most capable |
| `gpt-6.1-sol` | balanced intelligence/cost |
| `gpt-6-luna` | cost-efficient, high-volume |

The natural mapping for this repo would be `gpt-6-luna` for the high-volume
calls (selector, SQL, scheduling, graph tools) and `gpt-6.1-sol` for the
aggregator.

## Why it is not a string swap

**GPT-6 models are reasoning models and they reject `temperature` with a 400** —
`Unsupported parameter: 'temperature' is not supported with this model`. You set
`reasoning: { effort }` instead (`reasoning_effort` on Chat Completions), and the
supported levels differ per model: `gpt-6.1-sol` rejects `none` and `minimal` and
defaults to `medium`; `gpt-6-astra` rejects `none`.

That lands on six call sites and three different SDKs:

| Place | What breaks |
|---|---|
| `lib/agents/selector.ts` | `temperature: 0` on `responses.parse` |
| `lib/agents/sql.ts` | `temperature: 0` on `responses.parse` |
| `lib/scheduling.ts` | `temperature: 0` |
| `lib/agents/aggregator.ts` | AI SDK `streamText` — check what it sends by default |
| `app/api/chat/route.ts` | AI SDK provider call |
| `lib/graph.ts` | LangChain `ChatOpenAI` sets temperature itself |

And it reaches the curriculum, which is the expensive part: **`CLAUDE.md`
mandates `temperature: 0` in the structured-output pattern**, and students copy
that pattern when they write their own agents in weeks 3 and 4. Changing the
models means changing the pattern they are taught, the week-3 guide, and the
runbook — not just the strings.

### Caveats on that finding

The temperature rejection is reported consistently by several independent
projects, but it is **not** in OpenAI's own API reference, and Azure's reasoning
docs contradict it (listing `temperature` as supported for GPT-6, while also
saying reasoning models don't support it — the page disagrees with itself). Some
reports say Sol and Luna accept `temperature` when reasoning is explicitly
disabled. Verify with one live call before trusting any of it.

## Embeddings do not change

`text-embedding-3-small` at **1536 dimensions is still current** and is not
deprecated; `text-embedding-3-large` (3072) is the other third-generation option.
This is the good news, because changing the embedding model would mean
re-embedding ~21k notes, resizing the Pinecone index, and resizing every Qdrant
collection in the Bible lab. Week 1 is untouched.

## What makes cohort 4 safe as-is

Everything uses the **bare aliases** `gpt-4o` and `gpt-4o-mini` — verified, no
dated snapshots pinned anywhere. That matters: `gpt-4o-2024-05-13` shuts down
**2026-10-23**, and a pinned snapshot would have died mid-cohort. The aliases
follow OpenAI's current default snapshot, so they don't.

Neither `gpt-4o` nor `gpt-4o-mini` appears in the deprecation list. OpenAI also
doesn't positively confirm `gpt-4o-mini`'s availability on that page, so this is
"not deprecated" rather than "guaranteed for a year" — fine for six weeks.

**If you ever pin a snapshot, check it against the deprecations page first.** The
alias is what is protecting the course right now.

## The migration, when you do it

1. One live call first, on a real key, to settle the `temperature` question for
   the exact models you pick. Everything else depends on the answer.
2. Centralise the model ids. Right now they're inline string literals in six
   files; a single `lib/models.ts` makes the next migration one edit instead of
   six, and makes it greppable.
3. Strip `temperature` and add `reasoning: { effort }` per call site. The
   selector and SQL agent want low effort (they're routing and schema work, not
   analysis); the aggregator can afford more.
4. Check what the AI SDK and LangChain send on your behalf — both set parameters
   you didn't write, which is exactly how this bites.
5. Update `CLAUDE.md`'s mandated pattern, then the week-3 student guide and
   runbook, then grep the curriculum for `gpt-4o`.
6. Re-run `npm run test:run`, `npx tsc --noEmit`, `npm run build`, and at least
   one real `/api/chat` request per route — the unit tests mock the provider, so
   they will pass against a model that 400s in production.
