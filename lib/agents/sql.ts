/**
 * SQL agent — YOUR TASK. Returns TEXT (never streams).
 *
 * Text-to-SQL: feed the database SCHEMA to the LLM, let it write ONE read-only
 * SELECT, run it, and render the rows as text for the aggregator. No hand-coded
 * query builders — the model writes the WHERE / ORDER BY / LIMIT itself.
 *
 * Two things are the lesson:
 *   1. SAFETY — an LLM writing SQL is an injection surface. Accept ONLY a single
 *      read-only SELECT (no INSERT/UPDATE/DELETE/DDL/`;`) and enforce a LIMIT.
 *   2. VOCABULARY — the schema says a `display` column exists, not what's IN it.
 *      "smoker" won't match the stored "Smokes tobacco daily". Ground the prompt
 *      with real DISTINCT display values.
 */

import type { Message } from '../agent';

export async function runSql(query: string, history: Message[] = []): Promise<string> {
  // TODO:
  // 1. Ask the LLM for a single { sql, explanation } (Responses API +
  //    zodTextFormat) from a system prompt that describes the schema (patients,
  //    conditions, observations, medications, notes, encounters + columns) plus a
  //    sample of real DISTINCT display values.
  // 2. Reject anything that isn't one read-only SELECT; make sure it has a LIMIT.
  // 3. Run it with prisma.$queryRawUnsafe.
  // 4. Return a text block: the explanation, then the error / "0 rows — none" /
  //    up to ~25 rows as "key: value" lines.
  throw new Error('Not implemented — your turn! (lib/agents/sql.ts)');
}
