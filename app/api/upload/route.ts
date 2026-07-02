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
import { z } from 'zod';
import { processBundle, FHIRBundle } from '@/lib/fhir-extract';
import { upsertChunks } from '@/lib/pinecone';
import { prisma } from '@/lib/prisma';

const FHIRBundleSchema = z
  .object({
    resourceType: z.literal('Bundle'),
    entry: z
      .array(z.object({ resource: z.object({ resourceType: z.string() }).passthrough() }))
      .optional(),
  })
  .passthrough();

export async function POST(request: Request) {
  try {
    const bundle = FHIRBundleSchema.parse(await request.json()) as FHIRBundle;

    const extracted = processBundle(bundle);
    if (!extracted) {
      return NextResponse.json(
        { error: 'Bundle does not contain a Patient resource' },
        { status: 400 }
      );
    }

    const { patient, conditions, observations, medications, encounters, notes } = extracted;

    // Additive + idempotent: upsert the patient, skip duplicate child rows.
    // No deleteMany / deleteAllChunks here - clearing is the ingest script's job.
    await prisma.patient.upsert({
      where: { id: patient.id },
      create: patient,
      update: patient,
    });
    const [conditionResult, observationResult, medicationResult, encounterResult] = await Promise.all([
      prisma.condition.createMany({ data: conditions, skipDuplicates: true }),
      prisma.observation.createMany({ data: observations, skipDuplicates: true }),
      prisma.medication.createMany({ data: medications, skipDuplicates: true }),
      prisma.encounter.createMany({ data: encounters, skipDuplicates: true }),
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
        encounters: encounterResult.count,
        notes: noteCount,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
