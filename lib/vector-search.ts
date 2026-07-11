/**
 * Pinecone vector search for clinical notes
 *
 * Week 3: Implement semantic search over clinical notes
 */

import { Pinecone } from '@pinecone-database/pinecone';
import { createEmbedding } from './openai';
import type { VectorSearchResult } from './types';

const pinecone = new Pinecone({
	apiKey: process.env.PINECONE_API_KEY!,
});

const INDEX_NAME = process.env.PINECONE_INDEX || 'medical-notes';

export interface VectorSearchOptions {
	topK?: number;
	patientIds?: string[]; // Filter to specific patients (for hybrid queries)
	dateFrom?: string;
	dateTo?: string;
}

/**
 * Search clinical notes with semantic search
 */
export async function searchClinicalNotes(
	query: string,
	options: VectorSearchOptions = {},
): Promise<VectorSearchResult[]> {
	const { topK = 10, patientIds } = options;

	// TODO: Implement vector search

	throw new Error('Not implemented - your turn!');
}
