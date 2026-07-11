/**
 * SELECTOR agent — YOUR TASK. Structured output only (never streams).
 *
 * The selector is the single query-understanding step for the whole system.
 * It reads the question, classifies it, extracts entities (structured output),
 * and returns a PLAN: which specialists to run, and whether we need to retrieve
 * anything at all. A pure general_question short-circuits — the route then
 * skips SQL/RAG and lets the aggregator answer directly.
 *
 * The Zod schema below is provided (it's the contract). YOU write the prompt and
 * the select() body.
 */

import { z } from 'zod';
import { getOpenAIClient } from '../openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type { Message } from '../agent';

const NumericFilterSchema = z.object({
  field: z.string().describe('The field to filter on (e.g., "A1C", "glucose", "BMI")'),
  operator: z.enum(['gt', 'lt', 'eq', 'gte', 'lte']).describe('Comparison operator'),
  value: z.number().describe('The numeric value to compare against'),
});

const DateRangeSchema = z.object({
  from: z.string().nullable().describe('Start date in ISO format'),
  to: z.string().nullable().describe('End date in ISO format'),
});

const EntitiesSchema = z.object({
  patientName: z.string().nullable().describe('Patient name if searching for specific patient'),
  patientId: z.string().nullable().describe('Patient ID if provided'),
  conditions: z.array(z.string()).nullable().describe('Medical conditions mentioned'),
  medications: z.array(z.string()).nullable().describe('Medications mentioned'),
  labCodes: z.array(z.string()).nullable().describe('Lab test names (e.g., "A1C", "glucose")'),
  dateRange: DateRangeSchema.nullable().describe('Time filters if mentioned'),
  numericFilters: z.array(NumericFilterSchema).nullable().describe('Numeric comparisons'),
});

const QueryAnalysisSchema = z.object({
  intent: z
    .enum([
      'patient_lookup',
      'patient_summary',
      'structured_query',
      'clinical_note_search',
      'population_analytics',
      'hybrid_query',
      'general_question',
    ])
    .describe('The type of query'),
  entities: EntitiesSchema.describe('Extracted entities from the query'),
  semanticQuery: z
    .string()
    .nullable()
    .describe('Optimized search query for vector search - expand with related terms'),
  requiresSQL: z.boolean().describe('Whether structured database query is needed'),
  requiresVector: z.boolean().describe('Whether vector search over clinical notes is needed'),
});

export type QueryAnalysis = z.infer<typeof QueryAnalysisSchema>;
export type QueryIntent = QueryAnalysis['intent'];

export type Selection = {
  analysis: QueryAnalysis;
  /** False only for a pure general question — the route then skips retrieval. */
  needsSearch: boolean;
  useSql: boolean;
  useRag: boolean;
  /** The (expanded) query to embed for note search. */
  semanticQuery: string;
};

// TODO: Write the system prompt for the analyzer — describe the two stores
// (SQL + notes), the intent enum, and how to fill requiresSQL / requiresVector.
const SYSTEM_PROMPT = `You are a medical records query analyzer.

TODO: Complete this prompt!
`;

// TODO: Add a few worked examples (query -> the JSON you want back).
const FEW_SHOT_EXAMPLES = `
TODO: Add examples!
`;

export async function select(query: string, history: Message[] = []): Promise<Selection> {
  const client = getOpenAIClient();

  // TODO:
  // 1. Classify the question with structured output: client.responses.parse({
  //      model, input: [system(SYSTEM_PROMPT + FEW_SHOT_EXAMPLES), ...recent
  //      history, user(query)], temperature: 0,
  //      text: { format: zodTextFormat(QueryAnalysisSchema, 'queryAnalysis') } })
  //    then QueryAnalysisSchema.parse(response.output_parsed).
  // 2. Derive the plan from the analysis:
  //      useSql = analysis.requiresSQL; useRag = analysis.requiresVector;
  //      a pure `general_question` needs no retrieval -> needsSearch = false;
  //      if it IS a records question but neither engine was picked, useRag = true.
  // 3. Return { analysis, needsSearch, useSql, useRag,
  //      semanticQuery: analysis.semanticQuery || query }.
  void client;
  throw new Error('Not implemented — your turn! (lib/agents/selector.ts)');
}
