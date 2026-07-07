/**
 * Text-to-SQL agent (PROTOTYPE / experiment)
 *
 * An alternative to the hand-coded query builders (lib/sql-queries.ts): feed
 * the schema to the LLM, have it write ONE read-only SELECT, run it, hand the
 * rows to the aggregator. This is what kills the whole class of query-layer
 * bugs — "smokers under 50", "youngest diabetic", superlatives, combined
 * filters — because the model writes the WHERE/ORDER BY/LIMIT itself.
 *
 * Two guardrails matter (see the course discussion):
 *  1. SAFETY — an LLM writing SQL is the injection. `assertReadOnly` blocks
 *     anything but a single SELECT. In production, ALSO point DATABASE_URL at a
 *     read-only role (we have `student_ro`) so a bad query physically can't write.
 *  2. VOCABULARY — the schema alone doesn't tell the model that "smoker" is
 *     stored as "Smokes tobacco daily". We ground it with a sample of DISTINCT
 *     display values so it uses the real clinical terms (via ILIKE).
 */

import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { openai } from './openai';
import { prisma } from './prisma';

const SqlQuerySchema = z.object({
  sql: z
    .string()
    .describe(
      'A single read-only Postgres SELECT that answers the question. No semicolons, no comments, no INSERT/UPDATE/DELETE/DDL.',
    ),
  explanation: z.string().describe('One sentence: what this query returns.'),
});

export type TextToSqlResult = {
  sql: string;
  explanation: string;
  rows: Record<string, unknown>[];
  error?: string;
};

const SCHEMA = `You write PostgreSQL for a medical-records database. Table names are lowercase
and unquoted. Column names are camelCase and MUST be double-quoted exactly as shown
(e.g. p."firstName", c."patientId"). There are NO snake_case columns.

patients(id, "firstName", "lastName", gender, "birthDate" date, "deathDate" date, phone, "maritalStatus", race, ethnicity, city, state)
conditions(id, "patientId", code, display, "clinicalStatus", "onsetDate", "abatementDate")   -- display = SNOMED name
observations(id, "patientId", code, display, category, "valueNumber", "valueString", unit, "effectiveDate")  -- display = LOINC name
medications(id, "patientId", code, display, status, "authoredOn", dosage)   -- display = RxNorm name
notes(id, "patientId", type, date, content)   -- content = full clinical note text
encounters(id, "patientId", "classCode", type, status, "startDate", "endDate", "serviceProvider")

Joins: every clinical table has "patientId" -> patients.id.

Rules:
- ALWAYS double-quote the camelCase columns: p."firstName", p."lastName", p."birthDate", c."patientId". id is lowercase, unquoted.
- Read-only SELECT only. Never write. Always end with a LIMIT (<= 100).
- Free-text columns (display, content, type) use ILIKE '%term%' — the data uses clinical/SNOMED wording, not lay terms (grounding below).
- Age in years = date_part('year', age(p."birthDate")). "youngest" = ORDER BY p."birthDate" DESC; "oldest" = ASC.
- "patients with BOTH condition A and B": a single condition row can't match both — use two EXISTS subqueries, e.g.
  WHERE EXISTS (SELECT 1 FROM conditions c1 WHERE c1."patientId"=p.id AND c1.display ILIKE '%A%')
    AND EXISTS (SELECT 1 FROM conditions c2 WHERE c2."patientId"=p.id AND c2.display ILIKE '%B%')
- Dedupe patients with DISTINCT or GROUP BY p.id.
- Return useful columns for a human answer (names, the matched display, dates) — not just ids.`;

// TODO (semantic grounding — the hard part of text-to-SQL): map the user's
// everyday words to the actual clinical values stored in the columns. The
// schema tells the model a `display` column EXISTS, but not WHAT'S IN IT — so
// lay terms silently match nothing and the answer is a confident, wrong "none":
//   - "heart attack"        → the column says "Myocardial Infarction"
//                             (ILIKE '%heart attack%' matches 0 rows)
//   - "high blood pressure" → the column says "Hypertension"
//   - "smoker"              → the condition is "Smokes tobacco daily"
// The distinct-value dump below is a first pass, but it's long and unranked, so
// the model can miss it. Better: give it an explicit synonym map (lay term →
// real display / SNOMED code), or resolve the user's terms against the
// vocabulary BEFORE it writes SQL. This mapping is the real work — text-to-SQL
// moves the effort here, it doesn't remove it.

// Grounding: real distinct display values so the model uses the right terms
// (e.g. "Smokes tobacco daily", not "smoker"). Fetched once, cached.
let vocabCache: string | null = null;
async function getVocab(): Promise<string> {
  if (vocabCache) return vocabCache;
  try {
    // Include ALL distinct condition displays (there are ~120) so terms like
    // "Smokes tobacco daily" are never cut off — vocabulary coverage is the
    // whole point of the grounding. Observations are ordered by frequency.
    const conds = await prisma.$queryRawUnsafe<{ display: string }[]>(
      `SELECT DISTINCT display FROM conditions ORDER BY display LIMIT 300`,
    );
    const obs = await prisma.$queryRawUnsafe<{ display: string }[]>(
      `SELECT display FROM observations GROUP BY display ORDER BY COUNT(*) DESC LIMIT 120`,
    );
    vocabCache =
      `Real conditions.display values (use these terms):\n${conds.map((c) => c.display).join('; ')}\n\n` +
      `Real observations.display values:\n${obs.map((o) => o.display).join('; ')}`;
  } catch {
    vocabCache = '(vocabulary sample unavailable)';
  }
  return vocabCache;
}

/** Reject anything that isn't a single read-only SELECT. */
function assertReadOnly(sql: string): void {
  const trimmed = sql.trim().replace(/;\s*$/, '');
  if (/;/.test(trimmed)) throw new Error('Only a single statement is allowed');
  if (!/^\s*(select|with)\b/i.test(trimmed)) throw new Error('Only SELECT queries are allowed');
  if (/\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy)\b/i.test(trimmed)) {
    throw new Error('Write / DDL keywords are not allowed');
  }
}

/** BigInt (from count()) isn't JSON-serializable — coerce for the aggregator. */
function serializeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((r) =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => [
        k,
        typeof v === 'bigint' ? Number(v) : v instanceof Date ? v.toISOString().slice(0, 10) : v,
      ]),
    ),
  );
}

export async function textToSqlQuery(
  question: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
): Promise<TextToSqlResult> {
  const vocab = await getVocab();
  const today = new Date().toISOString().slice(0, 10);

  const response = await openai.responses.parse({
    model: 'gpt-4o-mini',
    input: [
      { role: 'system', content: `${SCHEMA}\n\nToday is ${today}.\n\n${vocab}` },
      ...history,
      { role: 'user', content: question },
    ],
    temperature: 0,
    text: { format: zodTextFormat(SqlQuerySchema, 'sqlQuery') },
  });

  const { sql, explanation } = SqlQuerySchema.parse(response.output_parsed);
  assertReadOnly(sql);
  const safeSql = /\blimit\b/i.test(sql) ? sql : `${sql.trim().replace(/;\s*$/, '')} LIMIT 50`;

  try {
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(safeSql);
    return { sql: safeSql, explanation, rows: serializeRows(rows) };
  } catch (e) {
    return { sql: safeSql, explanation, rows: [], error: e instanceof Error ? e.message : String(e) };
  }
}
