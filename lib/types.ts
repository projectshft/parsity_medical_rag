// Re-export query analysis types from the Zod-validated module
export type { QueryAnalysis, QueryIntent } from './query-analyzer';

// Vector search result
export interface VectorSearchResult {
  id: string;
  score: number;
  patientId: string;
  patientName?: string;
  documentType: string;
  date?: string;
  contentPreview: string;
}

// Combined query result. The SQL side is now text-to-SQL: the LLM writes one
// read-only SELECT and we return its rows (no hand-coded structured shapes).
export interface QueryResult {
  analysis: import('./query-analyzer').QueryAnalysis;
  sql?: {
    sql: string;
    explanation: string;
    rows: Record<string, unknown>[];
    error?: string;
  };
  vectorResults?: VectorSearchResult[];
}

// FHIR types
export interface FHIRBundle {
  resourceType: 'Bundle';
  entry: Array<{ resource: FHIRResource }>;
}

export interface FHIRResource {
  resourceType: string;
  id: string;
  [key: string]: any;
}
