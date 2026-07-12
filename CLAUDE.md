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

- **Neon PostgreSQL**: structured medical data (patients, conditions, observations, medications, notes, encounters) — the system of record.
- **Pinecone**: vector search over the clinical notes — a *derived* index, rebuildable from Postgres via `npm run vectorize`.
- **Prisma ORM**: type-safe database access.
- **The chat pipeline** — one file per agent in `lib/agents/`, orchestrated by `app/api/chat/route.ts` (the route IS the orchestrator): **selector** (pure routing — `Plan { useSql, useRag, needsSearch, semanticQuery }`, no entity extraction) → **sql ‖ rag** run in parallel (each returns TEXT) → **aggregator** (the ONLY streamer; short-circuits to a direct answer when `needsSearch` is false). Scheduling actions ride in the `X-Scheduling-Action` response header. `lib/agent.ts` holds only the shared `Message` type. There is no `/api/query` — chat and the MCP server are the only channels.

### The SQL side is text-to-SQL — do NOT hand-code query builders

The LLM writes the SQL. The SQL agent (`lib/agents/sql.ts`, `runSql`) feeds the schema + real distinct-value grounding to the model, gets back `{ sql, explanation }`, validates it, runs it read-only, and returns rendered text. **There is no `sql-queries.ts` / query-builder / `CONDITION_MAPPINGS` layer anymore — it was deleted. Do not recreate it.** When a query returns wrong/empty results, fix the schema prompt or the grounding in `lib/agents/sql.ts` — never add a per-question function.

Two guardrails are the point:
- **Safety** — an LLM writing SQL is an injection surface. `assertReadOnly` accepts only a single `SELECT` (no DML/DDL/`;`). In production also point `DATABASE_URL` at a read-only role (`student_ro`).
- **Semantic grounding** — the schema tells the model a column *exists*, not what's *in* it ("smoker" ≠ the stored `"Smokes tobacco daily"`; "heart attack" ≠ `"Myocardial Infarction"`). Ground the prompt with real distinct values.

`findPatientByName` (scheduling's one exact lookup) lives in `lib/patients.ts`, not a query-builder module.

## Data Source

Synthea Coherent Dataset — statistically realistic, **fully synthetic (zero PHI)**. The deployed/shared database is a **~200-patient subset** (fits the Neon free tier), ~21k SOAP-style clinical notes. Students connect **read-only**; nobody creates or seeds it.
- See `docs/DATA_STRUCTURE.md` for FHIR resource details.

## PII Obscuring

PII obscuring is **channel-based** (no login/roles): the **MCP server** (front-office channel) always obscures; the chat channel (clinician-facing) returns full data.

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
