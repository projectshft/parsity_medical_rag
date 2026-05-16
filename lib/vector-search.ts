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
  patientIds?: string[];  // Filter to specific patients (for hybrid queries)
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Search clinical notes with semantic search
 */
export async function searchClinicalNotes(
  query: string,
  options: VectorSearchOptions = {}
): Promise<VectorSearchResult[]> {
  const { topK = 10, patientIds } = options;

  // TODO: Implement vector search

  throw new Error('Not implemented - your turn!');
}

/**
 * Search clinical notes for a specific patient
 *
 * This helper is provided for you.
 */
export async function searchPatientNotes(
  patientId: string,
  query: string,
  topK: number = 5
): Promise<VectorSearchResult[]> {
  return searchClinicalNotes(query, { topK, patientIds: [patientId] });
}

/**
 * Truncate content to a maximum length while preserving word boundaries
 *
 * This helper is provided for you.
 */
function truncateContent(content: string, maxLength: number): string {
  if (!content) return '';
  if (content.length <= maxLength) return content;

  const truncated = content.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated) + '...';
}
