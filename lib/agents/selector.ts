/**
 * SELECTOR agent — YOUR TASK. Structured output only (never streams).
 *
 * The selector just ROUTES: does this question need the SQL database (structured
 * facts, counts, filters), the clinical notes (meaning-based search), both, or
 * neither (a general question)? It does NOT extract conditions/filters/entities —
 * the SQL agent's LLM does that when it writes the query. Keep it tiny.
 */

import { z } from 'zod';
import { openai } from '../openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type { Message } from '../agent';

const PlanSchema = z.object({
  requiresSQL: z
    .boolean()
    .describe('Structured data is needed — counts, filters by condition/medication/lab/age, or a specific patient.'),
  requiresVector: z
    .boolean()
    .describe('The clinical notes are needed — questions about what notes say / describe / mention.'),
  semanticQuery: z
    .string()
    .nullable()
    .describe('If requiresVector, an expanded clinical phrasing of the question to embed for note search.'),
});

export type Plan = {
  useSql: boolean;
  useRag: boolean;
  /** false = a general question with no tie to the records — answer directly. */
  needsSearch: boolean;
  semanticQuery: string;
};

// TODO: Write the system prompt. Describe the two stores (SQL DB of structured
// facts; vector store of clinical notes) and when each is needed. A pure general
// question (a greeting, "what's a normal A1C range?") needs NEITHER. When unsure,
// prefer searching the notes.
const SYSTEM_PROMPT = `You route medical-records questions to the right data store(s).

TODO: Complete this prompt!
`;

export async function select(query: string, history: Message[] = []): Promise<Plan> {
  // TODO:
  // 1. Ask the LLM for { requiresSQL, requiresVector, semanticQuery } with
  //    openai.responses.parse({ model, input: [system(SYSTEM_PROMPT), ...recent
  //    history, user(query)], temperature: 0,
  //    text: { format: zodTextFormat(PlanSchema, 'plan') } }), then
  //    PlanSchema.parse(response.output_parsed).
  // 2. useSql = requiresSQL; useRag = requiresVector;
  //    needsSearch = useSql || useRag  (both false → a general question).
  // 3. Return { useSql, useRag, needsSearch, semanticQuery: semanticQuery || query }.
  void openai;
  throw new Error('Not implemented — your turn! (lib/agents/selector.ts)');
}
