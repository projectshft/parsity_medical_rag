# Day 35 — Evals as the Spine: No Metric, No Decision

**Needs: every instrument you built across the course**

## Today you will

- Assemble the scattered instruments into one regression suite that runs on every change
- Add the gate you have not built yet: cost observability
- Step back and see the principle that has been the spine of the whole course

## Concept

A confession the course has been building toward: "no metric, no decision" was never a slogan about evals. It was the operating system. Look back at what you actually did, again and again:

- Chunking: you did not *argue* about chunk quality, you measured mid-word starts (88.6% vs 0%)
- Retrieval: you did not *feel* that reranking helped, you scored hit@5 with and without it
- The analyzer: you did not *trust* the classifier, you graded intent accuracy against labels
- The agent: you did not *hope* it refused bad requests, you ran a failure battery
- Auth: you did not *believe* the routes were protected, the test counter said `0 failed`
- The poisoned doc: you did not *assume* your defenses worked, you re-attacked and tabulated

Every one of those is the same move: **turn a judgment into a measurement, then let the measurement decide.** That move, repeated, is what separates an engineer who built a system from someone who finished a tutorial. The tutorial-finisher can describe RAG. You can show the number that made you keep the reranker, the number that made you drop it, and the failing case that changed your prompt.

Today you stop treating those instruments as one-offs and make them a **regression suite** — the thing that tells you, on every future change, whether you made the system better or just different.

## Implementation

### 1. Inventory and unify

You have, scattered across the course:

- `lib/fhir-extract.test.ts` — extraction correctness (23 tests)
- the RBAC + upload specs — now passing (`npm run test:run`)
- `eval/retrieval-set.json` + harness — hit@5
- `eval/analyzer-set.json` + harness — intent accuracy
- `eval/failure-battery.json` — adversarial behavior
- the poisoned-doc results — security regression

Two kinds live here, and they belong in two lanes. **Deterministic tests** (extraction, auth, upload) run free and fast on every commit — that is `npm run test:run`, and it should be green and stay green. **LLM evals** (retrieval, analyzer, failure battery) cost money and vary run to run — those go behind `npm run test:evals`, run deliberately, and are read as *trends*, not pass/fail gates. Knowing which lane a check belongs in is itself a skill: gate on the cheap and certain; monitor the expensive and statistical.

### 2. The missing gate: cost

You instrumented latency with tracing. You never put a number on *cost*, and an LLM system without cost observability is a system that surprises you with an invoice. Add it now, using the trace data you already collect:

- Count LLM calls per request (you found it is ~2 per chat turn — analyzer + answerer — plus embeddings on the retrieval path)
- Estimate tokens in/out per call, multiply by model price, log a per-request cost
- Compute the cost of your *eval suite itself* — running 25 analyzer cases and 15 retrieval cases is real money, and "what does one full eval run cost" is a number you should be able to state

The discipline: cost is a metric like any other, and "no metric, no decision" applies to it too. A reranker that adds 20 points of hit@5 and triples per-query cost is a *decision*, not a default — and now you can make it with both numbers in hand.

### 3. The completeness pass

A final-eval habit worth keeping: ask "what is *not* measured?" Walk the pipeline and find the stage with no instrument. Maybe it is `formatResultsForLLM` (does truncation drop the answer?), or the HITL extraction (does it grab the wrong patient from history?). You will not build every missing eval today — you will *name the gaps*, because a system whose blind spots are documented is more trustworthy than one assumed complete. The gaps go in your capstone.

### Common mistakes

- **One green run and done.** An eval is a *habit*, not an event. Its value is the *next* time you change a prompt and a number you were not watching moves. Wire it to run on demand and actually run it.
- **Gating commits on LLM evals.** Variable, paid checks make terrible commit gates — a flaky 1-case dip blocks a good change. Gate on deterministic tests; *track* LLM evals over time. Different jobs.
- **Optimizing one metric into the ground.** Push hit@5 to 100% and you have likely overfit the eval set or wrecked latency and cost. Metrics are a dashboard, not a single dial; the engineer reads all the gauges.
- **Ignoring cost until the bill.** "It works" with no cost number is half an answer. The teams that get cost-surprised in production are the ones who never made it a metric. You will not be one of them.

## Your turn

Spend no more than 60 minutes here.

1. Get `npm run test:run` fully green and `npm run test:evals` running; record the headline number from each eval.
2. Implement per-request cost logging; state, with a number, what one chat turn costs and what one full eval run costs.
3. The completeness pass: name two pipeline stages that currently have no eval, and for each, the one metric you would build. (These become postmortem material.)

## Check yourself

- Why do deterministic tests gate commits while LLM evals do not?
- "No metric, no decision" — restate it as a rule you would give a new engineer on day one of a RAG project.

<details>
<summary>Solution / discussion</summary>

**The two lanes:** deterministic tests are cheap, fast, and repeatable — the same input gives the same result every time — which is exactly what a commit gate needs: a clear, free, non-flaky yes/no. LLM evals are slow, paid, and *statistical* — the same input can score differently across runs, and one run of 15 cases has coarse resolution (recall: at n=15, one case is ~7 points). Gating a commit on a noisy paid metric blocks good changes on random dips and burns money on every push. So you gate on the certain (tests must stay green) and you *monitor* the statistical (eval trends, read over time, investigated when they move). The mistake is treating them the same — either by skipping the cheap gate or by blocking on the noisy one.

**The rule for a new engineer:** *Before you change the system to make it "better," define the number that says whether it got better — and after you change it, look at that number plus the ones you might have broken.* The corollary is the part people skip: a change you cannot measure is a change you cannot defend, so either build the instrument or do not claim the improvement. That single discipline, applied relentlessly, is most of what this course was teaching under the cover of building a medical RAG system. The system was the vehicle; measuring it was the point.

</details>

## Further reading (optional)

- [Hamel Husain: Your AI product needs evals](https://hamel.dev/blog/posts/evals/) — reread the one from the analyzer-eval day; everything in it should now read as description, not advice
