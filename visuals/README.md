# RAG & AI Agents — interactive visuals

Self-contained, single-file HTML explainers for the core retrieval concepts. No install, no internet, no build step — **double-click any file** (or open `index.html`) and it runs in the browser.

| File | Concept | What you do |
|------|---------|-------------|
| `index.html` | — | Gallery / launcher for all the visuals below |
| `vector-search.html` | Embeddings + cosine similarity | Drag a query around meaning-space; watch notes re-rank by angle. Shows why cosine ignores length. |
| `reranking.html` | Two-stage retrieval (bi-encoder → cross-encoder) | Watch a negated / surface-similar note that vector search ranks #1 get demoted once a re-ranker reads query + note together. |
| `chunking.html` | Fixed-size vs structure-aware chunking (KJV Bible) | Flip between fixed-size slicing (splits verses, crosses book boundaries) and verse-packing (`chunk-smart.ts`). Reinforces: **we don't chunk clinical notes — one note = one vector — but the Bible must be chunked.** |
| `hybrid-search.html` | Keyword (BM25) + vector + RRF | Switch queries and see keyword win on exact drug codes, vector win on synonyms, and fusion get both. |

## Running them

- **Simplest:** double-click the `.html` file. It opens in your default browser and works offline.
- **Or serve the folder** (nice on mobile / for sharing on a network):
  ```bash
  cd visuals && python3 -m http.server 8000
  # then open http://localhost:8000
  ```

## Notes for students

The numbers in these demos are **hand-authored to make the concept obvious** — they're teaching illustrations, not live model output. The real pipeline (OpenAI embeddings → Pinecone → optional re-ranker) produces the same *shapes* of behavior, just with 1536 dimensions you can't draw. Use these to build the intuition, then go read the actual retrieval code in `lib/`.
