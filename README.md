# Medical RAG: AI-Powered Patient Records

> **Start here:** [docs/WHAT-WERE-BUILDING.md](docs/WHAT-WERE-BUILDING.md) — what we're building and why, in two minutes.

## The Challenge

You're building an AI assistant for healthcare providers. Doctors need to quickly find patient information across thousands of records—but the data is messy:

- **Structured data**: Names, dates, diagnoses, medications, lab values
- **Unstructured data**: Clinical notes written by doctors in free-form text

Traditional search fails because:
- Keyword search for "breathing problems" misses notes about "dyspnea" or "shortness of breath"
- SQL queries can't understand natural language like "patients who might have heart issues"
- LLMs don't know your private patient data

**Your mission**: Build a Retrieval-Augmented Generation (RAG) system that combines the precision of SQL with the semantic understanding of vector search.

---

## What You'll Build

```
┌─────────────────────────────────────────────────────────────┐
│                       User Query                             │
│     "Find diabetic patients with notes about foot pain"      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Selector (LLM)  lib/agents/selector.ts      │
│          Routes only: { useSql, useRag, useScheduler }       │
└─────────────────────────────────────────────────────────────┘
                    │                         │
         structured │                         │ semantic
                    ▼                         ▼
┌─────────────────────────┐       ┌─────────────────────────┐
│   PostgreSQL (Neon)      │       │     Pinecone Vectors    │
│   Structured Data        │       │     Clinical Notes      │
│                          │       │                         │
│  • patients              │       │  • Embeddings           │
│  • conditions            │       │  • Semantic search      │
│  • medications           │       │  • patient_id filter    │
│  • lab results           │       │                         │
└─────────────────────────┘       └─────────────────────────┘
                    │                         │
                    └────────────┬────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│             Aggregator (LLM)  lib/agents/aggregator.ts       │
│    Grounds the answer in what came back — and streams it     │
└─────────────────────────────────────────────────────────────┘
```

In week 4 you build the same thing a second way: hand the model the tools and
let *it* choose, on `/api/chat-graph`, then compare the two on your own
questions.

---

## 6-Week Curriculum

| Week | Topic | What You'll Build | Homework |
|------|-------|-------------------|----------|
| 1 | **Intro to RAG + ingestion** | Embeddings, metadata design, vectorize the 21k notes into Pinecone | [CHALLENGE-CHUNKING.md](docs/CHALLENGE-CHUNKING.md) |
| 2 | **Retrieval & reranking** | `searchClinicalNotes`, `/api/search`, two-stage retrieval | [CHALLENGE-NOTE-INGEST.md](docs/CHALLENGE-NOTE-INGEST.md) |
| 3 | **The agent pipeline** | selector → SQL ‖ RAG → aggregator, plus human-confirmed scheduling | [CHALLENGE-TOOL-CALLING.md](docs/CHALLENGE-TOOL-CALLING.md) |
| 4 | **Tool-calling & LangGraph** | The model picks the tools instead of your `if` statements | [CHALLENGE-LANGGRAPH.md](docs/CHALLENGE-LANGGRAPH.md) |
| 5 | **Evals, security & capstone build** | Your query log becomes a test suite; then break the system with a poisoned document and defend it | [CHALLENGE-POISONED-DOCS.md](docs/CHALLENGE-POISONED-DOCS.md) |
| 6 | **Demo day** | Present what you built — 5 minutes, one decision defended with a number | — |

Your capstone runs alongside weeks 5–6: you pick the data, scope it down, and build it. The plan is due in week 4.

---

## Quick Start

You need **Node 20** (not 22 or 24 — later versions break `ts-node` on the scripts in `scripts/`) and your own free [OpenAI](https://platform.openai.com) and [Pinecone](https://pinecone.io) keys. The database is **provided, read-only** — already loaded, you just connect to it.

```bash
git clone <repo-url> && cd medical-rag
npm install
cp .env.example .env
```

Open `.env` and paste in these three values:

```
DATABASE_URL="<shared in class — a read-only connection string, paste it as-is>"
OPENAI_API_KEY=sk-...      # your own
PINECONE_API_KEY=...       # your own
```

Then:

```bash
npm run db:generate   # builds the DB client (local codegen — does NOT touch the database)
npm run dev           # open http://localhost:3000
```

That's it. The Postgres database is read-only and already loaded, so **don't** run `db:push` (it'll fail, and there's nothing to load). Browse the tables anytime with `npm run db:studio`.

Your **Pinecone** index is yours, though — `npm run vectorize` builds it from the notes in Postgres. That's week 1.

---

## Project Structure

```
medical-rag/
├── app/
│   ├── page.tsx                  # Chat UI (pre-built, intentionally plain)
│   └── api/
│       ├── chat/route.ts         # W3: THE ORCHESTRATOR — selector → sql ‖ rag → aggregator
│       ├── chat-graph/route.ts   # W4: the tool-calling channel (LangGraph)
│       ├── search/route.ts       # W2: raw vector search, for poking at retrieval
│       └── schedule/route.ts     # W3: Cal.com booking (human-confirmed)
├── lib/
│   ├── agents/
│   │   ├── selector.ts           # W3: routes — { useSql, useRag, useScheduler }. Nothing else.
│   │   ├── sql.ts                # W3: text-to-SQL. The LLM writes the query.
│   │   ├── rag.ts                # W3: semantic search → context block
│   │   └── aggregator.ts         # W3: the ONLY streamer (provided)
│   ├── graph.ts                  # W4: the tool-calling graph
│   ├── vector-search.ts          # W2: Pinecone query + rerank
│   ├── pinecone.ts               # W1: index + upsert (MedicalChunk lives here)
│   ├── openai.ts                 # the ONE place we configure OpenAI (+ LangSmith)
│   ├── reranker.ts               # W2: two-stage retrieval
│   ├── scheduling.ts             # W3: intent detection → proposed action
│   ├── calendar.ts               # W3: Cal.com adapter
│   ├── patients.ts               # findPatientByName — scheduling's one exact lookup
│   ├── langsmith.ts              # W3: tracing config (the switch is in openai.ts)
│   ├── security/                 # W5: poisoned-document detection + defenses
│   ├── evals/                    # W5: retrieval + LLM-judge evals
│   └── prisma.ts                 # database client
├── prisma/schema.prisma          # the schema of the read-only database
├── scripts/
│   ├── vectorize.ts              # W1: Postgres notes → Pinecone
│   ├── similarity.ts             # W1: cosine-similarity playground
│   ├── bible/                    # chunking homework helpers
│   ├── security/                 # W5: the poisoned-document demo
│   └── retell/                   # ⭐ bonus: voice confirmation call
├── visuals/                      # in-class explainers (open visuals/index.html)
├── data/                         # Synthea source data + security fixtures
└── docs/                         # challenge specs, one per week
```

Every stub says which week it belongs to in its header comment — open a file and
the first lines tell you `Week 3 · assignment: docs/CHALLENGE-...`.

There is deliberately **no** `sql-queries.ts` / query-builder layer. The SQL
agent's LLM writes the SQL from the schema plus real distinct values from the
data. When a query comes back wrong, you fix the prompt or the grounding in
`lib/agents/sql.ts` — you don't add a function per question.

---

## The Data

We're using the [Synthea Coherent Dataset](https://synthea.mitre.org/): statistically realistic, **fully synthetic** patient records — zero real people, so it's safe to break. The shared database is a ~200-patient subset (it fits the Neon free tier):

- **200 patients** with conditions (diabetes, hypertension, COPD, …), medications, lab observations, and encounters
- **~21,000 clinical notes** in SOAP format — this is what we search semantically
- Notes average ~450 characters, which is why week 1 needs no chunking: a note *is* a chunk. (The Bible homework is where you have to actually chunk something.)

See [docs/DATA_STRUCTURE.md](docs/DATA_STRUCTURE.md) for the FHIR resource details.

---

## Example Queries

Once built, your system will handle queries like:

| Query | How It's Answered |
|-------|-------------------|
| "How many patients have hypertension?" | SQL aggregation |
| "How many patients had a heart attack?" | SQL — and the LLM has to map "heart attack" to the stored `Myocardial Infarction` |
| "Which patients have both hypertension and hyperlipidemia?" | SQL with two subqueries |
| "Which patients are short of breath?" | Vector search — there is no column for this |
| "Tell me about Avery Mueller's recent visits" | Hybrid: SQL for the facts, notes for the story |
| "Book her a follow-up on Tuesday" | Scheduling — proposes, then waits for a human to confirm |

Skip lab-threshold questions like "A1C over 9" — the synthetic data is almost all
normal readings, so they return one row and look broken.

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 15 |
| Database | Neon PostgreSQL (read-only, provided) |
| Vector DB | Pinecone — index + hosted reranker (`bge-reranker-v2-m3`) |
| Embeddings | OpenAI `text-embedding-3-small`, 1536 dims, cosine |
| Agents | OpenAI Responses API + Zod structured outputs; Vercel AI SDK for streaming |
| Tool calling | LangGraph (week 4) |
| Observability | LangSmith |
| Scheduling | Cal.com |
| ORM | Prisma |
| Styling | Tailwind CSS |

---

## Weekly Challenges

Each week's homework has a spec in `docs/CHALLENGE-*.md`. Most weeks the real
deliverable is a **short video** explaining what you built and why — that's the
part a model can't write for you.

Running the tests:

```bash
npm test              # the unit suite — should be fully green on a fresh clone
npm run test:evals    # week 5's LLM-judge evals (hits the real API, costs money)
```

---

## Resources

- [RAG Explained](https://www.pinecone.io/learn/retrieval-augmented-generation/)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)
- [Pinecone Docs](https://docs.pinecone.io/) · [reranking](https://docs.pinecone.io/guides/search/rerank-results)
- [Anthropic — Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — the workflow-vs-agent vocabulary we use from week 2 on
- [LangGraph JS — tool calling](https://langchain-ai.github.io/langgraphjs/how-tos/tool-calling/)
- [Prisma Docs](https://www.prisma.io/docs)

---

## License

MIT - Built for educational purposes with synthetic data.
