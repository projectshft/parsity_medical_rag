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

// Combined query result
export interface QueryResult {
  analysis: import('./query-analyzer').QueryAnalysis;
  sqlResults?: {
    type: string;
    patients?: any[];
    patient?: any;
    count?: number;
    condition?: string;
    patientIds?: string[];
    aggregations?: any;
    message?: string;
  };
  vectorResults?: VectorSearchResult[];
  mergedResults?: {
    structuredData: any;
    clinicalNotes: VectorSearchResult[];
  };
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
