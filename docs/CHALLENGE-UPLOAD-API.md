# Challenge: Rebuild the Upload API

Rebuild `POST /api/upload` on top of the new ingestion pipeline — and prove it works with tests.

## Learning Objectives

- Build a Next.js API route that writes to two data stores (Postgres + Pinecone)
- Reuse extraction logic instead of duplicating it (`lib/fhir-extract.ts`)
- Understand why this dataset needs **no chunking** (one note = one vector)
- Test an API route by mocking its external dependencies

## Background

The current `app/api/upload/route.ts` is built on the old pipeline: it runs every FHIR resource through `lib/chunking.ts` and dumps text chunks into Pinecone. We've since redesigned ingestion (see `scripts/ingest-coherent.ts`):

- **Structured data** (patients, conditions, observations, medications) → **Postgres** via Prisma
- **Clinical notes** (`DocumentReference` attachments) → **Pinecone**, one note = one vector

The extraction logic already exists as pure, tested functions in `lib/fhir-extract.ts` (see `lib/fhir-extract.test.ts`). Your job is to put an HTTP API in front of it.

## Your Task

Replace the body of `app/api/upload/route.ts` so that uploading a FHIR bundle ingests it through the new pipeline.

### Requirements

**Request:** `POST /api/upload` with a FHIR Bundle as the JSON body.

**Behavior:**

1. Validate the body with a Zod schema — `.parse()` and let it throw; map `ZodError` to `400` in the catch (see CLAUDE.md "API Route Input Validation"). A `Bundle` without a `Patient` resource is also a `400`
2. Run the bundle through `processBundle()` from `lib/fhir-extract.ts`
3. Write the patient, conditions, observations, and medications to Postgres (use the shared client from `lib/prisma.ts`)
4. Upsert the clinical notes to Pinecone with `upsertChunks()` from `lib/pinecone.ts`
5. Uploads must be **additive** — do NOT clear existing data (the ingest script clears; the API must not)
6. Re-uploading the same bundle must not crash or duplicate rows (hint: resource IDs are stable — look at `skipDuplicates` / `upsert`)

**Response (200):**

```json
{
  "success": true,
  "patientId": "b8dd1798-beef-094d-1be4-f90ee0e6b7d5",
  "inserted": {
    "conditions": 12,
    "observations": 307,
    "medications": 44,
    "notes": 35
  }
}
```

**Error responses:** `400` for invalid/missing bundle, `500` with an error message for downstream failures.

### Tests (`app/api/upload/route.test.ts`)

Write tests that run with `npm run test:run` and **do not hit real services** — mock `lib/prisma` and `lib/pinecone` with `vi.mock()`. At minimum:

1. **Happy path** — POST a small fixture bundle (build one, or borrow the fixture style from `lib/fhir-extract.test.ts`), assert a `200` with the right counts
2. **The vector payload is right** — assert `upsertChunks` was called with chunks whose `content` is the decoded note text and whose `metadata` includes `patientId`, `patientName`, `type`, and a `YYYY-MM-DD` `date` (this is what `lib/vector-search.ts` depends on!)
3. **Validation** — a body with no `Patient` resource returns `400`, and neither Prisma nor Pinecone is called
4. **No destructive calls** — `deleteAllChunks` and `deleteMany` are never called

## Hints

- Next.js route handlers are just functions — import `POST` directly in your test and call it with `new Request(...)`. No server needed.
- `vi.mock('@/lib/pinecone', ...)` must be declared before the route import is evaluated — check the Vitest docs on hoisting.
- `prisma.patient.upsert` + `createMany({ skipDuplicates: true })` is the simplest idempotency story.
- Look at how `scripts/ingest-coherent.ts` wires the same pieces together — the route is the same flow minus the file I/O and minus the clearing.

## Stretch Goals

- Accept an array of bundles in one request and report per-bundle results
- Respect the `OBSCURE_PII` flag: obscure patient names in Pinecone metadata at ingest time (see `lib/pii.ts` — and think about why query-time obscuring might be the better design)
- Add a `dryRun=true` query param that returns the counts without writing anything
