# Medical RAG Strategy: FHIR Records

## Executive Summary

This document outlines a RAG strategy optimized for FHIR R4 medical records. The key insight: **FHIR resources are already atomic, semantically complete units**. Chunking destroys context and relationships. Instead, we embed whole resources with rich metadata for precise filtering.

---

## Core Principles

### 1. No Chunking - Document-Level Embeddings
FHIR resources (Condition, Observation, MedicationRequest, etc.) are designed as self-contained clinical facts. A blood pressure reading, a diabetes diagnosis, or a medication prescription is a complete semantic unit.

**Why chunking hurts FHIR:**
- Breaks clinical context (a medication without its dosage is dangerous)
- Loses relationships between fields (value + unit + reference range belong together)
- Creates artificial boundaries that split meaningful data

**Our approach:**
- Embed entire FHIR resources as single vectors
- Create rich text representations for embedding quality
- Store the full resource in metadata for retrieval

### 2. Rich Metadata Schema
Pinecone's metadata filtering enables precise queries without relying solely on semantic similarity.

```typescript
interface FHIRResourceMetadata {
  // Core identifiers
  resourceType: string;        // "Condition" | "Observation" | "MedicationRequest" | etc.
  resourceId: string;          // FHIR resource ID
  patientId: string;           // Patient reference
  patientName: string;         // Denormalized for convenience

  // Temporal
  recordDate: string;          // ISO date for filtering
  recordYear: number;          // For year-based queries
  recordMonth: number;         // For month-based queries

  // Clinical codes (for precise lookups)
  primaryCode: string;         // SNOMED, LOINC, RxNorm code
  codeSystem: string;          // "snomed-ct" | "loinc" | "rxnorm" | etc.
  displayName: string;         // Human-readable name

  // Status
  status: string;              // "active" | "resolved" | "completed" | etc.

  // Demographics (denormalized from Patient)
  patientGender: string;       // "male" | "female"
  patientBirthYear: number;    // For age-based queries
  patientCity: string;         // Geographic filtering

  // Resource-specific
  category?: string;           // "vital-signs" | "laboratory" | etc.
  severity?: string;           // For conditions
  value?: number;              // For observations (enables numeric filtering)
  unit?: string;               // For observations

  // Full content for retrieval
  fullText: string;            // Complete text representation
}
```

### 3. Hybrid Search Strategy

Different query types require different approaches:

| Query Type | Strategy | Example |
|------------|----------|---------|
| **Semantic** | Vector similarity only | "What's wrong with this patient?" |
| **Filtered** | Metadata filter + vector | "All conditions for patient John Smith" |
| **Precise** | Metadata only | "Patients with SNOMED code 44054006" |
| **Aggregation** | Full scan with filters | "How many patients have diabetes?" |

---

## Supported Scenarios

### Scenario 1: Individual Patient Lookup

**Use cases:**
- "What medications is John Smith taking?"
- "Show me all lab results for patient ID 3ec759"
- "What conditions has Maria Garcia been diagnosed with?"
- "When was this patient's last visit?"

**Strategy:**
```
Filter: patientId = X OR patientName contains "John Smith"
Optional: resourceType = "MedicationRequest"
Vector: Embed query for semantic relevance
```

**Why it works:** Metadata filter isolates patient data, then semantic search ranks by relevance to the specific question.

---

### Scenario 2: Medical History Summarization

**Use cases:**
- "Give me a complete medical summary for patient X"
- "What's the timeline of care for this patient?"
- "Summarize the last year of treatment for Maria Garcia"

**Strategy:**
```
Filter: patientId = X, recordDate >= "2024-01-01" (if temporal)
Retrieve: ALL matching resources (not just top-K)
Sort: By recordDate ascending
Process: LLM summarization with full context
```

**Why it works:** For summaries, we need completeness over relevance. Filter to the patient, retrieve all records, let the LLM synthesize.

---

### Scenario 3: Cross-Patient Analytics (Population Health)

**Use cases:**
- "How many patients have Type 2 Diabetes?"
- "What's the average A1C for diabetic patients?"
- "Which patients on Metformin also have hypertension?"
- "Show patients with uncontrolled blood pressure (>140/90)"

**Strategy:**
```
Query 1: Filter resourceType = "Condition", displayName contains "diabetes"
         Return: unique patientIds, count

Query 2: Filter resourceType = "Observation", primaryCode = "4548-4" (A1C LOINC)
         Filter: patientId IN [diabetic patient IDs]
         Aggregate: AVG(value)

Query 3: Filter resourceType = "Observation", category = "vital-signs"
         Filter: value > 140 (systolic)
         Return: patientIds, values
```

**Why it works:** Structured metadata enables SQL-like queries on clinical codes, values, and relationships.

---

### Scenario 4: Clinical Decision Support

**Use cases:**
- "Are there any potential drug interactions for patient X?"
- "Which patients are overdue for flu vaccination?"
- "Find patients with A1C > 9% who aren't on insulin"
- "Patients with recent ER visits and chronic conditions"

**Strategy:**
```
Step 1: Retrieve all medications for patient X
Step 2: Cross-reference with drug interaction database
Step 3: Return flagged combinations with severity

For population queries:
Filter: resourceType = "Immunization", displayName = "Influenza"
        recordDate < "2023-09-01"
Compare: Against all patient IDs to find gaps
```

**Why it works:** Clinical decision support requires precise lookups (medications, lab values) followed by rule-based analysis.

---

### Scenario 5: Temporal Queries

**Use cases:**
- "What happened to this patient in the last 6 months?"
- "Show lab value trends over the past year"
- "How has blood pressure changed since starting Lisinopril?"
- "When was the last A1C check?"

**Strategy:**
```
Filter: patientId = X
        recordDate >= "2024-11-01" AND recordDate <= "2025-05-01"
Sort: recordDate ascending
Group: By resourceType for organized display

For trends:
Filter: resourceType = "Observation", primaryCode = "4548-4" (A1C)
        patientId = X
Sort: recordDate
Return: date, value pairs for visualization
```

**Why it works:** Date metadata enables precise temporal filtering and trend analysis.

---

### Scenario 6: Demographic/Cohort Analysis

**Use cases:**
- "Show me all female patients over 65 with heart conditions"
- "Patients in Chicago with asthma"
- "Age distribution of diabetic patients"
- "Male patients on blood pressure medication"

**Strategy:**
```
Filter: patientGender = "female"
        patientBirthYear <= 1960 (approx age 65+)
        resourceType = "Condition"
        displayName contains "heart" OR primaryCode IN [cardiac SNOMED codes]
Return: Unique patients with condition details
```

**Why it works:** Denormalized patient demographics in every resource enables efficient cohort queries without joins.

---

### Scenario 7: Natural Language Clinical Questions

**Use cases:**
- "Is this patient at risk for cardiovascular disease?"
- "What should we monitor for this diabetic patient?"
- "Are there any concerning trends in recent labs?"
- "What preventive care is recommended?"

**Strategy:**
```
Step 1: Vector search with high top-K (50+)
Step 2: Rerank with Cohere for relevance
Step 3: Build context from top 10-20 results
Step 4: LLM reasoning with medical knowledge
```

**Why it works:** Open-ended clinical reasoning benefits from semantic search to gather relevant context, then LLM synthesis.

---

### Scenario 8: Clinical Note Search & Summarization

**Use cases:**
- "Find all discharge summaries mentioning chest pain"
- "What did the doctor note about this patient's diabetes management?"
- "Summarize the clinical notes from the last hospitalization"
- "Search notes for any mention of family history of cancer"

**Strategy:**
```
Step 1: Filter by resourceType = "DocumentReference"
        Optional: noteType = "discharge_summary"
        Optional: patientId = X

Step 2: Semantic search on note content
        Query: "chest pain" or natural language question

Step 3: Rerank for relevance to specific query

Step 4: For summarization:
        - Retrieve all matching notes
        - Sort chronologically
        - LLM summarization with clinical focus
```

**Why it works:** Clinical notes are unstructured text - this is where semantic search shines. Metadata filters narrow to relevant note types/patients, then embeddings find semantically similar content.

**Note types to support (LOINC codes):**
| Code | Type |
|------|------|
| 34117-2 | History and Physical |
| 18842-5 | Discharge Summary |
| 11506-3 | Progress Note |
| 28570-0 | Procedure Note |
| 11488-4 | Consultation Note |

---

### Scenario 9: MCP Tool-Based Queries (Programmatic Access)

**Use cases:**
- Claude/AI assistant: "Look up patient 3ec759's medications"
- Integration: "Get all critical lab values from last week"
- Automation: "Find patients needing follow-up calls"

**MCP Tools to implement:**

```typescript
// Tool 1: Patient lookup
getPatient(patientId: string): Patient

// Tool 2: Resources by patient
getPatientResources(patientId: string, resourceType?: string): Resource[]

// Tool 3: Search with filters
searchResources(filters: {
  resourceType?: string;
  patientId?: string;
  codeSystem?: string;
  code?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
}): Resource[]

// Tool 4: Natural language query
queryMedicalRecords(query: string): RAGResponse

// Tool 5: Population statistics
getPopulationStats(filters: {
  condition?: string;
  medication?: string;
  ageRange?: [number, number];
  gender?: string;
}): Stats

// Tool 6: Patient summary
getPatientSummary(patientId: string): Summary

// Tool 7: Clinical note search
searchClinicalNotes(query: string, filters?: {
  patientId?: string;
  noteType?: 'discharge_summary' | 'progress_note' | 'history_and_physical';
  dateFrom?: string;
  dateTo?: string;
}): Note[]

// Tool 8: Summarize notes
summarizeNotes(patientId: string, dateRange?: { from: string; to: string }): string
```

---

## Implementation Architecture

### Data Ingestion Pipeline

```
FHIR Bundle → Parse Resources → Extract Metadata → Generate Text → Embed → Upsert

                                    ↓
                          ┌─────────────────────┐
                          │   For each resource │
                          └─────────────────────┘
                                    ↓
                    ┌───────────────────────────────┐
                    │  1. Extract patient context   │
                    │  2. Build metadata object     │
                    │  3. Create text representation│
                    │  4. Generate embedding        │
                    │  5. Store in Pinecone         │
                    └───────────────────────────────┘
```

### Query Pipeline

```
User Query → Query Analysis → Strategy Selection → Execute → Post-Process → Response

Query Analysis:
  - Intent classification (lookup, summary, analytics, clinical)
  - Entity extraction (patient names, conditions, dates)
  - Filter construction

Strategy Selection:
  - Pure semantic: open-ended questions
  - Filtered semantic: entity-specific questions
  - Metadata only: precise lookups
  - Aggregation: population queries

Execution:
  - Pinecone query with filters
  - Optional reranking
  - Context assembly

Post-Processing:
  - Deduplication
  - Grouping by patient/resource
  - LLM summarization
```

### MCP Server Architecture

```
┌─────────────────────────────────────────────────┐
│                  MCP Server                      │
├─────────────────────────────────────────────────┤
│  Tools:                                          │
│    • getPatient(id)                             │
│    • getPatientResources(id, type?)             │
│    • searchResources(filters)                   │
│    • queryMedicalRecords(nlQuery)               │
│    • getPopulationStats(filters)                │
│    • getPatientSummary(id)                      │
├─────────────────────────────────────────────────┤
│  Resources:                                      │
│    • patients://list                            │
│    • patient://{id}/summary                     │
│    • patient://{id}/conditions                  │
│    • patient://{id}/medications                 │
│    • patient://{id}/observations                │
├─────────────────────────────────────────────────┤
│  Prompts:                                        │
│    • summarize-patient                          │
│    • analyze-cohort                             │
│    • clinical-assessment                        │
└─────────────────────────────────────────────────┘
```

---

## Text Representation Templates

For optimal embedding quality, each resource type gets a structured text template:

### Condition
```
Patient {name} (ID: {id}) has a {status} condition: {displayName}.
Clinical code: {codeSystem} {code}.
Onset date: {onsetDate}.
Severity: {severity}.
Notes: {notes}.
```

### Observation
```
Lab/Vital result for patient {name} (ID: {id}):
Test: {displayName} ({codeSystem} {code})
Value: {value} {unit}
Reference range: {low} - {high}
Status: {status}
Date: {effectiveDate}
Category: {category}
```

### MedicationRequest
```
Medication for patient {name} (ID: {id}):
Drug: {displayName} ({codeSystem} {code})
Status: {status}
Prescribed: {authoredOn}
Dosage: {dosageInstruction}
Refills: {numberOfRepeatsAllowed}
Prescriber: {requester}
```

### Patient
```
Patient: {name}
ID: {id}
Gender: {gender}
Date of Birth: {birthDate}
Age: {calculatedAge} years
Address: {city}, {state}
Contact: {phone}
```

---

## Performance Considerations

### Indexing Strategy
- **Pinecone serverless** for cost-effective scaling
- **1536 dimensions** (text-embedding-3-small) balances quality and cost
- **Metadata indexing** on frequently filtered fields

### Query Optimization
- **Filter first**: Apply metadata filters before vector search
- **Limit top-K**: 20-50 for most queries, higher for summaries
- **Rerank selectively**: Only for semantic queries, skip for filtered
- **Cache patient lookups**: Common query pattern

### Batch Processing
- **100 vectors per upsert** (Pinecone limit)
- **Parallel embedding** for bulk uploads
- **Progress tracking** for large datasets

---

## Security & Compliance Notes

### PHI Handling
- All patient data is PHI (Protected Health Information)
- Vector embeddings may encode patient information
- Metadata contains identifiable data

### Recommendations
- Implement role-based access control
- Audit all queries
- Consider encryption at rest
- Implement consent tracking
- Add data retention policies

---

## Data Sources with Clinical Summaries

Our current generated data lacks clinical narratives (discharge summaries, clinical notes, assessments). For a complete RAG system, we need text-heavy documents. Options:

### Recommended: Synthea Coherent Data Set
- **Free**, Creative Commons 4.0 license
- Includes SOAP-style clinical notes linked via `DocumentReference` resources
- 9GB dataset with FHIR, DICOM, genomic, and physiological data
- Download: `aws s3 cp --no-sign-request s3://synthea-open-data/coherent/ ./coherent --recursive`
- [AWS Registry](https://registry.opendata.aws/synthea-coherent-data/) | [Paper](https://www.mdpi.com/2079-9292/11/8/1199)

### Alternative: Generate with Synthea + Custom Modules
Run Synthea locally with note generation enabled:
```bash
java -jar synthea.jar -p 1000 --exporter.fhir.export true
```
Customize with clinical note templates in `src/main/resources/templates/`

### For Research: MIMIC-IV-Note
- Real de-identified discharge summaries (331,794 notes)
- Requires PhysioNet credentialing
- [physionet.org/content/mimic-iv-note](https://physionet.org/content/mimic-iv-note/2.2/)

### Additional Resource Types to Support
With clinical notes, add these FHIR resources to the metadata schema:

| Resource | Use Case |
|----------|----------|
| `DocumentReference` | Links to clinical notes, discharge summaries |
| `DiagnosticReport` | Lab report narratives, imaging interpretations |
| `CarePlan` | Treatment plans with goals and activities |
| `ClinicalImpression` | Assessments and clinical reasoning |
| `Composition` | Structured documents (discharge summary sections) |

---

## Next Steps

1. **Download Coherent Data Set** with clinical notes
2. **Implement new processing strategy** (document-level, no splitting)
3. **Expand metadata schema** (add clinical codes, demographics, note types)
4. **Build MCP server** with defined tools
5. **Create query analyzer** for intent classification
6. **Add population analytics** endpoints
7. **Implement caching layer** for common queries
8. **Build evaluation suite** for RAG quality
