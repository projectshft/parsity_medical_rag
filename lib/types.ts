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
