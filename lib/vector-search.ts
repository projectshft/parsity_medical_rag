/**
 * Pinecone vector search for clinical notes
 *
 * Two-stage retrieval in one call:
 *   1. cosine search over the index (wide + cheap) — over-fetches candidates
 *   2. rerank the candidates' note text against the query (narrow + careful)
 * If the rerank call fails, we fall back to cosine order — degraded search
 * beats no search.
 */

import { Pinecone, RerankResult } from '@pinecone-database/pinecone';
import { createEmbedding } from './openai';
import type { VectorSearchResult } from './types';

const pinecone = new Pinecone({
	apiKey: process.env.PINECONE_API_KEY!,
});

const INDEX_NAME = 'medical-notes-parsity';
const RERANK_MODEL = 'bge-reranker-v2-m3';

export interface VectorSearchOptions {
	topK?: number;
	patientIds?: string[]; // Filter to specific patients (for hybrid queries)
	dateFrom?: string;
	dateTo?: string;
}

/**
 * Search clinical notes with semantic search + reranking
 */
export async function searchClinicalNotes(
	query: string, // tell me about patients with breathing issues
	options: VectorSearchOptions = {},
): Promise<{
	docs: any[];
	rerankedDocuments: any[];
}> {
	const { topK = 100, patientIds } = options;

	const filter =
		patientIds && patientIds.length > 0
			? patientIds.length === 1
				? { patientId: patientIds[0] }
				: { patientId: { $in: patientIds } }
			: undefined;

	// turn the query into an embedding

	const embeddedQuery = await createEmbedding(query);

	const docs = await pinecone.Index(INDEX_NAME).query({
		vector: embeddedQuery,
		topK,
		includeMetadata: true,
		...(filter ? { filter } : {}), // if there are patient ids, filter the results to only include those patients
	});

	// console.log(JSON.stringify(docs, null, 2));
	/**
	 ['doc1', 'doc2', 'doc3'] => ['doc2', 'doc3', 'doc1']
	 */

	const rerankedDocuments = await pinecone.inference.rerank(
		'bge-reranker-v2-m3',
		query,
		docs.matches.map(
			(doc: any) =>
				`
			Patient note:${doc.metadata.content} 
			Current medications: ${doc.metadata?.currentMedications?.join(', ')}
			Race: ${doc.metadata.race}
			Gender: ${doc.metadata.gender}
			First name: ${doc.metadata.firstName}
			Last name: ${doc.metadata.lastName}
			`,
			{
				topN: 10,
			},
		),
	);

	return { docs: docs.matches, rerankedDocuments: rerankedDocuments.data };
}
