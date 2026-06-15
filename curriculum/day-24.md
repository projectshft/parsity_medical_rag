# Day 24 — Build Day: Eval Your Analyzer

**Needs: the analyzer, the failure battery, and this block's prompt changelog**

## Today you will

- Build the second measuring instrument: an intent-classification eval for the query analyzer
- Tune the analyzer prompt against a number instead of a feeling
- Record this block's deliverable video

This is a **build day**. On the retrieval build day you measured *search*; today you measure *judgment* — the analyzer that routes every query. Together they bracket the pipeline: is the right strategy chosen, and does the chosen strategy find the right things?

## Concept

The analyzer is a classifier, and classifiers have the most satisfying evals in the business: **exact match against a labeled answer**. No similarity thresholds, no judgment calls at scoring time — the query's correct intent either came back or it didn't.

The instrument:

1. A labeled set: **(query → expected intent, expected booleans)** — 25+ cases
2. Run each through `analyzeQuery`
3. Score three things separately: intent accuracy, `requiresSQL` accuracy, `requiresVector` accuracy

Why score the booleans separately when intent usually implies them? Because they're what the router *actually branches on* — an analyzer that gets the intent right but a boolean wrong still routes wrong. Measure what the system uses, not what reads nicest.

Where do 25 labeled queries come from? You've been accumulating them since the first day of the course without knowing it:

- Day 1's five labeled queries (your original taxonomy)
- The interrogation battery from the analyzer day
- The boundary-hunting misclassifications you crafted
- The failure battery's *in-scope* cases (the ambiguous-referent and general-question baits have correct intents too — `general_question` is a classification, and refusing-to-route is a route)
- New ones, written today, deliberately covering all seven intents

The labels are yours to assign — you are the ground truth. Where you genuinely can't decide a label, that's not a labeling failure; it's the discovery that your intent definitions have a gap, and *that* finding goes straight back into the system prompt's intent guide.

## Implementation

### 1. The labeled set — `eval/analyzer-set.json`

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

Distribution guidance: every intent gets ≥2 cases; the confusable boundaries (hybrid vs note-search, lookup vs summary) get ≥4 each; include 3 `general_question` cases. Easy cases are allowed — they're your canaries against regressions — but the set's discriminating power lives at the boundaries, same as your few-shot examples did.

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
    if (iHit) intentOk++; if (sHit) sqlOk++; if (vHit) vectorOk++;
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

Run it. Three numbers. Date them in your notes — the analyzer now has a baseline, exactly like retrieval got on its build day.

### 3. One tuning cycle, measured

Pick the most common failure pattern in the misses (there will be a pattern — usually one boundary). Make **one** prompt change — typically a single added few-shot example aimed at that boundary. Re-run. Record before → after for all three numbers.

Then the part that separates measurement from theater: **check the other two numbers didn't drop.** A few-shot example that fixes the hybrid boundary can quietly break the analytics boundary. With the harness, that regression costs one re-run to catch. Without it, you'd have shipped the fix and the break together, feeling good about both.

Repeat the cycle if you have appetite — but every change gets its own before/after line in the changelog. One variable at a time; you know why.

### Common mistakes

- **Labels copied from the analyzer's own output.** Running queries through the analyzer and saving its answers as "expected" scores 100% forever and measures nothing. Label first, by hand, *then* run.
- **A set that's all boundaries.** Pure edge cases make every prompt change look catastrophic (everything's fragile at the boundary). The easy-case canaries are what tell you a change broke something *that used to be solid*.
- **Tuning to 100%.** A 25-case set hitting 100% likely means the set is too easy now — add harder cases rather than celebrating. (And recall the instrument-resolution lesson from the retrieval eval: at n=25, one case is 4 points. Read small movements with appropriate humility.)
- **Fixing misses by rewording the *query*.** If a case fails and your instinct is to rephrase the case until it passes — stop. Either the label is wrong (fix the label, note why) or the analyzer is wrong (fix the prompt). The case's awkward phrasing is the realism.

## Your turn

This *is* the your-turn: the labeled set, the harness, baseline numbers, and at least one fully-documented tuning cycle (change → three numbers before/after → verdict). Spend **no more than 30 minutes** labeling before you start running — perfect label coverage matters less than starting the loop.

## Check yourself

- Your intent accuracy is 84% but `requiresVector` accuracy is 96%. What does that combination tell you about where the analyzer's confusion lives?
- Why must the labels exist before the first eval run?

<details>
<summary>Solution / discussion</summary>

**84% intent / 96% booleans:** the analyzer is confusing intents *that share routing* — most likely `patient_lookup` vs `patient_summary` (both SQL-only) or `clinical_note_search` vs parts of `hybrid_query`. The router still routes mostly right, so users barely notice — but intent feeds logging and analytics downstream, and "the numbers disagree by category" is your map of exactly which definitions need sharpening in the prompt's intent guide. Disaggregated metrics aren't three numbers for the price of one; they're a *diagnosis*.

**Labels-first** is the eval version of hypothesis-before-experiment. Label after running and the system's behavior anchors your judgment — borderline cases inherit whatever the model said, and the eval converges on measuring agreement-with-itself. The discipline is identical to the retrieval eval's "don't tune on the test set," one layer earlier: don't *create* the test set from the thing under test.

**Where this instrument goes next:** you now have two evals (retrieval hit@5, analyzer accuracy) plus a failure battery. Notice they're all the same shape — cases as data, a harness, dated numbers, one-change-at-a-time. That shape is about to become the backbone of how the whole system is maintained; the remaining blocks add the tooling to run it continuously.

</details>

## Deliverable 🎥

Record **2–3 minutes**, phone camera is fine. Pick one:

- **Defend with the number:** Present one tuning cycle — the failing boundary, the one change you made, and all three before/after numbers including the ones that *didn't* move. Why was this change worth it?
- **Teach back:** Explain to a non-engineer how you can "grade" an AI component without an answer key existing anywhere in the world — where the labels came from, and why that's legitimate.

**Submit:** [Typeform — submission](https://form.typeform.com/to/PLACEHOLDER-DAY24) <!-- PLACEHOLDER: replace with real Typeform URL -->

## Rest day next

Step back and look: a user types a sentence; your system classifies it, extracts its parameters, routes it to the right engines, retrieves, renders, answers in grounded prose, refuses what it should — and **every link in that chain now has either a test, an eval, or a battery.** Tomorrow is a rest day. When you return: your system stops being an app and becomes infrastructure — a tool that *other* AI systems can call.

## Further reading (optional)

- [Hamel Husain: Your AI product needs evals](https://hamel.dev/blog/posts/evals/) — the practitioner essay on exactly the habit you just built; read it now that you've done it once
