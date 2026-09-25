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

You need **Node 20+**, plus accounts on [Pinecone](https://pinecone.io),
[OpenAI](https://platform.openai.com) (or the class proxy key) and
[LangSmith](https://smith.langchain.com).

**We provide the database.** You get a connection string in Slack pointing at
your own private Neon branch of the course database — schema and all ~21k
clinical notes already in it. Nothing to create, nothing to load. It's yours and
it's writable, so you can break it.

```bash
git clone <repo-url> && cd parsity_medical_rag
npm install
cp .env.example .env      # paste your DATABASE_URL and keys — see the comments in that file
npm run setup             # builds the Prisma client, then checks every service
```

That's it. `npm run setup` is short now: `db:generate` (local codegen — it does
not touch the database) followed by `doctor`.

When something's wrong:

```bash
npm run doctor
```

It checks your Node version, `.env`, database, OpenAI key, Pinecone index and
optional services, and tells you which one is broken and how to fix it. Paste
its output into Slack if you're still stuck — it's far more useful than
"it doesn't work."

Expect one warning on day one: your Pinecone index is empty. That's correct —
you build it in week 1.

```bash
npm run dev               # http://localhost:3000
```

### Commands

| Command | What it does |
|---|---|
| `npm run setup` | First-time path: Prisma client + health check. |
| `npm run doctor` | Check every service; name what's broken. |
| `npm run db:reset` | Undo every write the agent made. Your week 4 undo button. |
| `npm run db:studio` | Browse your data in a UI. |
| `npm run vectorize` | Build your Pinecone index from your Postgres. `-- --limit 200` for a cheap slice. |
| `npm run similarity` | Embeddings playground — week 1. |
| `npm run test:run` | Unit tests + fast evals. No network, no cost. |
| `npm run test:evals` | LLM-as-judge evals. Real API calls. |

`db:reset` works without a seed file: nothing in this codebase ever issues a
`DELETE`, and every write records its previous value in `audit_log`, so the data
needed to restore your database is already in your database. It'll also tell you
if it finds a change with no audit trail — that's a bug in your write tool, and
week 4 explains why.

`db:push`, `db:seed` and `db:export-seed` also exist, but they're how *we* build
the course branch — see [docs/INSTRUCTOR-DB.md](docs/INSTRUCTOR-DB.md). You
won't need them unless your capstone uses its own data.

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
  medications, encounters, notes. One branch per student, provided.
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
  db/             reset (yours), seed + export (how the course branch is built)
  bible/          the week 1 chunking lab
  security/       the poisoned-document demo
docs/             the curriculum and the weekly challenges
visuals/          open visuals/index.html — vector search, chunking, reranking
```

---

## The data

The [Synthea Coherent Dataset](https://synthea.mitre.org/) — statistically
realistic and **fully synthetic**. Zero real people, zero PHI, so we get to
practise on medical data that's safe to break. ~200 patients and ~21k SOAP-style
clinical notes, already loaded in your branch.

---

## License

MIT — built for educational purposes with synthetic data.
