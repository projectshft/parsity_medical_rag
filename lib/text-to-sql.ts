/**
 * Text-to-SQL agent (Week 2) — YOUR TASK
 *
 * Instead of hand-coding query builders for every kind of question, feed the
 * database SCHEMA to the LLM and let it write ONE read-only SELECT, then run it.
 * This is how real teams do it — and it handles "smokers under 50", "youngest
 * diabetic", aggregates, and combined filters with zero per-query code.
 *
 * Two things make or break it (this is the lesson):
 *   1. SAFETY — an LLM writing SQL is an injection surface. Accept ONLY a single
 *      read-only SELECT (no INSERT/UPDATE/DELETE/DDL/`;`). In production, also
 *      point DATABASE_URL at a read-only role so a bad query physically can't write.
 *   2. VOCABULARY — the schema tells the model a `display` column exists, not
 *      what's IN it. "smoker" won't match the stored "Smokes tobacco daily".
 *      Ground the prompt with real values (SELECT DISTINCT display FROM ...).
 *
 * Reference: the Responses API + zodTextFormat pattern in CLAUDE.md, and
 * https://www.postgresql.org/docs. Needs OPENAI_API_KEY.
 */

// The shape the rest of the app expects back — keep this.
export type TextToSqlResult = {
  sql: string;
  explanation: string;
  rows: Record<string, unknown>[];
  error?: string;
};

export async function textToSqlQuery(
  question: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
): Promise<TextToSqlResult> {
  // TODO:
  // 1. Build a system prompt describing the schema (patients, conditions,
  //    observations, medications, notes, encounters + their columns), plus a
  //    sample of real DISTINCT display values so the model uses clinical wording.
  // 2. Ask the LLM for a single { sql, explanation } (Responses API +
  //    zodTextFormat over a Zod schema — see CLAUDE.md).
  // 3. VALIDATE: reject anything that isn't one read-only SELECT; enforce a LIMIT.
  // 4. Run it with prisma.$queryRawUnsafe and return { sql, explanation, rows }.
  //    On failure, return { sql, explanation, rows: [], error }.
  throw new Error('Not implemented — your turn! (lib/text-to-sql.ts)');
}
