/**
 * Unified query executor
 *
 * Routes a question to the two stores and returns the combined result:
 *   - structured side  -> text-to-SQL (the LLM writes one read-only SELECT)
 *   - unstructured side -> vector search over the clinical notes
 *
 * PII: the front-office / obscured channel is now SHAPE-AGNOSTIC. Because the
 * SQL agent returns whatever columns the LLM chose, we can't pseudonymize a
 * known "name field" — instead we run the regex de-identifier (lib/pii.ts) over
 * the whole rendered output. That's imperfect by design (regex misses novel
 * formats), which is exactly the Week 5 lesson.
 */

import { analyzeQuery } from './query-analyzer';
import { textToSqlQuery } from './text-to-sql';
import { searchClinicalNotes } from './vector-search';
import type { QueryResult } from './types';
import { shouldObscurePII, obscureContent } from './pii';

export interface ExecuteQueryOptions {
  vectorTopK?: number;
  obscurePII?: boolean;
}

/**
 * Execute a user query using the hybrid RAG system.
 */
export async function executeQuery(
  userQuery: string,
  options: ExecuteQueryOptions = {}
): Promise<QueryResult> {
  const { vectorTopK = 10 } = options;

  const analysis = await analyzeQuery(userQuery);

  // Vector runs when asked for, or as the fallback when the router picks neither.
  const useVector =
    analysis.requiresVector || (!analysis.requiresSQL && !analysis.requiresVector);

  const [sql, vectorResults] = await Promise.all([
    analysis.requiresSQL ? textToSqlQuery(userQuery) : Promise.resolve(undefined),
    useVector
      ? searchClinicalNotes(analysis.semanticQuery || userQuery, { topK: vectorTopK })
      : Promise.resolve(undefined),
  ]);

  return { analysis, sql, vectorResults };
}

/**
 * Format query results into LLM context. When obscurePII is on, the entire
 * output is run through the regex de-identifier before it's returned.
 */
export function formatResultsForLLM(result: QueryResult, obscurePII?: boolean): string {
  const obscure = shouldObscurePII(obscurePII);
  const parts: string[] = [];

  // Structured (text-to-SQL) side
  if (result.sql) {
    parts.push('## Structured data (SQL)');
    parts.push(`_${result.sql.explanation}_`);
    if (result.sql.error) {
      parts.push(`The query failed: ${result.sql.error}.`);
    } else if (!result.sql.rows.length) {
      parts.push('0 rows — nothing in the records matches. Say there are none.');
    } else {
      parts.push(`${result.sql.rows.length} row(s):`);
      for (const row of result.sql.rows.slice(0, 25)) {
        parts.push('- ' + Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(', '));
      }
    }
    parts.push('');
  }

  // Clinical notes side
  if (result.vectorResults?.length) {
    parts.push('## Relevant Clinical Notes\n');
    for (const note of result.vectorResults.slice(0, 5)) {
      parts.push(`### ${note.patientName || 'Patient'} - ${note.documentType} (${note.date || 'undated'})`);
      parts.push(`Score: ${note.score.toFixed(3)}`);
      parts.push('```');
      parts.push(note.contentPreview);
      parts.push('```\n');
    }
  }

  const output = parts.join('\n');

  // Shape-agnostic PII scrub for the obscured channel: names, SSNs, phones,
  // emails, dates, addresses — over the whole thing, whatever columns appeared.
  return obscure ? obscureContent(output) : output;
}
