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

const prisma = new PrismaClient();

const SQL_BATCH_SIZE = 1000;

async function clearDatabase() {
  // Children first (cascades would handle it, but be explicit)
  await prisma.medication.deleteMany();
  await prisma.observation.deleteMany();
  await prisma.condition.deleteMany();
  await prisma.encounter.deleteMany();
  await prisma.patient.deleteMany();
}

async function insertBatched<T>(
  label: string,
  rows: T[],
  insert: (batch: T[]) => Promise<{ count: number }>
) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += SQL_BATCH_SIZE) {
    const batch = rows.slice(i, i + SQL_BATCH_SIZE);
    const result = await insert(batch);
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
