/**
 * Reranking — Week 2, built together in class.
 *
 * Vector search ranks by cosine: the query and each note were embedded ALONE,
 * and nothing ever looked at the two together. A reranker (cross-encoder)
 * scores each (query, note) pair — far more accurate, far too slow for 21,000
 * notes. So we build a funnel:
 *
 *   query → vector search (wide, topK=100) → rerank (narrow, topN=10)
 *
 * Pinecone hosts a reranker on the PINECONE_API_KEY you already have.
 * Docs: https://docs.pinecone.io/guides/search/rerank-results
 */

import type { SearchResult } from './pinecone';

export async function rerankResults(
	query: string,
	results: SearchResult[],
	topN: number = 10,
): Promise<SearchResult[]> {
	throw new Error('Not built yet — Week 2 (lib/reranker.ts)');
}
