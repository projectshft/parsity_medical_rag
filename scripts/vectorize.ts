/**
 * Vectorize the notes — Week 1, built together in class.
 *
 * Postgres is the system of record. Pinecone is a DERIVED index we build from
 * it: read each clinical note, shape it into a `MedicalChunk`, and hand the
 * chunks to `upsertChunks()` (lib/pinecone.ts), which embeds AND upserts them,
 * 100 at a time, with retries.
 *
 *   npm run vectorize -- --limit 5     # prove it works, then check the Pinecone console
 *   npm run vectorize                  # all ~21,000 notes (15–25 min, a few cents)
 *
 * Before the first run:
 *   1. Create the index in the Pinecone console (we pick the dimension in class).
 *   2. Put its EXACT name in .env as PINECONE_INDEX.
 *
 * Prereqs: DATABASE_URL (the pre-loaded DB), OPENAI_API_KEY, PINECONE_API_KEY,
 * PINECONE_INDEX.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { upsertChunks, MedicalChunk } from '../lib/pinecone';

// The long read over ~21k notes times out on Neon's POOLED host, so prefer the
// direct (non-pooler) connection. Same credentials either way.
const directUrl =
	process.env.DIRECT_URL ??
	process.env.DATABASE_URL?.replace('-pooler.', '.');
const prisma = new PrismaClient(
	directUrl ? { datasources: { db: { url: directUrl } } } : undefined,
);

// `--limit 5` → 5. No flag → undefined (all notes).
const limitIdx = process.argv.indexOf('--limit');
const limit =
	limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1], 10) : undefined;

async function main() {
	// TODO 1 — read the notes from Postgres:
	//   prisma.note.findMany({ take: limit, include: { patient: { ... } } })
	//   Pull in whichever patient fields we decide to store as metadata.

	// TODO 2 — shape each note into a MedicalChunk (see lib/pinecone.ts):
	//   id:       the note's id (re-runs then overwrite instead of duplicating)
	//   content:  the note text — the ONLY thing that gets embedded
	//   metadata: the fields we decided on in class

	// TODO 3 — embed + upsert them:
	//   const total = await upsertChunks(chunks);

	const chunks: MedicalChunk[] = [];
	console.log(
		`Built ${chunks.length} chunks${limit ? ` (limit ${limit})` : ''}.`,
	);
	throw new Error(
		'Not built yet — we write this together in class (scripts/vectorize.ts)',
	);
}

main()
	.catch((err) => {
		console.error(err);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
