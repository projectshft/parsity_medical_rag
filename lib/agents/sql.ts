/**
 * SQL agent — text-to-SQL. Feed the schema, get ONE read-only SELECT, run it.
 */

import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { openai } from '../openai';
import { prisma } from '../prisma';
import type { Message } from '../agent';

const SqlSchema = z.object({
	sql: z
		.string()
		.describe(
			'One read-only Postgres SELECT statement. No semicolons, no DML (INSERT/UPDATE/DELETE).',
		),
});

// Hand-written RULES — the guidance and the one relationship fact that schema
// introspection can't convey. The table/column list itself is pulled from the
// live database (introspectSchema) so the prompt never drifts from the real DB.
const RULES = `You write PostgreSQL for a medical-records database (read-only).
Columns are camelCase and MUST be double-quoted: p."firstName". Tables are lowercase.
Every table joins to patients via "patientId" -> patients.id.
Rules: SELECT only. Use ILIKE '%term%' on display columns. Always add a LIMIT.
Apply EVERY filter the user states. If they name a condition or medication, you
MUST filter on it (JOIN conditions/medications with ILIKE), even alongside
ORDER BY / LIMIT — never silently drop a stated constraint. "oldest patient WITH
hypertension" must filter on hypertension, not just order by "birthDate".
For "tell me about <patient>" / "what should I know about <patient>", return a
rich picture — the patient row plus their conditions and active medications — not
just name and birthDate.`;

// Read the real table + column list straight from Postgres, so the schema in the
// prompt always matches the database instead of a hand-maintained text dump.
async function introspectSchema(): Promise<string> {
	const cols = await prisma.$queryRawUnsafe<
		{ table_name: string; column_name: string }[]
	>(
		`SELECT table_name, column_name
		 FROM information_schema.columns
		 WHERE table_schema = 'public'
		   AND table_name NOT IN ('_prisma_migrations', 'users')
		 ORDER BY table_name, ordinal_position`,
	);

	const byTable = new Map<string, string[]>();
	for (const { table_name, column_name } of cols) {
		const list = byTable.get(table_name) ?? [];
		// Quote camelCase identifiers the way any query against them must.
		list.push(/[A-Z]/.test(column_name) ? `"${column_name}"` : column_name);
		byTable.set(table_name, list);
	}

	return [...byTable]
		.map(([table, columns]) => `${table}(${columns.join(', ')})`)
		.join('\n');
}

// Demo queries — all verified end-to-end against the data:
//   "how many patients have had a stroke?"                  -> ILIKE '%Stroke%'                     -> 113
//   "which patients have both hypertension and hyperlipidemia?" -> two EXISTS subqueries           -> 19 names
//   "who is the oldest patient with hypertension?"          -> JOIN conditions ILIKE '%Hypertension%' + ORDER BY "birthDate" ASC LIMIT 1 -> Avery Mueller (1911)
//   "how many patients had a heart attack?"                 -> ILIKE '%Myocardial Infarction%'      -> 25  (lay term -> SNOMED, from grounding)
//   "count patients on a statin"                            -> ILIKE '%statin%' AND status='active' -> 93  (lay term -> drug, + active filter)
// Skip lab-threshold queries (e.g. "glucose over 150") — the data is almost all normal readings, so they return ~1 row.
export async function runSql(
	query: string,
	history: Message[] = [],
): Promise<string> {
	// Schema comes from the live DB; the grounding below says what's IN the
	// columns ("Myocardial Infarction", not "heart attack"). Without the grounding,
	// lay terms return a confident 0 rows.
	const schema = await introspectSchema();

	const conditions = await prisma.$queryRawUnsafe<{ display: string }[]>(
		`SELECT DISTINCT display FROM conditions`,
	);
	const meds = await prisma.$queryRawUnsafe<{ display: string }[]>(
		`SELECT DISTINCT display FROM medications`,
	);
	const vocab = `Real condition names (match the user's words to these, use ILIKE):\n${conditions
		.map((c) => c.display)
		.join('; ')}\n\nReal medication names:\n${meds
		.map((m) => m.display)
		.join('; ')}`;

	const response = await openai.responses.parse({
		// gpt-4o (not mini): text-to-SQL is the hardest step — joins, filters, and
		// not dropping a stated constraint. Worth the upgrade; still faster than gpt-4.
		model: 'gpt-4o',
		input: [
			{
				role: 'system',
				content: `${RULES}\n\nTables (from the live database):\n${schema}\n\n${vocab}`,
			},
			{
				role: 'user',
				content: `User query: ${query}\n\nConversation history:\n${
					history.length > 0
						? history
								.slice(-5)
								.map((h) => `${h.role}: ${h.content}`)
								.join('\n')
						: '(none)'
				}`,
			},
		],
		temperature: 0,
		text: { format: zodTextFormat(SqlSchema, 'sqlQuery') },
	});

	const { sql } = SqlSchema.parse(response.output_parsed);
	console.log(`[sql agent] ${sql}`);

	const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql);
	if (rows.length === 0) return 'SQL result: 0 rows — nothing matches.';

	return (
		`SQL result (${rows.length} rows):\n` +
		rows
			.slice(0, 20)
			.map(
				(r) =>
					'- ' +
					Object.entries(r)
						.map(([k, v]) => `${k}: ${v}`)
						.join(', '),
			)
			.join('\n')
	);
}
