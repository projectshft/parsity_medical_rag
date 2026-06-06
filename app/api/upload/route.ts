/**
 * Upload API — INSTRUCTOR REFERENCE SOLUTION (docs/CHALLENGE-UPLOAD-API.md)
 *
 * Ingests a single FHIR bundle through the new pipeline:
 * - structured rows -> Postgres (additive, idempotent on re-upload)
 * - clinical notes -> Pinecone, one note = one vector (no chunking)
 *
 * Stretch (CHALLENGE-RBAC.md): make this DOCTOR-only with
 * `await requireAuth(request, ['DOCTOR'])`.
 */

import { NextResponse } from 'next/server';
import { processBundle, FHIRBundle } from '@/lib/fhir-extract';
import { upsertChunks } from '@/lib/pinecone';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const bundle = (await request.json().catch(() => null)) as FHIRBundle | null;

    if (!bundle || bundle.resourceType !== 'Bundle') {
      return NextResponse.json(
        { error: 'Request body must be a FHIR Bundle' },
        { status: 400 }
      );
    }

    const extracted = processBundle(bundle);
    if (!extracted) {
      return NextResponse.json(
        { error: 'Bundle does not contain a Patient resource' },
        { status: 400 }
      );
    }

    const { patient, conditions, observations, medications, notes } = extracted;

    // Additive + idempotent: upsert the patient, skip duplicate child rows.
    // No deleteMany / deleteAllChunks here - clearing is the ingest script's job.
    await prisma.patient.upsert({
      where: { id: patient.id },
      create: patient,
      update: patient,
    });
    const [conditionResult, observationResult, medicationResult] = await Promise.all([
      prisma.condition.createMany({ data: conditions, skipDuplicates: true }),
      prisma.observation.createMany({ data: observations, skipDuplicates: true }),
      prisma.medication.createMany({ data: medications, skipDuplicates: true }),
    ]);

    // Pinecone upserts are idempotent by vector id (the DocumentReference id)
    const noteCount = notes.length > 0 ? await upsertChunks(notes) : 0;

    return NextResponse.json({
      success: true,
      patientId: patient.id,
      inserted: {
        conditions: conditionResult.count,
        observations: observationResult.count,
        medications: medicationResult.count,
        notes: noteCount,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
