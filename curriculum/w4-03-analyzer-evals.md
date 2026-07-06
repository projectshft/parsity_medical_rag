# Analyzer Evals: Grading a Classifier with `===`

**Needs: the query analyzer working; `OPENAI_API_KEY` in `.env`**

## Today you will

- Build the second measuring instrument: an intent-classification eval for the query analyzer
- Grade it with the simplest scoring there is — exact match against labels you wrote by hand
- Tune the analyzer prompt against a number instead of a feeling, and confirm you didn't break something else

## Concept

The retrieval eval measured *search* — does the chosen strategy find the right things? Today's measures *judgment* — does the analyzer choose the right strategy in the first place? Together they bracket the pipeline.

The analyzer (`analyzeQuery` in `lib/query-analyzer.ts`) is a **classifier**. It reads a user's sentence and returns an `intent` plus two booleans, `requiresSQL` and `requiresVector`. Classifiers have the most satisfying evals in the business: **exact match against a labeled answer.** No similarity thresholds, no judgment call at scoring time — the correct intent either came back or it didn't. It's just `===`.

The instrument:

1. A labeled set: **(query → expected intent, expected booleans)** — 25+ cases
2. Run each through `analyzeQuery`
3. Score three things *separately*: intent accuracy, `requiresSQL` accuracy, `requiresVector` accuracy

Why score the booleans separately when the intent usually implies them? Because they're what the router **actually branches on**. An analyzer that gets the intent right but a boolean wrong still routes the query wrong. Measure what the system uses, not what reads nicest.

Where do 25 labeled queries come from? You've been accumulating them since the first day of the course:

- The five labeled queries you wrote on day one (your original taxonomy)
- The interrogation battery from the analyzer day
- The boundary cases you crafted to try to fool the router
- The in-scope cases from your failure battery (a `general_question` bait still has a correct label — refusing to route *is* a route)
- New ones, written today, deliberately covering all seven intents

The labels are yours to assign — **you are the ground truth.** Where you genuinely can't decide a label, that's not a labeling failure; it's the discovery that your intent definitions have a gap, and that finding goes straight back into the analyzer's system prompt.

## Implementation

### 1. The labeled set — `eval/analyzer-set.json`

The seven intents live in `lib/query-analyzer.ts`: `patient_lookup`, `patient_summary`, `structured_query`, `clinical_note_search`, `population_analytics`, `hybrid_query`, `general_question`.

```json
[
  {
    "query": "How many patients are on blood pressure medication?",
    "expectIntent": "population_analytics",
    "expectSQL": true,
    "expectVector": false
  },
  {
    "query": "Are any patients describing numbness in their feet?",
    "expectIntent": "clinical_note_search",
    "expectSQL": false,
    "expectVector": true
  }
]
```

Distribution: every intent gets ≥2 cases; the confusable boundaries (hybrid vs note-search, lookup vs summary) get ≥4 each; include 3 `general_question` cases. Easy cases are allowed — they're your canaries against regressions — but the set's discriminating power lives at the boundaries, same as the analyzer's own few-shot examples.

### 2. The harness — `eval/run-analyzer-eval.ts`

```typescript
import 'dotenv/config';
import * as fs from 'fs';
import { analyzeQuery } from '../lib/query-analyzer';

type Case = { query: string; expectIntent: string; expectSQL: boolean; expectVector: boolean };

async function main() {
  const cases: Case[] = JSON.parse(fs.readFileSync('eval/analyzer-set.json', 'utf-8'));
  let intentOk = 0, sqlOk = 0, vectorOk = 0;

  for (const c of cases) {
    const a = await analyzeQuery(c.query);
    const iHit = a.intent === c.expectIntent;
    const sHit = a.requiresSQL === c.expectSQL;
    const vHit = a.requiresVector === c.expectVector;
    if (iHit) intentOk++;
    if (sHit) sqlOk++;
    if (vHit) vectorOk++;
    if (!iHit || !sHit || !vHit) {
      console.log(`✗ ${c.query}`);
      console.log(`   expected ${c.expectIntent} SQL:${c.expectSQL} V:${c.expectVector}`);
      console.log(`   got      ${a.intent} SQL:${a.requiresSQL} V:${a.requiresVector}`);
    }
  }

  const pct = (n: number) => ((100 * n) / cases.length).toFixed(0) + '%';
  console.log(`\nintent: ${pct(intentOk)}  requiresSQL: ${pct(sqlOk)}  requiresVector: ${pct(vectorOk)}  (n=${cases.length})`);
}
main();
```

Run it. Three numbers. Date them in your notes — the analyzer now has a baseline, exactly like retrieval got one. (*Illustrative:* intent 84% / requiresSQL 96% / requiresVector 92% at n=25. Your cases, your numbers — the point is you *have* numbers.)

### 3. One tuning cycle, measured

Pick the most common failure pattern in the misses — there'll be one, usually a single boundary. Make **one** prompt change: typically a single added few-shot example in `FEW_SHOT_EXAMPLES` aimed at that boundary. Re-run. Record before → after for all three numbers.

Then the part that separates measurement from theater: **check the other two numbers didn't drop.** A few-shot example that fixes the hybrid boundary can quietly break the analytics boundary. With the harness, that regression costs one re-run to catch. Without it, you'd ship the fix and the break together, feeling good about both.

Repeat if you have appetite — but every change gets its own before/after line. One variable at a time; you always know why.

### Common mistakes

- **Labels copied from the analyzer's own output.** Running queries through the analyzer and saving its answers as "expected" scores 100% forever and measures nothing. Label first, by hand, *then* run.
- **A set that's all boundaries.** Pure edge cases make every prompt change look catastrophic — everything's fragile at the boundary. The easy-case canaries tell you when a change broke something that used to be solid.
- **Tuning to 100%.** A 25-case set hitting 100% likely means the set got too easy — add harder cases rather than celebrating. At n=25, one case is 4 points; read small movements with humility.
- **Fixing misses by rewording the *query*.** If a case fails and your instinct is to rephrase it until it passes — stop. Either the label is wrong (fix the label, note why) or the analyzer is wrong (fix the prompt). The case's awkward phrasing is the realism.

## Your turn

This *is* the your-turn: the labeled set, the harness, baseline numbers, and at least one fully-documented tuning cycle (change → three numbers before/after → verdict). Spend **no more than 30 minutes** labeling before you start running — perfect coverage matters less than starting the loop.

## Check yourself

- Your intent accuracy is 84% but `requiresVector` accuracy is 96%. What does that combination tell you about where the analyzer's confusion lives?
- Why must the labels exist *before* the first eval run?

<details>
<summary>Solution / discussion</summary>

**84% intent / 96% booleans:** the analyzer is confusing intents *that share routing* — most likely `patient_lookup` vs `patient_summary` (both SQL-only) or `clinical_note_search` vs parts of `hybrid_query`. The router still routes mostly right, so users barely notice — but intent feeds logging and analytics downstream, and "the numbers disagree by category" is your map of exactly which definitions need sharpening in the prompt's intent guide. Disaggregated metrics aren't three numbers for the price of one; they're a *diagnosis*.

**Labels-first** is hypothesis-before-experiment. Label after running and the system's behavior anchors your judgment — borderline cases inherit whatever the model said, and the eval quietly converges on measuring agreement-with-itself. Same discipline as "don't tune on the test set," one layer earlier: don't *create* the test set from the thing under test.

**Where this goes next:** you now have two evals — retrieval hit@5 and analyzer accuracy — plus a failure battery. They're all the same shape: cases as data, a harness, dated numbers, one change at a time. That shape is about to become the backbone of how the whole system is maintained.

</details>

## Further reading (optional)

- [Hamel Husain: Your AI product needs evals](https://hamel.dev/blog/posts/evals/) — the practitioner essay on exactly the habit you just built; read it now that you've done it once
