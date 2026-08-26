/**
 * INSTRUCTOR ONLY — build the seed file students load with `npm run db:seed`.
 *
 *   npm run db:export-seed                  # -> data/seed/medical-rag-seed.jsonl.gz
 *   npm run db:export-seed -- --limit 200   # cap the patient count
 *
 * Point DATABASE_URL at the populated course database, run this once per
 * cohort, then host the file (or commit it) and put the link in
 * `SEED_DATA_URL` in .env.example so `db:seed` can fetch it.
 *
 * Students never run this. It exists so the dataset is reproducible instead of
 * being a file someone has to remember to find.
 */

import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { PrismaClient } from '@prisma/client';
import { SEED_TABLES, LOCAL_SEED_PATH, type SeedTable } from './dataset';

const directUrl =
	process.env.DIRECT_URL ?? process.env.DATABASE_URL?.replace('-pooler.', '.');
const prisma = new PrismaClient(
	directUrl ? { datasources: { db: { url: directUrl } } } : undefined,
);

const PAGE = 1000;

/** Page through one table, oldest id first, yielding rows as we go. */
async function* readTable(
	table: SeedTable,
	patientIds: Set<string> | null,
): AsyncGenerator<Record<string, unknown>> {
	const delegate = {
		patients: prisma.patient,
		conditions: prisma.condition,
		observations: prisma.observation,
		medications: prisma.medication,
		encounters: prisma.encounter,
		notes: prisma.note,
	}[table] as {
		findMany: (a: unknown) => Promise<Record<string, unknown>[]>;
	};

	let cursor: string | undefined;
	while (true) {
		const rows = await delegate.findMany({
			take: PAGE,
			...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
			orderBy: { id: 'asc' },
			...(patientIds && table !== 'patients'
				? { where: { patientId: { in: [...patientIds] } } }
				: {}),
		});
		if (!rows.length) return;
		for (const row of rows) yield row;
		cursor = rows[rows.length - 1].id as string;
		if (rows.length < PAGE) return;
	}
}

async function main() {
	const args = process.argv.slice(2);
	const limitIdx = args.indexOf('--limit');
	const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined;

	const out = path.resolve(LOCAL_SEED_PATH);
	fs.mkdirSync(path.dirname(out), { recursive: true });

	// When capping, pick the patients first so the child rows stay consistent.
	let patientIds: Set<string> | null = null;
	if (limit) {
		const picked = await prisma.patient.findMany({
			take: limit,
			orderBy: { id: 'asc' },
			select: { id: true },
		});
		patientIds = new Set(picked.map((p) => p.id));
		console.log(`Capping export to ${patientIds.size} patients.`);
	}

	const gzip = createGzip();
	const written = pipeline(gzip, fs.createWriteStream(out));
	const counts = new Map<SeedTable, number>();

	for (const table of SEED_TABLES) {
		let n = 0;
		for await (const row of readTable(table, patientIds)) {
			if (
				table === 'patients' &&
				patientIds &&
				!patientIds.has(row.id as string)
			) {
				continue;
			}
			if (!gzip.write(JSON.stringify({ table, row }) + '\n')) {
				await new Promise((r) => gzip.once('drain', r));
			}
			n++;
		}
		counts.set(table, n);
		console.log(`  ${table}: ${n}`);
	}

	gzip.end();
	await written;

	const mb = (fs.statSync(out).size / 1e6).toFixed(1);
	console.log(
		`\nWrote ${path.relative(process.cwd(), out)} (${mb} MB).\n` +
			'Host it (or commit it) and set SEED_DATA_URL so `npm run db:seed` can find it.',
	);
}

main()
	.catch((err) => {
		console.error(err);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
