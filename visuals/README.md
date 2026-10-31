# RAG & AI Agents — interactive visuals

Self-contained, single-file HTML explainers for the core retrieval concepts. No install, no internet, no build step — **double-click any file** (or open `index.html`) and it runs in the browser.

| File | Concept | What you do |
|------|---------|-------------|
| `index.html` | — | Gallery / launcher for all the visuals below |
| `before-after.html` | The "why" | Spreadsheet-style grid vs. the assistant, side by side. Type keywords on the left and watch exact-match fail where meaning-match succeeds. Start here. |
| `vector-search.html` | Embeddings + cosine similarity | Drag a query around meaning-space; watch notes re-rank by angle. Shows why cosine ignores length. |
| `reranking.html` | Two-stage retrieval (bi-encoder → cross-encoder) | Watch a negated / surface-similar note that vector search ranks #1 get demoted once a re-ranker reads query + note together. |
| `chunking.html` | Fixed-size vs structure-aware chunking (KJV Bible) | Flip between fixed-size slicing (splits verses, crosses book boundaries) and verse-packing. Reinforces: **we don't chunk clinical notes — one note = one vector — but the Bible must be chunked.** |
| `overlap.html` | Sentence overlap between chunks | Slide chunk size + overlap on a clinical note or Luke 15 and watch a two-sentence answer split across chunks, then reunite. Shows the storage cost and when to skip overlap (natural units like one note or one chapter). |
| `hybrid-search.html` | Keyword (BM25) + vector + RRF | Switch queries and see keyword win on exact drug codes, vector win on synonyms, and fusion get both. |
| `agent-anatomy.html` | The five parts of an agent | Flip between our four agents (selector, SQL, RAG, aggregator) and hover a slot (system prompt, context, model, structured output, history) to light it up in the real code. Shows the RAG agent is barely an agent and only the aggregator returns free text. |
| `tool-calling.html` | How the model discovers and calls tools | Pick a question and step through the trace: the tool descriptions go in with the request, the model picks one, your function runs, the result loops back. Matches `/api/chat-tools`. |
| `evals.html` | Evals and the Jev judge | The one-object test case (question, criteria, threshold), a one-call Jev walkthrough, and a threshold slider over real scores. Matches `lib/evals/chat.test.ts`. |

## Running them

- **Simplest:** double-click the `.html` file. It opens in your default browser and works offline.
- **Or serve the folder** (nice on mobile / for sharing on a network):
  ```bash
  cd visuals && python3 -m http.server 8000
  # then open http://localhost:8000
  ```

## Notes for students

The numbers in these demos are **hand-authored to make the concept obvious** — they're teaching illustrations, not live model output. The real pipeline (OpenAI embeddings → Pinecone → optional re-ranker) produces the same *shapes* of behavior, just with 1536 dimensions you can't draw. Use these to build the intuition, then go read the actual retrieval code in `lib/`.
