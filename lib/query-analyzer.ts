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

// TODO: Write the system prompt for the query analyzer
const SYSTEM_PROMPT = `You are a medical records query analyzer.

TODO: Complete this prompt!
`;

// TODO: Add few-shot examples
const FEW_SHOT_EXAMPLES = `
TODO: Add examples!
`;

/**
 * Analyze a user query to determine intent and extract entities
 */
export async function analyzeQuery(userQuery: string): Promise<QueryAnalysis> {
  const client = getOpenAIClient();

  // TODO: Implement query analysis using OpenAI structured outputs

  throw new Error('Not implemented - your turn!');
}
