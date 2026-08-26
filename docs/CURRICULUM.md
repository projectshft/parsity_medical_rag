# Cohort 4 — the plan

Six weeks. Six live sessions, ~2.5 hours each. This document is the teaching
plan: what happens in each session, what's due, and what we deliberately cut.

The short version of what changed since Cohort 3: **fewer topics, gone into
deeper**, evals as a spine instead of an afterthought, and everyone owns their
own database so a write is something you can actually practise.

---

## What we cut, and why

Every one of these is a judgement made from watching Cohort 3 happen, not a
guess. Together they free roughly four hours of live time.

| Cut | Time it ate in Cohort 3 | Why it goes |
|---|---|---|
| **Building an MCP server** | ~90 min of session 4, mostly failed | Node-version and `ts-node` resolution errors ate the session and most people never saw it work. It's also not a skill that pays: you consume MCP servers far more often than you write one. Replaced by a 10-minute explainer in week 6 — see [MCP-NOTE.md](MCP-NOTE.md). |
| **Retell / voice-AI agent** | a bonus session outside the six weeks | Fun demo, no transferable concept that tool calling doesn't already teach. Gone from the repo. |
| **Environment setup during class** | ~75 min of session 1, recurring after | Now pre-work, with `npm run doctor` naming the broken thing instead of twenty people screen-sharing in turn. |
| **Bulk `vectorize` of 21k notes live** | ~45 min of session 1 | Still done in week 1, but on `--limit 200` in class and the full run in the background. Nobody watches a progress bar together. |
| **Hand-rolled streaming + `X-Scheduling-Action` header** | ~25 min of session 3, called "black magic" on the recording | The header hack taught us nothing about agents. Week 4 sends a normal JSON response for the confirm card and keeps streaming for prose. |
| **Deep prompt-injection module** | had a whole slot | Compressed to a 40-minute live demo in week 5. One poisoned document, watched hijacking the answer, then defended. That's the lesson; the rest was surface area. |
| **The `traced()` / `tracedChild()` wrappers** | dead code | `wrapOpenAI()` already traces everything. Deleted. |
| **The Prisma schema pasted into the SQL prompt** | quiet correctness bug | It went stale the moment anyone touched the models. Replaced with a short summary and a pointer at `information_schema`. |

## What we added

- **Your own database.** `npm run db:push && npm run db:seed`. No shared
  read-only connection string.
- **Evals from week 2**, not week 6. Every architecture decision after week 2
  gets defended with a number.
- **Tool calling as a real week**, built against the workflow so students can
  measure which one wins on their own data.
- **Non-destructive write actions** — soft delete, follow-up flags, an audit
  log. The first time the agent changes something.
- **LangGraph**, half of week 6, as a refactor of code students already wrote.

---

## The spine

Weeks 1–2 build retrieval. Week 2 also builds the **golden set** — 20 questions
with known-correct answers. From then on, every change is judged against it:

> *No metric, no decision.* If a week has you choosing something — chunk size,
> reranker, model, workflow vs. agent — you produce the number that justifies
> the choice. "It feels better" is not an answer, and by week 3 it stops being
> accepted.

That's also what makes the capstone defensible in an interview. Anyone can say
they built a RAG app. Almost nobody can say what its recall@10 was before and
after they added reranking.

---

## Week 0 — before the first session (async, ~40 min)

Everything that used to eat session 1.

1. Accounts: [Neon](https://neon.com), [Pinecone](https://pinecone.io),
   [OpenAI](https://platform.openai.com) (or the class proxy key),
   [LangSmith](https://smith.langchain.com).
2. `git clone` → `npm install` → `cp .env.example .env` → fill it in.
3. `npm run setup` — generates the Prisma client, creates the tables in **your**
   Neon database, loads the dataset, then runs the doctor.
4. `npm run doctor` until it's green. Paste the output in Slack if it isn't.

**The bar for session 1:** `npm run doctor` prints green for node, .env,
postgres and openai. Pinecone will warn that your index is empty — that's
correct, you build it in class.

---

## Week 1 — Vector stores: embeddings, chunking, your own index

**The question:** half the clinic's data is in free text and SQL can't reach it.
What makes text searchable by *meaning*?

| Time | What |
|---|---|
| 0:10 | Doctor check. Anyone red gets fixed now or paired off. |
| 0:20 | What RAG actually is. Ask Claude a question about your patients; watch it have no idea. Retrieval is the fix, and it has nothing to do with vector databases yet. |
| 0:35 | Embeddings by intuition — `npm run similarity`. Everyone writes their own query and candidate list and argues with the scores. |
| 0:20 | Dimensions (512 / 1536 / 3072), the one-way-door problem, and why we pick 1536. Cosine similarity, using `visuals/index.html`. |
| 0:25 | **Metadata design, as a group.** What goes in the vector, what stays in SQL, and the question that decides it: who is going to query this and how? |
| 0:30 | Build `scripts/vectorize.ts` together. Run it with `--limit 200`. Look at the vectors in the Pinecone console. |
| 0:10 | Kick off the full run in the background. Homework. |

**Homework:** [CHALLENGE-01-CHUNKING.md](CHALLENGE-01-CHUNKING.md) — chunk the
KJV into your own Pinecone index. Strategy is yours; the reasoning is the
assignment.

**Video (2–3 min):** what chunking is, the strategy you chose and why, what
sentence overlap buys you.

---

## Week 2 — Retrieval that works: filters, reranking, and your first eval

**The question:** the search returns *something* for every query. How do you
know it's returning the right thing?

| Time | What |
|---|---|
| 0:15 | Chunking debrief. Two or three strategies compared out loud. |
| 0:30 | Build `searchClinicalNotes`: embed the query, `topK`, and the `includeMetadata` gotcha that makes results look useless. |
| 0:20 | Metadata filtering. "Tell me about Avery Mueller" returns *a different Avery* — watch semantic search fail at an exact-match job, then fix it with a `patientId` filter. |
| 0:30 | Over-fetch and rerank. Cross-encoders: why reading the query and document *together at query time* beats two embeddings made before the query existed. Fetch 100, keep 10. |
| 0:40 | **Build the golden set.** 20 questions with known answers, from the data. Measure recall@10 with and without reranking. Get a number on the board. |
| 0:15 | LangSmith: `wrapOpenAI` and one line in `.env`. Look at a trace. |

This is the session that changes the rest of the course. Cohort 3 argued about
whether reranking helped; they never measured it, so the argument had nowhere
to land. This time the answer is a number by the end of the session.

**Homework:** [CHALLENGE-02-RETRIEVAL-EVAL.md](CHALLENGE-02-RETRIEVAL-EVAL.md) —
grow the golden set, run it against both your medical index and your bible
index, find one query where reranking demonstrably reorders the answer.

**Video (3–4 min):** what reranking is, why you over-fetch, and *your*
before/after number.

---

## Week 3 — Structured outputs, then workflow vs. tool calling

**The question:** who decides what runs — your code, or the model?

| Time | What |
|---|---|
| 0:30 | Structured outputs. Zod + `responses.parse` + `zodTextFormat`. Why the schema's `.describe()` strings do more work than the system prompt. |
| 0:25 | The selector as a **router**: `{ useSql, useRag, needsSearch }`. Wire it to the SQL and RAG agents running in parallel, then an aggregator that streams. This is a workflow — fixed code paths, an LLM at each node. |
| 0:40 | **The pivot.** Same capabilities, handed over as *tools*: `search_notes`, `run_sql`, `get_patient`. Let the model loop. Build it next to the workflow, not instead of it. |
| 0:30 | Run both against the week-2 golden set. Compare accuracy, token cost, latency, and how easy each is to debug in LangSmith. |
| 0:25 | When a workflow wins. The compounding-error argument (0.9⁵ ≈ 0.59), the privacy boundary you lose when the model decides when to search, and Anthropic's *Building Effective Agents* vocabulary. |

**Homework:** [CHALLENGE-03-TOOL-CALLING.md](CHALLENGE-03-TOOL-CALLING.md) —
finish both paths, run the golden set against each, write up which won and why.

**Video (3–4 min):** tool calling vs. workflow for *this* project, defended with
your numbers and one tradeoff. "Agents are the future" is a failing answer.

---

## Week 4 — Human in the loop, and letting the agent write

**The question:** the agent has been read-only all course. What has to be true
before it can change a patient record?

| Time | What |
|---|---|
| 0:20 | Human-in-the-loop as a pattern. Where the confirm step goes, and why the model proposes rather than acts. |
| 0:30 | Scheduling: intent extraction → a confirm card → the user clicks → `/api/schedule` calls Cal.com. A plain JSON response, no header smuggling. |
| 0:45 | **Write tools.** `flag_patient_for_follow_up`, `soft_delete_note`, `update_patient_contact`. Every one: reversible, audited, confirmed. Nothing in this codebase issues a `DELETE`. |
| 0:20 | Why your database being writable moved the safety boundary into `lib/agents/read-only.ts`. Read the guard, then try to get past it. |
| 0:20 | The two-write problem: retracting a note means Postgres **and** Pinecone. Do one and the note stays searchable. What order, and what happens when the second write fails? |
| 0:15 | Capstone kickoff — the design doc, due end of week. |

**Homework:** [CHALLENGE-04-WRITE-ACTIONS.md](CHALLENGE-04-WRITE-ACTIONS.md) —
one more write action of your own design, plus an eval that proves the model
cannot write without a human confirming. **Capstone design doc due.**

**Video (3–4 min):** the write action you added, and one thing you would never
let an agent do without a human.

---

## Week 5 — Evals for real, and a short security pass

**The question:** you're about to change a prompt. How do you know you didn't
break the other nineteen answers?

| Time | What |
|---|---|
| 0:20 | The three kinds, and when each is the right tool: **assertion** evals (hypertension → exactly 63), **retrieval** evals (recall@k, MRR), **judge** evals (faithfulness, completeness). |
| 0:30 | LLM-as-judge properly: writing the rubric, and then calibrating the judge against answers you've already graded by hand. A judge you haven't checked is a random number generator with good manners. |
| 0:30 | Run the whole suite. Break a prompt on purpose. Watch it go red. Fix it. This loop is the deliverable. |
| 0:20 | Cost and latency as first-class metrics. Reading them out of LangSmith. Regression runs in CI. |
| 0:40 | **Security, compressed.** Put a poisoned note in your index, watch it hijack an answer, then defend it: context boundaries, `lib/security/content-validator.ts`, and why output validation matters too. Then PII — the front-office channel and why regex de-identification is imperfect *by design*. |

**Homework:** [CHALLENGE-05-EVALS-SECURITY.md](CHALLENGE-05-EVALS-SECURITY.md) —
30+ cases green in CI, and a one-paragraph postmortem on a real failure your
evals caught. Capstone build continues.

**Video (3–4 min):** demo your eval suite catching a regression you introduced.

---

## Week 6 — LangGraph, and demos

| Time | What |
|---|---|
| 0:10 | What MCP is and when you'd expose one — [MCP-NOTE.md](MCP-NOTE.md). No server built. |
| 0:60 | **LangGraph.** Refactor week 3's tool-calling loop into a graph: nodes, edges, shared state, checkpointing, and `interrupt()` for the human-in-the-loop step you hand-rolled in week 4. Same behaviour, framework version. Then the honest part: what the framework gave you, and what it cost in indirection and debuggability. |
| 0:70 | Capstone demos. |

**Deliverable:** the capstone, and a repo you'd hand an interviewer.

---

## Capstone

Same shape as Cohort 3, which worked. Design doc first, build second.

- **End of week 4** — design doc in Slack. Data source, general user flow, vector
  DB + chunking + metadata strategy, how the data stays fresh, agent
  architecture. Short is fine. The test: could you paste it into Claude and get
  a sane build plan out?
- **Weeks 5–6** — build.
- **Week 6** — demo.

**Required in every capstone:** observability (LangSmith), an eval suite with a
golden set, and either agentic RAG or a human-in-the-loop action. Everything
else is yours.

Start with the data. If you don't have a dataset you find interesting, you don't
have a project yet — see the tools listed in
[CHALLENGE-06-CAPSTONE.md](CHALLENGE-06-CAPSTONE.md).

---

## Standing structure

- **Weekly video** to the class Slack channel, publicly. The Feynman technique
  is the point: if you can't explain it on camera, you don't have it yet. The
  code is the easy half.
- **Office hours** Thursdays. Can't make it? Submit the question async and get
  a recorded answer.
- **Guest speakers** roughly monthly, chosen for disagreeing with the
  instructor.
