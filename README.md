# Medical RAG — Cohort 4

> **Start here:** [docs/WHAT-WERE-BUILDING.md](docs/WHAT-WERE-BUILDING.md) — what
> we're building and why, in two minutes.
> **Then:** [docs/CURRICULUM.md](docs/CURRICULUM.md) — the six-week plan.

## The problem

You've joined a medical clinic as an engineer. There are ~200 patients, their
diagnoses, medications and lab results — and about 21,000 free-text clinical
notes written by doctors at every visit.

Half that data is unreachable. Diagnoses and lab values got columns, so SQL
answers "how many patients have diabetes?" in milliseconds. But the *story* of
each visit only ever got written into the notes. There is no "short of breath"
column, and searching for the phrase returns nothing, because the doctor wrote
*"dyspnea on exertion."* Same fact, zero shared words. The database matches
**letters**; the question was about **meaning**.

Over six weeks you build an assistant that reaches the other half — and then
acts on it.

---

## Setup

You need **Node 20+** and accounts on [Neon](https://neon.com),
[Pinecone](https://pinecone.io), [OpenAI](https://platform.openai.com) (or the
class proxy key) and [LangSmith](https://smith.langchain.com).

**Everything is yours this cohort** — your own database, your own indexes. Break
whatever you like; `npm run db:reset` puts it back.

```bash
git clone <repo-url> && cd parsity_medical_rag
npm install
cp .env.example .env      # then fill it in — see the comments in that file
npm run setup             # creates your tables, loads the dataset, checks everything
```

`npm run setup` runs four things in order: `db:generate` (builds the Prisma
client locally), `db:push` (creates the tables in **your** Neon database),
`db:seed` (loads ~200 patients and ~21k notes), and `doctor`.

When something's wrong:

```bash
npm run doctor
```

It checks your Node version, `.env`, database, OpenAI key, Pinecone index and
optional services, and tells you which one is broken and how to fix it. Paste
its output into Slack if you're still stuck — it's far more useful than
"it doesn't work."

Then:

```bash
npm run dev               # http://localhost:3000
```

### Commands

| Command | What it does |
|---|---|
| `npm run setup` | The whole first-time path. Run this once. |
| `npm run doctor` | Check every service; name what's broken. |
| `npm run db:push` | Create/update tables in your database. |
| `npm run db:seed` | Load the course dataset. Safe to re-run. |
| `npm run db:reset` | Wipe and reseed. Your undo button. |
| `npm run db:studio` | Browse your data in a UI. |
| `npm run vectorize` | Build your Pinecone index from your Postgres. `-- --limit 200` for a cheap slice. |
| `npm run similarity` | Embeddings playground — week 1. |
| `npm run test:run` | Unit tests + fast evals. No network, no cost. |
| `npm run test:evals` | LLM-as-judge evals. Real API calls. |

Scripts run on [`tsx`](https://tsx.is), so they work on any Node 20+ without
`ts-node` configuration.

---

## The six weeks

| Week | Topic | You build |
|---|---|---|
| 1 | **Vector stores** | Embeddings, metadata design, your own index |
| 2 | **Retrieval + evals** | Filters, reranking, and a golden set that proves it works |
| 3 | **Tool calling** | The workflow and the agent, measured against each other |
| 4 | **Human in the loop** | Scheduling, and non-destructive writes to patient records |
| 5 | **Evals + security** | A suite you'd gate a deploy on; prompt injection and PII |
| 6 | **LangGraph + demos** | Refactor onto a framework; ship your capstone |

Each week has a challenge doc in `docs/CHALLENGE-0*.md` and one short video due
to Slack. The code is the easy half — the reasoning is the assignment.

---

## Architecture

- **Neon Postgres** — the system of record. Patients, conditions, observations,
  medications, encounters, notes.
- **Pinecone** — a *derived* index over the clinical notes. Rebuildable at any
  time with `npm run vectorize`.
- **Prisma** — type-safe database access.
- **Next.js 15** — the app, and the API routes that hold the pipeline.

The chat pipeline lives in `lib/agents/`, one file per agent, orchestrated by
`app/api/chat/route.ts`. See [CLAUDE.md](CLAUDE.md) for the conventions that
apply when you're writing code here.

```
lib/
  agents/         selector, sql, rag, aggregator — the pipeline
    read-only.ts  the guard on LLM-authored SQL
  evals/          golden set + LLM-as-judge
  security/       content validation
  pii.ts          de-identification (week 5 — currently stubs)
scripts/
  db/             seed, reset, export (your database)
  bible/          the week 1 chunking lab
  security/       the poisoned-document demo
docs/             the curriculum and the weekly challenges
visuals/          open visuals/index.html — vector search, chunking, reranking
```

---

## The data

The [Synthea Coherent Dataset](https://synthea.mitre.org/) — statistically
realistic and **fully synthetic**. Zero real people, zero PHI, so we get to
practise on medical data that's safe to break.

---

## License

MIT — built for educational purposes with synthetic data.
