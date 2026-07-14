# Two Planners: the Selector and the SQL Agent

**Needs: yesterday's structured-output pattern fresh in mind; `OPENAI_API_KEY` and the pre-loaded database**

## Today you will

- Build the **selector** — yesterday's pattern pointed at routing: which engine(s) does a question need?
- Build the **SQL agent** — hand the database **schema** to the LLM and run the query it writes
- Meet the two things that make or break text-to-SQL: **safety** and **semantic grounding**

## Concept

The agent you're assembling this week is four small pieces: a **selector** that routes, two specialists that retrieve (a **SQL agent** for exact facts, a **RAG agent** for meaning-matched notes), and an **aggregator** that writes the final answer. Today you build the two pieces where an LLM does the *planning* — the selector decides which stores to hit, and the SQL agent decides what query to run. Tomorrow you wire all four together.

### The selector: routing as a structured output

Yesterday's ticket extractor pulled urgency out of an email. Point the same four-step pattern at a different target — *retrieval strategy* — and you have the selector. It answers exactly one question: **which store(s) does this question need?** The whole schema (`lib/agents/selector.ts`):

```typescript
const PlanSchema = z.object({
  requiresSQL: z
    .boolean()
    .describe('Structured data is needed — counts, filters by condition/medication/lab/age, or a specific patient.'),
  requiresVector: z
    .boolean()
    .describe('The clinical notes are needed — questions about what notes say / describe / mention.'),
  semanticQuery: z
    .string()
    .nullable()
    .describe('If requiresVector, an expanded clinical phrasing of the question to embed for note search.'),
});
```

Three fields. "How many patients have diabetes?" → SQL (a count). "Notes mentioning chest pain at night" → vector (what the notes *say*). "What do the notes say about sleep for patients with depression?" → both. And "what's a normal A1C range?" → **neither** — a general-knowledge question with no tie to these records, so the pipeline skips retrieval entirely. That both-false case is a real, legitimate route (`needsSearch: false` in the returned `Plan`), not an error — you'll see it short-circuit the pipeline tomorrow.

Notice what the schema *doesn't* have — no `intent` enum, no extracted condition names, no age filters, no entity list. That's deliberate, and it's the design decision worth internalizing:

**Don't extract entities in the router.** It's tempting to make the selector pull out "hypertension" and "under 50" while it's in there anyway. Resist. The SQL agent's LLM re-derives all of that *better* when it writes the query, because it has the database schema in front of it — it knows there's a `conditions.display` column to match and a `birthDate` to compute age from. Anything the selector extracts is redundant work and a second place to be wrong: now a routing bug *and* an extraction bug can each break the same question. A selector that only routes can only misroute — one failure mode, easy to inspect, easy to fix.

The one piece of content it does produce is `semanticQuery`: an expanded clinical rephrasing for the note search ("trouble sleeping" → "insomnia, poor sleep, waking at night"). Embedding a well-phrased query is the vector store's whole game, and the selector is the last stop where an LLM sees the question before it becomes a vector.

### The SQL agent: the LLM writes the query itself

The selector returns a typed object. The SQL agent returns something with more leverage: **the query itself.**

The naive way to answer "which patients…" questions is to hand-code a query builder for each shape — a function for conditions, one for age filters, one for "the youngest," one for counts. You write more of them forever, and every new phrasing ("smokers *under 50*", "the *oldest* diabetic", "average age of…") is another function or another bug. That path is a treadmill.

Text-to-SQL steps off it. You describe the database **schema** to the model, it writes **one read-only `SELECT`**, you run it:

```mermaid
flowchart LR
    Q["'who is the youngest<br/>patient with hypertension?'"] --> L["LLM + schema"]
    L --> S["SELECT ... FROM patients p<br/>JOIN conditions c ...<br/>ORDER BY p.\"birthDate\" DESC LIMIT 1"]
    S --> DB[(Postgres<br/>read-only)]
    DB --> R["rows"]
```

The model writes the `WHERE`, the `JOIN`, the `ORDER BY`, the `LIMIT` — so superlatives, combined filters, and aggregates like "average age" just *work*, with zero per-query code. And it's still yesterday's pattern underneath: the LLM returns a **structured output** — `{ sql, explanation }` — a typed function call whose payload happens to be SQL.

### The two things that are actually hard

Text-to-SQL doesn't remove the effort; it **moves** it. Two problems replace the query-builder treadmill, and they're the whole lesson.

1. **Safety — an LLM writing SQL is an injection surface.** If the model can emit `DROP TABLE`, someday it will. The defense is layered: a validator that accepts **only a single read-only `SELECT`** (no `INSERT`/`UPDATE`/`DELETE`/DDL/`;`), *and* — in production — a database role that is physically read-only, so a bad query can't write even if the validator is fooled. Belt and suspenders. (Your pre-loaded database connects as exactly such a role.)
2. **Semantic grounding — the schema says a column exists, not what's *in* it.** The model sees a `conditions.display` column; it does not know the value is literally `"Smokes tobacco daily"`. Ask for "smokers" and it writes `ILIKE '%smoker%'` → **zero rows**, a confident wrong "none." You fix this by **grounding** the prompt with real distinct values from the data.

## Implementation

Both agents are stubs on your branch, with the plan spelled out in `TODO`s. Build them in order — the selector is a warm-up; the SQL agent is the day's real work.

### 1. Implement the selector — `lib/agents/selector.ts`

The schema and the `Plan` type are provided; you write the system prompt and the `select` function. Same four steps as yesterday's extractor:

1. `openai.responses.parse` at `temperature: 0` with `zodTextFormat(PlanSchema, 'plan')`. The input is your system prompt (describe the two stores and when each is needed; a pure general question needs neither; when unsure about a records question, prefer the notes), the last few turns of history (`history.slice(-5)` — enough to resolve a follow-up like "what about her medications?"), then the user's query.
2. `PlanSchema.parse(response.output_parsed)`.
3. Map it to the `Plan`: `useSql = requiresSQL`, `useRag = requiresVector`, `needsSearch = useSql || useRag`, and `semanticQuery: semanticQuery || query` (fall back to the raw question).

Then a routing battery, in a scratch script:

```typescript
import 'dotenv/config';
import { select } from './lib/agents/selector';

const queries = [
  'How many patients have diabetes?',
  'notes mentioning chest pain at night',
  'what do the notes say about sleep for patients with depression?',
  "what's a normal A1C range?",
];

async function main() {
  for (const q of queries) {
    console.log(`\n${q}\n `, await select(q));
  }
}
main();
```

Expect SQL-only, vector-only, both, and neither (`needsSearch: false`) — in that order. If a route is wrong, the fix is a sentence in the system prompt, not code.

### 2. Implement the SQL agent — `lib/agents/sql.ts`

`runSql(query)` takes the question and returns a **text block** the aggregator can read tomorrow. It's four moves:

1. **A schema prompt** — the tables and columns the model writes against (`patients`, `conditions`, `observations`, `medications`, `notes`, `encounters`), how they join (every clinical table's `"patientId"` → `patients.id`), and the house rules: camelCase columns must be double-quoted (`p."firstName"`), free-text columns use `ILIKE '%term%'`, always end with a `LIMIT`.
2. **Grounding** — pull real `SELECT DISTINCT display` values from `conditions` (and the most frequent `observations`) into the prompt, so the model writes `'Myocardial Infarction'`, not `'heart attack'`. Fetch once, cache in a module variable — the vocabulary doesn't change between requests.
3. **The call + the guardrails** — `responses.parse` with `zodTextFormat` for `{ sql, explanation }`, then **validate before you run anything**: reject stacked statements (`;`), reject anything that doesn't start with `SELECT`/`WITH`, reject write/DDL keywords, and append a `LIMIT` if the model forgot one.
4. **Run and render** — `prisma.$queryRawUnsafe(sql)`, then render the result as text: the explanation, then the rows as `key: value` lines — and on zero rows, say so explicitly ("0 rows — nothing in the records matches") so the aggregator reports "none" instead of improvising.

While you're developing, `console.log` the generated SQL before you run it — that's the agent thinking on paper, and it's the artifact you'll debug from all week.

### 3. Interrogate it

```typescript
import 'dotenv/config';
import { runSql } from './lib/agents/sql';

const queries = [
  'who is the youngest patient with hypertension?',
  'which patients have both diabetes and depression?',
  "what's the average age of patients with COPD?",
  'any smokers under 50?',
];

async function main() {
  for (const q of queries) {
    console.log(`\n=== ${q}\n${await runSql(q)}`);
  }
}
main();
```

The first three answer cleanly — a superlative, a two-condition `EXISTS`, an aggregate — none of which a hand-coded builder gave you for free. Watch the SQL for each; predict it before you read it.

### 4. One honest gap, named now

Run *"any patients who had a heart attack?"*. Without grounding, the model writes `ILIKE '%heart attack%'` and returns **0 rows** — but the records *do* have heart attacks; the condition is stored as **`"Myocardial Infarction"`**. Same trap:

- "heart attack" → the column says `Myocardial Infarction`
- "high blood pressure" → the column says `Hypertension`
- "smoker" → the condition is `Smokes tobacco daily`

This is **semantic grounding**, and it's the real work text-to-SQL leaves you — the header comment in `lib/agents/sql.ts` names it as half the lesson. The distinct-value dump is a first pass, but it's long and unranked, so the model can still miss. The sharper fix is an explicit synonym map (lay term → the value that actually lives in the column), or resolving the user's terms against the vocabulary *before* the model writes SQL.

### Common mistakes

- **A fat selector.** Adding `conditions: z.array(z.string())` to the plan feels helpful and creates a second extraction pipeline that the SQL agent will ignore or contradict. Route only.
- **Trusting a clean-looking query.** A syntactically perfect `SELECT` over the wrong vocabulary returns a confident, wrong "none." Correct SQL over the wrong *terms* is still a wrong answer.
- **Relying on the validator alone for safety.** The regex check is necessary, not sufficient — in production the read-only DB role is what actually saves you. Two layers.
- **No `LIMIT`.** A question that matches every row shouldn't stream the whole table into the model's context. Enforce a ceiling yourself; don't trust the model to remember.
- **Skipping `temperature: 0`.** A query writer that writes different SQL for the same question on Tuesday isn't a component, it's a coin.

## Your turn

Spend **no more than 90 minutes** here.

1. Finish both stubs and run both batteries. For each SQL question, predict the query *before* you read what the model wrote.
2. **Break the grounding.** Find three lay terms whose stored value differs (start with the heart-attack / hypertension / smoker set), and confirm each returns 0 rows when the grounding is removed or missed. Then improve it — a synonym line in the schema prompt, or a small alias map — until "heart attack" finds the myocardial-infarction patients.
3. **Try to break the safety guard.** Craft a question that tries to get the model to write something other than a `SELECT` (it will usually refuse, but try). Confirm your validator rejects anything that slips through.
4. Add five queries of your own to the routing battery, including one follow-up that only works with history. Any misroutes? Fix the prompt, not the caller.

```quiz
[
  {
    "q": "The SQL agent clearly needs condition names and age filters. Why doesn't the selector extract them while it's reading the question anyway?",
    "options": [
      "Extracting entities would make the selector's LLM call too slow to run on every message",
      "The Plan schema can't express arrays of entities, so there's nowhere to put them",
      "The SQL agent re-derives them better because it holds the database schema; upstream extraction is done blind and adds a second place for the same question to break"
    ],
    "answer": 2,
    "explain": "The filters are a function of the schema — which columns exist, what the joins are — and only the SQL agent has it. A selector that only routes can only misroute: one failure mode, easy to inspect. A fat selector creates a routing bug AND an extraction bug per question."
  },
  {
    "q": "Why keep BOTH the SELECT-only validator and a read-only database role — isn't one enough?",
    "options": [
      "The validator is a regex and regexes are foolable; the role is enforced by Postgres itself — the validator makes the common case cheap, the role makes the worst case impossible",
      "The validator handles injection from users while the role handles injection from the LLM",
      "The role only applies in production, so the validator is there to protect your dev database"
    ],
    "answer": 0,
    "explain": "Defense in depth. The in-process check catches the obvious (DROP, stacked statements) before anything runs, but a query that beats it still physically cannot write, because the connecting role has no write grant."
  },
  {
    "q": "The full table schema is in the prompt, yet 'any smokers?' confidently returns 0 rows. What's missing?",
    "options": [
      "A richer schema prompt — the model needs column types and indexes to write correct SQL",
      "Semantic grounding — the schema says a display column exists, not that its value is 'Smokes tobacco daily'; the model needs the real vocabulary (distinct values or a synonym map)",
      "The safety validator stripped the WHERE clause, so the query matched nothing"
    ],
    "answer": 1,
    "explain": "The SQL was syntactically perfect — ILIKE '%smoker%' over the wrong vocabulary. The schema is structure; grounding is meaning. Text-to-SQL needs both, and a confident wrong 'none' is the failure smell that tells you grounding is the gap."
  }
]
```

## Check yourself

- Why does the selector *not* extract condition names or age filters, when the SQL agent will clearly need them?
- Why keep a read-only database role *and* a `SELECT`-only validator — isn't one enough?
- The schema is in the prompt, yet "smoker" returns nothing. What's missing, and where do you add it?

<details>
<summary>Solution / discussion</summary>

**Why the selector stays skinny:** the filters the SQL agent needs are a *function of the database schema* — which columns exist, what the joins are — and the SQL agent is the only component holding that schema. Extraction done upstream is done blind (the selector doesn't know `display` from `valueNumber`), and it doubles the places one question can break. The finished selector's system prompt is ~20 lines: describe the two stores, give one example of a both-stores question, name the general-question case, and state the tie-breaker ("when unsure, prefer the notes"). Everything else is yesterday's four steps verbatim.

**Two layers of safety:** the validator is a fast, in-process check that catches the obvious (`DROP`, stacked statements) before a query ever runs — but it's a regex, and regexes are foolable. The read-only role is enforced by Postgres itself: even a query that beats the validator physically cannot write, because the connecting role has no write grant. Defense in depth — the validator makes the common case cheap; the role makes the worst case impossible. The reference validator, in full:

```typescript
function assertReadOnly(sql: string): void {
  const trimmed = sql.trim().replace(/;\s*$/, '');
  if (/;/.test(trimmed)) throw new Error('Only a single statement is allowed');
  if (!/^\s*(select|with)\b/i.test(trimmed)) throw new Error('Only SELECT queries are allowed');
  if (/\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy)\b/i.test(trimmed)) {
    throw new Error('Write / DDL keywords are not allowed');
  }
}
```

…plus the `LIMIT` backstop after it: `const safeSql = /\blimit\b/i.test(sql) ? sql : sql.trim().replace(/;\s*$/, '') + ' LIMIT 50';`

**"Smoker" returns nothing** because the schema tells the model a `display` column *exists*, not that its value is `"Smokes tobacco daily"`. The fix is **semantic grounding**: give the model the real vocabulary. Two places — (1) the grounding step, which should surface the actual distinct values (include *all* ~120 distinct condition displays; coverage is the whole point), and (2) the schema prompt, where an explicit synonym line ("'smoker' → the condition is 'Smokes tobacco daily'") costs nothing. The schema is *structure*; grounding is *meaning*, and text-to-SQL needs both.

</details>

## Further reading (optional)

- [OpenAI: structured outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs) — the `Plan` and the `{ sql, explanation }` payload are the same mechanism as yesterday
- The header comment in `lib/agents/sql.ts` — the safety + vocabulary problems, written down where they live
