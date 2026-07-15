# The SQL Agent: Text-to-SQL

**Needs: `OPENAI_API_KEY` and the pre-loaded database**

## Today you will

- Build the **SQL agent** — hand the database **schema** to the LLM and run the query it writes
- Meet the two things that make or break text-to-SQL: **safety** and **semantic grounding**
- Render query results into a text block the rest of the pipeline can read

## Concept

You've already built the selector: it reads a question and returns a typed plan — which store(s) the answer lives in. Today you build the first specialist it routes to. The selector returned a typed object; the SQL agent returns something with more leverage: **the query itself.**

The naive way to answer "which patients…" questions is to hand-code a query builder for each shape — a function for conditions, one for age filters, one for "the youngest," one for counts. You write more of them forever, and every new phrasing ("smokers *under 50*", "the *oldest* diabetic", "average age of…") is another function or another bug. That path is a treadmill.

Text-to-SQL steps off it. You describe the database **schema** to the model, it writes **one read-only `SELECT`**, you run it:

```mermaid
flowchart LR
    Q["'who is the youngest<br/>patient with hypertension?'"] --> L["LLM + schema"]
    L --> S["SELECT ... FROM patients p<br/>JOIN conditions c ...<br/>ORDER BY p.\"birthDate\" DESC LIMIT 1"]
    S --> DB[(Postgres<br/>read-only)]
    DB --> R["rows"]
```

The model writes the `WHERE`, the `JOIN`, the `ORDER BY`, the `LIMIT` — so superlatives, combined filters, and aggregates like "average age" just *work*, with zero per-query code. And it's still the structured-outputs pattern underneath: the LLM returns a **structured output** — `{ sql, explanation }` — a typed function call whose payload happens to be SQL.

### The two things that are actually hard

Text-to-SQL doesn't remove the effort; it **moves** it. Two problems replace the query-builder treadmill, and they're the whole lesson.

1. **Safety — an LLM writing SQL is an injection surface.** If the model can emit `DROP TABLE`, someday it will. The defense is layered: a validator that accepts **only a single read-only `SELECT`** (no `INSERT`/`UPDATE`/`DELETE`/DDL/`;`), *and* — in production — a database role that is physically read-only, so a bad query can't write even if the validator is fooled. Belt and suspenders. (Your pre-loaded database connects as exactly such a role.)
2. **Semantic grounding — the schema says a column exists, not what's *in* it.** The model sees a `conditions.display` column; it does not know the value is literally `"Smokes tobacco daily"`. Ask for "smokers" and it writes `ILIKE '%smoker%'` → **zero rows**, a confident wrong "none." You fix this by **grounding** the prompt with real distinct values from the data.

## Implementation

The agent is a stub on your branch, with the plan spelled out in `TODO`s. This is the day's real work — the selector was the warm-up.

### 1. Implement the SQL agent — `lib/agents/sql.ts`

`runSql(query)` takes the question and returns a **text block** the aggregator will read once the pipeline is wired (next lesson). It's four moves:

1. **A schema prompt** — the tables and columns the model writes against (`patients`, `conditions`, `observations`, `medications`, `notes`, `encounters`), how they join (every clinical table's `"patientId"` → `patients.id`), and the house rules: camelCase columns must be double-quoted (`p."firstName"`), free-text columns use `ILIKE '%term%'`, always end with a `LIMIT`.
2. **Grounding** — pull real `SELECT DISTINCT display` values from `conditions` (and the most frequent `observations`) into the prompt, so the model writes `'Myocardial Infarction'`, not `'heart attack'`. Fetch once, cache in a module variable — the vocabulary doesn't change between requests.
3. **The call + the guardrails** — `responses.parse` with `zodTextFormat` for `{ sql, explanation }`, then **validate before you run anything**: reject stacked statements (`;`), reject anything that doesn't start with `SELECT`/`WITH`, reject write/DDL keywords, and append a `LIMIT` if the model forgot one.
4. **Run and render** — `prisma.$queryRawUnsafe(sql)`, then render the result as text: the explanation, then the rows as `key: value` lines — and on zero rows, say so explicitly ("0 rows — nothing in the records matches") so the component reading the block reports "none" instead of improvising.

While you're developing, `console.log` the generated SQL before you run it — that's the agent thinking on paper, and it's the artifact you'll debug from all week.

### 2. Interrogate it

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

### 3. One honest gap, named now

Run *"any patients who had a heart attack?"*. Without grounding, the model writes `ILIKE '%heart attack%'` and returns **0 rows** — but the records *do* have heart attacks; the condition is stored as **`"Myocardial Infarction"`**. Same trap:

- "heart attack" → the column says `Myocardial Infarction`
- "high blood pressure" → the column says `Hypertension`
- "smoker" → the condition is `Smokes tobacco daily`

This is **semantic grounding**, and it's the real work text-to-SQL leaves you — the header comment in `lib/agents/sql.ts` names it as half the lesson. The distinct-value dump is a first pass, but it's long and unranked, so the model can still miss. The sharper fix is an explicit synonym map (lay term → the value that actually lives in the column), or resolving the user's terms against the vocabulary *before* the model writes SQL.

### Common mistakes

- **Trusting a clean-looking query.** A syntactically perfect `SELECT` over the wrong vocabulary returns a confident, wrong "none." Correct SQL over the wrong *terms* is still a wrong answer.
- **Relying on the validator alone for safety.** The regex check is necessary, not sufficient — in production the read-only DB role is what actually saves you. Two layers.
- **No `LIMIT`.** A question that matches every row shouldn't stream the whole table into the model's context. Enforce a ceiling yourself; don't trust the model to remember.
- **Skipping `temperature: 0`.** A query writer that writes different SQL for the same question on Tuesday isn't a component, it's a coin.

## Your turn

Spend **no more than 75 minutes** here.

1. Finish the stub and run the battery. For each question, predict the query *before* you read what the model wrote.
2. **Break the grounding.** Find three lay terms whose stored value differs (start with the heart-attack / hypertension / smoker set), and confirm each returns 0 rows when the grounding is removed or missed. Then improve it — a synonym line in the schema prompt, or a small alias map — until "heart attack" finds the myocardial-infarction patients.
3. **Try to break the safety guard.** Craft a question that tries to get the model to write something other than a `SELECT` (it will usually refuse, but try). Confirm your validator rejects anything that slips through.

```quiz
[
  {
    "q": "Why let the LLM write the SQL instead of hand-coding a query function per question shape?",
    "options": [
      "Model-written SQL runs faster because it's optimized against the live schema",
      "Every new phrasing — 'smokers under 50', 'the oldest diabetic', 'average age of…' — is another hand-coded function or another bug; given the schema, the model composes WHERE/JOIN/ORDER BY per question with zero per-query code",
      "Hand-coded query builders can't produce aggregates like AVG without an ORM"
    ],
    "answer": 1,
    "explain": "The query-builder path is a treadmill — you write more functions forever. Text-to-SQL steps off it, but doesn't remove the effort: it MOVES it, to safety (an LLM writing SQL is an injection surface) and semantic grounding (the schema says a column exists, not what's in it). Those two problems are the lesson."
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

- Why keep a read-only database role *and* a `SELECT`-only validator — isn't one enough?
- The schema is in the prompt, yet "smoker" returns nothing. What's missing, and where do you add it?
- Why must the rendered text block say "0 rows — nothing in the records matches" explicitly instead of returning an empty string?

<details>
<summary>Solution / discussion</summary>

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

**Why "0 rows" must be said out loud:** the agent's output is a text block another LLM will read. An empty string looks like "nothing was asked," not "nothing matched" — and a model handed silence next to a question improvises. An explicit "0 rows — nothing in the records matches" turns absence into a quotable fact, so the final answer can honestly say "none."

</details>

## Further reading (optional)

- [OpenAI: structured outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs) — the `{ sql, explanation }` payload is the same mechanism as the selector's `Plan`
- The header comment in `lib/agents/sql.ts` — the safety + vocabulary problems, written down where they live
