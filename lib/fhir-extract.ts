/**
 * FHIR bundle extraction for the Synthea Coherent dataset
 *
 * Pure functions that transform a FHIR bundle into:
 * - Structured rows for Postgres (patient, conditions, observations, medications)
 * - Clinical note chunks for Pinecone (one note = one vector, no chunking —
 *   Coherent SOAP notes average ~450 chars, well under embedding limits)
 *
 * Used by scripts/ingest-coherent.ts and the upload API route.
 */

import type { MedicalChunk } from './pinecone';

// ---------------------------------------------------------------------------
// FHIR types (only the fields we extract)
// ---------------------------------------------------------------------------

export interface FHIRResource {
  resourceType: string;
  id: string;
  [key: string]: any;
}

export interface FHIRBundle {
  resourceType: 'Bundle';
  entry?: Array<{ resource: FHIRResource }>;
}

export interface PatientResource extends FHIRResource {
  name?: Array<{ given?: string[]; family?: string }>;
  gender?: string;
  birthDate?: string;
  deceasedDateTime?: string;
  telecom?: Array<{ system?: string; value?: string; use?: string }>;
  maritalStatus?: { text?: string };
  address?: Array<{ city?: string; state?: string }>;
  extension?: Array<{
    url: string;
    extension?: Array<{ url: string; valueString?: string }>;
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Synthea appends digits to names ("Abe604 Frami345") — strip them */
export function cleanName(name?: string): string | null {
  return name ? name.replace(/\d+/g, '') : null;
}

function toDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** Read a US Core extension (race/ethnicity) text value */
function extractCoreExtension(patient: PatientResource, urlSuffix: string): string | null {
  const ext = patient.extension?.find((e) => e.url.endsWith(urlSuffix));
  return ext?.extension?.find((e) => e.url === 'text')?.valueString ?? null;
}

// ---------------------------------------------------------------------------
// Resource extractors
// ---------------------------------------------------------------------------

export function extractPatient(resource: PatientResource) {
  return {
    id: resource.id,
    firstName: cleanName(resource.name?.[0]?.given?.[0]),
    lastName: cleanName(resource.name?.[0]?.family),
    gender: resource.gender ?? null,
    birthDate: toDate(resource.birthDate),
    // Presence of deceasedDateTime doubles as an "is deceased" flag
    deathDate: toDate(resource.deceasedDateTime),
    phone: resource.telecom?.find((t) => t.system === 'phone')?.value ?? null,
    maritalStatus: resource.maritalStatus?.text ?? null,
    race: extractCoreExtension(resource, 'us-core-race'),
    ethnicity: extractCoreExtension(resource, 'us-core-ethnicity'),
    city: resource.address?.[0]?.city ?? null,
    state: resource.address?.[0]?.state ?? null,
  };
}

export function extractCondition(resource: FHIRResource, patientId: string) {
  const coding = resource.code?.coding?.[0];
  return {
    id: resource.id,
    patientId,
    code: coding?.code ?? null,
    display: coding?.display ?? resource.code?.text ?? 'Unknown',
    clinicalStatus: resource.clinicalStatus?.coding?.[0]?.code ?? null,
    onsetDate: toDate(resource.onsetDateTime),
    abatementDate: toDate(resource.abatementDateTime),
  };
}

export function extractObservation(resource: FHIRResource, patientId: string) {
  const coding = resource.code?.coding?.[0];
  return {
    id: resource.id,
    patientId,
    code: coding?.code ?? null,
    display: coding?.display ?? resource.code?.text ?? 'Unknown',
    category: resource.category?.[0]?.coding?.[0]?.code ?? null,
    valueNumber: resource.valueQuantity?.value ?? null,
    valueString: resource.valueString ?? resource.valueCodeableConcept?.text ?? null,
    unit: resource.valueQuantity?.unit ?? null,
    effectiveDate: toDate(resource.effectiveDateTime),
  };
}

export function extractEncounter(resource: FHIRResource, patientId: string) {
  return {
    id: resource.id,
    patientId,
    // HL7 v3 ActCode: AMB (ambulatory) | EMER (emergency) | IMP (inpatient)
    classCode: resource.class?.code ?? null,
    type: resource.type?.[0]?.coding?.[0]?.display ?? resource.type?.[0]?.text ?? null,
    status: resource.status ?? null,
    startDate: toDate(resource.period?.start),
    endDate: toDate(resource.period?.end),
    serviceProvider: resource.serviceProvider?.display ?? null,
  };
}

export function extractMedication(resource: FHIRResource, patientId: string) {
  const coding = resource.medicationCodeableConcept?.coding?.[0];
  return {
    id: resource.id,
    patientId,
    code: coding?.code ?? null,
    display: coding?.display ?? resource.medicationCodeableConcept?.text ?? 'Unknown',
    status: resource.status ?? null,
    authoredOn: toDate(resource.authoredOn),
    dosage: resource.dosageInstruction?.[0]?.text ?? null,
  };
}

/** Decode a clinical note from a DocumentReference (base64 attachment) */
export function extractNote(
  resource: FHIRResource,
  patientId: string,
  patientName: string
): MedicalChunk | null {
  const data = resource.content?.[0]?.attachment?.data;
  if (!data) return null;

  const content = Buffer.from(data, 'base64').toString('utf-8').trim();
  if (!content) return null;

  return {
    id: resource.id,
    content,
    metadata: {
      resourceType: 'DocumentReference',
      patientId,
      patientName,
      source: 'coherent',
      chunkIndex: 0,
      // Read by lib/vector-search.ts
      type: resource.type?.coding?.[0]?.display ?? 'Clinical Note',
      date: resource.date?.slice(0, 10) ?? '',
    },
  };
}

// ---------------------------------------------------------------------------
// Bundle processing
// ---------------------------------------------------------------------------

export interface ExtractedBundle {
  patient: ReturnType<typeof extractPatient>;
  conditions: ReturnType<typeof extractCondition>[];
  observations: ReturnType<typeof extractObservation>[];
  medications: ReturnType<typeof extractMedication>[];
  encounters: ReturnType<typeof extractEncounter>[];
  notes: MedicalChunk[];
}

export function processBundle(bundle: FHIRBundle): ExtractedBundle | null {
  const resources = (bundle.entry ?? []).map((e) => e.resource);

  const patientResource = resources.find((r) => r.resourceType === 'Patient');
  if (!patientResource) return null;

  const patient = extractPatient(patientResource as PatientResource);
  const patientName = [patient.firstName, patient.lastName].filter(Boolean).join(' ');

  const conditions: ExtractedBundle['conditions'] = [];
  const observations: ExtractedBundle['observations'] = [];
  const medications: ExtractedBundle['medications'] = [];
  const encounters: ExtractedBundle['encounters'] = [];
  const notes: MedicalChunk[] = [];

  for (const resource of resources) {
    switch (resource.resourceType) {
      case 'Condition':
        conditions.push(extractCondition(resource, patient.id));
        break;
      case 'Observation':
        observations.push(extractObservation(resource, patient.id));
        break;
      case 'MedicationRequest':
        medications.push(extractMedication(resource, patient.id));
        break;
      case 'Encounter':
        encounters.push(extractEncounter(resource, patient.id));
        break;
      case 'DocumentReference': {
        const note = extractNote(resource, patient.id, patientName);
        if (note) notes.push(note);
        break;
      }
    }
  }

  return { patient, conditions, observations, medications, encounters, notes };
}
