/**
 * Pinecone vector search for clinical notes
 *
 * Two-stage retrieval in one call:
 *   1. cosine search over the index (wide + cheap) — over-fetches candidates
 *   2. rerank the candidates' note text against the query (narrow + careful)
 * If the rerank call fails, we fall back to cosine order — degraded search
 * beats no search.
 */

import { Pinecone } from '@pinecone-database/pinecone';
import { createEmbedding } from './openai';
import { rerankResults } from './reranker';
import type { SearchResult } from './pinecone';

const pinecone = new Pinecone({
	apiKey: process.env.PINECONE_API_KEY!,
});

const INDEX_NAME = process.env.PINECONE_INDEX || 'medical-notes';

export interface VectorSearchOptions {
	topK?: number; // candidates the cosine search fetches (wide + cheap)
	topN?: number; // candidates kept after reranking (narrow + careful)
	patientIds?: string[]; // Filter to specific patients (for hybrid queries)
	dateFrom?: string;
	dateTo?: string;
}

/**
 * Search clinical notes with semantic search + reranking.
 *
 * Both lists are `SearchResult[]` — the same shape, so you can diff them:
 *   - `docs`            the cosine candidates, in cosine order (topK of them)
 *   - `rerankedDocuments`  the same objects reranked and cut to topN
 *
 * Keeping both is deliberate. Logging them side by side is the only way to
 * actually see whether reranking did anything on a given query.
 */
export async function searchClinicalNotes(
	query: string, // tell me about patients with breathing issues
	options: VectorSearchOptions = {},
): Promise<{
	docs: SearchResult[];
	rerankedDocuments: SearchResult[];
}> {
	const { topK = 100, topN = 10, patientIds } = options;

	const filter =
		patientIds && patientIds.length > 0
			? patientIds.length === 1
				? { patientId: patientIds[0] }
				: { patientId: { $in: patientIds } }
			: undefined;

	// turn the query into an embedding

	const embeddedQuery = await createEmbedding(query);

	const response = await pinecone.Index(INDEX_NAME).query({
		vector: embeddedQuery,
		topK,
		includeMetadata: true, // WITHOUT this you get ids and floats and no note text
		...(filter ? { filter } : {}), // if there are patient ids, filter the results to only include those patients
	});

	// Pinecone hands back its own match shape, with the note text buried in
	// `metadata.content`. Normalise it once, here, into the SearchResult shape
	// the rest of the app uses — so nothing downstream has to guess whether the
	// text lives on `.content`, `.document.text`, or somewhere else.
	const docs: SearchResult[] = response.matches.map((match) => {
		const { content, ...metadata } = (match.metadata ??
			{}) as Record<string, unknown>;
		return {
			id: match.id,
			score: match.score ?? 0,
			content: typeof content === 'string' ? content : '',
			metadata: metadata as SearchResult['metadata'],
		};
	});

	// Stage two: rerank. Falls back to cosine order if the reranker is down —
	// see lib/reranker.ts.
	const rerankedDocuments = await rerankResults(query, docs, topN);

	return { docs, rerankedDocuments };
}
