/**
 * The seed dataset format — shared by `db:seed` and `db:export-seed`.
 *
 * One gzipped JSONL file. Each line is `{"table":"patients","row":{...}}`.
 * Lines are written parents-first (patients, then everything that references
 * them) so a straight top-to-bottom load never trips a foreign key.
 *
 * Why JSONL and not a pg_dump: a dump is tied to one Postgres version and one
 * schema state. This loads through Prisma, so it works on whatever Neon hands
 * you and it fails loudly if the schema has drifted — which is the behaviour
 * you want when 20 people are each pointing at their own fresh database.
 */

/** Tables in load order. Children must follow their parent. */
export const SEED_TABLES = [
	'patients',
	'conditions',
	'observations',
	'medications',
	'encounters',
	'notes',
] as const;

export type SeedTable = (typeof SEED_TABLES)[number];

/** Columns to revive from ISO strings back into Dates on the way in. */
export const DATE_COLUMNS: Record<SeedTable, string[]> = {
	patients: ['birthDate', 'deathDate', 'deletedAt'],
	conditions: ['onsetDate', 'abatementDate'],
	observations: ['effectiveDate'],
	medications: ['authoredOn'],
	encounters: ['startDate', 'endDate'],
	notes: ['date', 'deletedAt'],
};

export type SeedLine = { table: SeedTable; row: Record<string, unknown> };

/** Turn ISO date strings back into Dates so Prisma gets the right types. */
export function reviveDates(table: SeedTable, row: Record<string, unknown>) {
	for (const col of DATE_COLUMNS[table]) {
		const v = row[col];
		if (typeof v === 'string') row[col] = new Date(v);
	}
	return row;
}

/**
 * Where the seed file lives, in order of preference:
 *   1. a local file you already downloaded (or that your instructor committed)
 *   2. SEED_DATA_URL from .env
 */
export const LOCAL_SEED_PATH = 'data/seed/medical-rag-seed.jsonl.gz';
