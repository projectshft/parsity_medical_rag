# Medical RAG: AI-Powered Patient Records

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

| Week | Topic | What You'll Learn |
|------|-------|-------------------|
| 1 | **Intro to RAG** | What is RAG? Project setup, explore the data |
| 2 | **Chunking** | Splitting documents for vector search |
| 3 | **Vector Search** | Embeddings and Pinecone |
| 4 | **Agents & Prompts** | Query understanding and response generation |
| 5 | **MCP Integration** | Expose your RAG to Claude/Cursor |
| 6 | **Capstone** | Build your own enhancement |

---

## Quick Start

### Prerequisites

- Node.js 18+
- Your own free accounts: [Pinecone](https://pinecone.io) and [OpenAI](https://platform.openai.com) — you build the vector store, so these are yours.
- The **provided, read-only Postgres** connection string (Neon). The company's data is already loaded; you do **not** create or seed a database. Drop it into `DATABASE_URL`.

### Setup

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Add your API keys + the provided DATABASE_URL to .env, then generate
# the Prisma client (local codegen — this does NOT touch the database):
npm run db:generate

# Start the app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

> No `db:push` / no ingest: the Postgres data is pre-loaded and read-only. You point at it and build the vector store on top (`npm run vectorize`). Peek at the data anytime with `npm run db:studio`.

---

## Project Structure

```
medical-rag/
├── app/                    # Next.js UI (pre-built)
│   ├── page.tsx            # Chat interface
│   └── api/                # API routes
├── lib/
│   ├── chunking.ts         # Week 2: Document chunking
│   ├── embeddings.ts       # Week 3: OpenAI embeddings
│   ├── vector-search.ts    # Week 3: Pinecone queries
│   ├── query-analyzer.ts   # Week 4: Query understanding
│   ├── agent.ts            # Week 4: Response generation
│   ├── sql-queries.ts      # Pre-built SQL queries
│   └── prisma.ts           # Database client
├── mcp-server/             # Week 5: MCP integration
├── prisma/
│   └── schema.prisma       # Database schema
├── scripts/
│   └── ingest-coherent.ts  # Data ingestion
├── data/                   # Patient data (Synthea)
└── docs/                   # Challenge specs + reference docs
```

---

## The Data

We're using the [Synthea Coherent Dataset](https://synthea.mitre.org/): realistic synthetic patient records with:

- ~150 patients
- Medical conditions (diabetes, hypertension, COPD, etc.)
- Medications and lab results
- **Clinical notes** (SOAP format)—this is what we'll search semantically

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
