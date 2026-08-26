/**
 * Wipe YOUR database back to the shipped dataset.
 *
 *   npm run db:reset             # truncate, then reseed
 *   npm run db:reset -- --empty  # truncate and stop (leave it empty)
 *
 * Week 4 has you writing to real rows — flagging patients, retracting notes.
 * This is the undo button for when you write something you didn't mean to.
 * It only ever touches the database in your own DATABASE_URL.
 */

import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const directUrl =
	process.env.DIRECT_URL ?? process.env.DATABASE_URL?.replace('-pooler.', '.');
const prisma = new PrismaClient(
	directUrl ? { datasources: { db: { url: directUrl } } } : undefined,
);

async function main() {
	const emptyOnly = process.argv.includes('--empty');

	const host = process.env.DATABASE_URL?.match(/@([^/:]+)/)?.[1] ?? 'unknown host';
	console.log(`Resetting the database at ${host} …`);

	// TRUNCATE, not DELETE: DELETE leaves dead rows that still count against
	// Neon's project size limit, so a reseed can blow the cap while the old data
	// is still occupying space. TRUNCATE reclaims it immediately, and CASCADE
	// clears the child tables through their foreign keys.
	await prisma.$executeRawUnsafe(
		'TRUNCATE TABLE "audit_log","notes","observations","medications","encounters","conditions","patients" CASCADE',
	);
	console.log('Tables truncated.');

	if (emptyOnly) {
		console.log('Left empty as asked. `npm run db:seed` when you want it back.');
		return;
	}

	await prisma.$disconnect();
	// Hand off rather than duplicating the loader — one seeding code path.
	const seed = spawnSync('npm', ['run', 'db:seed'], { stdio: 'inherit' });
	process.exit(seed.status ?? 0);
}

main()
	.catch((err) => {
		console.error(err);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
