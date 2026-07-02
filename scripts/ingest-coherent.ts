/**
 * Ingest the Synthea Coherent dataset into Postgres (Neon) + Pinecone
 *
 * - Structured data (patients, conditions, observations, medications) -> Postgres via Prisma
 * - Clinical notes (DocumentReference) -> Pinecone, one note = one vector (no chunking)
 *
 * Extraction logic lives in lib/fhir-extract.ts (shared with the upload API route).
 *
 * Usage:
 *   npm run ingest                          # full dataset (data/coherent/fhir)
 *   npm run ingest -- data/subset           # course subset
 *   npm run ingest -- --limit 10            # first 10 patients (smoke test)
 *   npm run ingest -- --skip-vectors        # Postgres only, skip Pinecone
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { upsertChunks, deleteAllChunks, MedicalChunk } from '../lib/pinecone';
import { processBundle, ExtractedBundle, FHIRBundle } from '../lib/fhir-extract';

// Bulk loads are far more reliable on Neon's DIRECT (non-pooled) connection —
// the transaction pooler drops long-running bulk sessions (P1017/P1001). Derive
// the direct URL from DATABASE_URL by dropping the "-pooler" suffix (Neon
// convention), or set DIRECT_URL explicitly.
const directUrl =
  process.env.DIRECT_URL ?? process.env.DATABASE_URL?.replace('-pooler.', '.');

const prisma = new PrismaClient(
  directUrl ? { datasources: { db: { url: directUrl } } } : undefined
);

const SQL_BATCH_SIZE = 500;

/**
 * Neon's pooled connection can drop during a long bulk load (the full dataset
 * has ~670k observations). Retry transient connection drops — Prisma reopens
 * the connection on the next query — so a from-scratch full ingest completes.
 */
async function withRetry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = (err as { code?: string })?.code;
      const transient =
        code === 'P1017' || // server closed the connection (pooler drop)
        code === 'P1001' || // can't reach server (Neon compute waking / transient)
        /closed the connection|reach database server|ECONNRESET|Connection terminated|timeout/i.test(
          msg
        );
      if (!transient || attempt >= tries) throw err;
      console.warn(`  (transient DB drop, retry ${attempt}/${tries - 1})`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

async function clearDatabase() {
  // Children first (cascades would handle it, but be explicit)
  await withRetry(() => prisma.medication.deleteMany());
  await withRetry(() => prisma.observation.deleteMany());
  await withRetry(() => prisma.condition.deleteMany());
  await withRetry(() => prisma.encounter.deleteMany());
  await withRetry(() => prisma.patient.deleteMany());
}

async function insertBatched<T>(
  label: string,
  rows: T[],
  insert: (batch: T[]) => Promise<{ count: number }>
) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += SQL_BATCH_SIZE) {
    const batch = rows.slice(i, i + SQL_BATCH_SIZE);
    const result = await withRetry(() => insert(batch));
    inserted += result.count;
  }
  console.log(`  ${label}: ${inserted} rows`);
}

async function main() {
  const args = process.argv.slice(2);
  const skipVectors = args.includes('--skip-vectors');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;
  const dirArg = args.find((a) => !a.startsWith('--') && a !== String(limit));

  const fhirDir = path.resolve(dirArg ?? path.join('data', 'coherent', 'fhir'));

  if (!fs.existsSync(fhirDir)) {
    console.error(`FHIR directory not found: ${fhirDir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(fhirDir)
    .filter((f) => f.endsWith('.json') && f !== 'manifest.json')
    .slice(0, limit);

  console.log(`Ingesting ${files.length} patient bundles from ${fhirDir}\n`);

  // Parse and extract everything first
  const patients: ExtractedBundle['patient'][] = [];
  const conditions: ExtractedBundle['conditions'] = [];
  const observations: ExtractedBundle['observations'] = [];
  const medications: ExtractedBundle['medications'] = [];
  const encounters: ExtractedBundle['encounters'] = [];
  const notes: MedicalChunk[] = [];

  for (const file of files) {
    try {
      const bundle = JSON.parse(
        fs.readFileSync(path.join(fhirDir, file), 'utf-8')
      ) as FHIRBundle;
      const extracted = processBundle(bundle);
      if (!extracted) {
        console.warn(`  No Patient resource in ${file}, skipping`);
        continue;
      }
      patients.push(extracted.patient);
      conditions.push(...extracted.conditions);
      observations.push(...extracted.observations);
      medications.push(...extracted.medications);
      encounters.push(...extracted.encounters);
      notes.push(...extracted.notes);
    } catch (err) {
      console.error(`  Error processing ${file}:`, err);
    }
  }

  console.log(
    `Extracted: ${patients.length} patients, ${conditions.length} conditions, ` +
      `${observations.length} observations, ${medications.length} medications, ` +
      `${encounters.length} encounters, ${notes.length} clinical notes\n`
  );

  // --- Postgres ---
  console.log('Clearing existing Postgres data...');
  await clearDatabase();

  console.log('Inserting into Postgres...');
  await insertBatched('patients', patients, (batch) =>
    prisma.patient.createMany({ data: batch, skipDuplicates: true })
  );
  await insertBatched('conditions', conditions, (batch) =>
    prisma.condition.createMany({ data: batch, skipDuplicates: true })
  );
  await insertBatched('observations', observations, (batch) =>
    prisma.observation.createMany({ data: batch, skipDuplicates: true })
  );
  await insertBatched('medications', medications, (batch) =>
    prisma.medication.createMany({ data: batch, skipDuplicates: true })
  );
  await insertBatched('encounters', encounters, (batch) =>
    prisma.encounter.createMany({ data: batch, skipDuplicates: true })
  );

  // --- Pinecone ---
  if (skipVectors) {
    console.log('\nSkipping Pinecone (--skip-vectors)');
  } else {
    console.log('\nClearing existing Pinecone vectors...');
    try {
      await deleteAllChunks();
    } catch {
      console.log('  (index may already be empty)');
    }

    console.log(`Embedding and upserting ${notes.length} clinical notes...`);
    const uploaded = await upsertChunks(notes);
    console.log(`  Uploaded ${uploaded} note vectors`);
  }

  console.log('\nDone!');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
