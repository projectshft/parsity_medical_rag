/**
 * Vectorize the notes — INSTRUCTOR REFERENCE SOLUTION
 *
 * The company already has all its data in Postgres (the system of record).
 * This script makes the clinical NOTES searchable by *meaning*: read each note
 * from Postgres, embed it, and upsert it into the vector store (Pinecone).
 *
 * That's the whole idea — the vector store is a DERIVED index built from the
 * database. This is how you "service" existing data for semantic search.
 *
 *   npm run vectorize                # all notes (embeds every note — costs $)
 *   npm run vectorize -- --limit 200 # a cheap slice while you build/test
 *
 * Prereqs: DATABASE_URL (the pre-loaded DB), OPENAI_API_KEY, PINECONE_API_KEY.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { upsertChunks, ensureIndexExists, MedicalChunk } from '../lib/pinecone';

// Bulk reads are steadier on Neon's direct (non-pooled) connection.
const directUrl =
	process.env.DIRECT_URL ??
	process.env.DATABASE_URL?.replace('-pooler.', '.');
const prisma = new PrismaClient(
	directUrl ? { datasources: { db: { url: directUrl } } } : undefined,
);

async function main() {
	const args = process.argv.slice(2);
	const limitIdx = args.indexOf('--limit');
	const limit =
		limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined;

	// 0. Make sure the vector index exists (creates it on first run).
	await ensureIndexExists();

	// 1. Read the notes from Postgres (the system of record).
	const notes = await prisma.note.findMany({
		take: limit,
		include: { patient: { select: { firstName: true, lastName: true } } },
	});
	console.log(`Vectorizing ${notes.length} notes from Postgres...`);

	// 2. Shape each note for the vector store — the text plus the metadata we
	//    want to be able to filter on later (patient, type, date).
	const chunks: MedicalChunk[] = notes.map((note) => ({
		id: note.id, // reuse the note's id as the vector id -> re-runs are idempotent
		content: note.content,
		metadata: {
			resourceType: 'Note',
			patientId: note.patientId,
			patientName: [note.patient.firstName, note.patient.lastName]
				.filter(Boolean)
				.join(' '),
			type: note.type ?? 'Clinical Note',
			date: note.date ? note.date.toISOString().slice(0, 10) : '',
			source: 'postgres',
			chunkIndex: 0, // notes are self-contained — one note = one vector, no chunking
		},
	}));

	// 3. Embed + upsert. upsertChunks batches the OpenAI + Pinecone calls for us.
	const upserted = await upsertChunks(chunks);
	console.log(`Done. Upserted ${upserted} note vectors into Pinecone.`);
}

main()
	.catch((err) => {
		console.error(err);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
