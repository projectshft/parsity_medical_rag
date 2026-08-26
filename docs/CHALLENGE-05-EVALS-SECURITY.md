# Week 5 — Evals you'd trust, and a security pass

Two things this week. The big one is evals: a suite you'd actually gate a deploy
on. The small one is security: one afternoon that shows you why a retrieved
document is untrusted input.

## Part 1 — Evals (the bulk of the work)

### 1. Grow the golden set to 30+

Add ten cases, and make them the ones that have bitten you. Every routing
mistake, every hallucination, every "close but the number is wrong" from the
last three weeks becomes a case.

That's the discipline: **a bug you fixed without adding a case is a bug you'll
ship again.**

### 2. Three kinds of eval, used for the right things

**Assertion evals.** Exact, cheap, deterministic. "How many patients have
hypertension?" → `63`. No judge, no fuzziness. These catch the failures that
matter most and cost nothing to run, so run them on every change.

**Retrieval evals.** recall@k and MRR over your semantic cases — you built these
in week 2. They tell you whether the right notes were *found*, independent of
what the model said about them. When an answer is wrong, this is what tells you
whether retrieval or generation is to blame.

**Judge evals.** For the answers where "correct" is a paragraph, not a value.
Implement the three evaluators in `lib/evals/llm-judge.ts`:

- `evaluateRetrievalRelevance(query, docs)` — were these the right documents?
- `evaluateAnswerFaithfulness(context, answer)` — is every claim in the answer
  supported by the context? This is your hallucination detector.
- `evaluateAnswerCompleteness(query, answer)` — did it answer the whole question?

Use the Responses API pattern from `CLAUDE.md` (`responses.parse` +
`zodTextFormat`), temperature 0.

### 3. Calibrate the judge

This is the step everyone skips and it's the one that makes the rest mean
anything.

Hand-grade 10 answers yourself: pass or fail, before you run the judge. Then run
the judge on the same 10 and compare. If it disagrees with you more than twice,
your rubric is broken — fix the rubric, not the answers.

**An uncalibrated judge is a random number generator with good manners.** Write
down your agreement rate; it's the confidence interval on every judge score you
report afterwards.

### 4. Make it a gate

- `npm run test:run` — assertion + retrieval evals. Fast, free, no network.
  These run on every commit.
- `npm run test:evals` — the judge evals. Real API calls, real money. Run before
  you'd deploy.
- Wire the fast suite into CI so a red suite blocks a merge.

### 5. Break something on purpose

Change a prompt, drop the reranker, swap the model down a tier. Watch the suite
go red. Note *which* cases caught it.

If you can make a real quality regression and the suite stays green, your suite
has a hole. Fill it. That's the exercise.

### 6. Watch cost and latency

Pull mean tokens and p95 latency per query out of LangSmith. Cost is a quality
metric: an answer that's 3% better for 4× the tokens is usually a bad trade, and
you can't have that conversation without the number.

---

## Part 2 — Security (one focused pass)

### Prompt injection through retrieval

RAG has a vulnerability structurally: retrieved documents get concatenated into
the prompt, and the model can't tell your instructions from a note's contents.
If an attacker can get text into your corpus, they can write your prompt.

```bash
npm run security:poisoned
```

Three attacks live in `data/security/poisoned/` — an "ignore previous
instructions" jailbreak, a fake-tool-call injection, and a data-exfiltration
attempt.

**Do this in order:**

1. Run the demo. Watch an attack land.
2. **Put a poisoned note in your own index**, on a real patient, then ask a
   normal question and watch your own system get hijacked. This is the moment.
3. Defend it, and check each defence with a query:
   - **Delimit and label** the retrieved context so the model knows where data
     ends and instructions begin. Cheap, helps, is not sufficient.
   - **Validate on the way in** — extend `lib/security/content-validator.ts`.
     Add one novel pattern of your own (zero-width characters, homoglyphs, or a
     base64 payload).
   - **Validate on the way out** — a leaked system prompt, a URL nobody asked
     for, or an SSN in the response are all signals the model was steered.
4. Then write the honest paragraph: what your defences *don't* catch. Design a
   new attack that gets past them. Pattern matching loses this arms race; the
   real answer is that retrieved text is untrusted and the blast radius must be
   small. That's why every write in week 4 needed a human.

### PII

Implement `lib/pii.ts` (31 tests, currently red — `npm run test:run` shows you
exactly which):

- `obscureName` — stable hash pseudonyms, `Patient-A7B3`
- `obscureDate` — keep the year, hide month and day
- `obscureContent` — SSNs, phones, emails, names with titles
- `obscurePatient` — the field-by-field helper

Then set `OBSCURE_PII=true` and route the whole rendered output through
`obscureContent` for the front-office channel. Note what it misses — a name
inside a sentence, an unusual date format. **It is imperfect by design.** Regex
de-identification is a mitigation, not a guarantee; the real controls are
zero-data-retention agreements and not sending the data at all.

## What "done" looks like

- [ ] 30+ golden cases spanning all four kinds
- [ ] Three judge evaluators implemented
- [ ] Judge calibrated against 10 hand-graded answers, agreement rate recorded
- [ ] The fast suite green and running in CI
- [ ] A deliberate regression that the suite caught — say which case caught it
- [ ] `lib/pii.ts` implemented, all 31 tests green
- [ ] One novel injection pattern added to the validator
- [ ] A paragraph on what your defences don't catch

## The video 🎥 (3–4 min)

Demo your suite catching a regression you introduced on purpose. Show the red,
show the fix, show the green. Then thirty seconds on your poisoned-document
demo.

## Further reading

- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [Simon Willison — Prompt injection](https://simonwillison.net/series/prompt-injection/)
- [HHS — HIPAA de-identification](https://www.hhs.gov/hipaa/for-professionals/privacy/special-topics/de-identification/index.html)
