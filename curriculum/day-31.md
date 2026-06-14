# Day 31 — The Upload API: Additive, Idempotent Ingestion

**Needs: the full pipeline; `docs/CHALLENGE-UPLOAD-API.md` open in a tab**

## Today you will

- Rebuild `/api/upload` on the pipeline you built — replacing the legacy chunking version
- Learn the two properties every ingestion endpoint must have: additive and idempotent
- Write the tests yourself this time — including the one that proves your endpoint cannot destroy data

## Concept

Welcome to the final block: production gates. Each day takes something that works and makes it something you could defend — to a security review, to an auditor, to yourself at 2am. First gate: how data gets in.

Your system has one ingestion path: the script. It is a batch tool with batch manners — it clears both stores and reloads everything. Correct for rebuilding a learning database; catastrophic as an API. An endpoint a clinic calls to add one new patient must obey different laws:

| Property | Meaning | The violation |
|---|---|---|
| Additive | Adds to what exists; never clears | One upload wipes 1,278 patients to insert 1 |
| Idempotent | Same request twice = same end state | A retried request creates duplicates |

That second one is not paranoia: networks retry, clients double-click, queues re-deliver. Re-delivery is a *when*, not an *if*, and an endpoint that duplicates on retry is a data-corruption bug waiting for a slow Tuesday.

The good news: you already built the foundations. The FHIR-id-as-primary-key decision from the Postgres day makes idempotency nearly free (re-inserting an existing id is an upsert/skip, not a duplicate), and the vector store upserts by note id the same way. Today assembles those properties into an endpoint — and proves them with tests.

Why this is its own day: `app/api/upload/route.ts` currently runs the legacy chunking pipeline from before this course's architecture existed. Replacing obsolete-but-running code with the current pipeline, without breaking the contract, is the most realistic ticket in the course.

## Implementation

The full spec is `docs/CHALLENGE-UPLOAD-API.md` — work it end to end. The shape of the work:

### 1. The route

`POST /api/upload` takes a FHIR bundle. Validate it with a zod schema and `.parse()` (the CLAUDE.md pattern — `ZodError` maps to 400 in your catch). Reject anything that is not a Bundle, or a Bundle without a Patient resource. Then run it through `processBundle` from `lib/fhir-extract.ts` — the same extraction the ingest script uses, which you read on the FHIR day.

### 2. The two properties, in code

- Additive: write the patient with an upsert, the children with `createMany({ skipDuplicates: true })`, notes with your normal vector upsert. No `deleteMany`. No `deleteAllChunks`. The clearing belongs to the script and nowhere else.
- Idempotent: because every id is the FHIR id, re-running the same bundle updates-in-place rather than duplicating. You get this for free *if* you do not generate new ids — so do not.

### 3. The tests — and the one that matters most

You write these (mock `lib/prisma` and `lib/pinecone` with `vi.mock`; never hit a real service). The spec lists them; the load-bearing one is the destructive-call test:

```
it('never clears existing data', async () => {
  await POST(uploadRequest(fixtureBundle));
  expect(deleteAllChunks).not.toHaveBeenCalled();
  expect(prisma.patient.deleteMany).not.toHaveBeenCalled();
});
```

Most tests assert that code does the right thing. This one asserts it *cannot do the catastrophic thing* — a different and more valuable kind of test, because the failure it guards against is not "wrong answer" but "data gone." Get used to writing the can't-happen test for every irreversible operation.

### Common mistakes

- Calling the ingest script's clear-first logic from the route. The script and the API have opposite contracts; sharing the destructive half is how a deploy wipes production.
- Generating fresh ids on insert. One `uuid()` in the wrong place and idempotency evaporates — every retry is a new patient. The FHIR id is the id; keep it.
- Testing only the happy path. An upload endpoint with no destructive-call test and no re-upload test has not been tested where it counts. The boring assertions are the ones an incident review reads.
- Skipping bundle validation because "the script trusts its input." The script reads files you control; the API receives bytes from the network. Boundaries between trusted and untrusted are where validation lives — a theme that owns the rest of this block.

## Your turn

The challenge doc is the your-turn. Deliverables: the rebuilt route, your test file passing, and in your notes — the response your endpoint returns for (a) a fresh patient, (b) the exact same bundle posted again, (c) a bundle with no Patient. Spend no more than 30 minutes stuck before reading the challenge's hints.

## Check yourself

- Why does the same FHIR bundle, posted twice, leave the database in the same state — and which earlier design decision bought you that?
- A teammate says "let's reuse the ingest script's logic in the route to avoid duplication." What is your one-sentence objection?

<details>
<summary>Solution / discussion</summary>

**Idempotency's origin** is the Postgres day's choice to make the FHIR id the primary key. Insert a row whose primary key already exists and the database rejects the duplicate; `upsert`/`skipDuplicates` turns that rejection into "update or ignore." Had the schema used an auto-generated id, every upload would pile up fresh copies and idempotency would require a manual "does this already exist" check on every record — slower, racier, and easy to get wrong. One schema decision, weeks earlier, paid off as a property you barely had to write.

**The reuse objection:** the script and the API have *opposite contracts* — the script's job is "replace everything," the API's is "never remove anything." Sharing code across an inverted contract means the destructive path is one bad import away from the endpoint, and the day someone refactors the shared function the API inherits a clear-first it never wanted. Shared *extraction* (`processBundle`) is good reuse — it has the same contract everywhere. Shared *persistence* is the trap. Reuse along contract lines, not along "it looks similar" lines.

</details>

## Further reading (optional)

- [Stripe: idempotent requests](https://docs.stripe.com/api/idempotent_requests) — how a company whose entire business is "do not double-charge" thinks about exactly today's property
