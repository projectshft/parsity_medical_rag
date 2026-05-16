/**
 * Pinecone vector search for clinical notes
 *
 * Week 3: Implement semantic search over clinical notes
 */

import { Pinecone } from '@pinecone-database/pinecone';
import { createEmbedding } from './openai';
import type { VectorSearchResult } from './types';

let _pinecone: Pinecone | null = null;

function getPinecone(): Pinecone {
  if (!_pinecone) {
    _pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
  }
  return _pinecone;
}

function getIndexName(): string {
  return process.env.PINECONE_INDEX || 'medical-notes';
}

export interface VectorSearchOptions {
  topK?: number;
  patientIds?: string[];  // Filter to specific patients (for hybrid queries)
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Search clinical notes with semantic search
 *
 * TODO: Implement this function
 *
 * Steps:
 * 1. Get the Pinecone index
 * 2. Create an embedding for the query using createEmbedding()
 * 3. Build a metadata filter if patientIds are provided
 * 4. Query Pinecone with the embedding and filter
 * 5. Map results to VectorSearchResult format
 *
 * Hints:
 * - Use index.query() with vector, topK, includeMetadata, and filter
 * - Filter format for single patient: { patientId: "patient-123" }
 * - Filter format for multiple: { patientId: { $in: ["p1", "p2"] } }
 */
export async function searchClinicalNotes(
  query: string,
  options: VectorSearchOptions = {}
): Promise<VectorSearchResult[]> {
  const { topK = 10, patientIds } = options;

  // TODO: Get the Pinecone index
  // const index = ...

  // TODO: Create embedding for the query
  // const queryEmbedding = ...

  // TODO: Build metadata filter for patientIds
  // const filter = ...

  // TODO: Query Pinecone
  // const results = await index.query({...})

  // TODO: Map results to VectorSearchResult[]
  // return results.matches.map(match => ({
  //   id: match.id,
  //   score: match.score,
  //   patientId: match.metadata?.patientId,
  //   patientName: match.metadata?.patientName,
  //   documentType: match.metadata?.type || 'Clinical Note',
  //   date: match.metadata?.date,
  //   contentPreview: truncateContent(match.metadata?.content, 500),
  // }));

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
