/**
 * RAG agent — returns TEXT (never streams).
 *
 * Meaning-based search over the clinical notes, rendered into a context block
 * for the aggregator. Reuses formatResultsForLLM so the note formatting (and
 * the channel-based PII scrub) stays in one place.
 */

import { searchClinicalNotes } from '../vector-search';
import { formatResultsForLLM } from '../query-executor';
import type { QueryAnalysis } from '../query-analyzer';

export async function runRag(
  semanticQuery: string,
  analysis: QueryAnalysis,
): Promise<string> {
  const vectorResults = await searchClinicalNotes(semanticQuery, { topK: 10 });
  return formatResultsForLLM({ analysis, vectorResults });
}
