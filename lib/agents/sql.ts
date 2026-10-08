/**
 * SQL agent — Week 3. Text-to-SQL: the LLM writes the query. Returns TEXT.
 *
 * Week 3 · assignment: docs/CHALLENGE-TOOL-CALLING.md
 *
 * The shape we're building:
 *   1. give the model the schema (prisma/schema.prisma) PLUS real distinct
 *      values from the data — the schema says a column exists, not what's in it
 *      ("heart attack" is stored as "Myocardial Infarction")
 *   2. get back ONE read-only SELECT (structured output)
 *   3. guard it — `assertReadOnly(sql)`: a single SELECT, nothing else
 *   4. run it and render the rows as text for the aggregator
 *
 * Do NOT hand-write a query function per question. When a query comes back
 * wrong, fix the prompt or the grounding.
 */

import type { Message } from '../agent';

export async function runSql(
	query: string,
	history: Message[] = [],
): Promise<string> {
	throw new Error('Not built yet — Week 3 (lib/agents/sql.ts)');
}
