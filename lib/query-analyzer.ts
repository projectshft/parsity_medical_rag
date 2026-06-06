/**
 * LLM-powered query analyzer with Zod-validated structured outputs
 *
 * Week 4: Use OpenAI to understand user queries and extract structure
 *
 * Uses OpenAI Responses API with zodTextFormat for reliable JSON output.
 */

import { z } from 'zod';
import { getOpenAIClient } from './openai';
import { zodTextFormat } from 'openai/helpers/zod';

/**
 * Schema for numeric filters (e.g., "A1C > 9")
 */
const NumericFilterSchema = z.object({
  field: z.string().describe('The field to filter on (e.g., "A1C", "glucose", "BMI")'),
  operator: z.enum(['gt', 'lt', 'eq', 'gte', 'lte']).describe('Comparison operator'),
  value: z.number().describe('The numeric value to compare against'),
});

/**
 * Schema for date ranges
 */
const DateRangeSchema = z.object({
  from: z.string().optional().describe('Start date in ISO format'),
  to: z.string().optional().describe('End date in ISO format'),
});

/**
 * Schema for extracted entities
 */
const EntitiesSchema = z.object({
  patientName: z.string().optional().describe('Patient name if searching for specific patient'),
  patientId: z.string().optional().describe('Patient ID if provided'),
  conditions: z.array(z.string()).optional().describe('Medical conditions mentioned'),
  medications: z.array(z.string()).optional().describe('Medications mentioned'),
  labCodes: z.array(z.string()).optional().describe('Lab test names (e.g., "A1C", "glucose")'),
  dateRange: DateRangeSchema.optional().describe('Time filters if mentioned'),
  numericFilters: z.array(NumericFilterSchema).optional().describe('Numeric comparisons'),
});

/**
 * Schema for query analysis result
 *
 * This defines what the LLM should output for each query.
 */
const QueryAnalysisSchema = z.object({
  intent: z.enum([
    'patient_lookup',      // Find specific patient by name
    'patient_summary',     // Summarize a patient's health
    'structured_query',    // Filter by conditions, meds, labs
    'clinical_note_search', // Semantic search over notes
    'population_analytics', // Aggregate statistics
    'hybrid_query',        // Both structured + semantic
    'general_question',    // Open-ended question
  ]).describe('The type of query'),

  entities: EntitiesSchema.describe('Extracted entities from the query'),

  semanticQuery: z.string().optional().describe(
    'Optimized search query for vector search - expand with related terms'
  ),

  requiresSQL: z.boolean().describe('Whether structured database query is needed'),
  requiresVector: z.boolean().describe('Whether vector search over clinical notes is needed'),
});

// Export types
export type QueryAnalysis = z.infer<typeof QueryAnalysisSchema>;
export type QueryIntent = QueryAnalysis['intent'];

const SYSTEM_PROMPT = `You are a medical records query analyzer for a hybrid RAG system.

The system has two data stores:
1. A SQL database with structured data: patients (name, gender, birth/death dates, phone, city, state), conditions (SNOMED display names, clinical status, onset dates), observations (LOINC labs and vitals with numeric values), and medications (RxNorm names, status, dosage).
2. A vector database with free-text clinical notes (SOAP-style encounter notes).

Your job is to classify the user's query intent and extract structured entities so the right store(s) can be queried.

Intent guide:
- patient_lookup: find a specific patient by name or ID ("find Abe Frami")
- patient_summary: summarize one patient's health ("give me a summary of patient X")
- structured_query: filter patients by conditions, medications, or lab values ("diabetics with A1C over 9")
- clinical_note_search: questions answered by reading notes ("patients describing chest pain at night")
- population_analytics: counts and aggregates ("how many patients have hypertension?")
- hybrid_query: needs BOTH a structured filter AND note content ("what do the notes say about sleep for patients with depression?")
- general_question: not about this data at all

Rules:
- requiresSQL is true for patient_lookup, patient_summary, structured_query, population_analytics, and hybrid_query.
- requiresVector is true for clinical_note_search and hybrid_query.
- Normalize condition names to common clinical terms (e.g., "sugar disease" -> "diabetes").
- Express comparisons like "A1C over 9" as numericFilters with field, operator, and value.
- For vector searches, write semanticQuery as an expanded clinical phrasing of the question, including synonyms a clinician might use in a note.
- Extract only what is actually in the query. Do not invent entities.`;

const FEW_SHOT_EXAMPLES = `Examples:

Query: "How many patients have type 2 diabetes?"
{ "intent": "population_analytics", "entities": { "conditions": ["diabetes"] }, "requiresSQL": true, "requiresVector": false }

Query: "Find patients with A1C above 9"
{ "intent": "structured_query", "entities": { "labCodes": ["A1C"], "numericFilters": [{ "field": "a1c", "operator": "gt", "value": 9 }] }, "requiresSQL": true, "requiresVector": false }

Query: "Which patients mention trouble sleeping in their notes?"
{ "intent": "clinical_note_search", "entities": {}, "semanticQuery": "trouble sleeping insomnia difficulty falling asleep poor sleep quality", "requiresSQL": false, "requiresVector": true }

Query: "What do the clinical notes say about medication side effects for patients with depression?"
{ "intent": "hybrid_query", "entities": { "conditions": ["depression"] }, "semanticQuery": "medication side effects adverse reaction antidepressant tolerability", "requiresSQL": true, "requiresVector": true }

Query: "Tell me about Abe Frami"
{ "intent": "patient_summary", "entities": { "patientName": "Abe Frami" }, "requiresSQL": true, "requiresVector": false }`;

/**
 * Analyze a user query to determine intent and extract entities
 */
export async function analyzeQuery(userQuery: string): Promise<QueryAnalysis> {
  const client = getOpenAIClient();

  const response = await client.responses.parse({
    model: 'gpt-4o-mini',
    input: [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\n${FEW_SHOT_EXAMPLES}` },
      { role: 'user', content: userQuery },
    ],
    temperature: 0,
    text: {
      format: zodTextFormat(QueryAnalysisSchema, 'queryAnalysis'),
    },
  });

  return QueryAnalysisSchema.parse(response.output_parsed);
}
