/**
 * Load the course dataset into YOUR database.
 *
 *   npm run db:seed                # the whole thing (~200 patients, ~21k notes)
 *   npm run db:seed -- --limit 25  # 25 patients and their records — fast smoke test
 *   npm run db:seed -- --force     # reseed even if rows are already there
 *
 * Prereq: `npm run db:push` (creates the tables). Run that first.
 *
 * This is the step that used to not exist. In previous cohorts everyone shared
 * one read-only database, which meant nobody could practise a write and one
 * flaky connection took out the whole class. Now the database is yours: you can
 * break it, and `npm run db:reset` puts it back.
 */

import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { PrismaClient } from '@prisma/client';
import {
	SEED_TABLES,
	LOCAL_SEED_PATH,
	reviveDates,
	type SeedLine,
	type SeedTable,
} from './dataset';

// Bulk loads are far more reliable on Neon's DIRECT (non-pooled) connection —
// the transaction pooler drops long-running bulk sessions. Derive the direct URL
// by dropping the "-pooler" suffix, or set DIRECT_URL explicitly.
const directUrl =
	process.env.DIRECT_URL ?? process.env.DATABASE_URL?.replace('-pooler.', '.');
const prisma = new PrismaClient(
	directUrl ? { datasources: { db: { url: directUrl } } } : undefined,
);

const BATCH_SIZE = 500;

/**
 * Neon's connection can drop mid-load. Prisma reopens on the next query, so a
 * retry with backoff is the difference between "finished" and "got to 40% and
 * gave up" — which is exactly what bit half of Cohort 3.
 */
async function withRetry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
	for (let attempt = 1; ; attempt++) {
		try {
			return await fn();
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			const code = (err as { code?: string })?.code;
			const transient =
				code === 'P1017' || // server closed the connection
				code === 'P1001' || // can't reach server (Neon compute waking)
				/closed the connection|reach database server|ECONNRESET|Connection terminated|timeout/i.test(
					msg,
				);
			if (!transient || attempt >= tries) throw err;
			console.warn(`  (transient DB drop — retry ${attempt}/${tries - 1})`);
			await new Promise((r) => setTimeout(r, 2000 * attempt));
		}
	}
}

/** Find the seed file, downloading and caching it if we only have a URL. */
async function resolveSeedFile(): Promise<string> {
	const local = path.resolve(LOCAL_SEED_PATH);
	if (fs.existsSync(local)) return local;

	const url = process.env.SEED_DATA_URL;
	if (!url) {
		console.error(
			[
				'',
				`Could not find the seed dataset at ${LOCAL_SEED_PATH}, and SEED_DATA_URL is not set.`,
				'',
				'Fix it one of two ways:',
				`  • put the file your instructor shared at ${LOCAL_SEED_PATH}, or`,
				'  • add SEED_DATA_URL=<the link from Slack> to your .env',
				'',
				'Then run `npm run db:seed` again.',
				'',
			].join('\n'),
		);
		process.exit(1);
	}

	console.log(`Downloading the dataset from ${url} …`);
	fs.mkdirSync(path.dirname(local), { recursive: true });
	const res = await fetch(url);
	if (!res.ok || !res.body) {
		console.error(
			`Download failed: ${res.status} ${res.statusText}. Check SEED_DATA_URL.`,
		);
		process.exit(1);
	}
	const tmp = `${local}.part`;
	await pipeline(Readable.fromWeb(res.body as never), fs.createWriteStream(tmp));
	fs.renameSync(tmp, local);
	const mb = (fs.statSync(local).size / 1e6).toFixed(1);
	console.log(`Saved ${LOCAL_SEED_PATH} (${mb} MB) — cached for next time.\n`);
	return local;
}

async function currentCounts() {
	return {
		patients: await prisma.patient.count(),
		notes: await prisma.note.count(),
	};
}

/** Insert one batch, skipping rows that are already there (so reruns are safe). */
async function insertBatch(table: SeedTable, rows: Record<string, unknown>[]) {
	const delegate = {
		patients: prisma.patient,
		conditions: prisma.condition,
		observations: prisma.observation,
		medications: prisma.medication,
		encounters: prisma.encounter,
		notes: prisma.note,
	}[table];

	// `as never` because the six delegates have six different row types; the
	// dataset file is the contract that keeps them honest.
	return withRetry(() =>
		(delegate as { createMany: (a: never) => Promise<{ count: number }> }).createMany(
			{ data: rows, skipDuplicates: true } as never,
		),
	);
}

async function main() {
	const args = process.argv.slice(2);
	const force = args.includes('--force');
	const limitIdx = args.indexOf('--limit');
	const patientLimit =
		limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;

	// Confirm we can reach the database AND that the tables exist, before we go
	// looking for a 30 MB download. These are different problems with different
	// fixes, so say which one it is.
	try {
		await prisma.patient.count();
	} catch (err) {
		const code = (err as { code?: string })?.code;
		const msg = err instanceof Error ? err.message : String(err);
		if (!process.env.DATABASE_URL) {
			console.error('\nDATABASE_URL is not set. Copy .env.example to .env and fill it in.\n');
		} else if (code === 'P1001' || /reach database server/i.test(msg)) {
			const host = process.env.DATABASE_URL.match(/@([^/:]+)/)?.[1] ?? 'that host';
			console.error(
				`\nCan't reach the database at ${host}. Check DATABASE_URL — and if the\n` +
					'Neon compute is asleep, open the Neon console once to wake it.\n',
			);
		} else {
			console.error(
				'\nYour database has no tables yet. Run `npm run db:push` first, then seed.\n',
			);
		}
		process.exit(1);
	}

	const before = await currentCounts();
	if (before.patients > 0 && !force) {
		console.log(
			`Database already has ${before.patients} patients and ${before.notes} notes.\n` +
				'Nothing to do. Use `npm run db:seed -- --force` to top it up, or ' +
				'`npm run db:reset` to wipe and start over.',
		);
		return;
	}

	const file = await resolveSeedFile();
	console.log(
		`Seeding from ${path.relative(process.cwd(), file)}` +
			(patientLimit === Infinity ? '' : ` (first ${patientLimit} patients)`) +
			' …',
	);
	const startedAt = Date.now();

	// Stream it: gunzip → lines → batched inserts. We never hold the whole
	// dataset in memory, so this works the same on a laptop with 8 GB as 64.
	const lines = readline.createInterface({
		input: fs.createReadStream(file).pipe(createGunzip()),
		crlfDelay: Infinity,
	});

	const buffers = new Map<SeedTable, Record<string, unknown>[]>();
	const totals = new Map<SeedTable, number>();
	const keptPatients = new Set<string>();
	let seenPatients = 0;

	const flush = async (table: SeedTable) => {
		const rows = buffers.get(table);
		if (!rows?.length) return;
		const { count } = await insertBatch(table, rows);
		totals.set(table, (totals.get(table) ?? 0) + count);
		buffers.set(table, []);
		process.stdout.write(
			`\r  ${SEED_TABLES.map((t) => `${t}: ${totals.get(t) ?? 0}`).join('  ')}   `,
		);
	};

	for await (const line of lines) {
		if (!line.trim()) continue;
		const { table, row } = JSON.parse(line) as SeedLine;

		// --limit keeps a coherent slice: N patients and only their records.
		if (table === 'patients') {
			seenPatients++;
			if (seenPatients > patientLimit) continue;
			keptPatients.add(row.id as string);
		} else if (
			patientLimit !== Infinity &&
			!keptPatients.has(row.patientId as string)
		) {
			continue;
		}

		const buf = buffers.get(table) ?? [];
		buf.push(reviveDates(table, row));
		buffers.set(table, buf);
		if (buf.length >= BATCH_SIZE) await flush(table);
	}

	// Flush what's left, parents first.
	for (const table of SEED_TABLES) await flush(table);

	const after = await currentCounts();
	const secs = ((Date.now() - startedAt) / 1000).toFixed(0);
	console.log(
		`\n\nDone in ${secs}s — ${after.patients} patients, ${after.notes} clinical notes.\n` +
			'Next: `npm run doctor` to check every service, then `npm run vectorize`.',
	);
}

main()
	.catch((err) => {
		console.error('\n', err);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
