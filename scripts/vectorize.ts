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
import { upsertChunks, MedicalChunk } from '../lib/pinecone';

const directUrl =
  process.env.DIRECT_URL ?? process.env.DATABASE_URL?.replace('-pooler.', '.');
const prisma = new PrismaClient(
  directUrl ? { datasources: { db: { url: directUrl } } } : undefined
);

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined;

  // TODO: 1. Read the notes from Postgres (prisma.note.findMany).
  //          Include the patient's name (include: { patient: {...} }) so you can
  //          put it in the metadata. Respect `limit` (take: limit).

  // TODO: 2. Shape each note into a MedicalChunk:
  //          { id: note.id,               // reuse the note id -> idempotent re-runs
  //            content: note.content,
  //            metadata: { patientId, patientName, type, date, source, chunkIndex } }
  //          Metadata is what you'll filter searches on later — choose well.
  const chunks: MedicalChunk[] = [];

  // TODO: 3. Embed + upsert them: `const n = await upsertChunks(chunks)`.

  console.log(`(stub) would vectorize ${chunks.length} notes (limit=${limit ?? 'all'})`);
  throw new Error('Not implemented — build the vectorize pipeline (see TODOs).');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
