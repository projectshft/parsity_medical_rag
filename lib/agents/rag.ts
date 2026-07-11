/**
 * RAG agent — YOUR TASK. Returns TEXT (never streams).
 *
 * Meaning-based search over the clinical notes, rendered into a context block
 * for the aggregator.
 */

export async function runRag(semanticQuery: string): Promise<string> {
  // TODO:
  // 1. Call searchClinicalNotes(semanticQuery, { topK: 10 }) (lib/vector-search.ts).
  // 2. Render the returned notes into a readable text block for the aggregator
  //    (patient, date, and a snippet of each note's content).
  // 3. Return that string.
  throw new Error('Not implemented — your turn! (lib/agents/rag.ts)');
}
