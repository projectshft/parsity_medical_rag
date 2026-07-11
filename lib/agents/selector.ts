/**
 * SELECTOR agent — structured output only (never streams).
 *
 * Wraps the query analyzer and turns its classification into a concrete plan:
 * which specialists to run, and whether we need to retrieve anything at all.
 * A pure `general_question` (no tie to the records) short-circuits — the route
 * skips SQL/RAG and lets the aggregator answer directly.
 */

import {
  analyzeQuery,
  type QueryAnalysis,
  type ConversationMessage,
} from '../query-analyzer';

export type Selection = {
  analysis: QueryAnalysis;
  /** False only for a pure general question — the route then skips retrieval. */
  needsSearch: boolean;
  useSql: boolean;
  useRag: boolean;
  /** The (expanded) query to embed for note search. */
  semanticQuery: string;
};

export async function select(
  query: string,
  history: ConversationMessage[] = [],
): Promise<Selection> {
  const analysis = await analyzeQuery(query, history);

  const useSql = analysis.requiresSQL;
  let useRag = analysis.requiresVector;

  // A question with no connection to the records needs no retrieval at all.
  const isGeneral = analysis.intent === 'general_question';
  // But if it IS a records question and the analyzer set neither engine
  // (it was unsure), fall back to a note search rather than answering blind.
  if (!isGeneral && !useSql && !useRag) useRag = true;

  return {
    analysis,
    needsSearch: useSql || useRag,
    useSql,
    useRag,
    semanticQuery: analysis.semanticQuery || query,
  };
}
