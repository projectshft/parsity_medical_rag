# Day 5 — The SQL Half of Hybrid RAG

**Needs: Postgres loaded from Day 4**

## Today you will

- Read the pre-built query functions that turn questions into SQL
- Run them against your own data and see exact, structured answers
- Understand condition/lab *mapping* — why "diabetes" has to become five search terms

## Concept

Yesterday you loaded rows. Today you read them back the way the system will: through a small set of typed query functions in `lib/sql-queries.ts`. These are **pre-built** — you're not implementing them today, you're understanding them, because they're the template for the kind of retrieval the LLM will trigger later.

Here's what's in the file:

| Function | Answers |
|---|---|
| `findPatientByName(name)` | "show me Jane Doe" |
| `getPatientSummary(patientId)` | "everything about this patient" |
| `findPatientsByConditions([...])` | "patients with diabetes" |
| `findPatientsByLabValues(lab, op, value)` | "patients with A1c over 9" |
| `countPatientsByCondition(condition)` | "how many patients have hypertension" |
| `getPatientIdsByConditions([...])` | (used later to narrow meaning-based search) |

Notice these are exactly the **structured** questions from Day 1 — counts, filters, lookups. None of them need anything but SQL.

### The mapping problem

Naively, "find patients with diabetes" becomes:

```sql
WHERE display = 'diabetes'
```

That returns **nothing**. The data says "Type 2 Diabetes Mellitus," "Prediabetes," "Diabetic." Real medical vocabulary is messy — the same concept wears many labels. So the query functions keep a small dictionary:

```typescript
const CONDITION_MAPPINGS: Record<string, string[]> = {
  diabetes: ['diabetes', 'diabetic', 'diabetes mellitus', 'type 2 diabetes', 'prediabetes'],
  hypertension: ['hypertension', 'high blood pressure', 'hypertensive'],
  // ...
};
```

One user word → many database phrasings, matched with a case-insensitive `contains`. This is a *keyword* expansion — it's blunt, and it only works because someone wrote the synonyms down by hand.

> **Why not just use meaning-based search for everything, since it handles synonyms automatically?** Because "how many patients have hypertension" needs an exact integer, and "A1c over 9" needs a real numeric comparison. A meaning-based search returns a ranked list of *similar* things — useless for counting and thresholds. The mapping dictionary is the honest, debuggable way to do structured filtering. You'll see its limits when you build the meaning-based layer, and that contrast is the whole point of *hybrid* retrieval: each half covers the other's blind spot.

## Implementation

You'll run the query functions directly. Create a scratch script (don't commit it) — call it `scratch.ts` at the repo root:

```typescript
import { findPatientsByConditions, countPatientsByCondition, findPatientsByLabValues } from './lib/sql-queries';

async function main() {
  const count = await countPatientsByCondition('diabetes');
  console.log('diabetic patients:', count);

  const patients = await findPatientsByConditions(['hypertension']);
  console.log('first hypertensive patient:', patients[0]?.firstName, patients[0]?.lastName);

  const highA1c = await findPatientsByLabValues('a1c', 'gt', 9);
  console.log('patients with A1c > 9:', highA1c.length);
}

main();
```

Run it:

```bash
npx tsx scratch.ts
```

(If `tsx` isn't available, use `npx ts-node --compiler-options '{"module":"CommonJS"}' scratch.ts`.)

You should get real counts from *your* data. Change the conditions, change the threshold, re-run.

### Common mistakes

- **Searching for an exact `display` value.** `display = 'diabetes'` finds nothing. The data uses clinical phrasings; that's what the mapping dictionary is for. Always `contains`, never `=`, on free-text condition names.
- **Forgetting a condition isn't in the dictionary.** If you search `findPatientsByConditions(['gout'])` and gout isn't mapped, it falls back to a literal `contains 'gout'` — which may still work, or may miss variants. Mapping is a maintained list, not magic.
- **Expecting lab names to be uniform.** "A1c" appears as "Hemoglobin A1c", "HbA1c", etc. The lab mapping handles the common ones; obscure labs need adding.

## Your turn

Spend **no more than 30 minutes** here.

1. Using your scratch script, find the three most common conditions in your dataset (try several condition keywords and compare counts).
2. Pick a lab (`a1c`, `glucose`, `cholesterol`) and a threshold. Count patients above it, then below it. Do the numbers sum to roughly the patients who *have* that lab?
3. In your notes: name one query a *doctor* would ask that **none** of these six functions can answer. (Keep it — some of these gaps are what the meaning-based layer fills later.)

## Check yourself

- Why does `findPatientsByConditions(['diabetes'])` return more patients than a search for the literal string "diabetes"?
- Which of the six functions could you *not* rebuild with meaning-based search alone, and why?

<details>
<summary>Solution / discussion</summary>

**More patients** because the function expands "diabetes" into `['diabetes', 'diabetic', 'diabetes mellitus', 'type 2 diabetes', 'prediabetes']` and matches any of them with `contains`. A literal string search for "diabetes" would miss a row whose `display` is "Prediabetes" if it didn't contain the substring — and would definitely miss differently-worded conditions a human considers diabetic.

**Can't rebuild with meaning-based search:** `countPatientsByCondition` (needs an exact count, not a ranked list) and `findPatientsByLabValues` (needs a true numeric `>` comparison). Meaning-based search returns "things similar to your query," which is the wrong shape for both counting and thresholds. This is precisely why the system keeps Postgres — and why the next phase is a *second* engine, not a replacement.

**A query none of these answer:** e.g. "which patients' notes describe them as non-compliant with medication?" — that's semantic, living in free-text notes, not structured rows. Hold onto it.

</details>

## Further reading (optional)

- [Prisma Client: filtering and `contains`](https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting) — the query API behind these functions
