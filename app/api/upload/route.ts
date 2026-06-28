/**
 * Upload API — YOUR TASK (docs/CHALLENGE-UPLOAD-API.md)
 *
 * Ingest a single FHIR bundle through the new pipeline:
 *   - structured rows -> Postgres (additive + idempotent on re-upload)
 *   - clinical notes  -> Pinecone, one note = one vector (no chunking)
 *
 * The reference tests in route.test.ts pin the exact contract — make them pass.
 * Reuse what already exists:
 *   - processBundle(bundle) from '@/lib/fhir-extract'  (returns null if no Patient)
 *   - upsertChunks(notes)   from '@/lib/pinecone'
 *   - prisma                from '@/lib/prisma'
 */
import { NextResponse } from 'next/server';

export async function POST(_request: Request) {
  // TODO: parse + validate the body as a FHIR Bundle with a Zod schema (let it throw -> 400)
  // TODO: const extracted = processBundle(bundle); if !extracted -> 400 (no Patient resource)
  // TODO: prisma.patient.upsert(...) then createMany({ data, skipDuplicates: true }) for
  //       conditions / observations / medications — ADDITIVE + IDEMPOTENT, never delete
  // TODO: upsertChunks(notes) — one note = one vector (skip if there are no notes)
  // TODO: return { success: true, patientId, inserted: { conditions, observations, medications, notes } }
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
