/**
 * Vector search over the clinical notes — Week 2, built together in class.
 *
 * The shape we're building, two-stage retrieval in one call:
 *   1. embed the query, ask Pinecone for the nearest topK notes (wide, cheap)
 *   2. rerank those candidates against the query, keep topN (narrow, careful)
 *
 * Returns both lists so you can log them side by side and SEE what reranking
 * changed on a given query.
 */

import type { SearchResult } from './pinecone';

export type VectorSearchOptions = {
	topK?: number; // candidates the cosine search fetches
	topN?: number; // candidates kept after reranking
};

export async function searchClinicalNotes(
	query: string,
	options: VectorSearchOptions = {},
): Promise<{
	docs: SearchResult[];
	rerankedDocuments: SearchResult[];
}> {
	throw new Error('Not built yet — Week 2 (lib/vector-search.ts)');
}
