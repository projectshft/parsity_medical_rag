/**
 * RAG quality evals — INSTRUCTOR ANSWER
 *
 * Completes the three TODOs left in `retrieval.test.ts`:
 *   1. answer faithfulness  (grounded → pass, hallucinated → fail)
 *   2. answer completeness  (full → pass, partial → fail)
 *   3. end-to-end pipeline   (retrieve → answer → judge all three → aggregate)
 *
 * This is the "evals as spine" payoff: reference-free LLM-as-judge scoring, so
 * you can measure answer quality without hand-labeling a gold answer for every
 * question.
 *
 * Run:  npm run test:evals                    # judge unit tests (needs the proxy/LLM only)
 *       EVAL_PIPELINE=1 npm run test:evals    # + the end-to-end block (needs live DB + Pinecone)
 *
 * The end-to-end block hits the real retrieval + agent, so it's behind its own
 * opt-in flag (EVAL_PIPELINE) — the standard judge tests stay dependency-light.
 */

import { describe, it, expect } from "vitest";
import {
  evaluateRetrievalRelevance,
  evaluateAnswerFaithfulness,
  evaluateAnswerCompleteness,
} from "./llm-judge";
import { searchClinicalNotes } from "../vector-search";
import { runAgentWithTools } from "../agent-tools";

const LIVE = !!process.env.EVAL_PIPELINE; // end-to-end needs live DB + Pinecone

// A tiny shared context used by the faithfulness/completeness unit tests.
const CONTEXT = [
  "Patient is prescribed Metformin 500mg twice daily for type 2 diabetes.",
  "Most recent Hemoglobin A1C measured 7.2%, indicating moderate glucose control.",
  "Blood pressure at last visit: 128/82 mmHg.",
].join("\n");

describe("answer faithfulness (grounding / hallucination)", () => {
  it(
    "passes an answer fully grounded in the context",
    async () => {
      const answer =
        "The patient takes Metformin 500mg twice daily for type 2 diabetes; their most recent A1C was 7.2%, showing moderate control.";
      const result = await evaluateAnswerFaithfulness(CONTEXT, answer);
      expect(result.score).toBeGreaterThanOrEqual(7);
      expect(result.pass).toBe(true);
    },
    { timeout: 30000 }
  );

  it(
    "fails an answer that hallucinates facts not in the context",
    async () => {
      // Nothing in CONTEXT mentions cancer or chemotherapy.
      const answer =
        "The patient takes Metformin for diabetes and is also undergoing chemotherapy for stage III lung cancer, with insulin added last week.";
      const result = await evaluateAnswerFaithfulness(CONTEXT, answer);
      expect(result.score).toBeLessThan(5);
      expect(result.pass).toBe(false);
    },
    { timeout: 30000 }
  );
});

describe("answer completeness", () => {
  const query = "What diabetes medication is the patient on, and what is the dose?";

  it(
    "passes an answer that addresses every part of the question",
    async () => {
      const answer = "The patient is on Metformin, dosed at 500mg twice daily.";
      const result = await evaluateAnswerCompleteness(query, answer);
      expect(result.score).toBeGreaterThanOrEqual(7);
      expect(result.pass).toBe(true);
    },
    { timeout: 30000 }
  );

  it(
    "fails an answer that only addresses part of the question",
    async () => {
      const answer = "The patient is on Metformin."; // names the drug, omits the dose
      const result = await evaluateAnswerCompleteness(query, answer);
      expect(result.score).toBeLessThan(7);
      expect(result.pass).toBe(false);
    },
    { timeout: 30000 }
  );
});

// End-to-end: run the real tool-calling agent over a golden set and score every
// dimension. Skipped unless RUN_EVALS is set (it hits DB + Pinecone + the LLM).
describe.skipIf(!LIVE)("end-to-end RAG quality (golden set)", () => {
  const GOLDEN = [
    "How many patients are in the records?",
    "Do any notes mention shortness of breath, and what do they describe?",
    "Which conditions are most common across patients?",
  ];

  it(
    "scores acceptably across retrieval, faithfulness, and completeness",
    async () => {
      const scorecard: Array<Record<string, number | boolean | string>> = [];

      for (const question of GOLDEN) {
        // 1. What the system retrieves (used as the grounding context).
        const notes = await searchClinicalNotes(question, { topK: 8 });
        const context = notes.map((n) => n.contentPreview);

        // 2. The system's actual answer (via the new tool-calling agent).
        const answer = await runAgentWithTools(question).text;

        // 3. Judge all three dimensions (reference-free).
        const [relevance, faithfulness, completeness] = await Promise.all([
          context.length
            ? evaluateRetrievalRelevance(question, context)
            : Promise.resolve({ score: 5, pass: true, reasoning: "no notes retrieved (SQL-only question)" }),
          context.length
            ? evaluateAnswerFaithfulness(context.join("\n\n"), answer)
            : Promise.resolve({ score: 8, pass: true, reasoning: "structured answer; not note-grounded" }),
          evaluateAnswerCompleteness(question, answer),
        ]);

        const avg = (relevance.score + faithfulness.score + completeness.score) / 3;
        scorecard.push({
          question,
          relevance: relevance.score,
          faithfulness: faithfulness.score,
          completeness: completeness.score,
          avg: Number(avg.toFixed(1)),
        });

        // Faithfulness is the load-bearing check: the answer must not invent
        // medical facts. Keep the aggregate bar lenient (judges are noisy).
        expect(faithfulness.pass).toBe(true);
        expect(avg).toBeGreaterThanOrEqual(5);
      }

      // eslint-disable-next-line no-console
      console.table(scorecard);
    },
    { timeout: 120000 }
  );
});
