# Day 6 — Build Day: Your First End-to-End Feature

**Needs: Postgres loaded, `lib/sql-queries.ts` understood from Day 5**

## Today you will

- Extend the structured-query layer with something it can't do yet
- Make a real decision and justify it with the data, not a guess
- Record your first deliverable video

This is a **build day**: less reading, more doing. You've spent five days understanding the structured half of the system. Today you add to it.

## Concept

Every function in `lib/sql-queries.ts` answers a question the system couldn't answer before. Today you write one more. The point isn't the SQL — it's the *loop* you'll repeat all course: **find a gap → build the smallest thing that fills it → verify it against real data.**

You also meet the rule that governs the rest of the course: **no metric, no decision.** When you make a choice today (which conditions to map, what counts as "elderly"), you don't pick by vibe — you check the data and let the number decide.

## Implementation

Pick **one** of these to build. Each is small and self-contained.

### Option A — A new condition mapping

Day 5 showed that `CONDITION_MAPPINGS` is a hand-maintained dictionary. Pick a condition that *isn't* mapped (asthma, COPD, depression, anxiety…), figure out how this dataset actually phrases it, and add it.

1. Explore first — what does the data call it?
   ```typescript
   // in a scratch script
   const guesses = await findPatientsByConditions(['asthma']);
   console.log(guesses.map(p => p.conditions.map(c => c.display)));
   ```
2. Add the real phrasings to `CONDITION_MAPPINGS` in `lib/sql-queries.ts`.
3. Re-run. Did the match count change? **Record the before/after number** — that's your evidence the mapping helped.

### Option B — A new query function

Write `findDeceasedPatients()` or `findLivingPatientsOverAge(age: number)` using the `deathDate` column from Day 4.

```typescript
export async function findLivingPatientsOverAge(age: number) {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - age);
  return prisma.patient.findMany({
    where: {
      deathDate: null,            // alive
      birthDate: { lte: cutoff }, // born before the cutoff
    },
    take: 100,
  });
}
```

Then answer with data: how many living patients over 80 are in your set?

### Option C — A combined-filter function

Write a function that takes a condition *and* a lab threshold and returns patients matching both (e.g. diabetics with A1c over 9). Reuse `findPatientsByConditions` and `findPatientsByLabValues`, then intersect by patient id.

### Verify

Whatever you build, prove it works with a number from your own data. Add a line to your scratch script that prints the result, and screenshot or copy the output into your notes.

### Common mistakes

- **Building before exploring.** Don't guess how the data phrases "asthma" — query it and *look*. Half of every option above is reconnaissance.
- **No before/after number.** "It seems better" is not done. "Matched 0, now matches 14" is done.
- **Editing tests to pass.** If you touch a test file to make it green, you've measured nothing. Leave the specs alone; change the code.
- **Over-building.** One function, one gap. Resist adding five features — depth over breadth.

## Your turn

This *is* the your-turn. Build one option, verify with a number, keep the code. Spend **no more than 60 minutes** before opening the solution.

## Check yourself

- Can you state, in one sentence, the gap your feature fills and the measured result?
- Did you decide anything by vibe today? If so, go back and find the number.

<details>
<summary>Solution / discussion</summary>

**Option A — asthma mapping.** This dataset phrases it as variations on "Asthma" and "Childhood asthma." A reasonable addition:
```typescript
asthma: ['asthma', 'asthmatic', 'childhood asthma', 'reactive airway'],
```
Before: a literal search might catch only exact "Asthma" rows. After: the variants are included. The *evidence* is the count delta — if it didn't move, either the data only uses one phrasing (fine — you proved it) or your variants don't appear (also fine — you learned the vocabulary).

**Option B — living over 80.** The key is two conditions ANDed: `deathDate: null` (the nullable-means-alive design from Day 4) and `birthDate <= today minus 80 years`. Forgetting the `deathDate: null` clause silently includes dead patients who were *born* over 80 years ago — a classic correctness bug that looks fine until someone checks.

**Option C — combined filter.** Intersecting two result sets by patient id is the manual, in-code version of what a real hybrid query does. Notice how clunky it is — that clunkiness motivates the orchestration layer you'll build later, which routes these automatically.

The thread through all three: **you decided from a measurement.** That's the muscle this course trains.

</details>

## Deliverable 🎥

Record **2–3 minutes**, phone camera is fine. Pick one:

- **Teach back:** Explain to a non-engineer why this system needs *both* a regular database and a meaning-based search — use a real example query of each kind.
- **Defend a decision:** Walk through the feature you built today. What gap did it fill? What number proves it works? What did you decide *not* to build, and why?

**Submit:** [Typeform — submission](https://form.typeform.com/to/PLACEHOLDER-DAY06) <!-- PLACEHOLDER: replace with real Typeform URL -->

## Rest day next

You've earned it. You stood up half of a hybrid RAG system — the exact, structured half — and you extended it with a measured decision. **Tomorrow is a rest day.** Don't code. Let it settle; spaced repetition does its work in the gap. When you come back, you'll start preparing documents for the *other* half: the meaning-based search.

## Further reading (optional)

- [Anthropic: Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval) — a preview of where retrieval quality goes once both halves exist (skim; it'll make full sense after the next stretch)
