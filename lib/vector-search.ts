/**
 * Pinecone vector search for clinical notes
 */

import { Pinecone } from '@pinecone-database/pinecone';
import { createEmbedding } from './openai';
import type { VectorSearchResult } from './types';
import { shouldObscurePII, obscureName, obscureContent } from './pii';

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
  obscurePII?: boolean;   // Apply PII obscuring to results
}

/**
 * Search clinical notes with semantic search
 */
export async function searchClinicalNotes(
  query: string,
  options: VectorSearchOptions = {}
): Promise<VectorSearchResult[]> {
  const { topK = 10, patientIds, dateFrom, dateTo, obscurePII } = options;
  const obscure = shouldObscurePII(obscurePII);

  const index = getPinecone().Index(getIndexName());
  const queryEmbedding = await createEmbedding(query);

  // Build metadata filter
  const filter: Record<string, any> = {};

  if (patientIds && patientIds.length > 0) {
    // Filter to specific patient IDs
    if (patientIds.length === 1) {
      filter.patientId = patientIds[0];
    } else {
      filter.patientId = { $in: patientIds };
    }
  }

  // Date filtering (if supported by your Pinecone index)
  // Note: Date filtering requires dates stored as strings in YYYY-MM-DD format
  // and may need index configuration

  const results = await index.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
    filter: Object.keys(filter).length > 0 ? filter : undefined,
  });

  return (results.matches || []).map(match => {
    const rawContent = (match.metadata?.content as string) || '';
    const rawPatientName = (match.metadata?.patientName as string) || undefined;

    return {
      id: match.id,
      score: match.score || 0,
      patientId: (match.metadata?.patientId as string) || '',
      patientName: obscure ? obscureName(rawPatientName) : rawPatientName,
      documentType: (match.metadata?.type as string) || 'Clinical Note',
      date: (match.metadata?.date as string) || undefined,
      contentPreview: obscure
        ? obscureContent(truncateContent(rawContent, 500))
        : truncateContent(rawContent, 500),
    };
  });
}

/**
 * Search clinical notes for a specific patient
 */
export async function searchPatientNotes(
  patientId: string,
  query: string,
  topK: number = 5
): Promise<VectorSearchResult[]> {
  return searchClinicalNotes(query, { topK, patientIds: [patientId] });
}

/**
 * Get most recent clinical notes for a patient (no semantic search)
 * Uses a neutral query to get representative notes
 */
export async function getRecentPatientNotes(
  patientId: string,
  topK: number = 10
): Promise<VectorSearchResult[]> {
  // Use a neutral medical query to get notes
  return searchClinicalNotes('patient visit clinical notes assessment plan', {
    topK,
    patientIds: [patientId],
  });
}

/**
 * Truncate content to a maximum length while preserving word boundaries
 */
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;

  const truncated = content.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated) + '...';
}
