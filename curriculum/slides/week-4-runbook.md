# Week 4 — Agents, evals &amp; observability · Facilitator Runbook

**Block:** Agents, evals &amp; observability · **Days drawn from:** the agent-behavior + evals + observability days (`day-24`, `day-28`, `day-35`; retrieval-eval machinery from `day-18`) · **Session length:** ~110 min · **Deck:** `week-4.html`

**Goal of this session:** the room leaves able to do the two things a non-deterministic system demands — **see** why it answered (open a real trace and read the rendered context) and **prove** whether it's good (run an eval and report the number *compared to what*). They'll have counted the LLM calls in one chat turn, read a LangSmith trace top-down, run `npm run test:evals`, and watched a silent reranker fallback quietly move a number that nothing else in the system reveals.

> This runbook is backstage. Say anything here — the planted silent-fallback, the exact cost math, the "grade an LLM with an LLM" defense. The slides are what students see, so slide text stays in the student register (household-name meds — aspirin, insulin, diabetes; no metformin/lisinopril). You do **not** need to have built the system to run this — Pre-flight and Code-together assume you're coming in cold.

---

## Pre-flight (before the room arrives)

- [ ] Repo cloned on the **`instructor`** branch (you want the solved `lib/langsmith.ts`, `lib/evals/`, `lib/reranker.ts`, `lib/query-analyzer.ts`, `lib/agent.ts` to demo against), `npm install` done. Students follow on `student`.
- [ ] `.env` filled with the full stack this week touches: `OPENAI_API_KEY` (analyzer, answerer, **and the judge**), `DATABASE_URL` (Neon), `PINECONE_API_KEY`, `COHERE_API_KEY` (reranker — free trial tier is enough), plus `LANGSMITH_API_KEY` + `LANGSMITH_PROJECT` for the tracing segment. Missing the Cohere key is the headline break-it — have it set, but know exactly what its absence looks like (below).
- [ ] Both engines actually populated: Postgres has patients (`npm run db:studio` shows rows) and the vector index has clinical notes. If you're on a fresh machine, a prior block's ingest must have run — **don't reset/re-ingest here**, use whatever's already loaded.
- [ ] **A LangSmith project with at least one real trace already in it.** Run 3–4 chat queries against the app before class (at least one *hybrid* query, so the trace tree has an analysis → retrieval → answer shape worth reading). Do **not** generate the first trace live and hope it lands.
- [ ] **Know your eval baseline before class.** Run `npm run test:evals` once yourself and write down the numbers — these evals are **paid** (they call `gpt-4o-mini` as analyzer, answerer, and judge) and **variable** run-to-run, so you want to have seen a representative run, not discover a flaky dip in front of the room.
- [ ] `lib/langsmith.ts`, `lib/reranker.ts`, `lib/evals/llm-judge.ts`, `lib/evals/retrieval.test.ts`, `lib/query-analyzer.ts`, and `lib/agent.ts` open in the editor — you'll point at all six.
- [ ] Terminals open: one in the repo root for `npm run test:evals`, a second tab for `npm run dev` (the chat UI, to generate a fresh trace live if you want).
- [ ] `week-4.html` open full-screen in a browser. Arrow keys / click to navigate. `N` toggles presenter notes.

**Known runnable-state note — so you're not surprised live:** the LLM evals live behind `npm run test:evals` (which sets `RUN_EVALS=1 vitest run lib/evals`), **not** the default `npm run test:run` — that's deliberate. Deterministic tests gate commits; paid, noisy LLM evals are *run on demand and read as trends*. If you accidentally run `npm test` you'll pull in the whole suite; use `test:evals` for this session. Also: `lib/evals/retrieval.test.ts` ships with two working judge cases plus TODO stubs for faithfulness/completeness — the stubs are intentional (they're student work), don't treat the TODOs as broken.

If a laptop can't reach OpenAI/Cohere/LangSmith, pair up — the trace read-through and the eval run both survive one working setup between two people.

---

## Timed flow (~110 min)

| Time | Arc segment | Slides | What to do |
|---|---|---|---|
| 0:00 | **Problem statement** | 1–3 | Cold open: "Your system answers. Now — *why* did it answer that, and *is it any good*? You can't `console.log` an LLM, and 'feels right' isn't a number." Sit in both gaps before naming a fix. |
| 0:10 | **How it's solved** | 4 | Two instruments, one line each: a **trace** replays the past (debug); an **eval** scores the present (decide). You need both. |
| 0:16 | **Concept: count the calls** | 5 | Walk one chat turn: analyzer + answerer = **~2 LLM calls**, plus an embedding. Most guess one. That gap is why you must see inside. |
| 0:24 | **Concept: observability** | 6 | `traced()` = a debugger for the past. Draw the trace tree (analysis → retrieval → answer) with per-step timing. |
| 0:30 | **Code together (part 1)** | 7–8 | The two rules of `traced()` (re-throw wrapped / never throw its own), then open a **real** LangSmith trace and read the rendered context aloud. Commands below. |
| 0:48 | **Discussion / breakout** | 9 | "The answer was wrong — where do you look first?" Walk the trace top-down. Breakout if >8 people. Debrief with the key below. |
| 1:00 | **Concept: evals, the spine** | 10 | "No metric, no decision." An eval is fixed inputs + known answers + a score. Its value is the *next* change. |
| 1:07 | **Concept: two kinds of eval** | 11–12 | Exact-match (grade the analyzer classifier with `===`) vs LLM-as-judge (a second model grades grounding/relevance). Land why one gates and one trends. |
| 1:18 | **Code together (part 2)** | 13 | Run `npm run test:evals`; read the retrieval hit@5 and judge scores. Score twice → "is 73% good?" → *compared to what?* Commands below. |
| 1:30 | **Concept: cost is a metric** | 14 | Price the 2 calls + embedding per turn. A reranker that adds accuracy AND triples cost is a decision made with *both* numbers. |
| 1:38 | **Break it / extend** | 15 | Run the silent-Cohere-fallback live (the headline), then turn them loose on the bank. Protect this time — it's where the lesson gets proven. |
| 1:50 | **Research + recap + send-off** | 16 | Two research questions (label legitimacy; why paid evals don't gate). Recap the two instruments; frame the deliverable; point at the final block (production gates + capstone). |

Runs long? Compressible: the cost concept (1:30 — the math is a two-line demo) and the discussion (0:48 — can shrink to a fast whole-room walk of the trace). **Never** compress the trace read-through (0:30) or the eval run (1:18) — those are the hands-on proof points of the whole week.

---

## Breakout prompt + answer key

### Breakout (slide 9) — "The answer was wrong. Where do you look?"

**Prompt:** "A user asked about **one** patient's diabetes and got a confident answer about *someone else's* records. You have the trace open. Using only the trace — analysis, retrieval, rendered context, answer — decide which step is at fault and how you'd confirm it. Don't guess from the outside; point at a field."

**What to listen for / answer key:**
- **Analysis wrong** — the intent or the extracted patient entity is off (e.g., no patient name pulled, or the wrong one). Fault is *upstream*, in the analyzer prompt. Confirm: read the `intent` + `entities` in the first box.
- **Analysis right, retrieval wrong** — correct patient in the analysis, but the **rendered context** contains a different patient's notes. Fault is retrieval/filtering (the empty-filter privacy bug from the search block is exactly this shape). Confirm: read the rendered-context field — whose notes are actually in there?
- **Context right, answer wrong** — the right notes are in context but the model answered about someone else / from general knowledge. Fault is the grounding prompt. Confirm: the context has patient A, the answer names patient B.
- The instinct to correct: *"it hallucinated"* is not a diagnosis — it's the symptom. Without the trace, all three failures look identical from the outside. The trace tells you which door to open, and the **rendered-context field** resolves most of these in thirty seconds.

**Debrief:** the habit is *read the trace top-down, don't guess*. This is the same debugging loop from the agent block ("read the analysis object first"), now with a permanent tool instead of a scratch `console.log`. Bridge to evals: a trace explains *one* wrong answer; it can't tell you *how often* the system is wrong. That's the next instrument.

---

## Code-together

### Part 1 — read a trace (slides 7–8)

First, show the wrapper and its two rules in `lib/langsmith.ts` (don't run anything yet — just point):

```ts
// lib/langsmith.ts — traced()
if (!isLangSmithEnabled()) return fn();     // no key → run untraced, never break
try {
  await run.postRun();
  const result = await fn();
  await run.end({ outputs: { result } });
  return result;
} catch (error) {
  await run.end({ error: String(error) });
  throw error;                              // RULE 1: re-throw the wrapped error
}
```
- **Narrate the two rules.** (1) It **re-throws** the function's error — record the crime, then let it reach the caller; swallow it and you've hidden the bug you built this to see. (2) It **never throws its own** — the no-key early-return and the fact that a trace-post failure won't take the request down mean observability degrades to nothing rather than crashing the pipeline. One idea from both sides: *a trace is a witness, not a participant.*
- **Point at `lib/agent.ts`:** the one `traced("execute_query", …)` wrap is why a run shows up in LangSmith at all. (Extend later: wrap `analyzeQuery` and `searchClinicalNotes` too, and the tree grows boxes.)

Then open **one real trace** in LangSmith (seeded in Pre-flight) and walk it top to bottom:
- **Narrate in order:** the *analysis* box (intent + entities — the first stack frame), the *retrieval* box (patient/note counts), **the rendered context** (read it aloud — this is the field that pays for the whole setup), and which step *dominates the duration* (usually an LLM call, not the DB).
- **Count the LLM boxes:** it's **2** — analyzer + answerer. Ask the room to guess first; most say one.
- **Most likely live failure:** no traces appear → `LANGSMITH_API_KEY` / `LANGSMITH_PROJECT` unset, or the project name in `.env` doesn't match the project you're viewing in the UI. This is exactly why Pre-flight says seed a trace before class. Don't debug it live — switch to the trace you already seeded.

### Part 2 — run and read an eval (slide 13)

```bash
# paid + variable — runs the LLM evals under lib/evals only
npm run test:evals
```
- **Narrate the two kinds as they scroll by.** The **retrieval** eval is hit@5 over `(query, expected-note)` pairs read from your own corpus — pure `===`-style bookkeeping once you have the pairs. The **judge** cases (`lib/evals/retrieval.test.ts` → `evaluateRetrievalRelevance`) are a *second model* scoring relevance 0–10 with a 7+ threshold — noisier, and it costs a call.
- **Land "compared to what?"** Show hit@5 for **vector alone vs vector + reranker** side by side (illustrative: 73% → 89%). "Is 73% good?" has no answer alone — the eval hands you a *difference*, not a grade. Two configs, two numbers, and the reranker's value is now a fact.
- **Point at the honest gaps:** `retrieval.test.ts` has TODO stubs for faithfulness/completeness — name them as student work, not breakage. A system whose blind spots are *documented* beats one assumed complete.
- **Most likely live failure:** a judge case dips below threshold on this particular run and "fails." That's the *nature* of a paid, statistical metric — one case at n=15 is ~7 points of swing. Don't panic-debug it; that flakiness is precisely why these live behind `test:evals` and are read as trends, not commit gates. (If everything errors: `OPENAI_API_KEY` unset, or you ran `test:run` instead of `test:evals`.)

---

## Break it / extend bank

Run at least one live (the silent Cohere fallback is the headline), then turn the room loose.

**1. The silent reranker fallback (the headline one).**
- **Sabotage:** unset / comment out `COHERE_API_KEY`, then re-run the retrieval path (`searchChunks(query, 25)` → `rerankResults(query, candidates, 5)`) and the eval.
- **Expected failure:** the caller gets a list **identical to the plain vector order** — and *nothing the user or caller sees says so*. `rerankResults` in `lib/reranker.ts` catches the failed Cohere call, logs `console.error("Reranking failed, using original order", …)`, and returns `results.slice(0, topN)` — the original order. Degraded search beats no search, so it fails *soft*. The only signal is one red line in the server log (easy to miss) — and **your hit@5 quietly drops back to the vector-alone number.** The eval is the only thing in the whole system that catches this.
- **Fix:** restore the key. Reranked order differs from cosine order on at least some queries again, and hit@5 climbs back.
- **Extend:** this is the argument *for* evals in one experiment — a real regression that is invisible to a human clicking around, caught only because a number you were watching moved. Add "silent-degradation" to the list of things only an eval sees.

**2. Reranking with no over-fetch.**
- **Sabotage:** fetch 5 and rerank 5 (`searchChunks(query, 5)` → `rerankResults(query, candidates, 5)`).
- **Expected failure:** the list comes back **identical** — and Cohere is *never even called*. `rerankResults` early-returns unchanged when `results.length <= topN` (the `if (results.length <= topN) return results;` guard at the top of `lib/reranker.ts`). There's no depth to reorder: you handed it exactly the 5 you wanted back.
- **Fix:** over-fetch on purpose — fetch 25, keep 5. A relevant note buried at #19 by cosine is invisible unless the funnel mouth is wide enough to include it before the reranker gets a look.
- **Extend:** run the eval at over-fetch depths 10, 25, 50 and watch hit@5 vs latency/cost. Wider mouth = more candidates = more to promote *and* more to pay for. That's a cost/accuracy curve — a decision made with both numbers, exactly like slide 14.

**3. Blind the trace (failure isolation, the *good* kind).**
- **Sabotage:** unset or corrupt `LANGSMITH_API_KEY` (or point `traced()` at a dead endpoint).
- **Expected failure (the good one):** the app keeps working — answers still stream — but the trace project goes silent. You've gone **blind without going down**. That's `traced()`'s "never throw its own error" rule working as designed (`if (!isLangSmithEnabled()) return fn();`).
- **Fix:** restore the key; traces resume. Then deliberately make `traced()` *re-throw* on a trace-post failure and re-run — now observability takes the pipeline down with it. Compare the two. That contrast *is* the lesson: the witness must never become the crash.
- **Extend:** wrap one more step (`searchClinicalNotes` as `runType: 'retriever'`, `analyzeQuery` as `'llm'`) and watch the trace tree grow a box. Count the LLM calls from the finished tree and confirm it's 2 per turn.

**4. (If time) Grade the classifier, then move one thing.**
- **Sabotage:** run the analyzer exact-match eval, then change a *single* few-shot example in `lib/query-analyzer.ts` to fix one boundary case (e.g., a hybrid that misroutes to SQL-only).
- **Expected failure:** the boundary case flips right — *but* re-run and check `requiresSQL` / `requiresVector` didn't regress elsewhere. Tuning one number often dents another.
- **Fix / point:** the discipline is *change one variable, re-run, confirm the other numbers held*. If they can point at the boundary-that-improved **and** the booleans-that-held, they own measurement; if they only report the number that went up, that's theater.
- **Extend:** keep a handful of cases you never tune on. Grading against labels you memorized is the eval version of testing on your training set.

---

## Misconceptions to preempt

- **"One chat turn is one LLM call."** It's ~2 — an analyzer *and* an answerer — plus an embedding on the search path. Students consistently under-count, which means they under-count cost and under-instrument. The trace makes the real number undeniable.
- **"Tracing is just logging."** Logging is lines; a trace is a *tree* — each step's inputs, outputs, duration, error — and it stores the **exact context the model received**. That last field turns "the AI hallucinated" into "retrieval handed it the wrong context" in thirty seconds. Logging can't do that.
- **"The order changed, so the reranker helped."** "Changed" ≠ "got better." Better needs ground truth — hit@5 with and without. This is the spine rule; resisting the conclusion until the eval exists *is* the discipline.
- **"Using an LLM to grade an LLM is circular."** Grading is easier than generating, the judge is handed an explicit rubric it doesn't have to invent, and you spot-check it against your own eyes. It's a thermometer, not a supreme court — which is why judge scores are read as *trends*, not hard gates.
- **"Grading the analyzer against my own labels is cheating."** It isn't — as long as you **label first, by hand, then run**, and keep some pairs you never tune on. Saving the analyzer's own output as the "expected" answer *would* be cheating; hypothesis-before-experiment is not.
- **"'It works' is a complete answer."** Not without a cost number. A system with no cost metric is one that surprises you with an invoice. "No metric, no decision" applies to dollars too.

---

## Deliverable 🎥 (end of week)

A strong 2–3 min video (phone camera fine) does **one** of:

- **Defend with the number:** run one eval on the student's own system — retrieval hit@5 (vector alone vs vector+reranker) *or* the analyzer exact-match eval. Show the two numbers side by side, say what changed their mind (or didn't), and **state what one query costs** (calls counted from the trace × model price). The demo shows the trace open, not just the terminal.
- **Teach back:** open a real trace and explain to a non-engineer how you found *why* a wrong answer was wrong — which box, which field — and then how an eval tells you whether that wrongness is rare or routine.

**Grade against one question:** when asked *"is your number good?"*, do they answer **"compared to what?"** and point at a second configuration's number? If yes, they own the spine rule — evals create *differences*, not grades. If they recite a percentage as a grade, they don't yet. Second-order tell of mastery: they can state what one query *costs* — a price tag is part of a system's spec, same as its accuracy.

---

## Materials

- Student day files this anchors: the agent-behavior + evals + observability days — `day-24.md` (analyzer eval), `day-28.md` (observability / LangSmith), `day-35.md` (evals as the spine); retrieval-eval machinery seeded in `day-18.md`.
- Deck: `week-4.html`
- Repo files the session points at (on `instructor`): `lib/langsmith.ts` (`traced()`), `lib/reranker.ts` (`rerankResults` — silent Cohere fallback + no-over-fetch early return), `lib/evals/llm-judge.ts` (`evaluateRetrievalRelevance` / `evaluateAnswerFaithfulness` / `evaluateAnswerCompleteness`), `lib/evals/retrieval.test.ts` (working judge cases + TODO stubs), `lib/query-analyzer.ts` (the classifier under exact-match eval), `lib/agent.ts` (where `traced()` wraps the pipeline).
- Commands: `npm run test:evals` (paid LLM evals — `RUN_EVALS=1 vitest run lib/evals`); `npm run test:run` (the deterministic gate, for contrast); `npm run dev` (generate a fresh trace live).
- The repo's `CLAUDE.md` structured-output rules (`responses.parse` + `zodTextFormat` + `output_parsed`; `.parse()` not `safeParse`) — any code shown live must model these, since the room reads the repo over the training data.
- Further reading the keen students will have hit: [Hamel Husain — "Your AI product needs evals"](https://hamel.dev/blog/posts/evals/), [LangSmith observability docs](https://docs.langchain.com/langsmith/observability), Cohere rerank docs.
