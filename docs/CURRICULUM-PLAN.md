# Medical RAG Curriculum - 6 Week Plan

## Course Overview

**Goal**: Teach students non-trivial RAG through hands-on building of a medical records system
**Format**: 2-hour classes, instructor-led live coding with TODOs
**Tools**: AI-assisted coding (Claude/Cursor), plain HTML presentations
**Branches**: `instructor` (complete), `student` (skeleton with TODOs)

---

## Week-by-Week Breakdown

### Week 1: Introduction to RAG & Project Setup
**Theme**: What is RAG and why does it matter?

**Presentation Topics** (20 min):
- The problem: LLMs don't know your data
- RAG architecture diagram (Retrieve → Augment → Generate)
- Medical use case: querying patient records
- Course roadmap overview

**Live Coding / TODOs** (90 min):
- Clone repo, install dependencies
- Explore the pre-built UI (Next.js app)
- Review the data structure (Synthea FHIR)
- TODO: Set up environment variables
- TODO: Connect to Neon PostgreSQL
- TODO: Run Prisma migration
- Group discussion: What metadata matters for medical queries?

**Student Challenge**:
- Explore the FHIR data files
- Identify 5 query types users might ask

**Files to Prepare**:
- `docs/WEEK1-INTRO.html` - Presentation
- `.env.example` - Pre-configured
- `prisma/schema.prisma` - Complete schema
- `README.md` - Problem statement + setup

---

### Week 2: Chunking Clinical Notes
**Theme**: Preparing documents for vector search

**Presentation Topics** (20 min):
- Why chunking matters (context windows, relevance)
- Chunking strategies (fixed, semantic, document-aware)
- Medical documents: SOAP notes structure
- Overlap and chunk size tradeoffs

**Live Coding / TODOs** (90 min):
- Review raw clinical notes from Synthea
- TODO: Implement `chunkDocument()` function
- TODO: Handle SOAP note sections (Subjective, Objective, Assessment, Plan)
- TODO: Add metadata to chunks (patientId, date, section type)
- Group decision: Chunk size and overlap values
- Test chunking on sample documents

**Student Challenge**:
- Experiment with different chunk sizes
- Compare retrieval quality

**Files to Prepare**:
- `docs/WEEK2-CHUNKING.html` - Presentation
- `lib/chunking.ts` - Skeleton with TODOs
- `scripts/chunk-documents.ts` - Ingestion script
- Sample FHIR DocumentReference files

---

### Week 3: Vector Search with Pinecone
**Theme**: Embeddings and semantic search

**Presentation Topics** (20 min):
- What are embeddings? (visual: word2vec-style)
- OpenAI embeddings API
- Vector databases: why not just SQL?
- Pinecone basics: indexes, namespaces, metadata filtering

**Live Coding / TODOs** (90 min):
- Set up Pinecone account and index
- TODO: Implement `createEmbedding()` wrapper
- TODO: Implement `upsertChunks()` to Pinecone
- TODO: Implement `searchClinicalNotes()` query function
- Run ingestion: chunks → embeddings → Pinecone
- Test semantic queries vs keyword search

**Student Challenge**:
- Query: "patients with breathing problems" vs "dyspnea"
- Compare vector search results

**Files to Prepare**:
- `docs/WEEK3-VECTORS.html` - Presentation
- `lib/embeddings.ts` - Skeleton with TODOs
- `lib/vector-search.ts` - Skeleton with TODOs
- `scripts/ingest-to-pinecone.ts` - Ingestion script

---

### Week 4: Agents and Prompts
**Theme**: Query understanding and response generation

**Presentation Topics** (20 min):
- Query analysis: What does the user want?
- Structured outputs with Zod (OpenAI Responses API)
- Prompt engineering for medical context
- Hybrid queries: SQL + Vector

**Live Coding / TODOs** (90 min):
- Review query types (patient lookup, clinical search, analytics)
- TODO: Implement `analyzeQuery()` with Zod schema
- TODO: Write system prompt for medical assistant
- TODO: Implement `executeQuery()` orchestration
- TODO: Format results for LLM context
- Group discussion: Prompt tone and safety guardrails

**Student Challenge**:
- Test edge cases: ambiguous queries, out-of-scope requests
- Iterate on prompt improvements

**Files to Prepare**:
- `docs/WEEK4-AGENTS.html` - Presentation
- `lib/query-analyzer.ts` - Skeleton with TODOs
- `lib/agent.ts` - Skeleton with TODOs
- `lib/prompts.ts` - System prompt templates

---

### Week 5: MCP Integration
**Theme**: Expose your RAG as a tool for AI assistants

**Presentation Topics** (20 min):
- What is MCP (Model Context Protocol)?
- Why expose RAG as an MCP server?
- Claude Desktop / Cursor integration
- Tool definitions and schemas

**Live Coding / TODOs** (90 min):
- Install `@modelcontextprotocol/sdk`
- TODO: Define MCP tools (search_patients, query_notes, get_patient)
- TODO: Implement tool handlers
- TODO: Configure Claude Desktop / Cursor
- Demo: Natural language → MCP tool → RAG results
- Group discussion: What other tools would be useful?

**Student Challenge**:
- Add a new MCP tool (e.g., `list_conditions`, `summarize_patient`)
- Test with Claude Desktop or Cursor

**Files to Prepare**:
- `docs/WEEK5-MCP.html` - Presentation
- `mcp-server/index.ts` - Skeleton MCP server
- `mcp-server/tools.ts` - Tool definitions
- `.cursor/mcp.json` or Claude Desktop config example

---

### Week 6: Capstone Project
**Theme**: Put it all together

**Presentation Topics** (15 min):
- Capstone requirements review
- Demo of complete system
- Ideas for extensions

**Capstone Work** (90 min):
Students complete their own enhancements. Options:
1. **PII Obscuring** - Implement privacy protection (existing challenge)
2. **Reranking** - Add Cohere reranker for better results
3. **Multi-modal** - Add image/PDF support
4. **New Data Source** - Integrate additional medical data
5. **Custom MCP Tool** - Build a novel MCP integration

**Final 15 min**:
- Student demos (volunteers)
- Q&A and wrap-up
- Resources for continued learning

**Files to Prepare**:
- `docs/WEEK6-CAPSTONE.html` - Requirements
- `docs/CHALLENGE-*.md` - Multiple challenge options
- Grading rubric (if applicable)

---

## Repository Structure

```
medical-rag/
├── app/                    # Next.js UI (complete for students)
│   ├── page.tsx
│   └── api/
│       ├── chat/route.ts
│       └── query/route.ts
├── lib/
│   ├── chunking.ts         # Week 2 TODOs
│   ├── embeddings.ts       # Week 3 TODOs
│   ├── vector-search.ts    # Week 3 TODOs
│   ├── query-analyzer.ts   # Week 4 TODOs
│   ├── agent.ts            # Week 4 TODOs
│   ├── prompts.ts          # Week 4 TODOs (group)
│   ├── sql-queries.ts      # Pre-built
│   └── prisma.ts           # Pre-built
├── mcp-server/             # Week 5
│   ├── index.ts            # TODOs
│   └── tools.ts            # TODOs
├── prisma/
│   └── schema.prisma       # Pre-built
├── scripts/
│   ├── ingest-coherent.ts  # Ingestion script
│   └── seed-data.ts        # Sample data loader
├── data/                   # Subset of Synthea data (or S3 URL)
├── docs/
│   ├── WEEK1-INTRO.html
│   ├── WEEK2-CHUNKING.html
│   ├── WEEK3-VECTORS.html
│   ├── WEEK4-AGENTS.html
│   ├── WEEK5-MCP.html
│   ├── WEEK6-CAPSTONE.html
│   └── CHALLENGE-*.md
└── README.md               # Problem statement + course overview
```

---

## Branch Strategy

### `instructor` branch (private)
- Full working implementation
- All TODOs completed
- Used for live coding reference
- Contains answer keys

### `student` branch (private)
- Skeleton code with TODOs
- Tests that validate implementations
- UI fully working
- SQL queries pre-built
- Starting point each week

### Git Workflow
```bash
# Students start each week
git pull origin student
git checkout -b week-N-myname

# Instructor references
git checkout instructor
```

---

## Data Strategy

### Option A: S3 (Preferred)
```
s3://parsity-medical-rag/data/
├── patients/          # ~100 patient bundles (subset)
├── documents/         # Clinical notes
└── README.md          # Data dictionary
```

### Option B: In-Repo (Fallback)
```
data/
├── sample-patients.json     # 10-20 patients
├── sample-documents.json    # Corresponding notes
└── full-data-url.txt        # Link to download full set
```

### Recommended Subset
- 100-200 patients (from 1,278 total)
- Diverse conditions (diabetes, hypertension, COPD, etc.)
- Multiple clinical notes per patient
- ~50MB total

---

## TODO Style Guide

**Good TODOs** (brief, clear):
```typescript
// TODO: Create embedding for the text using OpenAI
export async function createEmbedding(text: string): Promise<number[]> {
  // Your code here
}
```

**Bad TODOs** (overly prescriptive):
```typescript
// TODO: Use the OpenAI SDK to call the embeddings endpoint
// with model 'text-embedding-3-small' and return the
// embedding array from response.data[0].embedding
```

---

## HTML Presentation Template

```html
<!DOCTYPE html>
<html>
<head>
  <title>Week N: Topic</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
    h2 { margin-top: 2rem; }
    code { background: #f4f4f4; padding: 0.2rem 0.4rem; border-radius: 3px; }
    pre { background: #f4f4f4; padding: 1rem; overflow-x: auto; }
    .diagram { border: 1px solid #ccc; padding: 1rem; margin: 1rem 0; text-align: center; }
  </style>
</head>
<body>
  <h1>Week N: Topic</h1>
  <!-- Content here -->
</body>
</html>
```

---

## Next Steps

1. [ ] Finalize data subset (100-200 patients)
2. [ ] Upload to S3 or commit to repo
3. [ ] Create `instructor` branch with full implementation
4. [ ] Create `student` branch with skeletons
5. [ ] Write Week 1-6 HTML presentations
6. [ ] Add tests for each week's TODOs
7. [ ] Create challenge options for Week 6
8. [ ] Test full flow end-to-end
