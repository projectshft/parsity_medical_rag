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
│                    Query Analyzer (LLM)                      │
│     Extracts: entities, intent, structured vs semantic       │
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
│                   Response Generator                         │
│        Merges SQL + vector results → LLM response            │
└─────────────────────────────────────────────────────────────┘
```

---

## 6-Week Curriculum

| Week | Topic | What You'll Build | Homework |
|------|-------|-------------------|----------|
| 1 | **Intro to RAG + ingestion** | Embeddings, metadata design, vectorize the 21k notes into Pinecone | [CHALLENGE-CHUNKING.md](docs/CHALLENGE-CHUNKING.md) |
| 2 | **Retrieval & reranking** | `searchClinicalNotes`, `/api/search`, two-stage retrieval | [CHALLENGE-NOTE-INGEST.md](docs/CHALLENGE-NOTE-INGEST.md) |
| 3 | **The agent pipeline** | selector → SQL ‖ RAG → aggregator, plus human-confirmed scheduling | [CHALLENGE-TOOL-CALLING.md](docs/CHALLENGE-TOOL-CALLING.md) |
| 4 | **Tool-calling & LangGraph** | The model picks the tools instead of your `if` statements | [CHALLENGE-LANGGRAPH.md](docs/CHALLENGE-LANGGRAPH.md) |
| 5 | **Evals, security, privacy** | Measure it, attack it, de-identify it | [CHALLENGE-POISONED-DOCS.md](docs/CHALLENGE-POISONED-DOCS.md) · [CHALLENGE-PII.md](docs/CHALLENGE-PII.md) |
| 6 | **Capstone** | Your own data, your own RAG app | — |

Bonus, not covered this cohort: [MCP server](docs/bonus/CHALLENGE-MCP-AUTH.md) — same idea as week 4, but over a wire protocol so Claude Desktop does the tool-picking.

---

## Quick Start

You need **Node 18+** and your own free [OpenAI](https://platform.openai.com) and [Pinecone](https://pinecone.io) keys. The database is **provided, read-only** — already loaded, you just connect to it.

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
│   │   ├── selector.ts           # W3: routes — { useSql, useRag }. Nothing else.
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
│   ├── pii.ts                    # W5: de-identification (your task)
│   ├── security/                 # W5: poisoned-document defenses
│   ├── evals/                    # W5: retrieval + LLM-judge evals
│   └── prisma.ts                 # database client
├── mcp-server/                   # ⭐ bonus, not covered this cohort
├── prisma/schema.prisma          # the schema of the read-only database
├── scripts/
│   ├── vectorize.ts              # W1: Postgres notes → Pinecone
│   ├── similarity.ts             # W1: cosine-similarity playground
│   └── bible/                    # chunking homework helpers
├── visuals/                      # in-class explainers (open visuals/index.html)
├── data/                         # Synthea source data + security fixtures
└── docs/                         # challenge specs; docs/bonus/ = optional
```

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
| "What medications is John Smith taking?" | SQL lookup |
| "Find patients with A1C > 9%" | SQL with numeric filter |
| "Notes mentioning breathing problems" | Vector search |
| "Diabetic patients with foot pain" | Hybrid: SQL → Vector |
| "How many patients have hypertension?" | SQL aggregation |

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 15 |
| Database | Neon PostgreSQL |
| Vector DB | Pinecone |
| Embeddings | OpenAI |
| ORM | Prisma |
| Styling | Tailwind CSS |

---

## Weekly Challenges

Each week has a challenge file in `docs/CHALLENGE-*.md` with:
- Learning objectives
- TODO tasks to complete
- Test cases to pass
- Bonus challenges

---

## Resources

- [RAG Explained](https://www.pinecone.io/learn/retrieval-augmented-generation/)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)
- [Pinecone Docs](https://docs.pinecone.io/)
- [Prisma Docs](https://www.prisma.io/docs)
- [MCP Protocol](https://modelcontextprotocol.io/)

---

## License

MIT - Built for educational purposes with synthetic data.
