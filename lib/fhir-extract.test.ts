import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  processBundle,
  extractPatient,
  extractNote,
  cleanName,
  FHIRBundle,
  FHIRResource,
  PatientResource,
} from './fhir-extract';

// ---------------------------------------------------------------------------
// Fixtures (shaped like real Synthea Coherent resources)
// ---------------------------------------------------------------------------

const NOTE_TEXT = `
1926-06-19

# Chief Complaint
No complaints.

# Assessment and Plan
The patient was placed on a careplan.
`.trim();

const patientResource: PatientResource = {
  resourceType: 'Patient',
  id: 'patient-123',
  name: [{ given: ['Abe604'], family: 'Frami345' }],
  gender: 'male',
  birthDate: '1925-11-14',
  deceasedDateTime: '2008-03-22T02:05:40-04:00',
  telecom: [{ system: 'phone', value: '555-612-5059', use: 'home' }],
  maritalStatus: { text: 'M' },
  address: [{ city: 'Waltham', state: 'MA' }],
  extension: [
    {
      url: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-race',
      extension: [{ url: 'text', valueString: 'White' }],
    },
    {
      url: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity',
      extension: [{ url: 'text', valueString: 'Hispanic or Latino' }],
    },
  ],
};

function makeDocumentReference(overrides: Partial<FHIRResource> = {}): FHIRResource {
  return {
    resourceType: 'DocumentReference',
    id: 'doc-1',
    status: 'superseded',
    type: {
      coding: [{ system: 'http://loinc.org', code: '34117-2', display: 'History and physical note' }],
    },
    date: '1926-06-19T02:05:40.200-04:00',
    content: [
      { attachment: { contentType: 'text/plain', data: Buffer.from(NOTE_TEXT).toString('base64') } },
    ],
    ...overrides,
  };
}

const fullBundle: FHIRBundle = {
  resourceType: 'Bundle',
  entry: [
    { resource: patientResource },
    {
      resource: {
        resourceType: 'Condition',
        id: 'cond-1',
        code: {
          coding: [{ system: 'http://snomed.info/sct', code: '44054006', display: 'Type 2 Diabetes Mellitus' }],
        },
        clinicalStatus: { coding: [{ code: 'active' }] },
        onsetDateTime: '2001-05-10T00:00:00-04:00',
        subject: { reference: 'urn:uuid:patient-123' },
      },
    },
    {
      resource: {
        resourceType: 'Observation',
        id: 'obs-1',
        code: { coding: [{ system: 'http://loinc.org', code: '2339-0', display: 'Glucose' }] },
        category: [{ coding: [{ code: 'laboratory' }] }],
        valueQuantity: { value: 71.54, unit: 'mg/dL' },
        effectiveDateTime: '1999-03-06T01:05:40-05:00',
        subject: { reference: 'urn:uuid:patient-123' },
      },
    },
    {
      resource: {
        resourceType: 'MedicationRequest',
        id: 'med-1',
        status: 'stopped',
        medicationCodeableConcept: {
          coding: [{ system: 'rxnorm', code: '314231', display: 'Simvastatin 10 MG Oral Tablet' }],
        },
        authoredOn: '1992-03-07T01:05:40-05:00',
        subject: { reference: 'urn:uuid:patient-123' },
      },
    },
    {
      resource: {
        resourceType: 'Encounter',
        id: 'enc-1',
        status: 'finished',
        class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
        type: [{ coding: [{ display: 'Encounter for problem' }] }],
        period: { start: '2001-05-10T02:05:40-04:00', end: '2001-05-10T02:20:40-04:00' },
        serviceProvider: { display: 'PCP123' },
        subject: { reference: 'urn:uuid:patient-123' },
      },
    },
    { resource: makeDocumentReference() },
    { resource: makeDocumentReference({ id: 'doc-2' }) },
    // Resources we intentionally don't extract should be ignored, not crash
    { resource: { resourceType: 'Claim', id: 'claim-1' } },
  ],
};

// ---------------------------------------------------------------------------
// Vector DB content — the critical path
// ---------------------------------------------------------------------------

describe('extractNote (what goes into Pinecone)', () => {
  it('decodes the base64 attachment to the exact note text', () => {
    const note = extractNote(makeDocumentReference(), 'patient-123', 'Abe Frami');
    expect(note?.content).toBe(NOTE_TEXT);
  });

  it('uses the DocumentReference id as the vector id', () => {
    const note = extractNote(makeDocumentReference(), 'patient-123', 'Abe Frami');
    expect(note?.id).toBe('doc-1');
  });

  it('sets the metadata fields that lib/vector-search.ts reads', () => {
    const note = extractNote(makeDocumentReference(), 'patient-123', 'Abe Frami');
    expect(note?.metadata).toMatchObject({
      patientId: 'patient-123',
      patientName: 'Abe Frami',
      type: 'History and physical note',
      date: '1926-06-19', // YYYY-MM-DD, sliced from the ISO timestamp
    });
  });

  it('returns null when the attachment has no data', () => {
    const doc = makeDocumentReference({ content: [{ attachment: { contentType: 'text/plain' } }] });
    expect(extractNote(doc, 'patient-123', 'Abe Frami')).toBeNull();
  });

  it('returns null when the decoded note is empty', () => {
    const doc = makeDocumentReference({
      content: [{ attachment: { data: Buffer.from('   \n  ').toString('base64') } }],
    });
    expect(extractNote(doc, 'patient-123', 'Abe Frami')).toBeNull();
  });

  it('falls back to "Clinical Note" when type coding is missing', () => {
    const doc = makeDocumentReference({ type: undefined });
    const note = extractNote(doc, 'patient-123', 'Abe Frami');
    expect(note?.metadata.type).toBe('Clinical Note');
  });
});

describe('processBundle (notes)', () => {
  it('produces one vector per note — no chunking', () => {
    const extracted = processBundle(fullBundle)!;
    expect(extracted.notes).toHaveLength(2);
    expect(extracted.notes.map((n) => n.id)).toEqual(['doc-1', 'doc-2']);
  });

  it('tags every note with the bundle patient id and cleaned name', () => {
    const extracted = processBundle(fullBundle)!;
    for (const note of extracted.notes) {
      expect(note.metadata.patientId).toBe('patient-123');
      expect(note.metadata.patientName).toBe('Abe Frami'); // Synthea digits stripped
    }
  });

  it('returns null for a bundle without a Patient resource', () => {
    expect(processBundle({ resourceType: 'Bundle', entry: [] })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Structured extraction (what goes into Postgres)
// ---------------------------------------------------------------------------

describe('extractPatient', () => {
  const patient = extractPatient(patientResource);

  it('strips Synthea digits from names', () => {
    expect(patient.firstName).toBe('Abe');
    expect(patient.lastName).toBe('Frami');
  });

  it('extracts phone from telecom', () => {
    expect(patient.phone).toBe('555-612-5059');
  });

  it('extracts deathDate from deceasedDateTime', () => {
    expect(patient.deathDate).toEqual(new Date('2008-03-22T02:05:40-04:00'));
  });

  it('leaves deathDate null for living patients', () => {
    const alive = extractPatient({ ...patientResource, deceasedDateTime: undefined });
    expect(alive.deathDate).toBeNull();
  });

  it('extracts race and ethnicity from US Core extensions', () => {
    expect(patient.race).toBe('White');
    expect(patient.ethnicity).toBe('Hispanic or Latino');
  });

  it('handles a minimal patient without optional fields', () => {
    const minimal = extractPatient({ resourceType: 'Patient', id: 'p-2' });
    expect(minimal).toMatchObject({
      id: 'p-2',
      firstName: null,
      phone: null,
      deathDate: null,
      race: null,
    });
  });
});

describe('processBundle (structured rows)', () => {
  const extracted = processBundle(fullBundle)!;

  it('extracts conditions with SNOMED code and status', () => {
    expect(extracted.conditions).toEqual([
      expect.objectContaining({
        id: 'cond-1',
        patientId: 'patient-123',
        code: '44054006',
        display: 'Type 2 Diabetes Mellitus',
        clinicalStatus: 'active',
      }),
    ]);
  });

  it('extracts observations with numeric value and unit', () => {
    expect(extracted.observations).toEqual([
      expect.objectContaining({
        id: 'obs-1',
        code: '2339-0',
        display: 'Glucose',
        category: 'laboratory',
        valueNumber: 71.54,
        unit: 'mg/dL',
      }),
    ]);
  });

  it('extracts medications with RxNorm display and status', () => {
    expect(extracted.medications).toEqual([
      expect.objectContaining({
        id: 'med-1',
        display: 'Simvastatin 10 MG Oral Tablet',
        status: 'stopped',
      }),
    ]);
  });

  it('extracts encounters with class code, type, and status', () => {
    expect(extracted.encounters).toEqual([
      expect.objectContaining({
        id: 'enc-1',
        patientId: 'patient-123',
        classCode: 'AMB',
        type: 'Encounter for problem',
        status: 'finished',
      }),
    ]);
  });
});

describe('cleanName', () => {
  it('strips digits and preserves the rest', () => {
    expect(cleanName('Abe604')).toBe('Abe');
    expect(cleanName("O'Brien123")).toBe("O'Brien");
  });

  it('returns null for missing names', () => {
    expect(cleanName(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Integration: a real Coherent bundle (skipped if the dataset isn't present)
// ---------------------------------------------------------------------------

const COHERENT_DIR = path.join(__dirname, '..', 'data', 'coherent', 'fhir');
const hasData = fs.existsSync(COHERENT_DIR);

describe.runIf(hasData)('real Coherent bundle', () => {
  const file = fs.readdirSync(COHERENT_DIR).find((f) => f.endsWith('.json'))!;
  const bundle = JSON.parse(fs.readFileSync(path.join(COHERENT_DIR, file), 'utf-8')) as FHIRBundle;
  const extracted = processBundle(bundle)!;

  it('extracts a patient with an id', () => {
    expect(extracted.patient.id).toBeTruthy();
  });

  it('every note is non-empty, keyed to the patient, with a YYYY-MM-DD date', () => {
    expect(extracted.notes.length).toBeGreaterThan(0);
    for (const note of extracted.notes) {
      expect(note.content.length).toBeGreaterThan(0);
      expect(note.metadata.patientId).toBe(extracted.patient.id);
      expect(note.metadata.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('note ids are unique (vector ids must not collide)', () => {
    const ids = extracted.notes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
