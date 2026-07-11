/**
 * SELECTOR agent — structured output only (never streams).
 *
 * The selector reads the question, classifies it, extracts entities, and turns
 * that into a concrete PLAN: which specialists to run, and whether we need to
 * retrieve anything at all. A pure general_question short-circuits — callers
 * then skip SQL/RAG and let the aggregator answer directly.
 *
 * This is the single query-understanding step for the whole system (chat,
 * /api/query, and MCP all go through it).
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

const AgeFilterSchema = z.object({
  operator: z.enum(['gt', 'lt', 'gte', 'lte']).describe('Comparison operator on age in years'),
  value: z.number().describe('Age threshold in years'),
});

const EntitiesSchema = z.object({
  patientName: z.string().nullable().describe('Patient name if searching for specific patient'),
  patientId: z.string().nullable().describe('Patient ID if provided'),
  conditions: z.array(z.string()).nullable().describe('Medical conditions mentioned'),
  numericFilters: z.array(NumericFilterSchema).nullable().describe('Numeric comparisons'),
  ageFilter: AgeFilterSchema.nullable().describe(
    'Patient age filter in years. "younger"->{lt,40}, "older/elderly/senior"->{gte,65}, "over 50"->{gt,50}, "under 30"->{lt,30}',
  ),
  ageSort: z
    .enum(['youngest', 'oldest'])
    .nullable()
    .describe(
      'Superlative by age — "who is the youngest?", "the oldest patient". NOT a threshold (that is ageFilter). Carry the population/condition from history for follow-ups like "who is the youngest one?".',
    ),
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
  /** False only for a pure general question — callers then skip retrieval. */
  needsSearch: boolean;
  useSql: boolean;
  useRag: boolean;
  /** The (expanded) query to embed for note search. */
  semanticQuery: string;
};

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
- hybrid_query: needs BOTH a structured filter AND note content ("what do the notes say about sleep for patients with depression?"), OR an open/analytical question about a group of patients defined by a condition ("what are the trends in stroke patients?", "tell me about diabetics")
- general_question: ONLY for questions with no connection to the patient records at all (e.g., "what is a normal A1C range?", "who are you?"). If the question names or implies ANY condition, medication, lab, symptom, or patient population, it is NOT a general_question.

Rules:
- requiresSQL is true for patient_lookup, patient_summary, structured_query, population_analytics, and hybrid_query.
- requiresVector is true for clinical_note_search and hybrid_query.
- If the question references a medical condition — even vaguely or analytically ("trends in stroke patients", "insights on CHF cases", "tell me about asthmatics") — you MUST extract it into entities.conditions and classify as population_analytics or hybrid_query. Never route such a question to general_question with empty entities.
- If the question references patient age or life stage ("younger", "older", "elderly", "seniors", "over 50", "under 30"), populate entities.ageFilter and classify as structured_query (or population_analytics for a count). Map: "younger"/"young" -> {operator:"lt", value:40}, "older"/"elderly"/"senior" -> {operator:"gte", value:65}, "over N" -> {operator:"gt", value:N}, "under N" -> {operator:"lt", value:N}. Do NOT put age phrases into patientName.
- For an age SUPERLATIVE ("who is the youngest?", "the oldest patient", "youngest one", "who's the oldest of them"), set entities.ageSort to "youngest" or "oldest" — do NOT use ageFilter (that is a threshold, not a superlative). Classify as structured_query. If it's a follow-up ("who is the youngest one?"), carry the condition/population from earlier turns into entities.conditions.
- Normalize condition names to common clinical terms (e.g., "sugar disease" -> "diabetes").
- Express comparisons like "A1C over 9" as numericFilters with field, operator, and value.
- For vector searches, write semanticQuery as an expanded clinical phrasing of the question, including synonyms a clinician might use in a note.
- Extract only what is actually in the query. Do not invent entities.
- Conversation history may precede the latest message. Use it ONLY to resolve references in a follow-up (e.g., "what about their medications?", "and the younger ones?", "just the diabetics") — carry forward the relevant entities/conditions from earlier turns. Always classify the LATEST user message.`;

const FEW_SHOT_EXAMPLES = `Examples:

Query: "How many patients have type 2 diabetes?"
{ "intent": "population_analytics", "entities": { "conditions": ["diabetes"] }, "requiresSQL": true, "requiresVector": false }

Query: "Which patients mention trouble sleeping in their notes?"
{ "intent": "clinical_note_search", "entities": {}, "semanticQuery": "trouble sleeping insomnia difficulty falling asleep poor sleep quality", "requiresSQL": false, "requiresVector": true }

Query: "What do the clinical notes say about medication side effects for patients with depression?"
{ "intent": "hybrid_query", "entities": { "conditions": ["depression"] }, "semanticQuery": "medication side effects adverse reaction antidepressant tolerability", "requiresSQL": true, "requiresVector": true }

Query: "Tell me about Abe Frami"
{ "intent": "patient_summary", "entities": { "patientName": "Abe Frami" }, "requiresSQL": true, "requiresVector": false }

Query: "Who is the youngest one?"  (following "How many patients have hypertension?")
{ "intent": "structured_query", "entities": { "conditions": ["hypertension"], "ageSort": "youngest" }, "requiresSQL": true, "requiresVector": false }

Query: "What is a normal A1C range?"
{ "intent": "general_question", "entities": {}, "requiresSQL": false, "requiresVector": false }`;

export async function select(query: string, history: Message[] = []): Promise<Selection> {
  const client = getOpenAIClient();
  const recent = history.slice(-5).map((m) => ({ role: m.role, content: m.content }));

  const response = await client.responses.parse({
    model: 'gpt-4o-mini',
    input: [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\n${FEW_SHOT_EXAMPLES}` },
      ...recent,
      { role: 'user', content: query },
    ],
    temperature: 0,
    text: { format: zodTextFormat(QueryAnalysisSchema, 'queryAnalysis') },
  });

  const analysis = QueryAnalysisSchema.parse(response.output_parsed);

  const useSql = analysis.requiresSQL;
  let useRag = analysis.requiresVector;
  // A pure general question needs no retrieval at all — short-circuit.
  const isGeneral = analysis.intent === 'general_question';
  // But if it IS a records question and the analyzer picked neither engine, note-search.
  if (!isGeneral && !useSql && !useRag) useRag = true;

  return {
    analysis,
    needsSearch: useSql || useRag,
    useSql,
    useRag,
    semanticQuery: analysis.semanticQuery || query,
  };
}
