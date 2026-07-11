/**
 * SELECTOR agent — YOUR TASK. Structured output only (never streams).
 *
 * The selector reads the question and returns a PLAN: which specialists to run,
 * and whether we need to retrieve anything at all. A pure general question
 * (no tie to the records) should short-circuit — the route then skips SQL/RAG
 * and lets the aggregator answer directly.
 */

import type { QueryAnalysis } from '../query-analyzer';
import type { Message } from '../agent';

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
  history: Message[] = [],
): Promise<Selection> {
  // TODO:
  // 1. Call analyzeQuery(query) (lib/query-analyzer.ts) to classify the
  //    question and extract entities.
  // 2. Decide useSql / useRag from analysis.requiresSQL / analysis.requiresVector.
  // 3. Short-circuit: a pure `general_question` needs no retrieval, so
  //    needsSearch = false. But if it IS a records question and the analyzer
  //    set neither engine, fall back to a note search (useRag = true).
  // 4. Return { analysis, needsSearch, useSql, useRag, semanticQuery }
  //    (semanticQuery = analysis.semanticQuery || query).
  throw new Error('Not implemented — your turn! (lib/agents/selector.ts)');
}
