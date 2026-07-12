/**
 * RAG agent — returns TEXT (never streams).
 *
 * Meaning-based search over the clinical notes, rendered into a context block
 * for the aggregator (or for MCP).
 */

import { searchClinicalNotes } from '../vector-search';

export async function runRag(semanticQuery: string): Promise<string> {
  const results = await searchClinicalNotes(semanticQuery, { topK: 10 });
  if (!results.length) return '## Relevant Clinical Notes\n(none found)';

  const parts = ['## Relevant Clinical Notes\n'];
  for (const note of results.slice(0, 5)) {
    parts.push(`### ${note.patientName || 'Patient'} - ${note.documentType} (${note.date || 'undated'})`);
    parts.push(`Score: ${note.score.toFixed(3)}`);
    parts.push('```');
    parts.push(note.contentPreview);
    parts.push('```\n');
  }
  return parts.join('\n');
}
