/**
 * SELECTOR agent — structured output only (never streams).
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

const SYSTEM_PROMPT = `You route medical-records questions to the right data store(s).

There are two stores:
1. SQL database — structured facts: patients (name, gender, birth/death dates,
   city), conditions, observations (labs/vitals with values), medications, and
   encounters. Needed for counts ("how many..."), filters by condition /
   medication / lab value / age, superlatives ("youngest diabetic"), and
   lookups or summaries of a specific named patient.
2. Vector store — free-text clinical notes (SOAP-style encounter notes),
   searched by MEANING. Needed when the answer lives in what the notes SAY:
   symptoms described, narrative history, "what do the notes mention about...".

Set requiresSQL and/or requiresVector accordingly — a question can need both
("what do the notes say about sleep for patients with depression?").

A pure GENERAL question — a greeting, small talk, or general medical knowledge
with no tie to these patient records ("what's a normal A1C range?", "who are
you?") — needs NEITHER: set both to false.

If requiresVector, write semanticQuery as an expanded clinical phrasing of the
question, including synonyms a clinician might use in a note.

Conversation history may precede the latest message — use it only to resolve
follow-ups. When unsure whether a records question fits either store, prefer
searching the notes (requiresVector).`;

export async function select(query: string, history: Message[] = []): Promise<Plan> {
  const recent = history.slice(-5).map((m) => ({ role: m.role, content: m.content }));

  const response = await openai.responses.parse({
    model: 'gpt-4o-mini',
    input: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...recent,
      { role: 'user', content: query },
    ],
    temperature: 0,
    text: { format: zodTextFormat(PlanSchema, 'plan') },
  });

  const { requiresSQL, requiresVector, semanticQuery } = PlanSchema.parse(response.output_parsed);

  const useSql = requiresSQL;
  const useRag = requiresVector;
  return {
    useSql,
    useRag,
    needsSearch: useSql || useRag,
    semanticQuery: semanticQuery || query,
  };
}
