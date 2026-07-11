/**
 * Vectorize the notes — YOUR TASK (Week 1)
 *
 * The company already has all its data in Postgres (the system of record).
 * Your job: make the clinical NOTES searchable by *meaning* by building the
 * vector store — read each note from Postgres, embed it, and upsert it into
 * Pinecone. The vector store is a DERIVED index built from the database.
 *
 *   npm run vectorize -- --limit 200   # a cheap slice while you build/test
 *   npm run vectorize                  # all notes (embeds every note — costs $)
 *
 * Prereqs: DATABASE_URL (the pre-loaded DB), OPENAI_API_KEY, PINECONE_API_KEY.
 *
 * Reuse what exists: `upsertChunks(chunks)` from '../lib/pinecone' embeds AND
 * upserts a MedicalChunk[] for you (it batches the OpenAI + Pinecone calls).
 * You just have to read the notes and shape them.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { ensureIndexExists, upsertChunks, MedicalChunk } from '../lib/pinecone';

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

	// Create the index on first run (no-op if it already exists).
	await ensureIndexExists();

	// Read a page of 100, embed + upsert it, then read the next page (cursor
	// pagination) — we never hold more than 100 notes in memory, and progress
	// ships as we go instead of all at the end.
	const PAGE_SIZE = 100;
	let cursor: string | undefined;
	let total = 0;

	// Say what we're about to do BEFORE the first slow page.
	const noteCount = await prisma.note.count();
	const target = limit ? Math.min(limit, noteCount) : noteCount;
	const pages = Math.ceil(target / PAGE_SIZE);
	console.log(
		`Vectorizing ${target} of ${noteCount} notes into Pinecone index ` +
			`"${process.env.PINECONE_INDEX || 'medical-notes'}" — ` +
			`${pages} page(s) of ${PAGE_SIZE} (embed + upsert per page)…`,
	);
	const startedAt = Date.now();

	while (true) {
		// Respect --limit: shrink the final page so we stop exactly at the cap.
		const take = limit ? Math.min(PAGE_SIZE, limit - total) : PAGE_SIZE;
		if (take <= 0) break;

		const notes = await prisma.note.findMany({
			take,
			// The cursor points at the LAST row of the previous page; skip: 1
			// starts this page just after it.
			...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
			orderBy: { id: 'asc' }, // a cursor only works over a stable order
			include: {
				patient: {
					select: {
						firstName: true,
						lastName: true,
						birthDate: true,
						gender: true,
						race: true,
						state: true,
						city: true,
						// "current" meds = status 'active' (everything else is 'stopped')
						medications: {
							where: { status: 'active' },
							select: { display: true },
						},
					},
				},
			},
		});
		if (notes.length === 0) break;

		const chunks: MedicalChunk[] = notes.map((note) => {
			const age = note.patient.birthDate
				? Math.floor(
						(Date.now() - note.patient.birthDate.getTime()) /
							31557600000,
					)
				: undefined;

			return {
				id: note.id, // reuse the note id -> re-runs overwrite, never duplicate
				content: note.content, // what gets vectorized
				metadata: {
					patientId: note.patientId,
					firstName: note.patient.firstName ?? undefined,
					lastName: note.patient.lastName ?? undefined,
					age,
					gender: note.patient.gender ?? undefined,
					race: note.patient.race ?? undefined,
					city: note.patient.city ?? undefined,
					state: note.patient.state ?? undefined,
					source: 'postgres',
					currentMedications: note.patient.medications.map(
						(m) => m.display,
					),
				},
			};
		});

		total += await upsertChunks(chunks);
		cursor = notes[notes.length - 1].id;

		const page = Math.ceil(total / PAGE_SIZE);
		const elapsed = (Date.now() - startedAt) / 1000;
		const etaMin = ((elapsed / total) * (target - total)) / 60;
		console.log(
			`  page ${page}/${pages} — ${total}/${target} notes ` +
				`(${Math.round(elapsed)}s elapsed, ~${etaMin.toFixed(1)} min left)`,
		);
	}

	const mins = ((Date.now() - startedAt) / 60000).toFixed(1);
	console.log(`Done. Upserted ${total} note vectors in ${mins} min.`);
}

main()
	.catch((err) => {
		console.error(err);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
