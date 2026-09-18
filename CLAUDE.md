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
- **The chat pipeline** (`/api/chat`) — one file per agent in `lib/agents/`, orchestrated by `app/api/chat/route.ts` (the route IS the orchestrator): **selector** (pure routing — `Plan { useSql, useRag, useScheduler, needsSearch, semanticQuery }`, no entity extraction) → **sql ‖ rag** (each returns TEXT) → **aggregator** (streams the grounded answer). A scheduling request **short-circuits** retrieval: the route streams its own response and rides the action out in the `X-Scheduling-Action` header, so the aggregator is the only streamer *on the retrieval path*, not in the file. `lib/agent.ts` holds only the shared `Message` type.
- **The tool-calling channel** (`/api/chat-graph`) — `lib/graph.ts`: the same `runSql` / `runRag` functions exposed as LangGraph tools, where the **model** picks what to call instead of the selector. Deliberately a *second* route: `/api/chat` keeps working, and the two are meant to be compared on the same question. Student task — `buildGraph` throws until implemented.
- There is no `/api/query` and no MCP server. The channels are `/api/chat` and `/api/chat-graph`.

### The SQL side is text-to-SQL — do NOT hand-code query builders

The LLM writes the SQL. The SQL agent (`lib/agents/sql.ts`, `runSql`) feeds the schema + real distinct-value grounding to the model, gets back `{ sql }`, runs it via `$queryRawUnsafe` against the read-only role, and returns rendered text. **There is no `sql-queries.ts` / query-builder / `CONDITION_MAPPINGS` layer anymore — it was deleted. Do not recreate it.** When a query returns wrong/empty results, fix the schema prompt or the grounding in `lib/agents/sql.ts` — never add a per-question function.

Two guardrails are the point:
- **Safety** — an LLM writing SQL is an injection surface, and right now the only thing defending this path is the **database role**: `DATABASE_URL` points at `student_ro`, which holds `SELECT` and nothing else. There is **no `assertReadOnly` in the code** — it's a marked TODO in `lib/agents/sql.ts` (a student exercise: accept one statement, `SELECT` only, no `;`, no DML/DDL). Don't describe it as shipped, and don't wire a throwing validator into the working path without saying so. The ordering is the lesson: the database enforces, a validator only explains.
- **Semantic grounding** — the schema tells the model a column *exists*, not what's *in* it ("smoker" ≠ the stored `"Smokes tobacco daily"`; "heart attack" ≠ `"Myocardial Infarction"`). Ground the prompt with real distinct values.

`findPatientByName` (scheduling's one exact lookup) lives in `lib/patients.ts`, not a query-builder module.

### Tool-calling lives in `lib/graph.ts` — LangGraph v1, not the AI SDK

The graph channel uses `@langchain/langgraph` v1 + `@langchain/openai` (`ChatOpenAI`), NOT the Vercel AI SDK's `tool()` / `maxSteps`. Both are installed — the AI SDK stays on the `/api/chat` streaming path. Don't mix them in one file.

```typescript
import { tool } from '@langchain/core/tools';
import { StateGraph, MessagesAnnotation, START, END } from '@langchain/langgraph';
import { ToolNode, toolsCondition } from '@langchain/langgraph/prebuilt';

const myTool = tool(async ({ arg }) => runSomething(arg), {
  name: 'snake_case_name',
  description: 'When to use this, and when NOT to — the model sees only this.',
  schema: z.object({ arg: z.string().describe('…') }),
});
```

- `schema:` (v1), **not** `parameters:` (that's the AI SDK's v4 shape).
- Tools wrap the EXISTING agents (`runSql`, `runRag`). A tool body should be one line. If you're writing retrieval logic inside a tool, it belongs in `lib/agents/`.
- `ChatOpenAI` takes `apiKey` plus `configuration: { baseURL }` — same proxy as `lib/openai.ts`.
- `buildGraph()` currently throws (student exercise). Leave it throwing unless asked; the instructor solution belongs on the `instructor` branch, never here.

## Data Source

Synthea Coherent Dataset — statistically realistic, **fully synthetic (zero PHI)**. The deployed/shared database is a **~200-patient subset** (fits the Neon free tier), ~21k SOAP-style clinical notes. Students connect **read-only**; nobody creates or seeds it.
- See `docs/DATA_STRUCTURE.md` for FHIR resource details.
