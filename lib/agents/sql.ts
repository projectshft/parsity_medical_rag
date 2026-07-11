/**
 * SQL agent — YOUR TASK. Returns TEXT (never streams).
 *
 * Text-to-SQL: the LLM writes one read-only SELECT, you run it, and render the
 * rows into a context block the aggregator can read.
 */

import type { Message } from '../agent';

export async function runSql(
  query: string,
  history: Message[] = [],
): Promise<string> {
  // TODO:
  // 1. Call textToSqlQuery(query) (lib/text-to-sql.ts) to get { sql, explanation,
  //    rows, error }.
  // 2. Render it as a text block for the aggregator: the explanation, then either
  //    the error, a "0 rows — none" line, or up to ~25 rows as "key: value" lines.
  // 3. Return that string.
  throw new Error('Not implemented — your turn! (lib/agents/sql.ts)');
}
