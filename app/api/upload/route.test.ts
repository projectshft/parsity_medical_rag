/**
 * INSTRUCTOR REFERENCE TESTS for the upload API (docs/CHALLENGE-UPLOAD-API.md)
 *
 * Students write their own version of these - this is the grading baseline.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    patient: { upsert: vi.fn(async () => ({})), deleteMany: vi.fn() },
    condition: { createMany: vi.fn(async () => ({ count: 1 })), deleteMany: vi.fn() },
    observation: { createMany: vi.fn(async () => ({ count: 2 })), deleteMany: vi.fn() },
    medication: { createMany: vi.fn(async () => ({ count: 1 })), deleteMany: vi.fn() },
  },
}));

vi.mock('@/lib/pinecone', () => ({
  upsertChunks: vi.fn(async (chunks: unknown[]) => chunks.length),
  deleteAllChunks: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { upsertChunks, deleteAllChunks } from '@/lib/pinecone';
import { POST } from './route';

const NOTE_TEXT = '1926-06-19\n\n# Chief Complaint\nNo complaints.';

const fixtureBundle = {
  resourceType: 'Bundle',
  entry: [
    {
      resource: {
        resourceType: 'Patient',
        id: 'patient-123',
        name: [{ given: ['Abe604'], family: 'Frami345' }],
        gender: 'male',
        birthDate: '1925-11-14',
        telecom: [{ system: 'phone', value: '555-612-5059' }],
      },
    },
    {
      resource: {
        resourceType: 'Condition',
        id: 'cond-1',
        code: { coding: [{ code: '44054006', display: 'Type 2 Diabetes Mellitus' }] },
      },
    },
    {
      resource: {
        resourceType: 'Observation',
        id: 'obs-1',
        code: { coding: [{ code: '2339-0', display: 'Glucose' }] },
        valueQuantity: { value: 71.5, unit: 'mg/dL' },
      },
    },
    {
      resource: {
        resourceType: 'Observation',
        id: 'obs-2',
        code: { coding: [{ code: '4548-4', display: 'Hemoglobin A1c' }] },
        valueQuantity: { value: 6.8, unit: '%' },
      },
    },
    {
      resource: {
        resourceType: 'MedicationRequest',
        id: 'med-1',
        status: 'active',
        medicationCodeableConcept: { coding: [{ code: '860975', display: 'Metformin 500mg' }] },
      },
    },
    {
      resource: {
        resourceType: 'DocumentReference',
        id: 'doc-1',
        type: { coding: [{ display: 'History and physical note' }] },
        date: '1926-06-19T02:05:40.200-04:00',
        content: [{ attachment: { data: Buffer.from(NOTE_TEXT).toString('base64') } }],
      },
    },
  ],
};

function uploadRequest(body: unknown): Request {
  return new Request('http://localhost/api/upload', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/upload', () => {
  it('ingests a bundle and reports counts', async () => {
    const response = await POST(uploadRequest(fixtureBundle));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      patientId: 'patient-123',
      inserted: { conditions: 1, observations: 2, medications: 1, notes: 1 },
    });
  });

  it('sends the right payload to the vector DB', async () => {
    await POST(uploadRequest(fixtureBundle));

    expect(upsertChunks).toHaveBeenCalledOnce();
    const chunks = vi.mocked(upsertChunks).mock.calls[0][0] as any[];
    expect(chunks).toHaveLength(1);
    expect(chunks[0].id).toBe('doc-1');
    expect(chunks[0].content).toBe(NOTE_TEXT);
    expect(chunks[0].metadata).toMatchObject({
      patientId: 'patient-123',
      patientName: 'Abe Frami', // Synthea digits stripped
      type: 'History and physical note',
      date: '1926-06-19', // YYYY-MM-DD
    });
  });

  it('is additive - never clears existing data', async () => {
    await POST(uploadRequest(fixtureBundle));

    expect(deleteAllChunks).not.toHaveBeenCalled();
    expect(prisma.patient.deleteMany).not.toHaveBeenCalled();
    expect(prisma.condition.deleteMany).not.toHaveBeenCalled();
  });

  it('is idempotent - re-upload uses upsert + skipDuplicates', async () => {
    await POST(uploadRequest(fixtureBundle));

    expect(prisma.patient.upsert).toHaveBeenCalledOnce();
    expect(vi.mocked(prisma.condition.createMany).mock.calls[0][0]).toMatchObject({
      skipDuplicates: true,
    });
  });

  it('rejects a body that is not a Bundle with 400', async () => {
    const response = await POST(uploadRequest({ resourceType: 'Patient', id: 'x' }));
    expect(response.status).toBe(400);
    expect(prisma.patient.upsert).not.toHaveBeenCalled();
    expect(upsertChunks).not.toHaveBeenCalled();
  });

  it('rejects a Bundle without a Patient resource with 400', async () => {
    const response = await POST(
      uploadRequest({ resourceType: 'Bundle', entry: [{ resource: { resourceType: 'Claim', id: 'c1' } }] })
    );
    expect(response.status).toBe(400);
    expect(prisma.patient.upsert).not.toHaveBeenCalled();
  });
});
