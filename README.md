# Medical Records RAG

AI-powered assistant for querying FHIR medical records using RAG (Retrieval-Augmented Generation).

## Features

- **FHIR Support**: Processes FHIR R4 bundles including Patient, Condition, Observation, MedicationRequest, Procedure, Encounter, Immunization, and AllergyIntolerance resources
- **Vector Search**: Uses Pinecone for semantic search across medical records
- **Re-ranking**: Cohere reranker for improved relevance
- **Streaming Chat**: Real-time streaming responses with OpenAI
- **Copilot-style UI**: Clean, dark-themed chat interface

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Fill in your API keys:
   - `OPENAI_API_KEY` - OpenAI API key
   - `PINECONE_API_KEY` - Pinecone API key
   - `PINECONE_INDEX` - Pinecone index name (e.g., "medical-records")
   - `COHERE_API_KEY` - Cohere API key for reranking

3. **Create Pinecone index**
   - Go to [Pinecone Console](https://app.pinecone.io)
   - Create an index with dimension `1536` and metric `cosine`

4. **Generate sample FHIR data** (optional)
   ```bash
   npm run generate-fhir
   ```
   This creates 1000 synthetic patient records in the `fhir/` directory.

5. **Process and upload FHIR data**
   ```bash
   npm run process-fhir
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000)

## Usage

### Chat Interface
Ask questions about the medical records:
- "What patients have diabetes?"
- "Show me recent lab results for John Smith"
- "What medications are commonly prescribed?"
- "Find patients with hypertension and their medications"

### Upload Page
Upload additional FHIR JSON files at `/upload`

## Architecture

```
medical-rag/
├── app/
│   ├── api/
│   │   ├── chat/route.ts      # Streaming chat endpoint
│   │   └── upload/route.ts    # FHIR upload endpoint
│   ├── upload/page.tsx        # Upload UI
│   └── page.tsx               # Chat UI
├── lib/
│   ├── agent.ts               # RAG agent with context building
│   ├── chunking.ts            # FHIR resource processing
│   ├── openai.ts              # Embeddings client
│   ├── pinecone.ts            # Vector store operations
│   └── reranker.ts            # Cohere reranking
└── scripts/
    ├── generate-fhir.ts       # Synthetic data generator
    └── process-fhir.ts        # Batch FHIR processor
```

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **AI**: OpenAI GPT-4o-mini, text-embedding-3-small
- **Vector DB**: Pinecone
- **Reranking**: Cohere rerank-english-v3.0
- **Streaming**: Vercel AI SDK
- **Styling**: Tailwind CSS
