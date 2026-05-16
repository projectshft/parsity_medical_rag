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

## Project Architecture

- **Neon PostgreSQL**: Structured medical data (patients, conditions, observations, medications)
- **Pinecone**: Vector search for clinical notes only
- **Prisma ORM**: Type-safe database access
- **Hybrid RAG**: SQL filters → Vector search for combined queries

## Data Source

Synthea Coherent Dataset (~1,278 patients with SOAP-style clinical notes)
- Location: `data/coherent/fhir/`
- See `docs/DATA_STRUCTURE.md` for FHIR resource details

## PII Obscuring

The system supports query-time PII obscuring for privacy-sensitive contexts.

### Enable Globally
```bash
# In .env
OBSCURE_PII=true
```

### Enable Per-Request
```typescript
// Pass obscurePII option to query functions
const results = await executeQuery(userQuery, { obscurePII: true });
const formatted = formatResultsForLLM(results, true);

// Or in vector search
const notes = await searchClinicalNotes(query, { obscurePII: true });
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
