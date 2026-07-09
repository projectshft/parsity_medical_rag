/**
 * Reranking (Week 2) — YOUR TASK
 *
 * Vector search returns the top-K by cosine, but cosine is a coarse ranker:
 * the most *similar* chunk isn't always the most *relevant* one. A reranker
 * (Cohere) re-scores the candidates against the query and reorders them.
 * Implement rerankResults so the best `topN` come back first.
 *
 * Docs: https://docs.cohere.com/reference/rerank  ·  needs COHERE_API_KEY.
 */

import { SearchResult } from "./pinecone";

export async function rerankResults(
  query: string,
  results: SearchResult[],
  topN: number = 5,
): Promise<SearchResult[]> {
  // TODO:
  // 1. Short-circuit the trivial cases (no results, or already <= topN).
  // 2. Call Cohere's rerank endpoint with the query and the candidate texts
  //    (results.map(r => r.content)).
  // 3. Map the reranked order back onto your SearchResult objects — carry the
  //    new relevance score — and return the top `topN`.
  // 4. If the rerank call fails, fall back to the original order (slice topN):
  //    a reranker outage must not break search.
  throw new Error("Not implemented — your turn! (lib/reranker.ts)");
}
