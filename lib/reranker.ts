/**
 * Reranking (Week 2) — YOUR TASK
 *
 * Vector search returns the top-K by cosine, but cosine is a coarse ranker:
 * the most *similar* chunk isn't always the most *relevant* one. A reranker
 * re-scores the candidates against the query and reorders them. Pinecone hosts
 * one (bge-reranker-v2-m3) that runs on your existing PINECONE_API_KEY — no
 * extra provider or key. Implement rerankResults so the best `topN` come first.
 *
 * Docs: https://docs.pinecone.io/guides/search/rerank-results
 *   const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
 *   const res = await pc.inference.rerank(model, query, docs, { topN });
 *   // res.data -> [{ index, score }] in descending relevance order
 */

import { SearchResult } from "./pinecone";

export async function rerankResults(
  query: string,
  results: SearchResult[],
  topN: number = 5,
): Promise<SearchResult[]> {
  // TODO:
  // 1. Short-circuit the trivial cases (no results, or already <= topN).
  // 2. Call Pinecone's reranker (pc.inference.rerank) with the query and the
  //    candidate texts (results.map(r => r.content)).
  // 3. Map the reranked order back onto your SearchResult objects — carry the
  //    new relevance score (res.data[i].score) — and return the top `topN`.
  // 4. If the rerank call fails, fall back to the original order (slice topN):
  //    a reranker outage must not break search.
  throw new Error("Not implemented — your turn! (lib/reranker.ts)");
}
