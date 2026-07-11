/**
 * SQL agent — returns TEXT (never streams).
 *
 * Text-to-SQL: the LLM writes one read-only SELECT (lib/text-to-sql.ts), we run
 * it, and render the rows into a context block the aggregator can read.
 */

import { textToSqlQuery, type TextToSqlResult } from '../text-to-sql';
import type { Message } from '../agent';

export async function runSql(
  query: string,
  history: Message[] = [],
): Promise<string> {
  const result = await textToSqlQuery(query, history);
  return formatSqlResult(result);
}

/** Render the text-to-SQL result as a context block for the aggregator. */
function formatSqlResult(r: TextToSqlResult): string {
  const parts = ['## Structured data (SQL)', `_${r.explanation}_`];
  if (r.error) {
    parts.push(`The query failed: ${r.error}. Tell the user you couldn't retrieve that.`);
  } else if (r.rows.length === 0) {
    parts.push('0 rows — nothing in the records matches. Say there are none.');
  } else {
    parts.push(`${r.rows.length} row(s):`);
    for (const row of r.rows.slice(0, 25)) {
      parts.push('- ' + Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(', '));
    }
  }
  return parts.join('\n');
}
