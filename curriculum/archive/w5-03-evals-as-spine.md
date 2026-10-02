# Evals as the Spine: No Metric, No Decision

**Needs: the two evals from this block; `OPENAI_API_KEY` in `.env` (the judge calls the model too)**

## Today you will

- See the LLM-as-judge eval — how to grade an answer that has no string to compare against — and run it
- Add the gate you haven't built yet: **cost** as a metric
- Step back and name the principle that's been the spine of the whole course

## Concept

A confession the course has been building toward: "no metric, no decision" was never a slogan about evals. It was the operating system underneath everything. Look at what you actually did, again and again:

- Chunking: you didn't *argue* about chunk quality, you measured mid-word starts
- Retrieval: you didn't *feel* that reranking helped, you scored hit@5 with and without it
- The selector: you didn't *trust* the classifier, you graded its routing against labels
- The agent: you didn't *hope* it refused bad requests, you ran a failure battery

Every one of those is the same move: **turn a judgment into a measurement, then let the measurement decide.** That move, repeated, is what separates an engineer who built a system from someone who finished a tutorial. The tutorial-finisher can describe RAG. You can show the number that made you keep the reranker, the number that made you drop it, and the failing case that changed your prompt.

### The third eval: LLM-as-judge

Exact match (the selector eval) works when there's one right answer to compare against. But *"is this answer grounded in the notes?"* has no string to `===` against. So you ask a **second model** to grade the first, against an explicit rubric.

That machinery already exists in `lib/evals/llm-judge.ts`:

```typescript
evaluateRetrievalRelevance(query, retrievedNotes)
//  → { score: 3, pass: false, reasoning: "notes are about a different visit" }

evaluateAnswerFaithfulness(context, answer)
//  → { score: 9, pass: true, reasoning: "every claim traces to the notes" }
```

Each is a judge prompt with a 0–10 rubric, `temperature: 0`, and a threshold at 7. Two of them are exercised by `lib/evals/retrieval.test.ts`; `evaluateAnswerFaithfulness` and `evaluateAnswerCompleteness` have TODO stubs waiting for cases — that's your work, not breakage.

It's noisier than `===`, and it **costs a call**. So you read a judge score as a **trend over runs**, not a hard pass/fail gate.

> **"Using an LLM to grade an LLM — isn't that circular?"** No. Grading is easier than generating; the judge is handed an explicit rubric it doesn't have to invent; and you spot-check it against your own eyes. It's a thermometer, not a supreme court — which is exactly why judge scores are read as trends, not gates.

### Two lanes

Your checks now split cleanly into two lanes, and knowing which lane a check belongs in is itself the skill:

- **Deterministic tests** (extraction, the PII scrubber, the reranker's early-return logic) are cheap, fast, and repeatable — same input, same result. They gate every commit. That's `npm run test:run`, and it stays green.
- **LLM evals** (retrieval hit@5, the selector, the judge) cost money and vary run to run. They live behind `npm run test:evals` (which sets `RUN_EVALS=1`), run deliberately, and are read as *trends*.

```bash
npm run test:run    # deterministic — the commit gate, free and certain
npm run test:evals  # paid + variable — run on demand, read as trends
```

Gate on the cheap and certain; monitor the expensive and statistical. Gate a commit on a noisy paid metric and a flaky one-case dip blocks a good change — and burns money on every push.

## Implementation

### 1. Run the judge evals and read them as trends

```bash
npm run test:evals
```

Watch the two kinds scroll by. The retrieval hit@5 harness you built is pure `===`-style bookkeeping. The **judge** cases (`evaluateRetrievalRelevance` and friends) are a second model scoring 0–10 with a 7+ threshold — noisier, and each costs a call.

Expect a judge case to occasionally dip below threshold on a given run. That's not a bug to panic-debug — it's the *nature* of a paid, statistical metric. One case at small n is several points of swing. It's exactly why these live behind `test:evals` and are read as trends, not commit gates. (If *everything* errors: `OPENAI_API_KEY` unset, or you ran `test:run` instead of `test:evals`.)

### 2. The missing gate: cost

You instrumented latency with the trace. You never put a number on *cost* — and an LLM system without cost observability is one that surprises you with an invoice. You have everything you need already: the trace told you the calls per request.

- One hybrid chat turn = **~4 LLM calls** (scheduling-intent check, selector, SQL agent, aggregator) plus an embedding on the note-search path. (You counted this in the trace — now price it.)
- Estimate tokens in/out per call, multiply by the model's price, log a per-request cost.
- Then price the eval *suite itself*: running 25 selector cases and 15 retrieval cases plus a handful of judge calls is real money. "What does one full eval run cost?" is a number you should be able to say out loud.

Cost is a metric like any other, and "no metric, no decision" applies to it too. A reranker that adds 16 points of hit@5 **and triples the per-query cost** isn't a default you flip on — it's a trade you make with the accuracy gain and the price tag side by side.

### 3. The completeness pass

A final habit worth keeping: ask *"what is not measured?"* Walk the pipeline and find the stage with no instrument — maybe the context renderers (the SQL agent shows the aggregator at most 25 rows, the RAG block truncates each note to a 500-character preview — does truncation ever drop the answer?), maybe the scheduling extraction (does it grab the wrong patient from history?). You won't build every missing eval today. You'll *name the gaps* — because a system whose blind spots are documented is more trustworthy than one assumed complete. The gaps go in your capstone.

### Common mistakes

- **One green run and done.** An eval is a *habit*, not an event. Its value is the *next* time you change a prompt and a number you weren't watching moves. Actually re-run it.
- **Gating commits on LLM evals.** Variable, paid checks make terrible commit gates — a flaky one-case dip blocks a good change. Gate on deterministic tests; *track* LLM evals over time.
- **Optimizing one metric into the ground.** Push hit@5 to 100% and you've likely overfit the eval set or wrecked latency and cost. Metrics are a dashboard, not a single dial — read all the gauges.
- **Ignoring cost until the bill.** "It works" with no cost number is half an answer. The teams that get cost-surprised in production are the ones who never made it a metric.

## Your turn

Spend **no more than 60 minutes** here.

1. Get `npm run test:run` fully green and `npm run test:evals` running. Record the headline number from each.
2. Implement per-request cost logging. State, with a number, what one chat turn costs and what one full eval run costs.
3. The completeness pass: name two pipeline stages that currently have no eval, and for each, the one metric you'd build. (These become postmortem material.)

```quiz
[
  {
    "q": "Why do deterministic tests gate every commit while LLM evals live behind npm run test:evals?",
    "options": [
      "LLM evals are paid and statistical — a flaky one-case dip would block good changes and burn money on every push",
      "Deterministic tests cover more of the codebase, so they're the stronger gate",
      "LLM evals require production data that CI can't access"
    ],
    "answer": 0,
    "explain": "Gate on the cheap and certain; monitor the expensive and statistical. Same input, same result is exactly what a commit gate needs — LLM evals vary run to run, so they're read as trends over time, not pass/fail on one run."
  },
  {
    "q": "'Using an LLM to grade an LLM is circular.' What's the actual defense of the judge pattern?",
    "options": [
      "The judge uses a bigger model, so its opinion outranks the generator's",
      "Grading against an explicit rubric is easier than generating, and you spot-check the judge against your own eyes — a thermometer, not a supreme court",
      "The judge and generator never see each other's prompts, which breaks the circularity"
    ],
    "answer": 1,
    "explain": "The judge doesn't invent the standard — it applies a rubric you wrote, at temperature 0, on a task easier than generation. It's still noisy, which is exactly why judge scores are read as trends, never as hard commit gates."
  },
  {
    "q": "Your reranker adds 16 points of hit@5. Do you turn it on?",
    "options": [
      "Yes — a measured accuracy gain is exactly what 'no metric, no decision' asks for",
      "Not yet — cost is a metric too; the decision needs the accuracy gain and the per-query price side by side",
      "No — rerankers overfit small eval sets, so the gain is probably noise"
    ],
    "answer": 1,
    "explain": "A reranker that adds 16 points AND triples per-query cost isn't a default you flip on — it's a trade you make with both numbers on the table. 'No metric, no decision' applies to the invoice as much as to accuracy."
  }
]
```

## Check yourself

- Why do deterministic tests gate commits while LLM evals do not?
- "No metric, no decision" — restate it as a rule you'd give a new engineer on day one of a RAG project.

<details>
<summary>Solution / discussion</summary>

**The two lanes:** deterministic tests are cheap, fast, and repeatable — the same input gives the same result — which is exactly what a commit gate needs: a free, non-flaky yes/no. LLM evals are slow, paid, and statistical — the same input can score differently across runs, and one run has coarse resolution. Gating a commit on a noisy paid metric blocks good changes on random dips and burns money on every push. So you gate on the certain and *monitor* the statistical. The mistake is treating them the same — skipping the cheap gate, or blocking on the noisy one.

**The rule for a new engineer:** *Before you change the system to make it "better," define the number that says whether it got better — and after you change it, look at that number plus the ones you might have broken.* The corollary people skip: a change you can't measure is a change you can't defend, so either build the instrument or don't claim the improvement. That single discipline, applied relentlessly, is most of what this course was teaching under the cover of building a medical RAG system. The system was the vehicle; measuring it was the point.

</details>

## Deliverable 🎥

Record **2–3 minutes**, phone camera is fine. Do **one**:

- **Defend with the number:** run one eval on *your own* system — retrieval hit@5 (vector alone vs vector + reranker) or the selector exact-match eval. Show the two numbers side by side, say what changed your mind (or didn't), and **state what one query costs** (calls counted from the trace × model price). Show the trace open, not just the terminal.
- **Teach back:** open a real trace and explain to a non-engineer how you found *why* a wrong answer was wrong — which box, which field — and then how an eval tells you whether that wrongness is rare or routine.

The one question you're graded against: when someone asks *"is your number good?"*, do you answer **"compared to what?"** and point at a second configuration's number? If yes, you own the spine rule — evals create *differences*, not grades. Second-order tell: you can state what one query *costs*. A price tag is part of a system's spec, same as its accuracy.

**Submit:** [Typeform — submission](https://form.typeform.com/to/PLACEHOLDER-W5) <!-- PLACEHOLDER: replace with real Typeform URL -->

## Further reading (optional)

- [Hamel Husain: Your AI product needs evals](https://hamel.dev/blog/posts/evals/) — reread it; everything in it should now read as description, not advice
- [LangSmith docs: observability](https://docs.langchain.com/langsmith/observability) — the project views that turn one trace into a trend
