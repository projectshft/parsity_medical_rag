/**
 * Ingest Synthea Coherent Dataset into Neon (PostgreSQL) + Pinecone
 * Uses batch inserts for speed
 */

import * as dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { getPinecone, getIndexName, ensureIndexExists } from '../lib/pinecone';
import { createEmbeddings } from '../lib/openai';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

const DATA_DIR = path.join(process.cwd(), 'data', 'coherent', 'fhir');
const BATCH_SIZE = 50;
const DB_BATCH_SIZE = 500; // Batch size for database inserts
const MAX_PATIENTS = process.env.MAX_PATIENTS ? parseInt(process.env.MAX_PATIENTS) : undefined;

interface FHIRResource {
  resourceType: string;
  id: string;
  [key: string]: any;
}

interface FHIRBundle {
  resourceType: 'Bundle';
  entry: Array<{ resource: FHIRResource }>;
}

interface DocumentForEmbedding {
  id: string;
  patientId: string;
  patientName: string;
  type: string;
  date: string;
  content: string;
}

// Batch data collectors
const batches = {
  patients: [] as any[],
  conditions: [] as any[],
  observations: [] as any[],
  medications: [] as any[],
  procedures: [] as any[],
  encounters: [] as any[],
  immunizations: [] as any[],
  allergies: [] as any[],
  documents: [] as any[],
};

const documentsToEmbed: DocumentForEmbedding[] = [];

async function main() {
  console.log('🏥 Medical RAG Ingestion (Batch Mode)');
  console.log('=====================================\n');

  if (!fs.existsSync(DATA_DIR)) {
    console.error(`❌ Data directory not found: ${DATA_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json'))
    .slice(0, MAX_PATIENTS);

  console.log(`📁 Found ${files.length} patient bundles\n`);

  if (MAX_PATIENTS) {
    console.log(`⚠️  Limited to ${MAX_PATIENTS} patients\n`);
  }

  // Clear existing data
  console.log('🗑️  Clearing existing data...');
  await clearAllData();
  console.log('✅ Data cleared\n');

  // Phase 1: Parse all bundles and collect data
  console.log('📖 Phase 1: Parsing FHIR bundles...');
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(DATA_DIR, file);

    try {
      const bundle = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as FHIRBundle;
      parseBundle(bundle);

      if ((i + 1) % 100 === 0 || i === files.length - 1) {
        console.log(`  Parsed ${i + 1}/${files.length} bundles`);
      }
    } catch (error) {
      console.error(`  ❌ Error parsing ${file}`);
    }
  }

  console.log('\n📊 Parsed data:');
  console.log(`   Patients:      ${batches.patients.length}`);
  console.log(`   Conditions:    ${batches.conditions.length}`);
  console.log(`   Observations:  ${batches.observations.length}`);
  console.log(`   Medications:   ${batches.medications.length}`);
  console.log(`   Procedures:    ${batches.procedures.length}`);
  console.log(`   Encounters:    ${batches.encounters.length}`);
  console.log(`   Immunizations: ${batches.immunizations.length}`);
  console.log(`   Allergies:     ${batches.allergies.length}`);
  console.log(`   Documents:     ${batches.documents.length}`);

  // Phase 2: Batch insert to database
  console.log('\n💾 Phase 2: Inserting into Neon (batch mode)...');
  await insertAllBatches();
  console.log('✅ Database ingestion complete');

  // Phase 3: Embed and upsert to Pinecone
  if (documentsToEmbed.length > 0) {
    console.log(`\n🧠 Phase 3: Embedding ${documentsToEmbed.length} clinical notes...`);
    await embedAndUpsertDocuments();
    console.log('✅ Pinecone ingestion complete');
  }

  console.log('\n🎉 Ingestion complete!');
  await prisma.$disconnect();
}

async function clearAllData() {
  await prisma.document.deleteMany();
  await prisma.allergy.deleteMany();
  await prisma.immunization.deleteMany();
  await prisma.encounter.deleteMany();
  await prisma.procedure.deleteMany();
  await prisma.medication.deleteMany();
  await prisma.observation.deleteMany();
  await prisma.condition.deleteMany();
  await prisma.patient.deleteMany();

  try {
    const index = getPinecone().Index(getIndexName());
    await index.deleteAll();
  } catch (error) {
    console.log('  Note: Pinecone index may not exist yet');
  }
}

function parseBundle(bundle: FHIRBundle) {
  const resourcesByType: Record<string, FHIRResource[]> = {};
  for (const entry of bundle.entry || []) {
    const type = entry.resource.resourceType;
    if (!resourcesByType[type]) resourcesByType[type] = [];
    resourcesByType[type].push(entry.resource);
  }

  const patients = resourcesByType['Patient'] || [];
  if (patients.length === 0) return;

  const patientResource = patients[0];
  const patientData = parsePatient(patientResource);
  if (!patientData) return;

  batches.patients.push(patientData);
  const patientId = patientData.id;
  const patientName = patientData.name;

  for (const r of resourcesByType['Condition'] || []) {
    const data = parseCondition(r, patientId);
    if (data) batches.conditions.push(data);
  }

  for (const r of resourcesByType['Observation'] || []) {
    const data = parseObservation(r, patientId);
    if (data) batches.observations.push(data);
  }

  for (const r of resourcesByType['MedicationRequest'] || []) {
    const data = parseMedication(r, patientId);
    if (data) batches.medications.push(data);
  }

  for (const r of resourcesByType['Procedure'] || []) {
    const data = parseProcedure(r, patientId);
    if (data) batches.procedures.push(data);
  }

  for (const r of resourcesByType['Encounter'] || []) {
    const data = parseEncounter(r, patientId);
    if (data) batches.encounters.push(data);
  }

  for (const r of resourcesByType['Immunization'] || []) {
    const data = parseImmunization(r, patientId);
    if (data) batches.immunizations.push(data);
  }

  for (const r of resourcesByType['AllergyIntolerance'] || []) {
    const data = parseAllergy(r, patientId);
    if (data) batches.allergies.push(data);
  }

  for (const r of resourcesByType['DocumentReference'] || []) {
    const result = parseDocument(r, patientId, patientName);
    if (result) {
      batches.documents.push(result.dbData);
      documentsToEmbed.push(result.embedData);
    }
  }
}

function parsePatient(r: FHIRResource) {
  const name = r.name?.[0];
  const fullName = name ? `${name.given?.join(' ') || ''} ${name.family || ''}`.trim() : 'Unknown';
  const address = r.address?.[0];

  return {
    id: uuidv4(),
    fhirId: r.id,
    name: fullName,
    givenName: name?.given?.join(' ') || null,
    familyName: name?.family || null,
    gender: r.gender || null,
    birthDate: r.birthDate ? new Date(r.birthDate) : null,
    city: address?.city || null,
    state: address?.state || null,
    postalCode: address?.postalCode || null,
  };
}

function parseCondition(r: FHIRResource, patientId: string) {
  const coding = r.code?.coding?.[0];
  if (!coding) return null;

  return {
    id: uuidv4(),
    fhirId: r.id,
    patientId,
    code: coding.code || '',
    codeSystem: getCodeSystem(coding.system),
    display: coding.display || r.code?.text || '',
    status: r.clinicalStatus?.coding?.[0]?.code || null,
    severity: r.severity?.coding?.[0]?.display || null,
    onsetDate: r.onsetDateTime ? new Date(r.onsetDateTime) : null,
    abatementDate: r.abatementDateTime ? new Date(r.abatementDateTime) : null,
  };
}

function parseObservation(r: FHIRResource, patientId: string) {
  const coding = r.code?.coding?.[0];
  if (!coding) return null;

  let valueNumeric: number | null = null;
  let valueString: string | null = null;
  let unit: string | null = null;

  if (r.valueQuantity) {
    valueNumeric = r.valueQuantity.value;
    unit = r.valueQuantity.unit;
  } else if (r.valueCodeableConcept) {
    valueString = r.valueCodeableConcept.coding?.[0]?.display || r.valueCodeableConcept.text;
  } else if (r.valueString) {
    valueString = r.valueString;
  }

  const refRange = r.referenceRange?.[0];

  return {
    id: uuidv4(),
    fhirId: r.id,
    patientId,
    code: coding.code || '',
    codeSystem: getCodeSystem(coding.system),
    display: coding.display || r.code?.text || '',
    category: r.category?.[0]?.coding?.[0]?.code || null,
    valueNumeric,
    valueString,
    unit,
    referenceLow: refRange?.low?.value || null,
    referenceHigh: refRange?.high?.value || null,
    effectiveDate: r.effectiveDateTime ? new Date(r.effectiveDateTime) : null,
    status: r.status || null,
  };
}

function parseMedication(r: FHIRResource, patientId: string) {
  const coding = r.medicationCodeableConcept?.coding?.[0];

  return {
    id: uuidv4(),
    fhirId: r.id,
    patientId,
    code: coding?.code || null,
    codeSystem: coding ? getCodeSystem(coding.system) : 'rxnorm',
    display: coding?.display || r.medicationCodeableConcept?.text || '',
    status: r.status || null,
    intent: r.intent || null,
    dosageInstruction: r.dosageInstruction?.[0]?.text || null,
    authoredDate: r.authoredOn ? new Date(r.authoredOn) : null,
  };
}

function parseProcedure(r: FHIRResource, patientId: string) {
  const coding = r.code?.coding?.[0];
  if (!coding) return null;

  return {
    id: uuidv4(),
    fhirId: r.id,
    patientId,
    code: coding.code || null,
    codeSystem: getCodeSystem(coding.system),
    display: coding.display || r.code?.text || '',
    status: r.status || null,
    performedDate: r.performedDateTime
      ? new Date(r.performedDateTime)
      : r.performedPeriod?.start
        ? new Date(r.performedPeriod.start)
        : null,
  };
}

function parseEncounter(r: FHIRResource, patientId: string) {
  return {
    id: uuidv4(),
    fhirId: r.id,
    patientId,
    class: r.class?.code || null,
    type: r.type?.[0]?.coding?.[0]?.display || r.type?.[0]?.text || null,
    status: r.status || null,
    startDate: r.period?.start ? new Date(r.period.start) : null,
    endDate: r.period?.end ? new Date(r.period.end) : null,
  };
}

function parseImmunization(r: FHIRResource, patientId: string) {
  const coding = r.vaccineCode?.coding?.[0];
  if (!coding) return null;

  return {
    id: uuidv4(),
    fhirId: r.id,
    patientId,
    code: coding.code || null,
    codeSystem: getCodeSystem(coding.system),
    display: coding.display || r.vaccineCode?.text || '',
    status: r.status || null,
    occurrenceDate: r.occurrenceDateTime ? new Date(r.occurrenceDateTime) : null,
  };
}

function parseAllergy(r: FHIRResource, patientId: string) {
  const coding = r.code?.coding?.[0];

  return {
    id: uuidv4(),
    fhirId: r.id,
    patientId,
    code: coding?.code || null,
    codeSystem: coding ? getCodeSystem(coding.system) : null,
    display: coding?.display || r.code?.text || 'Unknown',
    category: r.category?.[0] || null,
    criticality: r.criticality || null,
    status: r.clinicalStatus?.coding?.[0]?.code || null,
    onsetDate: r.onsetDateTime ? new Date(r.onsetDateTime) : null,
  };
}

function parseDocument(r: FHIRResource, patientId: string, patientName: string) {
  const attachment = r.content?.[0]?.attachment;
  if (!attachment?.data) return null;

  const content = Buffer.from(attachment.data, 'base64').toString('utf-8');
  if (!content || content.length < 50) return null;

  const pineconeId = uuidv4();
  const docType = r.type?.coding?.[0]?.display || 'Clinical Note';
  const loincCode = r.type?.coding?.[0]?.code || null;
  const date = r.date || r.context?.period?.start || null;

  return {
    dbData: {
      id: uuidv4(),
      fhirId: r.id,
      patientId,
      type: docType,
      loincCode,
      date: date ? new Date(date) : null,
      wordCount: content.split(/\s+/).length,
      pineconeId,
      snippet: content.substring(0, 200),
    },
    embedData: {
      id: pineconeId,
      patientId,
      patientName,
      type: docType,
      date: date || '',
      content,
    },
  };
}

async function insertAllBatches() {
  // Insert patients first (other tables depend on patient IDs)
  console.log('  Inserting patients...');
  await batchInsert('patient', batches.patients);

  // Insert other tables in parallel
  console.log('  Inserting related records...');
  await Promise.all([
    batchInsert('condition', batches.conditions),
    batchInsert('observation', batches.observations),
    batchInsert('medication', batches.medications),
    batchInsert('procedure', batches.procedures),
    batchInsert('encounter', batches.encounters),
    batchInsert('immunization', batches.immunizations),
    batchInsert('allergy', batches.allergies),
    batchInsert('document', batches.documents),
  ]);
}

async function batchInsert(table: string, data: any[]) {
  if (data.length === 0) return;

  for (let i = 0; i < data.length; i += DB_BATCH_SIZE) {
    const batch = data.slice(i, i + DB_BATCH_SIZE);
    try {
      await (prisma as any)[table].createMany({
        data: batch,
        skipDuplicates: true,
      });
    } catch (error) {
      console.error(`  Error inserting ${table} batch:`, error);
    }
  }
}

async function embedAndUpsertDocuments() {
  await ensureIndexExists();
  const index = getPinecone().Index(getIndexName());

  for (let i = 0; i < documentsToEmbed.length; i += BATCH_SIZE) {
    const batch = documentsToEmbed.slice(i, i + BATCH_SIZE);
    const texts = batch.map(d => d.content);

    try {
      const embeddings = await createEmbeddings(texts);

      const vectors = batch.map((doc, idx) => ({
        id: doc.id,
        values: embeddings[idx],
        metadata: {
          patientId: doc.patientId,
          patientName: doc.patientName,
          type: doc.type,
          date: doc.date,
          content: doc.content.substring(0, 8000),
        },
      }));

      await index.upsert(vectors);

      if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= documentsToEmbed.length) {
        console.log(`  Embedded ${Math.min(i + BATCH_SIZE, documentsToEmbed.length)}/${documentsToEmbed.length}`);
      }
    } catch (error) {
      console.error(`  ❌ Error embedding batch at ${i}:`, error);
    }
  }
}

function getCodeSystem(uri?: string): string {
  if (!uri) return 'unknown';
  if (uri.includes('snomed')) return 'snomed-ct';
  if (uri.includes('loinc')) return 'loinc';
  if (uri.includes('rxnorm')) return 'rxnorm';
  if (uri.includes('cvx')) return 'cvx';
  if (uri.includes('icd')) return 'icd';
  if (uri.includes('cpt')) return 'cpt';
  return 'unknown';
}

main().catch(console.error);
