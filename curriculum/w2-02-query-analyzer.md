# The SQL Agent: Text-to-SQL

**Needs: yesterday's structured-output pattern fresh in mind; `OPENAI_API_KEY` and the pre-loaded database**

## Today you will

- Build the SQL agent by handing the **schema** to the LLM and running the query it writes
- See why this kills a whole class of bugs the hand-coded approach kept hitting
- Meet the two things that make or break text-to-SQL: **safety** and **semantic grounding**

## Concept

Yesterday the LLM returned a typed object. Today it returns something with more leverage: **the query itself.**

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

1. **Safety — an LLM writing SQL is an injection surface.** If the model can emit `DROP TABLE`, someday it will. The defense is layered: a validator that accepts **only a single read-only `SELECT`** (no `INSERT`/`UPDATE`/`DELETE`/DDL/`;`), *and* — in production — a database role that is physically read-only, so a bad query can't write even if the validator is fooled. Belt and suspenders.
2. **Semantic grounding — the schema says a column exists, not what's *in* it.** The model sees a `conditions.display` column; it does not know the value is literally `"Smokes tobacco daily"`. Ask for "smokers" and it writes `ILIKE '%smoker%'` → **zero rows**, a confident wrong "none." You fix this by **grounding** the prompt with real distinct values from the data.

## Implementation

### 1. Read `lib/text-to-sql.ts` top to bottom

It's four moves: a **schema prompt** (the tables, columns, and rules the model writes against), a **grounding** step (`getVocab` pulls real `DISTINCT display` values so the model uses clinical wording), the **safety validator** (`assertReadOnly`), and the call itself — `responses.parse` with `zodTextFormat({ sql, explanation })`, then run the SQL with `prisma.$queryRawUnsafe`. Notice the shape is identical to yesterday's extractor; only the target changed.

### 2. Interrogate it

```typescript
import 'dotenv/config';
import { textToSqlQuery } from './lib/text-to-sql';

const queries = [
  'who is the youngest patient with hypertension?',
  'which patients have both diabetes and depression?',
  "what's the average age of patients with COPD?",
  'any smokers under 50?',
];

async function main() {
  for (const q of queries) {
    const r = await textToSqlQuery(q);
    console.log(`\n${q}\n  SQL: ${r.sql}\n  rows: ${r.rows.length}`);
  }
}
main();
```

The first three answer cleanly — a superlative, a two-condition `EXISTS`, an aggregate — none of which a hand-coded builder gave you for free. Watch the SQL it wrote; that's the agent thinking on paper.

### 3. One honest gap, named now

Run *"any patients who had a heart attack?"*. The model writes `ILIKE '%heart attack%'` and returns **0 rows** — but the records *do* have heart attacks; the condition is stored as **`"Myocardial Infarction"`**. Same trap:

- "heart attack" → the column says `Myocardial Infarction`
- "high blood pressure" → the column says `Hypertension`
- "smoker" → the condition is `Smokes tobacco daily`

This is **semantic grounding**, and it's the real work text-to-SQL leaves you. The `getVocab` grounding is a first pass (it dumps distinct values), but it's long and unranked, so the model can still miss. The `TODO` at the top of `lib/text-to-sql.ts` is exactly this: map the user's lay terms to the values that actually live in the columns.

### Common mistakes

- **Trusting a clean-looking query.** A syntactically perfect `SELECT` over the wrong vocabulary returns a confident, wrong "none." Correct SQL over the wrong *terms* is still a wrong answer.
- **Relying on the validator alone for safety.** The regex check is necessary, not sufficient — in production the read-only DB role is what actually saves you. Two layers.
- **No `LIMIT`.** A question that matches every row shouldn't stream the whole table into the model's context. The agent enforces a ceiling; keep it.
- **Skipping `temperature: 0`.** A query writer that writes different SQL for the same question on Tuesday isn't a component, it's a coin.

## Your turn

Spend **no more than 60 minutes** here.

1. Run the interrogation battery. For each, predict the SQL *before* you read it, then check.
2. **Break the grounding.** Find three lay terms whose stored value differs (start with the heart-attack / hypertension / smoker set), and confirm each returns 0 rows. Then improve the grounding — a synonym note in the schema prompt, or a small alias map — until "heart attack" finds the myocardial-infarction patients.
3. **Try to break the safety guard.** Craft a question that tries to get the model to write something other than a `SELECT` (it will usually refuse, but try). Confirm `assertReadOnly` rejects anything that slips through.

## Check yourself

- Why keep a read-only database role *and* a `SELECT`-only validator — isn't one enough?
- The schema is in the prompt, yet "smoker" returns nothing. What's missing, and where do you add it?

<details>
<summary>Solution / discussion</summary>

**Two layers of safety:** the validator is a fast, in-process check that catches the obvious (`DROP`, stacked statements) before a query ever runs — but it's a regex, and regexes are foolable. The read-only role is enforced by Postgres itself: even a query that beats the validator physically cannot write, because the connecting role has no write grant. Defense in depth — the validator makes the common case cheap; the role makes the worst case impossible.

**"Smoker" returns nothing** because the schema tells the model a `display` column *exists*, not that its value is `"Smokes tobacco daily"`. The fix is **semantic grounding**: give the model the real vocabulary. Two places — (1) the grounding step (`getVocab`), which should surface the actual distinct values, ideally mapped from lay terms; and (2) the schema prompt, where an explicit synonym line ("'smoker' → the condition is 'Smokes tobacco daily'") costs nothing. The schema is *structure*; grounding is *meaning*, and text-to-SQL needs both.

</details>

## Further reading (optional)

- [OpenAI: structured outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs) — the `{ sql, explanation }` payload is the same mechanism as yesterday
- The `TODO` block in `lib/text-to-sql.ts` — the semantic-grounding problem, written down where it lives
