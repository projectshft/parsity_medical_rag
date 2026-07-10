# Challenge: Reranking for Better Retrieval

Improve search quality by reranking vector results with a cross-encoder
(Cohere Rerank) before they reach the LLM, and measure the difference.

> **Capstone track:** Option 2 · **Competency:** C-RET-3 (Hybrid search & retrieval quality, Advanced)

## Learning Objectives

- Understand why bi-encoder vector search benefits from a reranking pass
- Integrate the Cohere Rerank API
- Measure retrieval quality before vs. after reranking

## Background

Vector search ranks chunks by embedding similarity, which is fast but coarse. A
**reranker** re-scores the top-K candidates against the query with a more
expensive cross-encoder, improving ordering.

A reranker helper is provided:

```typescript
// lib/reranker.ts
export async function rerankResults(
  query: string,
  results: SearchResult[],
  topN: number = 5
): Promise<SearchResult[]>;  // Cohere rerank-english-v3.0; falls back to original order on error
```

`COHERE_API_KEY` is already wired in `.env.example`.

## Your Task

### 1. Integrate reranking into the pipeline

- In the retrieval path (`lib/query-executor.ts` / `lib/vector-search.ts`),
  retrieve a **wider** candidate set (e.g., top 20) from Pinecone, then call
  `rerankResults(query, candidates, topN)` to narrow to the final set.
- Make reranking **configurable** (e.g., `RERANK=true|false`) so you can A/B it.
- Preserve the graceful fallback: if rerank fails, use the original order.

### 2. Measure the impact

- Using the eval set in `lib/evals/retrieval.test.ts`, compare retrieval quality
  **with vs. without** reranking on the same queries.
- Report the before/after (e.g., hit rate / rank of the known-relevant chunk).

## Acceptance Criteria

- [ ] Wider candidate retrieval feeds a rerank pass that returns `topN`
- [ ] Reranking can be toggled via config
- [ ] Fallback path is preserved (no crash when the rerank API errors)
- [ ] A written before/after comparison on the eval query set
- [ ] At least 3 tests (rerank ordering, toggle off, fallback on error)

## Bonus

1. **Latency budget** — measure added latency and cap candidate width.
2. **Score blending** — combine vector score and rerank score instead of replacing.
3. **Threshold** — drop candidates below a relevance score.

## Resources

- [Cohere Rerank](https://docs.cohere.com/docs/rerank-overview)
- [Why rerank (Pinecone)](https://www.pinecone.io/learn/series/rag/rerankers/)
