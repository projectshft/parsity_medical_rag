import { v4 as uuidv4 } from "uuid";
import { MedicalChunk } from "./pinecone";

interface FHIRResource {
  resourceType: string;
  id?: string;
}

interface FHIRBundle {
  resourceType: "Bundle";
  entry?: Array<{ resource: FHIRResource }>;
}

interface PatientResource extends FHIRResource {
  resourceType: "Patient";
  name?: Array<{
    given?: string[];
    family?: string;
    text?: string;
  }>;
  gender?: string;
  birthDate?: string;
  address?: Array<{
    city?: string;
    state?: string;
  }>;
}

interface ConditionResource extends FHIRResource {
  resourceType: "Condition";
  subject?: { reference?: string };
  code?: { coding?: Array<{ display?: string }>; text?: string };
  clinicalStatus?: { coding?: Array<{ code?: string }> };
  onsetDateTime?: string;
}

interface ObservationResource extends FHIRResource {
  resourceType: "Observation";
  subject?: { reference?: string };
  code?: { coding?: Array<{ display?: string }>; text?: string };
  valueQuantity?: { value?: number; unit?: string };
  valueString?: string;
  effectiveDateTime?: string;
  status?: string;
}

interface MedicationRequestResource extends FHIRResource {
  resourceType: "MedicationRequest";
  subject?: { reference?: string };
  medicationCodeableConcept?: { coding?: Array<{ display?: string }>; text?: string };
  status?: string;
  authoredOn?: string;
  dosageInstruction?: Array<{ text?: string }>;
}

interface ProcedureResource extends FHIRResource {
  resourceType: "Procedure";
  subject?: { reference?: string };
  code?: { coding?: Array<{ display?: string }>; text?: string };
  performedDateTime?: string;
  status?: string;
}

interface EncounterResource extends FHIRResource {
  resourceType: "Encounter";
  subject?: { reference?: string };
  type?: Array<{ coding?: Array<{ display?: string }>; text?: string }>;
  period?: { start?: string; end?: string };
  status?: string;
}

interface ImmunizationResource extends FHIRResource {
  resourceType: "Immunization";
  patient?: { reference?: string };
  vaccineCode?: { coding?: Array<{ display?: string }>; text?: string };
  occurrenceDateTime?: string;
  status?: string;
}

interface AllergyIntoleranceResource extends FHIRResource {
  resourceType: "AllergyIntolerance";
  patient?: { reference?: string };
  code?: { coding?: Array<{ display?: string }>; text?: string };
  clinicalStatus?: { coding?: Array<{ code?: string }> };
  reaction?: Array<{ manifestation?: Array<{ coding?: Array<{ display?: string }> }> }>;
}

const patientNameCache = new Map<string, string>();

function extractPatientId(reference?: string): string | undefined {
  if (!reference) return undefined;
  const match = reference.match(/Patient\/([^/]+)/);
  return match ? match[1] : undefined;
}

function formatPatient(patient: PatientResource): string {
  const name = patient.name?.[0];
  const fullName = name?.text ||
    [name?.given?.join(" "), name?.family].filter(Boolean).join(" ") ||
    "Unknown";

  const parts = [`Patient: ${fullName}`];
  if (patient.gender) parts.push(`Gender: ${patient.gender}`);
  if (patient.birthDate) parts.push(`Birth Date: ${patient.birthDate}`);
  if (patient.address?.[0]) {
    const addr = patient.address[0];
    if (addr.city || addr.state) {
      parts.push(`Location: ${[addr.city, addr.state].filter(Boolean).join(", ")}`);
    }
  }

  if (patient.id) {
    patientNameCache.set(patient.id, fullName);
  }

  return parts.join("\n");
}

function formatCondition(condition: ConditionResource): string {
  const code = condition.code?.text ||
    condition.code?.coding?.[0]?.display ||
    "Unknown condition";
  const status = condition.clinicalStatus?.coding?.[0]?.code || "unknown";

  const parts = [`Condition: ${code}`, `Status: ${status}`];
  if (condition.onsetDateTime) {
    parts.push(`Onset: ${condition.onsetDateTime.split("T")[0]}`);
  }

  return parts.join("\n");
}

function formatObservation(obs: ObservationResource): string {
  const code = obs.code?.text ||
    obs.code?.coding?.[0]?.display ||
    "Unknown observation";

  let value = "No value recorded";
  if (obs.valueQuantity) {
    value = `${obs.valueQuantity.value} ${obs.valueQuantity.unit || ""}`.trim();
  } else if (obs.valueString) {
    value = obs.valueString;
  }

  const parts = [`Observation: ${code}`, `Value: ${value}`];
  if (obs.effectiveDateTime) {
    parts.push(`Date: ${obs.effectiveDateTime.split("T")[0]}`);
  }
  if (obs.status) {
    parts.push(`Status: ${obs.status}`);
  }

  return parts.join("\n");
}

function formatMedicationRequest(med: MedicationRequestResource): string {
  const medication = med.medicationCodeableConcept?.text ||
    med.medicationCodeableConcept?.coding?.[0]?.display ||
    "Unknown medication";

  const parts = [`Medication: ${medication}`];
  if (med.status) parts.push(`Status: ${med.status}`);
  if (med.authoredOn) parts.push(`Prescribed: ${med.authoredOn.split("T")[0]}`);
  if (med.dosageInstruction?.[0]?.text) {
    parts.push(`Dosage: ${med.dosageInstruction[0].text}`);
  }

  return parts.join("\n");
}

function formatProcedure(proc: ProcedureResource): string {
  const code = proc.code?.text ||
    proc.code?.coding?.[0]?.display ||
    "Unknown procedure";

  const parts = [`Procedure: ${code}`];
  if (proc.status) parts.push(`Status: ${proc.status}`);
  if (proc.performedDateTime) {
    parts.push(`Date: ${proc.performedDateTime.split("T")[0]}`);
  }

  return parts.join("\n");
}

function formatEncounter(enc: EncounterResource): string {
  const type = enc.type?.[0]?.text ||
    enc.type?.[0]?.coding?.[0]?.display ||
    "Unknown encounter";

  const parts = [`Encounter: ${type}`];
  if (enc.status) parts.push(`Status: ${enc.status}`);
  if (enc.period?.start) {
    parts.push(`Date: ${enc.period.start.split("T")[0]}`);
  }

  return parts.join("\n");
}

function formatImmunization(imm: ImmunizationResource): string {
  const vaccine = imm.vaccineCode?.text ||
    imm.vaccineCode?.coding?.[0]?.display ||
    "Unknown vaccine";

  const parts = [`Immunization: ${vaccine}`];
  if (imm.status) parts.push(`Status: ${imm.status}`);
  if (imm.occurrenceDateTime) {
    parts.push(`Date: ${imm.occurrenceDateTime.split("T")[0]}`);
  }

  return parts.join("\n");
}

function formatAllergy(allergy: AllergyIntoleranceResource): string {
  const substance = allergy.code?.text ||
    allergy.code?.coding?.[0]?.display ||
    "Unknown allergen";

  const parts = [`Allergy: ${substance}`];
  const status = allergy.clinicalStatus?.coding?.[0]?.code;
  if (status) parts.push(`Status: ${status}`);

  const reactions = allergy.reaction
    ?.flatMap(r => r.manifestation?.map(m => m.coding?.[0]?.display))
    .filter(Boolean);
  if (reactions?.length) {
    parts.push(`Reactions: ${reactions.join(", ")}`);
  }

  return parts.join("\n");
}

function formatResource(resource: FHIRResource): string | null {
  switch (resource.resourceType) {
    case "Patient":
      return formatPatient(resource as PatientResource);
    case "Condition":
      return formatCondition(resource as ConditionResource);
    case "Observation":
      return formatObservation(resource as ObservationResource);
    case "MedicationRequest":
      return formatMedicationRequest(resource as MedicationRequestResource);
    case "Procedure":
      return formatProcedure(resource as ProcedureResource);
    case "Encounter":
      return formatEncounter(resource as EncounterResource);
    case "Immunization":
      return formatImmunization(resource as ImmunizationResource);
    case "AllergyIntolerance":
      return formatAllergy(resource as AllergyIntoleranceResource);
    default:
      return null;
  }
}

function getPatientReference(resource: FHIRResource): string | undefined {
  const ref = (resource as { subject?: { reference?: string }; patient?: { reference?: string } });
  return ref.subject?.reference || ref.patient?.reference;
}

function getRecordDate(resource: FHIRResource): string | undefined {
  const r = resource as {
    effectiveDateTime?: string;
    authoredOn?: string;
    performedDateTime?: string;
    occurrenceDateTime?: string;
    onsetDateTime?: string;
    period?: { start?: string };
  };
  return (
    r.effectiveDateTime ||
    r.authoredOn ||
    r.performedDateTime ||
    r.occurrenceDateTime ||
    r.onsetDateTime ||
    r.period?.start
  );
}

export function processBundle(
  bundle: FHIRBundle | FHIRResource,
  sourceName: string
): MedicalChunk[] {
  const chunks: MedicalChunk[] = [];

  // Handle single resource
  if (bundle.resourceType !== "Bundle") {
    const resource = bundle as FHIRResource;
    const content = formatResource(resource);
    if (content) {
      const patientRef = getPatientReference(resource);
      const patientId = extractPatientId(patientRef);

      chunks.push({
        id: uuidv4(),
        content,
        metadata: {
          resourceType: resource.resourceType,
          patientId,
          patientName: patientId ? patientNameCache.get(patientId) : undefined,
          recordDate: getRecordDate(resource),
          source: sourceName,
          chunkIndex: 0,
        },
      });
    }
    return chunks;
  }

  // Process bundle entries
  const fhirBundle = bundle as FHIRBundle;
  const entries = fhirBundle.entry || [];

  // First pass: extract all patients to build name cache
  for (const entry of entries) {
    if (entry.resource?.resourceType === "Patient") {
      formatPatient(entry.resource as PatientResource);
    }
  }

  // Second pass: process all resources
  for (const entry of entries) {
    const resource = entry.resource;
    if (!resource) continue;

    const content = formatResource(resource);
    if (!content) continue;

    const patientRef = getPatientReference(resource);
    const patientId = extractPatientId(patientRef) ||
      (resource.resourceType === "Patient" ? resource.id : undefined);

    chunks.push({
      id: uuidv4(),
      content,
      metadata: {
        resourceType: resource.resourceType,
        patientId,
        patientName: patientId ? patientNameCache.get(patientId) : undefined,
        recordDate: getRecordDate(resource),
        source: sourceName,
        chunkIndex: chunks.length,
      },
    });
  }

  return chunks;
}

export function chunkText(
  text: string,
  maxChunkSize: number = 500,
  overlap: number = 50
): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxChunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      // Keep overlap from end of previous chunk
      const words = currentChunk.split(" ");
      const overlapWords: string[] = [];
      let overlapLength = 0;
      for (let i = words.length - 1; i >= 0 && overlapLength < overlap; i--) {
        overlapWords.unshift(words[i]);
        overlapLength += words[i].length + 1;
      }
      currentChunk = overlapWords.join(" ") + " " + sentence;
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
