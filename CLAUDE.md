# Claude Code Instructions

Project-specific patterns and conventions for AI assistance.

## OpenAI Structured Outputs with Zod

**Always use the Responses API pattern** for structured outputs:

```typescript
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';

// 1. Define Zod schema
const MySchema = z.object({
  field: z.string().describe('Description for the LLM'),
  count: z.number().describe('Numeric field'),
  category: z.enum(['a', 'b', 'c']).describe('Enum field'),
});

// 2. Infer TypeScript type from schema
type MyType = z.infer<typeof MySchema>;

// 3. Call responses.parse() with zodTextFormat
const response = await openaiClient.responses.parse({
  model: 'gpt-4o-mini',
  input: [
    { role: 'system', content: 'System prompt here' },
    { role: 'user', content: userInput },
  ],
  temperature: 0,
  text: {
    format: zodTextFormat(MySchema, 'schemaName'),
  },
});

// 4. Access parsed output and validate
const parsed = response.output_parsed;
return MySchema.parse(parsed);
```

**DO NOT use the old beta API:**
- ~~`zodResponseFormat`~~ → use `zodTextFormat`
- ~~`client.beta.chat.completions.parse()`~~ → use `client.responses.parse()`
- ~~`messages: [...]`~~ → use `input: [...]`
- ~~`response_format: zodResponseFormat(...)`~~ → use `text: { format: zodTextFormat(...) }`
- ~~`response.choices[0].message.parsed`~~ → use `response.output_parsed`

## API Route Input Validation

**Parse request bodies with a Zod schema and let it throw** — the route's catch-all maps `ZodError` to a 400:

```typescript
const MyRequestSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().positive().default(10),
});

export async function POST(request: Request) {
  try {
    const { query, topK } = MyRequestSchema.parse(await request.json()); // typed, defaults applied
    // ... happy path only
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**DO NOT:**
- ~~`if (!query || typeof query !== "string") { ... }`~~ — that's what the schema is for
- ~~`safeParse` + hand-built issue strings~~ — just `.parse()` and let it fail
- ~~`new Response(JSON.stringify({ error }), { status, headers })`~~ — use `NextResponse.json(body, { status })`

## TypeScript Conventions

**Prefer `type` aliases over `interface`** for object shapes, props, and data models:

```typescript
// Do this
type Patient = { id: string; firstName: string | null };

// Not this
interface Patient { id: string; firstName: string | null }
```

`type` is more consistent (handles unions, intersections, and primitives that `interface` can't) and avoids declaration-merging surprises. Reach for `interface` only when you specifically need merging (rare here).

## Project Architecture

- **Neon PostgreSQL**: structured medical data (patients, conditions, observations, medications, notes, encounters) — the system of record. **Each student owns their own** (`npm run db:push && npm run db:seed`); there is no shared read-only instance any more.
- **Pinecone**: vector search over the clinical notes — a *derived* index, rebuildable from Postgres via `npm run vectorize`.
- **Prisma ORM**: type-safe database access.
- **The chat pipeline** — one file per agent in `lib/agents/`, orchestrated by `app/api/chat/route.ts` (the route IS the orchestrator): **selector** (pure routing — `Plan { useSql, useRag, needsSearch, semanticQuery }`, no entity extraction) → **sql ‖ rag** run in parallel (each returns TEXT) → **aggregator** (the ONLY streamer; short-circuits to a direct answer when `needsSearch` is false). `lib/agent.ts` holds only the shared `Message` type.
- **Scripts run on `tsx`**, not `ts-node`. Don't reintroduce `ts-node` or a `ts-node` block in tsconfig — the ESM/CJS resolution failures it caused cost a whole session last cohort.

### There is no MCP server

It was removed. `docs/MCP-NOTE.md` explains what MCP is and why we don't build
one here. Do not recreate `mcp-server/`. Tool calling — which we do teach — lives
in the chat pipeline.

### Human-in-the-loop responses: JSON, not headers

Cohort 3 smuggled the scheduling card through an `X-Scheduling-Action` response
header because the route always streamed. **Return normal JSON when there is a
card to render; stream when there is prose to say.** The route knows which case
it's in.

The header is still there in `app/api/chat/route.ts` and `app/page.tsx` — it is
the starting point students replace in week 4, and both sites are commented as
such. Don't copy the pattern into new code, and don't silently "fix" it either:
removing it is the assignment.

### The SQL side is text-to-SQL — do NOT hand-code query builders

The LLM writes the SQL. The SQL agent (`lib/agents/sql.ts`, `runSql`) feeds the schema + real distinct-value grounding to the model, gets back `{ sql, explanation }`, validates it, runs it read-only, and returns rendered text. **There is no `sql-queries.ts` / query-builder / `CONDITION_MAPPINGS` layer anymore — it was deleted. Do not recreate it.** When a query returns wrong/empty results, fix the schema prompt or the grounding in `lib/agents/sql.ts` — never add a per-question function.

Two guardrails are the point:
- **Safety** — an LLM writing SQL is an injection surface, and the student's own `DATABASE_URL` is now an owner connection, so the guard is the boundary. `assertReadOnly` (`lib/agents/read-only.ts`) accepts only a single `SELECT`/`WITH` — no DML/DDL, no `;`, no writing CTEs, comments stripped first. It is layer three of three; in production also point the read path at a read-only role.
- **Semantic grounding** — the schema tells the model a column *exists*, not what's *in* it ("smoker" ≠ the stored `"Smokes tobacco daily"`; "heart attack" ≠ `"Myocardial Infarction"`). Ground the prompt with real distinct values.

**Never paste the Prisma schema into the prompt.** Cohort 3 did; it went stale
the first time the models changed and the agent started writing SQL against
columns that no longer existed. Keep the short summary in `SCHEMA` true, or read
`information_schema` at call time.

`findPatientByName` (scheduling's one exact lookup) lives in `lib/patients.ts`, not a query-builder module.

## Writes are soft, audited, and human-confirmed

From week 4 the agent can change records. Three non-negotiables:

- **Nothing issues a `DELETE`.** `patients` and `notes` carry `deletedAt`;
  removing means stamping it. Every read path must filter it out — the SQL
  agent's prompt, `searchClinicalNotes`, and `scripts/vectorize.ts` all do.
- **Every write lands a row in `audit_log`** with `before` populated, so any
  single action can be undone by hand.
- **The model proposes; a human confirms.** A write tool returns a proposal;
  a separate confirmed route performs it and sets `humanConfirmed: true`.

Retracting a note is *two* writes — Postgres and Pinecone — and they can't be
atomic. Ordering and failure handling are part of the lesson, not an oversight.

## Data Source

Synthea Coherent Dataset — statistically realistic, **fully synthetic (zero PHI)**. A **~200-patient subset** (fits the Neon free tier), ~21k SOAP-style clinical notes. Each student loads it into their own database with `npm run db:seed`; the instructor regenerates the seed artifact with `npm run db:export-seed`.

## PII Obscuring

PII obscuring is **channel-based** (no login/roles): the front-office channel always obscures; the clinician chat channel returns full data. The channel decides — not a flag the caller could set, which would make it forgeable.

**The obscuring is shape-agnostic.** Because the SQL agent returns whatever columns the LLM chose, there's no fixed "name field" to pseudonymize — so the obscured channel runs the regex de-identifier (`obscureContent`) over the **entire rendered output** (names, SSNs, phones, dates, addresses). It's imperfect by design (regex misses novel formats) — that's the Week 5 lesson. (`obscurePatient` still exists as a field-by-field helper but the main path doesn't use it.)

### Enable Globally
```bash
# In .env
OBSCURE_PII=true
```

### Applying it
```typescript
const combined = [sqlText, ragText].filter(Boolean).join('\n\n');
const safe = obscureContent(combined); // scrub the whole rendered output
```

### What Gets Obscured

| Data Type | Original | Obscured |
|-----------|----------|----------|
| Names | `John Smith` | `Patient-A7B3` |
| Birth dates | `1985-03-15` | `1985-XX-XX` |
| Locations | `Boston, MA 02101` | `[LOCATION REDACTED]` |
| Clinical notes | Names, SSNs, phones, emails, addresses | `[NAME]`, `[SSN REDACTED]`, etc. |

### Utilities (`lib/pii.ts`)
- `shouldObscurePII(flag?)` - Check if obscuring is enabled
- `obscureName(name)` - Hash-based pseudonymization
- `obscureDate(date)` - Keep year, hide month/day
- `obscureLocation(city, state, zip)` - Full redaction
- `obscureContent(text)` - Regex patterns for PII in clinical text
- `obscurePatient(patient, obscure?)` - Apply all obscuring to a patient object
