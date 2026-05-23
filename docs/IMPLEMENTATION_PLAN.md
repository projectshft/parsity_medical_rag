# Implementation Plan: Medical RAG with Neon + Pinecone

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Query                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Query Analyzer                              │
│  - Extracts entities (patient names, conditions, dates)         │
│  - Classifies intent (structured vs semantic)                   │
│  - Routes to appropriate data layer                             │
└─────────────────────────────────────────────────────────────────┘
                    │                           │
         structured │                           │ semantic
                    ▼                           ▼
┌─────────────────────────────┐     ┌─────────────────────────────┐
│     Neon (PostgreSQL)        │     │         Pinecone            │
│     via Prisma ORM           │     │                             │
│                              │     │   Clinical Notes Only       │
│  • patients                  │     │   • Dense embeddings        │
│  • conditions                │     │   • patient_id filter       │
│  • observations              │     │   • document_id reference   │
│  • medications               │     │                             │
│  • procedures                │     │                             │
│  • documents (metadata)      │     │                             │
└─────────────────────────────┘     └─────────────────────────────┘
                    │                           │
                    └───────────┬───────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Response Generator                            │
│  - Merges SQL + vector results                                  │
│  - Builds context for LLM                                       │
│  - Generates natural language response                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 0: Environment Setup

### Step 1: Install Dependencies

```bash
# Core dependencies
npm install @prisma/client @neondatabase/serverless
npm install @pinecone-database/pinecone
npm install openai ai
npm install zod                    # Schema validation

# Dev dependencies
npm install -D prisma typescript ts-node @types/node
```

### Step 2: Create Neon Database

1. **Sign up at [neon.tech](https://neon.tech)** (free tier: 0.5 GB storage, 190 compute hours/month)

2. **Create a new project:**
   - Project name: `medical-rag`
   - Region: Choose closest to you
   - Database name: `medical`

3. **Get connection string:**
   - Go to Dashboard → Connection Details
   - Copy the connection string (looks like `postgresql://user:pass@ep-xxx.region.aws.neon.tech/medical?sslmode=require`)

4. **Add to `.env`:**
```env
# Neon PostgreSQL
DATABASE_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/medical?sslmode=require"

# Pinecone (existing)
PINECONE_API_KEY="your-pinecone-api-key"
PINECONE_INDEX="medical-notes"

# OpenAI (existing)
OPENAI_API_KEY="sk-..."

# Optional: Cohere for reranking
COHERE_API_KEY="..."
```

### Step 3: Create Pinecone Index

1. **Go to [pinecone.io](https://pinecone.io)** and sign in

2. **Create index:**
   - Name: `medical-notes`
   - Dimensions: `1536` (for text-embedding-3-small)
   - Metric: `cosine`
   - Serverless: Choose your cloud/region

---

## Phase 1: Database Schema (Prisma)

### Step 1: Initialize Prisma

```bash
npx prisma init
```

### Step 2: Define Schema

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
}

// ============================================
// PATIENTS
// ============================================
model Patient {
  id          String   @id @default(uuid())
  fhirId      String   @unique @map("fhir_id")  // Original FHIR resource ID
  name        String
  givenName   String?  @map("given_name")
  familyName  String?  @map("family_name")
  gender      String?
  birthDate   DateTime? @map("birth_date")
  city        String?
  state       String?
  postalCode  String?  @map("postal_code")

  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  // Relations
  conditions    Condition[]
  observations  Observation[]
  medications   Medication[]
  procedures    Procedure[]
  encounters    Encounter[]
  immunizations Immunization[]
  allergies     Allergy[]
  documents     Document[]

  @@map("patients")
}

// ============================================
// CONDITIONS (Diagnoses)
// ============================================
model Condition {
  id          String   @id @default(uuid())
  fhirId      String   @unique @map("fhir_id")
  patientId   String   @map("patient_id")

  code        String                    // SNOMED code
  codeSystem  String   @default("snomed-ct") @map("code_system")
  display     String                    // Human-readable name

  status      String?                   // active, resolved, inactive
  severity    String?
  onsetDate   DateTime? @map("onset_date")
  abatementDate DateTime? @map("abatement_date")

  createdAt   DateTime @default(now()) @map("created_at")

  patient     Patient  @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@index([code])
  @@index([status])
  @@map("conditions")
}

// ============================================
// OBSERVATIONS (Labs, Vitals)
// ============================================
model Observation {
  id          String   @id @default(uuid())
  fhirId      String   @unique @map("fhir_id")
  patientId   String   @map("patient_id")

  code        String                    // LOINC code
  codeSystem  String   @default("loinc") @map("code_system")
  display     String                    // "Hemoglobin A1c"
  category    String?                   // vital-signs, laboratory, etc.

  valueNumeric  Float?   @map("value_numeric")
  valueString   String?  @map("value_string")
  unit          String?

  referenceLow  Float?   @map("reference_low")
  referenceHigh Float?   @map("reference_high")

  effectiveDate DateTime? @map("effective_date")
  status        String?

  createdAt   DateTime @default(now()) @map("created_at")

  patient     Patient  @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@index([code])
  @@index([effectiveDate])
  @@index([valueNumeric])
  @@map("observations")
}

// ============================================
// MEDICATIONS
// ============================================
model Medication {
  id          String   @id @default(uuid())
  fhirId      String   @unique @map("fhir_id")
  patientId   String   @map("patient_id")

  code        String?                   // RxNorm code
  codeSystem  String   @default("rxnorm") @map("code_system")
  display     String                    // "Metformin 500mg tablet"

  status      String?                   // active, stopped, completed
  intent      String?                   // order, plan, proposal

  dosageInstruction String? @map("dosage_instruction")
  authoredDate      DateTime? @map("authored_date")

  createdAt   DateTime @default(now()) @map("created_at")

  patient     Patient  @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@index([status])
  @@map("medications")
}

// ============================================
// PROCEDURES
// ============================================
model Procedure {
  id          String   @id @default(uuid())
  fhirId      String   @unique @map("fhir_id")
  patientId   String   @map("patient_id")

  code        String?                   // CPT/SNOMED code
  codeSystem  String?  @map("code_system")
  display     String

  status      String?
  performedDate DateTime? @map("performed_date")

  createdAt   DateTime @default(now()) @map("created_at")

  patient     Patient  @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@map("procedures")
}

// ============================================
// ENCOUNTERS (Visits)
// ============================================
model Encounter {
  id          String   @id @default(uuid())
  fhirId      String   @unique @map("fhir_id")
  patientId   String   @map("patient_id")

  class       String?                   // ambulatory, inpatient, emergency
  type        String?
  status      String?

  startDate   DateTime? @map("start_date")
  endDate     DateTime? @map("end_date")

  createdAt   DateTime @default(now()) @map("created_at")

  patient     Patient  @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@index([startDate])
  @@map("encounters")
}

// ============================================
// IMMUNIZATIONS
// ============================================
model Immunization {
  id          String   @id @default(uuid())
  fhirId      String   @unique @map("fhir_id")
  patientId   String   @map("patient_id")

  code        String?                   // CVX code
  codeSystem  String   @default("cvx") @map("code_system")
  display     String

  status      String?
  occurrenceDate DateTime? @map("occurrence_date")

  createdAt   DateTime @default(now()) @map("created_at")

  patient     Patient  @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@map("immunizations")
}

// ============================================
// ALLERGIES
// ============================================
model Allergy {
  id          String   @id @default(uuid())
  fhirId      String   @unique @map("fhir_id")
  patientId   String   @map("patient_id")

  code        String?
  codeSystem  String?  @map("code_system")
  display     String

  category    String?                   // food, medication, environment
  criticality String?                   // low, high, unable-to-assess
  status      String?

  onsetDate   DateTime? @map("onset_date")

  createdAt   DateTime @default(now()) @map("created_at")

  patient     Patient  @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@map("allergies")
}

// ============================================
// DOCUMENTS (Clinical Notes - metadata only)
// Content stored in Pinecone for vector search
// ============================================
model Document {
  id          String   @id @default(uuid())
  fhirId      String   @unique @map("fhir_id")
  patientId   String   @map("patient_id")

  type        String                    // history_and_physical, discharge_summary, etc.
  loincCode   String?  @map("loinc_code")

  date        DateTime?
  wordCount   Int?     @map("word_count")

  // Reference to Pinecone vector
  pineconeId  String   @unique @map("pinecone_id")

  // Store a snippet for quick preview (first 500 chars)
  snippet     String?

  createdAt   DateTime @default(now()) @map("created_at")

  patient     Patient  @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@index([type])
  @@index([date])
  @@map("documents")
}
```

### Step 3: Generate Prisma Client & Push Schema

```bash
# Generate the Prisma client
npx prisma generate

# Push schema to Neon (creates tables)
npx prisma db push

# Optional: Open Prisma Studio to view data
npx prisma studio
```

---

## Phase 2: Data Ingestion Pipeline

### Step 1: Create Prisma Client Singleton

Create `lib/prisma.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### Step 2: Create Pinecone Client

Create `lib/pinecone.ts`:

```typescript
import { Pinecone } from '@pinecone-database/pinecone';

let pineconeClient: Pinecone | null = null;

export function getPinecone(): Pinecone {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
  }
  return pineconeClient;
}

export function getNotesIndex() {
  return getPinecone().index(process.env.PINECONE_INDEX || 'medical-notes');
}
```

### Step 3: Create OpenAI Embedding Client

Create `lib/embeddings.ts`:

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function embedText(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  });
  return response.data.map((d) => d.embedding);
}
```

### Step 4: FHIR Processing & Ingestion Script

Create `scripts/ingest-coherent.ts`:

```typescript
import { readdir, readFile } from 'fs/promises';
import { prisma } from '../lib/prisma';
import { getNotesIndex } from '../lib/pinecone';
import { embedTexts } from '../lib/embeddings';
import { v4 as uuid } from 'uuid';

const FHIR_DIR = './data/coherent/fhir';
const BATCH_SIZE = 50;

interface FHIRBundle {
  resourceType: 'Bundle';
  entry: Array<{ resource: any }>;
}

// ============================================
// MAIN INGESTION FUNCTION
// ============================================
async function ingestCoherentData() {
  console.log('Starting Coherent dataset ingestion...\n');

  const files = await readdir(FHIR_DIR);
  const patientFiles = files.filter(
    (f) => f.endsWith('.json') && !['organizations.json', 'practitioners.json'].includes(f)
  );

  console.log(`Found ${patientFiles.length} patient files\n`);

  let totalPatients = 0;
  let totalDocuments = 0;
  let totalResources = 0;

  // Process in batches
  for (let i = 0; i < patientFiles.length; i += BATCH_SIZE) {
    const batch = patientFiles.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(patientFiles.length / BATCH_SIZE)}`);

    const documentsToEmbed: Array<{ id: string; patientId: string; content: string; metadata: any }> = [];

    for (const file of batch) {
      try {
        const content = await readFile(`${FHIR_DIR}/${file}`, 'utf-8');
        const bundle: FHIRBundle = JSON.parse(content);

        const result = await processBundle(bundle, documentsToEmbed);
        totalPatients += result.patients;
        totalResources += result.resources;
      } catch (error) {
        console.error(`Error processing ${file}:`, error);
      }
    }

    // Embed and upsert documents to Pinecone
    if (documentsToEmbed.length > 0) {
      await embedAndUpsertDocuments(documentsToEmbed);
      totalDocuments += documentsToEmbed.length;
    }

    console.log(`  Batch complete. Running totals: ${totalPatients} patients, ${totalDocuments} documents\n`);
  }

  console.log('\n=== Ingestion Complete ===');
  console.log(`Patients: ${totalPatients}`);
  console.log(`Documents: ${totalDocuments}`);
  console.log(`Total Resources: ${totalResources}`);
}

// ============================================
// PROCESS A SINGLE FHIR BUNDLE
// ============================================
async function processBundle(
  bundle: FHIRBundle,
  documentsToEmbed: Array<{ id: string; patientId: string; content: string; metadata: any }>
): Promise<{ patients: number; resources: number }> {
  let patients = 0;
  let resources = 0;

  // First pass: find and create patient
  const patientResource = bundle.entry.find((e) => e.resource.resourceType === 'Patient')?.resource;
  if (!patientResource) {
    console.warn('No patient resource found in bundle');
    return { patients: 0, resources: 0 };
  }

  const patientId = await upsertPatient(patientResource);
  patients = 1;

  // Second pass: process all other resources
  for (const entry of bundle.entry) {
    const resource = entry.resource;
    if (!resource || resource.resourceType === 'Patient') continue;

    try {
      switch (resource.resourceType) {
        case 'Condition':
          await upsertCondition(resource, patientId);
          resources++;
          break;
        case 'Observation':
          await upsertObservation(resource, patientId);
          resources++;
          break;
        case 'MedicationRequest':
          await upsertMedication(resource, patientId);
          resources++;
          break;
        case 'Procedure':
          await upsertProcedure(resource, patientId);
          resources++;
          break;
        case 'Encounter':
          await upsertEncounter(resource, patientId);
          resources++;
          break;
        case 'Immunization':
          await upsertImmunization(resource, patientId);
          resources++;
          break;
        case 'AllergyIntolerance':
          await upsertAllergy(resource, patientId);
          resources++;
          break;
        case 'DocumentReference':
          const doc = await processDocumentReference(resource, patientId);
          if (doc) {
            documentsToEmbed.push(doc);
            resources++;
          }
          break;
      }
    } catch (error) {
      // Skip duplicates silently (unique constraint violations)
      if ((error as any)?.code !== 'P2002') {
        console.error(`Error processing ${resource.resourceType}:`, error);
      }
    }
  }

  return { patients, resources };
}

// ============================================
// RESOURCE UPSERT FUNCTIONS
// ============================================

async function upsertPatient(resource: any): Promise<string> {
  const name = resource.name?.[0];
  const address = resource.address?.[0];

  const data = {
    fhirId: resource.id,
    name: name ? `${name.given?.join(' ') || ''} ${name.family || ''}`.trim() : 'Unknown',
    givenName: name?.given?.join(' '),
    familyName: name?.family,
    gender: resource.gender,
    birthDate: resource.birthDate ? new Date(resource.birthDate) : null,
    city: address?.city,
    state: address?.state,
    postalCode: address?.postalCode,
  };

  const patient = await prisma.patient.upsert({
    where: { fhirId: resource.id },
    update: data,
    create: data,
  });

  return patient.id;
}

async function upsertCondition(resource: any, patientId: string) {
  const coding = resource.code?.coding?.[0];

  await prisma.condition.upsert({
    where: { fhirId: resource.id },
    update: {},
    create: {
      fhirId: resource.id,
      patientId,
      code: coding?.code || 'unknown',
      codeSystem: detectCodeSystem(coding?.system),
      display: coding?.display || resource.code?.text || 'Unknown Condition',
      status: resource.clinicalStatus?.coding?.[0]?.code,
      severity: resource.severity?.coding?.[0]?.display,
      onsetDate: resource.onsetDateTime ? new Date(resource.onsetDateTime) : null,
      abatementDate: resource.abatementDateTime ? new Date(resource.abatementDateTime) : null,
    },
  });
}

async function upsertObservation(resource: any, patientId: string) {
  const coding = resource.code?.coding?.[0];
  const value = resource.valueQuantity;

  await prisma.observation.upsert({
    where: { fhirId: resource.id },
    update: {},
    create: {
      fhirId: resource.id,
      patientId,
      code: coding?.code || 'unknown',
      codeSystem: detectCodeSystem(coding?.system),
      display: coding?.display || resource.code?.text || 'Unknown Observation',
      category: resource.category?.[0]?.coding?.[0]?.code,
      valueNumeric: value?.value,
      valueString: resource.valueString || resource.valueCodeableConcept?.text,
      unit: value?.unit,
      referenceLow: resource.referenceRange?.[0]?.low?.value,
      referenceHigh: resource.referenceRange?.[0]?.high?.value,
      effectiveDate: resource.effectiveDateTime ? new Date(resource.effectiveDateTime) : null,
      status: resource.status,
    },
  });
}

async function upsertMedication(resource: any, patientId: string) {
  const coding = resource.medicationCodeableConcept?.coding?.[0];

  await prisma.medication.upsert({
    where: { fhirId: resource.id },
    update: {},
    create: {
      fhirId: resource.id,
      patientId,
      code: coding?.code,
      codeSystem: detectCodeSystem(coding?.system),
      display: coding?.display || resource.medicationCodeableConcept?.text || 'Unknown Medication',
      status: resource.status,
      intent: resource.intent,
      dosageInstruction: resource.dosageInstruction?.[0]?.text,
      authoredDate: resource.authoredOn ? new Date(resource.authoredOn) : null,
    },
  });
}

async function upsertProcedure(resource: any, patientId: string) {
  const coding = resource.code?.coding?.[0];

  await prisma.procedure.upsert({
    where: { fhirId: resource.id },
    update: {},
    create: {
      fhirId: resource.id,
      patientId,
      code: coding?.code,
      codeSystem: detectCodeSystem(coding?.system),
      display: coding?.display || resource.code?.text || 'Unknown Procedure',
      status: resource.status,
      performedDate: resource.performedDateTime ? new Date(resource.performedDateTime) : null,
    },
  });
}

async function upsertEncounter(resource: any, patientId: string) {
  await prisma.encounter.upsert({
    where: { fhirId: resource.id },
    update: {},
    create: {
      fhirId: resource.id,
      patientId,
      class: resource.class?.code,
      type: resource.type?.[0]?.coding?.[0]?.display,
      status: resource.status,
      startDate: resource.period?.start ? new Date(resource.period.start) : null,
      endDate: resource.period?.end ? new Date(resource.period.end) : null,
    },
  });
}

async function upsertImmunization(resource: any, patientId: string) {
  const coding = resource.vaccineCode?.coding?.[0];

  await prisma.immunization.upsert({
    where: { fhirId: resource.id },
    update: {},
    create: {
      fhirId: resource.id,
      patientId,
      code: coding?.code,
      codeSystem: detectCodeSystem(coding?.system),
      display: coding?.display || resource.vaccineCode?.text || 'Unknown Vaccine',
      status: resource.status,
      occurrenceDate: resource.occurrenceDateTime ? new Date(resource.occurrenceDateTime) : null,
    },
  });
}

async function upsertAllergy(resource: any, patientId: string) {
  const coding = resource.code?.coding?.[0];

  await prisma.allergy.upsert({
    where: { fhirId: resource.id },
    update: {},
    create: {
      fhirId: resource.id,
      patientId,
      code: coding?.code,
      codeSystem: detectCodeSystem(coding?.system),
      display: coding?.display || resource.code?.text || 'Unknown Allergy',
      category: resource.category?.[0],
      criticality: resource.criticality,
      status: resource.clinicalStatus?.coding?.[0]?.code,
      onsetDate: resource.onsetDateTime ? new Date(resource.onsetDateTime) : null,
    },
  });
}

// ============================================
// DOCUMENT REFERENCE PROCESSING
// ============================================

async function processDocumentReference(
  resource: any,
  patientId: string
): Promise<{ id: string; patientId: string; content: string; metadata: any } | null> {
  const attachment = resource.content?.[0]?.attachment;
  if (!attachment?.data) return null;

  // Decode base64 content
  const content = Buffer.from(attachment.data, 'base64').toString('utf-8');
  if (!content || content.length < 50) return null;

  const coding = resource.type?.coding?.[0];
  const pineconeId = uuid();

  // Create document record in Postgres
  await prisma.document.upsert({
    where: { fhirId: resource.id },
    update: {},
    create: {
      fhirId: resource.id,
      patientId,
      type: classifyDocumentType(coding?.code),
      loincCode: coding?.code,
      date: resource.date ? new Date(resource.date) : null,
      wordCount: content.split(/\s+/).length,
      pineconeId,
      snippet: content.substring(0, 500),
    },
  });

  return {
    id: pineconeId,
    patientId,
    content,
    metadata: {
      documentType: classifyDocumentType(coding?.code),
      date: resource.date,
    },
  };
}

// ============================================
// PINECONE EMBEDDING & UPSERT
// ============================================

async function embedAndUpsertDocuments(
  documents: Array<{ id: string; patientId: string; content: string; metadata: any }>
) {
  const index = getNotesIndex();

  // Embed in batches of 100 (OpenAI limit)
  const EMBED_BATCH = 100;
  for (let i = 0; i < documents.length; i += EMBED_BATCH) {
    const batch = documents.slice(i, i + EMBED_BATCH);
    const texts = batch.map((d) => d.content);

    const embeddings = await embedTexts(texts);

    const vectors = batch.map((doc, idx) => ({
      id: doc.id,
      values: embeddings[idx],
      metadata: {
        patient_id: doc.patientId,
        document_type: doc.metadata.documentType,
        date: doc.metadata.date,
        content_preview: doc.content.substring(0, 1000), // Store preview for retrieval
      },
    }));

    await index.upsert(vectors);
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function detectCodeSystem(system?: string): string {
  if (!system) return 'unknown';
  if (system.includes('snomed')) return 'snomed-ct';
  if (system.includes('loinc')) return 'loinc';
  if (system.includes('rxnorm')) return 'rxnorm';
  if (system.includes('cvx')) return 'cvx';
  if (system.includes('cpt')) return 'cpt';
  return 'unknown';
}

function classifyDocumentType(loincCode?: string): string {
  const types: Record<string, string> = {
    '34117-2': 'history_and_physical',
    '18842-5': 'discharge_summary',
    '11506-3': 'progress_note',
    '28570-0': 'procedure_note',
    '11488-4': 'consultation_note',
  };
  return types[loincCode || ''] || 'clinical_note';
}

// ============================================
// RUN
// ============================================

ingestCoherentData()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
```

### Step 5: Add Ingestion Script to package.json

```json
{
  "scripts": {
    "ingest": "npx ts-node scripts/ingest-coherent.ts",
    "db:push": "npx prisma db push",
    "db:studio": "npx prisma studio"
  }
}
```

### Step 6: Run Ingestion

```bash
# Ensure schema is pushed to Neon
npm run db:push

# Run ingestion (takes ~10-20 minutes for 1,278 patients)
npm run ingest
```

---

## Phase 3: Query Layer

### Step 1: Create Query Types

Create `lib/types.ts`:

```typescript
export type QueryIntent =
  | 'patient_lookup'        // "John Smith's medications"
  | 'patient_summary'       // "Summarize patient X"
  | 'structured_query'      // "Diabetic patients with A1C > 9"
  | 'clinical_note_search'  // "Notes mentioning chest pain"
  | 'population_analytics'  // "How many patients have diabetes"
  | 'hybrid_query'          // Combines structured + semantic
  | 'general_question';     // Open-ended medical question

export interface QueryAnalysis {
  intent: QueryIntent;
  entities: {
    patientName?: string;
    patientId?: string;
    conditions?: string[];
    medications?: string[];
    labCodes?: string[];
    dateRange?: { from?: Date; to?: Date };
    numericFilters?: Array<{ field: string; operator: 'gt' | 'lt' | 'eq'; value: number }>;
  };
  semanticQuery?: string;  // Part to send to vector search
  requiresSQL: boolean;
  requiresVector: boolean;
}

export interface SearchResult {
  source: 'sql' | 'vector' | 'merged';
  patients?: any[];
  documents?: any[];
  aggregations?: any;
}
```

### Step 2: Create Query Analyzer

Create `lib/query-analyzer.ts`:

```typescript
import OpenAI from 'openai';
import { QueryAnalysis, QueryIntent } from './types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ANALYSIS_PROMPT = `You are a medical query analyzer. Given a user query about patient medical records, extract:

1. intent: One of:
   - patient_lookup: Looking up specific patient's data
   - patient_summary: Requesting summary of a patient's history
   - structured_query: Query with specific conditions/values (e.g., "A1C > 9")
   - clinical_note_search: Searching clinical notes for symptoms/mentions
   - population_analytics: Aggregate statistics across patients
   - hybrid_query: Combines structured filters with semantic search
   - general_question: Open-ended medical question

2. entities: Extract any mentioned:
   - patientName: Patient's name
   - patientId: Patient ID if mentioned
   - conditions: Medical conditions mentioned
   - medications: Medications mentioned
   - labCodes: Lab tests mentioned (map to LOINC if possible)
   - dateRange: Any date constraints
   - numericFilters: Numeric comparisons (e.g., "A1C > 9" → {field: "a1c", operator: "gt", value: 9})

3. semanticQuery: The part of the query that needs semantic search (for clinical notes)

4. requiresSQL: true if query needs structured database lookup
5. requiresVector: true if query needs semantic search on clinical notes

Return valid JSON only.

Examples:
- "What medications is John Smith taking?" → patient_lookup, requires SQL only
- "Find patients with diabetes and A1C > 9%" → structured_query, requires SQL only
- "Notes mentioning breathing problems" → clinical_note_search, requires Vector only
- "Diabetic patients with notes about foot issues" → hybrid_query, requires both`;

export async function analyzeQuery(query: string): Promise<QueryAnalysis> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: ANALYSIS_PROMPT },
      { role: 'user', content: query },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
  });

  const result = JSON.parse(response.choices[0].message.content || '{}');

  return {
    intent: result.intent || 'general_question',
    entities: result.entities || {},
    semanticQuery: result.semanticQuery,
    requiresSQL: result.requiresSQL ?? true,
    requiresVector: result.requiresVector ?? false,
  };
}
```

### Step 3: Create SQL Query Builder

Create `lib/sql-queries.ts`:

```typescript
import { prisma } from './prisma';
import { QueryAnalysis } from './types';

export async function executeStructuredQuery(analysis: QueryAnalysis) {
  const { entities, intent } = analysis;

  // Patient lookup by name
  if (entities.patientName) {
    return await findPatientByName(entities.patientName);
  }

  // Patient lookup by ID
  if (entities.patientId) {
    return await getPatientById(entities.patientId);
  }

  // Structured query with conditions/medications
  if (intent === 'structured_query' || intent === 'hybrid_query') {
    return await executeComplexQuery(entities);
  }

  // Population analytics
  if (intent === 'population_analytics') {
    return await executeAnalyticsQuery(entities);
  }

  return null;
}

async function findPatientByName(name: string) {
  const patients = await prisma.patient.findMany({
    where: {
      name: { contains: name, mode: 'insensitive' },
    },
    include: {
      conditions: { where: { status: 'active' } },
      medications: { where: { status: 'active' } },
      observations: { orderBy: { effectiveDate: 'desc' }, take: 10 },
    },
  });

  return { patients, type: 'patient_lookup' };
}

async function getPatientById(id: string) {
  const patient = await prisma.patient.findFirst({
    where: {
      OR: [{ id }, { fhirId: id }],
    },
    include: {
      conditions: true,
      medications: true,
      observations: { orderBy: { effectiveDate: 'desc' } },
      procedures: true,
      allergies: true,
      documents: true,
    },
  });

  return { patient, type: 'patient_detail' };
}

async function executeComplexQuery(entities: QueryAnalysis['entities']) {
  // Build dynamic query based on entities
  const patientIds = new Set<string>();

  // Filter by conditions
  if (entities.conditions?.length) {
    for (const condition of entities.conditions) {
      const matches = await prisma.condition.findMany({
        where: {
          display: { contains: condition, mode: 'insensitive' },
          status: 'active',
        },
        select: { patientId: true },
      });
      matches.forEach((m) => patientIds.add(m.patientId));
    }
  }

  // Filter by numeric values (e.g., A1C > 9)
  if (entities.numericFilters?.length) {
    for (const filter of entities.numericFilters) {
      // Map common terms to LOINC codes
      const codeMap: Record<string, string> = {
        a1c: '4548-4',
        hemoglobin_a1c: '4548-4',
        glucose: '2345-7',
        cholesterol: '2093-3',
      };

      const code = codeMap[filter.field.toLowerCase()] || filter.field;
      const op =
        filter.operator === 'gt' ? 'gt' : filter.operator === 'lt' ? 'lt' : 'equals';

      const matches = await prisma.observation.findMany({
        where: {
          code,
          valueNumeric: { [op]: filter.value },
          ...(patientIds.size > 0 ? { patientId: { in: Array.from(patientIds) } } : {}),
        },
        select: { patientId: true, valueNumeric: true, effectiveDate: true },
        orderBy: { effectiveDate: 'desc' },
      });

      // Intersect with existing patient IDs or add new ones
      if (patientIds.size > 0) {
        const matchedIds = new Set(matches.map((m) => m.patientId));
        patientIds.forEach((id) => {
          if (!matchedIds.has(id)) patientIds.delete(id);
        });
      } else {
        matches.forEach((m) => patientIds.add(m.patientId));
      }
    }
  }

  // Get full patient data for matches
  const patients = await prisma.patient.findMany({
    where: { id: { in: Array.from(patientIds) } },
    include: {
      conditions: { where: { status: 'active' } },
      medications: { where: { status: 'active' } },
      observations: { orderBy: { effectiveDate: 'desc' }, take: 5 },
    },
  });

  return { patients, type: 'complex_query', count: patients.length };
}

async function executeAnalyticsQuery(entities: QueryAnalysis['entities']) {
  // Count patients by condition
  if (entities.conditions?.length) {
    const condition = entities.conditions[0];

    const result = await prisma.condition.groupBy({
      by: ['status'],
      where: {
        display: { contains: condition, mode: 'insensitive' },
      },
      _count: { patientId: true },
    });

    const uniquePatients = await prisma.condition.findMany({
      where: { display: { contains: condition, mode: 'insensitive' } },
      select: { patientId: true },
      distinct: ['patientId'],
    });

    return {
      type: 'analytics',
      condition,
      totalPatients: uniquePatients.length,
      byStatus: result,
    };
  }

  return null;
}

// Get document IDs for a patient (for vector search filtering)
export async function getPatientDocumentIds(patientId: string): Promise<string[]> {
  const docs = await prisma.document.findMany({
    where: { patientId },
    select: { pineconeId: true },
  });
  return docs.map((d) => d.pineconeId);
}

// Get patient IDs matching criteria (for vector search filtering)
export async function getPatientIdsWithCondition(condition: string): Promise<string[]> {
  const matches = await prisma.condition.findMany({
    where: {
      display: { contains: condition, mode: 'insensitive' },
      status: 'active',
    },
    select: { patientId: true },
    distinct: ['patientId'],
  });
  return matches.map((m) => m.patientId);
}
```

### Step 4: Create Vector Search Layer

Create `lib/vector-search.ts`:

```typescript
import { getNotesIndex } from './pinecone';
import { embedText } from './embeddings';

interface VectorSearchOptions {
  query: string;
  topK?: number;
  patientIds?: string[];      // Filter to specific patients
  documentIds?: string[];     // Filter to specific documents
  documentType?: string;      // Filter by document type
}

export async function searchClinicalNotes(options: VectorSearchOptions) {
  const { query, topK = 20, patientIds, documentIds, documentType } = options;

  const index = getNotesIndex();
  const embedding = await embedText(query);

  // Build Pinecone filter
  const filter: Record<string, any> = {};

  if (patientIds?.length) {
    filter.patient_id = { $in: patientIds };
  }

  if (documentIds?.length) {
    filter.id = { $in: documentIds };
  }

  if (documentType) {
    filter.document_type = { $eq: documentType };
  }

  const results = await index.query({
    vector: embedding,
    topK,
    includeMetadata: true,
    filter: Object.keys(filter).length > 0 ? filter : undefined,
  });

  return results.matches.map((match) => ({
    id: match.id,
    score: match.score,
    patientId: match.metadata?.patient_id as string,
    documentType: match.metadata?.document_type as string,
    date: match.metadata?.date as string,
    contentPreview: match.metadata?.content_preview as string,
  }));
}
```

### Step 5: Create Unified Query Executor

Create `lib/query-executor.ts`:

```typescript
import { analyzeQuery } from './query-analyzer';
import { executeStructuredQuery, getPatientIdsWithCondition } from './sql-queries';
import { searchClinicalNotes } from './vector-search';
import { prisma } from './prisma';
import { QueryAnalysis } from './types';

export interface QueryResult {
  analysis: QueryAnalysis;
  sqlResults?: any;
  vectorResults?: any;
  mergedResults?: any;
}

export async function executeQuery(userQuery: string): Promise<QueryResult> {
  // Step 1: Analyze query
  const analysis = await analyzeQuery(userQuery);
  console.log('Query Analysis:', JSON.stringify(analysis, null, 2));

  const result: QueryResult = { analysis };

  // Step 2: Execute SQL if needed
  if (analysis.requiresSQL) {
    result.sqlResults = await executeStructuredQuery(analysis);
  }

  // Step 3: Execute vector search if needed
  if (analysis.requiresVector && analysis.semanticQuery) {
    // For hybrid queries, use SQL results to filter vector search
    let patientIds: string[] | undefined;

    if (analysis.intent === 'hybrid_query' && result.sqlResults?.patients) {
      patientIds = result.sqlResults.patients.map((p: any) => p.id);
    } else if (analysis.entities.conditions?.length && analysis.intent === 'clinical_note_search') {
      // If searching notes for patients with a condition, filter to those patients
      patientIds = await getPatientIdsWithCondition(analysis.entities.conditions[0]);
    }

    result.vectorResults = await searchClinicalNotes({
      query: analysis.semanticQuery,
      topK: 20,
      patientIds,
    });
  }

  // Step 4: Merge results if both SQL and vector were used
  if (result.sqlResults && result.vectorResults) {
    result.mergedResults = await mergeResults(result.sqlResults, result.vectorResults);
  }

  return result;
}

async function mergeResults(sqlResults: any, vectorResults: any[]) {
  // Enrich vector results with patient names
  const patientIds = [...new Set(vectorResults.map((r) => r.patientId))];

  const patients = await prisma.patient.findMany({
    where: { id: { in: patientIds } },
    select: { id: true, name: true },
  });

  const patientMap = new Map(patients.map((p) => [p.id, p.name]));

  const enrichedVectorResults = vectorResults.map((r) => ({
    ...r,
    patientName: patientMap.get(r.patientId) || 'Unknown',
  }));

  return {
    structuredData: sqlResults,
    clinicalNotes: enrichedVectorResults,
  };
}
```

---

## Phase 4: API & Chat Integration

### Step 1: Create Query API Route

Create `app/api/query/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/query-executor';

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const result = await executeQuery(query);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Query error:', error);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }
}
```

### Step 2: Update Chat Route with RAG

Update `app/api/chat/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { executeQuery } from '@/lib/query-executor';

const SYSTEM_PROMPT = `You are a medical records assistant with access to patient data.
You help healthcare providers find information about patients, understand their medical history,
and answer clinical questions.

Guidelines:
- Be accurate and cite specific data when available
- Organize information clearly (conditions, medications, labs, notes)
- Highlight important clinical findings
- If data is missing, say so clearly
- Never make up medical information

You will receive context from the database including patient records and clinical notes.
Use this context to answer the user's question.`;

export async function POST(request: NextRequest) {
  const { query, messages = [] } = await request.json();

  // Execute RAG query to get context
  const ragResult = await executeQuery(query);

  // Build context from RAG results
  const context = buildContext(ragResult);

  // Stream response
  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: SYSTEM_PROMPT,
    messages: [
      ...messages,
      {
        role: 'user',
        content: `Context from medical records:\n${context}\n\nQuestion: ${query}`,
      },
    ],
  });

  return result.toDataStreamResponse();
}

function buildContext(ragResult: any): string {
  const parts: string[] = [];

  // Add SQL results
  if (ragResult.sqlResults) {
    if (ragResult.sqlResults.patients) {
      parts.push('## Patient Records\n');
      for (const patient of ragResult.sqlResults.patients) {
        parts.push(`### ${patient.name} (${patient.gender}, DOB: ${patient.birthDate})`);

        if (patient.conditions?.length) {
          parts.push('\n**Active Conditions:**');
          patient.conditions.forEach((c: any) => parts.push(`- ${c.display} (${c.status})`));
        }

        if (patient.medications?.length) {
          parts.push('\n**Current Medications:**');
          patient.medications.forEach((m: any) => parts.push(`- ${m.display}`));
        }

        if (patient.observations?.length) {
          parts.push('\n**Recent Labs/Vitals:**');
          patient.observations.slice(0, 5).forEach((o: any) => {
            parts.push(`- ${o.display}: ${o.valueNumeric || o.valueString} ${o.unit || ''}`);
          });
        }
        parts.push('');
      }
    }

    if (ragResult.sqlResults.type === 'analytics') {
      parts.push(`## Analytics\n`);
      parts.push(`Condition: ${ragResult.sqlResults.condition}`);
      parts.push(`Total Patients: ${ragResult.sqlResults.totalPatients}`);
    }
  }

  // Add vector search results (clinical notes)
  if (ragResult.vectorResults?.length) {
    parts.push('\n## Relevant Clinical Notes\n');
    for (const note of ragResult.vectorResults.slice(0, 5)) {
      parts.push(`### ${note.patientName || 'Patient'} - ${note.documentType} (${note.date})`);
      parts.push(`Relevance: ${(note.score * 100).toFixed(1)}%`);
      parts.push(`\n${note.contentPreview}\n`);
    }
  }

  return parts.join('\n') || 'No relevant records found.';
}
```

---

## Phase 5: MCP Server (Optional)

Create `mcp-server/index.ts` for programmatic access:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { prisma } from '../lib/prisma';
import { searchClinicalNotes } from '../lib/vector-search';
import { executeQuery } from '../lib/query-executor';

const server = new Server(
  { name: 'medical-rag', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'searchPatients',
      description: 'Search for patients by name',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
    },
    {
      name: 'getPatientSummary',
      description: 'Get full medical summary for a patient',
      inputSchema: {
        type: 'object',
        properties: { patientId: { type: 'string' } },
        required: ['patientId'],
      },
    },
    {
      name: 'searchClinicalNotes',
      description: 'Semantic search over clinical notes',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          patientId: { type: 'string' },
        },
        required: ['query'],
      },
    },
    {
      name: 'queryMedicalRecords',
      description: 'Natural language query over medical records',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
  ],
}));

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'searchPatients':
      const patients = await prisma.patient.findMany({
        where: { name: { contains: args.name, mode: 'insensitive' } },
        take: 10,
      });
      return { content: [{ type: 'text', text: JSON.stringify(patients, null, 2) }] };

    case 'getPatientSummary':
      const patient = await prisma.patient.findUnique({
        where: { id: args.patientId },
        include: {
          conditions: true,
          medications: true,
          observations: { orderBy: { effectiveDate: 'desc' }, take: 20 },
          procedures: true,
          allergies: true,
        },
      });
      return { content: [{ type: 'text', text: JSON.stringify(patient, null, 2) }] };

    case 'searchClinicalNotes':
      const notes = await searchClinicalNotes({
        query: args.query,
        patientIds: args.patientId ? [args.patientId] : undefined,
      });
      return { content: [{ type: 'text', text: JSON.stringify(notes, null, 2) }] };

    case 'queryMedicalRecords':
      const result = await executeQuery(args.query);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

const transport = new StdioServerTransport();
server.connect(transport);
```

---

## Quick Start Checklist

```bash
# 1. Install dependencies
npm install @prisma/client @neondatabase/serverless @pinecone-database/pinecone openai ai zod uuid
npm install -D prisma typescript ts-node @types/node @types/uuid

# 2. Set up environment variables (.env)
DATABASE_URL="postgresql://..."
PINECONE_API_KEY="..."
PINECONE_INDEX="medical-notes"
OPENAI_API_KEY="sk-..."

# 3. Initialize Prisma and push schema
npx prisma generate
npx prisma db push

# 4. Run data ingestion
npm run ingest

# 5. Start development server
npm run dev
```

---

## Example Queries to Test

| Query | Expected Behavior |
|-------|-------------------|
| "What medications is Abe Frami taking?" | SQL lookup by name → medications |
| "Find patients with diabetes and A1C > 9%" | SQL join conditions + observations |
| "Notes mentioning breathing problems" | Vector search on clinical notes |
| "Diabetic patients with foot problems in notes" | Hybrid: SQL for diabetics → Vector for foot mentions |
| "How many patients have hypertension?" | SQL aggregation |
| "Summarize John's medical history" | SQL full patient → LLM summary |

---

## Architecture Benefits

1. **SQL for structure** - Fast, precise, relational queries
2. **Vectors for semantics** - Natural language on clinical notes
3. **Prisma for type safety** - Full TypeScript support, migrations
4. **Neon for serverless** - Scales to zero, generous free tier
5. **Clean separation** - Each tool does what it's best at
6. **Real-world pattern** - Production RAG systems work this way
