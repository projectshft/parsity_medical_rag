/**
 * Undo every write the agent made. Your week 4 undo button.
 *
 *   npm run db:reset              # undo all recorded writes, clear soft deletes
 *   npm run db:reset -- --dry-run # show what it would undo, change nothing
 *   npm run db:reset -- --hard    # truncate + reseed from a seed file (see below)
 *
 * Your database arrived pre-loaded — it's a Neon branch of the course database,
 * so you never ran a seed and you don't have the dataset on disk. That means the
 * old "truncate and reload" trick isn't available to you.
 *
 * It also isn't necessary, and that's the whole point of week 4's design:
 *
 *   - nothing is ever DELETEd, only stamped with `deletedAt`
 *   - every write lands an `audit_log` row carrying its `before` value
 *
 * So the data to restore your database is already *in* your database. This
 * script walks the audit log backwards and puts every field back. If you find
 * yourself wishing it could undo something it can't, that's a gap in your write
 * tools — go make them audit properly.
 *
 * `--hard` is the nuclear option and mostly exists for the instructor and for
 * capstone projects: it truncates and reloads from `data/seed/`. If you want a
 * genuinely untouched database, ask for a fresh Neon branch instead — that's a
 * one-click operation on our side and it costs you nothing.
 *
 * It only ever touches the database in your own DATABASE_URL.
 */

import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { PrismaClient, type Prisma } from '@prisma/client';
import { LOCAL_SEED_PATH } from './dataset';

const directUrl =
	process.env.DIRECT_URL ?? process.env.DATABASE_URL?.replace('-pooler.', '.');
const prisma = new PrismaClient(
	directUrl ? { datasources: { db: { url: directUrl } } } : undefined,
);

/**
 * Columns an undo is allowed to restore, and how to read them back out of the
 * audit row's JSON. A whitelist rather than "apply whatever `before` holds",
 * because `before` is written by your code and this script shouldn't be a way
 * to set arbitrary columns from a JSON blob.
 */
const RESTORABLE = {
	patient: {
		firstName: 'string',
		lastName: 'string',
		phone: 'string',
		city: 'string',
		state: 'string',
		followUpFlag: 'boolean',
		followUpReason: 'string',
		deletedAt: 'date',
	},
	note: {
		content: 'string',
		type: 'string',
		deletedAt: 'date',
	},
} as const satisfies Record<string, Record<string, 'string' | 'boolean' | 'date'>>;

type Entity = keyof typeof RESTORABLE;

const isEntity = (v: string): v is Entity => v in RESTORABLE;

/** Coerce a JSON value back to the type the column actually wants. */
function coerce(kind: 'string' | 'boolean' | 'date', value: unknown) {
	if (value === null || value === undefined) return null;
	if (kind === 'date') return typeof value === 'string' ? new Date(value) : value;
	if (kind === 'boolean') return Boolean(value);
	return String(value);
}

/** Build the `data` for one undo from an audit row's `before` blob. */
function undoData(entity: Entity, before: Prisma.JsonValue) {
	if (!before || typeof before !== 'object' || Array.isArray(before)) return null;
	const allowed = RESTORABLE[entity] as Record<string, 'string' | 'boolean' | 'date'>;
	const data: Record<string, unknown> = {};
	for (const [key, kind] of Object.entries(allowed)) {
		if (key in before) data[key] = coerce(kind, (before as Record<string, unknown>)[key]);
	}
	return Object.keys(data).length ? data : null;
}

async function hardReset() {
	if (!fs.existsSync(LOCAL_SEED_PATH)) {
		console.error(
			[
				'',
				`--hard needs the seed dataset at ${LOCAL_SEED_PATH}, which you don't have.`,
				'',
				'Your database is a pre-loaded Neon branch, so you never downloaded it.',
				'Two better options:',
				'  • `npm run db:reset` (no flag) — undoes every recorded write. Usually enough.',
				'  • ask in Slack for a fresh branch — instant, and genuinely pristine.',
				'',
			].join('\n'),
		);
		process.exit(1);
	}

	// TRUNCATE, not DELETE: DELETE leaves dead rows that still count against
	// Neon's project size limit, so a reseed can blow the cap while the old data
	// is still occupying space. TRUNCATE reclaims it immediately, and CASCADE
	// clears the child tables through their foreign keys.
	await prisma.$executeRawUnsafe(
		'TRUNCATE TABLE "audit_log","notes","observations","medications","encounters","conditions","patients" CASCADE',
	);
	console.log('Tables truncated. Reseeding …\n');
	await prisma.$disconnect();
	// Hand off rather than duplicating the loader — one seeding code path.
	const seed = spawnSync('npm', ['run', 'db:seed'], { stdio: 'inherit' });
	process.exit(seed.status ?? 0);
}

async function main() {
	const args = process.argv.slice(2);
	const dryRun = args.includes('--dry-run');

	if (!process.env.DATABASE_URL) {
		console.error('\nDATABASE_URL is not set. Copy .env.example to .env first.\n');
		process.exit(1);
	}
	const host = process.env.DATABASE_URL.match(/@([^/:]+)/)?.[1] ?? 'unknown host';

	if (args.includes('--hard')) return hardReset();

	console.log(
		`${dryRun ? 'Would undo' : 'Undoing'} agent writes on ${host} …\n`,
	);

	// Newest first: if two writes touched the same field, walking backwards
	// leaves the oldest `before` applied last, which is the original value.
	const entries = await prisma.auditLog.findMany({ orderBy: { at: 'desc' } });

	let undone = 0;
	let unrestorable = 0;
	for (const row of entries) {
		if (!isEntity(row.entity)) {
			unrestorable++;
			console.log(`  ? ${row.action} on unknown entity "${row.entity}" — skipped`);
			continue;
		}
		const data = undoData(row.entity, row.before);
		if (!data) {
			unrestorable++;
			console.log(
				`  ! ${row.action} (${row.entity} ${row.entityId}) has no usable "before" — can't undo`,
			);
			continue;
		}
		const fields = Object.keys(data).join(', ');
		console.log(`  ${dryRun ? '·' : '✓'} ${row.action} → restoring ${fields}`);
		if (!dryRun) {
			const delegate = row.entity === 'patient' ? prisma.patient : prisma.note;
			try {
				await (delegate as { update: (a: never) => Promise<unknown> }).update({
					where: { id: row.entityId },
					data,
				} as never);
				undone++;
			} catch {
				// The row may have been hard-deleted by something outside the
				// audited path — which is itself worth knowing about.
				unrestorable++;
				console.log(`  ! ${row.entity} ${row.entityId} no longer exists`);
			}
		}
	}

	// Belt and braces: catch soft deletes and flags set WITHOUT an audit row.
	// Finding any here means a write tool skipped its audit — a real bug, and
	// exactly the kind your week 4 tests should be failing on.
	//
	// "Unaudited" has to mean *not covered by an audit row*, not merely
	// "currently modified" — otherwise a dry run counts the rows it just
	// offered to undo and reports a bug that doesn't exist.
	const auditedIds = (entity: Entity) =>
		entries.filter((e) => e.entity === entity).map((e) => e.entityId);
	const unaudited = {
		notes: await prisma.note.count({
			where: {
				deletedAt: { not: null },
				id: { notIn: auditedIds('note') },
			},
		}),
		patients: await prisma.patient.count({
			where: {
				OR: [{ deletedAt: { not: null } }, { followUpFlag: true }],
				id: { notIn: auditedIds('patient') },
			},
		}),
	};
	const strays = unaudited.notes + unaudited.patients;
	if (strays > 0) {
		console.log(
			`\n  ⚠ ${strays} row(s) still modified with no audit trail ` +
				`(${unaudited.notes} note(s), ${unaudited.patients} patient(s)).\n` +
				'    A write that left no audit row is a bug in your write tool, not in this script.',
		);
		if (!dryRun) {
			await prisma.note.updateMany({
				where: { deletedAt: { not: null }, id: { notIn: auditedIds('note') } },
				data: { deletedAt: null },
			});
			await prisma.patient.updateMany({
				where: {
					OR: [{ deletedAt: { not: null } }, { followUpFlag: true }],
					id: { notIn: auditedIds('patient') },
				},
				data: { deletedAt: null, followUpFlag: false, followUpReason: null },
			});
			console.log('    Cleared them anyway.');
		}
	}

	if (dryRun) {
		console.log(
			`\nDry run — nothing changed. ${entries.length} audit row(s) would be replayed.\n`,
		);
		return;
	}

	await prisma.auditLog.deleteMany({});

	console.log(
		`\nDone. ${undone} write(s) undone` +
			(unrestorable ? `, ${unrestorable} could not be` : '') +
			', audit log cleared.',
	);
	if (undone > 0 || strays > 0) {
		console.log(
			'\nYour Pinecone index is now out of step: retracted notes had their\n' +
				'vectors deleted and restoring the row does not bring them back.\n' +
				'Run `npm run vectorize` to rebuild the index from Postgres.\n',
		);
	}
}

main()
	.catch((err) => {
		console.error(err);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
