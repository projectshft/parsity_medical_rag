# Selector Evals: Grading a Classifier with `===`

**Needs: the selector working (`lib/agents/selector.ts`); `OPENAI_API_KEY` in `.env`**

## Today you will

- Build the second measuring instrument: a routing eval for the selector
- Grade it with the simplest scoring there is — exact match against labels you wrote by hand
- Tune the selector prompt against a number instead of a feeling, and confirm you didn't break something else

## Concept

The retrieval eval measured *search* — does the chosen strategy find the right things? Today's measures *judgment* — does the selector choose the right strategy in the first place? Together they bracket the pipeline.

The selector (`select` in `lib/agents/selector.ts`) is a **classifier**. It reads a user's sentence and returns two booleans — `requiresSQL` and `requiresVector`, surfaced as `useSql` / `useRag` on the returned `Plan`. Classifiers have the most satisfying evals in the business: **exact match against a labeled answer.** No similarity thresholds, no judgment call at scoring time — the correct route either came back or it didn't. It's just `===`.

The instrument:

1. A labeled set: **(query → expected `useSql`, expected `useRag`)** — 25+ cases
2. Run each through `select`
3. Score three things *separately*: `useSql` accuracy, `useRag` accuracy, and **full-plan accuracy** (both booleans right)

Why three numbers instead of one? The booleans are what the route **actually branches on** — a plan that's half-right still runs a retrieval the question didn't need, or skips one it did. Full-plan accuracy is what the user experiences; the per-boolean numbers tell you *which boundary* the confusion lives on. Measure what the system uses, not what reads nicest.

(The `Plan` has one more field — `semanticQuery`, the expanded phrasing for note search. There's no string to `===` against a rephrasing, so it isn't graded here; it gets judged downstream, by the retrieval eval — a bad expansion shows up as a lower hit@5.)

Where do 25 labeled queries come from? You've been accumulating them since the start:

- The routing battery from the selector day
- The boundary cases you crafted to try to fool the router
- The in-scope cases from your failure battery (a general-knowledge bait still has a correct label — both booleans `false`; refusing to route *is* a route)
- New ones, written today, deliberately covering all four routes: SQL-only, vector-only, both, neither

The labels are yours to assign — **you are the ground truth.** Where you genuinely can't decide a label, that's not a labeling failure; it's the discovery that your routing definitions have a gap, and that finding goes straight back into the selector's `SYSTEM_PROMPT`.

## Implementation

### 1. The labeled set — `eval/selector-set.json`

Four routes, drawn from the two booleans:

```json
[
  {
    "query": "How many patients are on blood pressure medication?",
    "expectSql": true,
    "expectRag": false
  },
  {
    "query": "Are any patients describing numbness in their feet?",
    "expectSql": false,
    "expectRag": true
  },
  {
    "query": "What do the notes say about sleep for patients with depression?",
    "expectSql": true,
    "expectRag": true
  },
  {
    "query": "What's a normal A1C range?",
    "expectSql": false,
    "expectRag": false
  }
]
```

Distribution: every route gets ≥3 cases; the confusable boundaries (hybrid vs notes-only, structured-fact vs what-the-notes-say) get ≥4 each; include 3 both-false general-knowledge cases. Easy cases are allowed — they're your canaries against regressions — but the set's discriminating power lives at the boundaries.

### 2. The harness — `eval/run-selector-eval.ts`

```typescript
import 'dotenv/config';
import * as fs from 'fs';
import { select } from '../lib/agents/selector';

type Case = { query: string; expectSql: boolean; expectRag: boolean };

async function main() {
  const cases: Case[] = JSON.parse(fs.readFileSync('eval/selector-set.json', 'utf-8'));
  let sqlOk = 0, ragOk = 0, planOk = 0;

  for (const c of cases) {
    const p = await select(c.query);
    const sHit = p.useSql === c.expectSql;
    const rHit = p.useRag === c.expectRag;
    if (sHit) sqlOk++;
    if (rHit) ragOk++;
    if (sHit && rHit) planOk++;
    if (!sHit || !rHit) {
      console.log(`✗ ${c.query}`);
      console.log(`   expected SQL:${c.expectSql} RAG:${c.expectRag}`);
      console.log(`   got      SQL:${p.useSql} RAG:${p.useRag}`);
    }
  }

  const pct = (n: number) => ((100 * n) / cases.length).toFixed(0) + '%';
  console.log(`\nplan: ${pct(planOk)}  useSql: ${pct(sqlOk)}  useRag: ${pct(ragOk)}  (n=${cases.length})`);
}
main();
```

Run it. Three numbers. Date them in your notes — the selector now has a baseline, exactly like retrieval got one. (*Illustrative:* plan 84% / useSql 96% / useRag 88% at n=25. Your cases, your numbers — the point is you *have* numbers.)

### 3. One tuning cycle, measured

Pick the most common failure pattern in the misses — there'll be one, usually a single boundary. Make **one** prompt change: typically a single added rule or example in the selector's `SYSTEM_PROMPT` aimed at that boundary (it already has one such nudge — "when unsure, prefer searching the notes"). Re-run. Record before → after for all three numbers.

Then the part that separates measurement from theater: **check the other two numbers didn't drop.** A rule that fixes the hybrid boundary can quietly break the general-question short-circuit. With the harness, that regression costs one re-run to catch. Without it, you'd ship the fix and the break together, feeling good about both.

Repeat if you have appetite — but every change gets its own before/after line. One variable at a time; you always know why.

### Common mistakes

- **Labels copied from the selector's own output.** Running queries through the selector and saving its answers as "expected" scores 100% forever and measures nothing. Label first, by hand, *then* run.
- **A set that's all boundaries.** Pure edge cases make every prompt change look catastrophic — everything's fragile at the boundary. The easy-case canaries tell you when a change broke something that used to be solid.
- **Tuning to 100%.** A 25-case set hitting 100% likely means the set got too easy — add harder cases rather than celebrating. At n=25, one case is 4 points; read small movements with humility.
- **Fixing misses by rewording the *query*.** If a case fails and your instinct is to rephrase it until it passes — stop. Either the label is wrong (fix the label, note why) or the selector is wrong (fix the prompt). The case's awkward phrasing is the realism.

## Your turn

This *is* the your-turn: the labeled set, the harness, baseline numbers, and at least one fully-documented tuning cycle (change → three numbers before/after → verdict). Spend **no more than 30 minutes** labeling before you start running — perfect coverage matters less than starting the loop.

## Check yourself

- Your `useSql` accuracy is 96% but `useRag` is 84%. What does that combination tell you about where the selector's confusion lives?
- Why must the labels exist *before* the first eval run?

<details>
<summary>Solution / discussion</summary>

**96% SQL / 84% RAG:** the selector reliably recognizes when structured facts are needed but wavers on whether the *notes* are — almost always at the "what do the notes SAY" boundary, where a question mentions a condition (SQL-shaped) but the answer lives in narrative text, or vice versa. That's a map, not just a grade: the fix is sharpening the vector-store description and its examples in the `SYSTEM_PROMPT`, not touching the SQL side at all. Disaggregated metrics aren't three numbers for the price of one; they're a *diagnosis*.

**Labels-first** is hypothesis-before-experiment. Label after running and the system's behavior anchors your judgment — borderline cases inherit whatever the model said, and the eval quietly converges on measuring agreement-with-itself. Same discipline as "don't tune on the test set," one layer earlier: don't *create* the test set from the thing under test.

**Where this goes next:** you now have two evals — retrieval hit@5 and selector accuracy — plus a failure battery. They're all the same shape: cases as data, a harness, dated numbers, one change at a time. That shape is about to become the backbone of how the whole system is maintained.

</details>

## Further reading (optional)

- [Hamel Husain: Your AI product needs evals](https://hamel.dev/blog/posts/evals/) — the practitioner essay on exactly the habit you just built; read it now that you've done it once
