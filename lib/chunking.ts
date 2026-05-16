/**
 * Document chunking utilities for clinical notes
 *
 * Week 2: Split clinical notes into chunks for vector search
 *
 * SOAP notes have a specific structure:
 * - S (Subjective): What the patient reports
 * - O (Objective): Doctor's observations and measurements
 * - A (Assessment): Diagnosis and clinical reasoning
 * - P (Plan): Treatment plan
 */

import { v4 as uuidv4 } from 'uuid';

export interface SOAPSections {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  raw: string; // Full content if parsing fails
}

export interface ChunkMetadata {
  patientId: string;
  documentId: string;
  date: string;
  sectionType: 'subjective' | 'objective' | 'assessment' | 'plan' | 'full';
  chunkIndex: number;
}

export interface Chunk {
  id: string;
  content: string;
  metadata: ChunkMetadata;
}

export interface ChunkingOptions {
  maxTokens?: number; // Target chunk size (default: 400)
  overlap?: number;   // Overlap percentage 0-1 (default: 0.1)
}

/**
 * Parse SOAP sections from clinical note content
 *
 * TODO: Implement this function
 *
 * Look for section headers like:
 * - "SUBJECTIVE:", "S:", "Subjective"
 * - "OBJECTIVE:", "O:", "Objective"
 * - "ASSESSMENT:", "A:", "Assessment"
 * - "PLAN:", "P:", "Plan"
 *
 * Return the content of each section, or empty string if not found.
 * If no sections are found, put everything in `raw`.
 *
 * Hint: Use regex to find section headers and extract content between them
 */
export function parseSOAPSections(content: string): SOAPSections {
  // TODO: Implement SOAP section parsing
  //
  // Example regex pattern: /(?:^|\n)\s*(SUBJECTIVE|S)[\s:]+/i
  //
  // Steps:
  // 1. Find each section header
  // 2. Extract text between headers
  // 3. Return { subjective, objective, assessment, plan, raw }

  throw new Error('Not implemented - your turn!');
}

/**
 * Estimate token count for a string
 *
 * TODO: Implement this function
 *
 * Simple approximation: ~4 characters per token for English text.
 * For more accuracy, you could use the tiktoken library.
 */
export function estimateTokens(text: string): number {
  // TODO: Implement token estimation
  // Hint: Math.ceil(text.length / 4) is a reasonable approximation

  throw new Error('Not implemented - your turn!');
}

/**
 * Split text into chunks respecting sentence boundaries
 *
 * TODO: Implement this function
 *
 * Requirements:
 * - Split on sentence boundaries (. ! ?)
 * - Each chunk should be close to maxTokens but not exceed it
 * - Add overlap between chunks (overlap % of previous chunk)
 * - Don't split in the middle of a sentence
 *
 * Hint:
 * 1. Split text into sentences
 * 2. Accumulate sentences until you hit maxTokens
 * 3. When starting a new chunk, include overlap from previous
 */
export function chunkText(
  text: string,
  maxTokens: number = 400,
  overlapPercent: number = 0.1
): string[] {
  // TODO: Implement text chunking

  throw new Error('Not implemented - your turn!');
}

/**
 * Chunk a clinical document into vector-ready pieces
 *
 * TODO: Implement this function
 *
 * Pipeline:
 * 1. Parse SOAP sections using parseSOAPSections()
 * 2. For each non-empty section, chunk it using chunkText()
 * 3. Create Chunk objects with proper metadata
 * 4. Generate unique IDs using uuidv4()
 */
export function chunkDocument(
  content: string,
  patientId: string,
  documentId: string,
  date: string,
  options: ChunkingOptions = {}
): Chunk[] {
  const { maxTokens = 400, overlap = 0.1 } = options;

  // TODO: Implement document chunking
  //
  // Steps:
  // 1. Parse SOAP sections
  // 2. For each section (subjective, objective, assessment, plan):
  //    - If section has content, chunk it
  //    - Create Chunk objects with metadata
  // 3. If no sections found, chunk the raw content
  // 4. Return array of chunks

  throw new Error('Not implemented - your turn!');
}

/**
 * Batch chunk multiple documents
 *
 * This function is provided for convenience.
 */
export function chunkDocuments(
  documents: Array<{
    content: string;
    patientId: string;
    documentId: string;
    date: string;
  }>,
  options: ChunkingOptions = {}
): Chunk[] {
  const allChunks: Chunk[] = [];

  for (const doc of documents) {
    const chunks = chunkDocument(
      doc.content,
      doc.patientId,
      doc.documentId,
      doc.date,
      options
    );
    allChunks.push(...chunks);
  }

  return allChunks;
}
