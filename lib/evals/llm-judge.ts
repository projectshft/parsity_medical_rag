/**
 * LLM-as-Judge Evaluator
 *
 * Uses an LLM to evaluate RAG system outputs against quality criteria.
 *
 * Week 6: Implement these evaluators to measure your RAG system quality
 */

import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { openai } from '../openai';

/**
 * Schema for evaluation results
 *
 * TODO: Understand this schema - it's the same for all evaluators
 */
const EvalResultSchema = z.object({
  score: z.number().min(0).max(10).describe('Score from 0-10'),
  reasoning: z.string().describe('Brief explanation for the score'),
  pass: z.boolean().describe('Whether this meets the quality threshold'),
});

export type EvalResult = z.infer<typeof EvalResultSchema>;

/**
 * Evaluate retrieval relevance
 *
 * TODO: Implement this evaluator
 * 1. Create a system prompt that explains the scoring criteria (0-10)
 * 2. Use openai.responses.parse() with zodTextFormat
 * 3. Pass the query and retrieved documents to evaluate
 * 4. Return the parsed EvalResult
 *
 * Scoring guide:
 * - 9-10: All documents highly relevant
 * - 7-8: Most documents relevant
 * - 5-6: Mixed relevance
 * - 3-4: Mostly irrelevant
 * - 0-2: Doesn't address the query
 */
export async function evaluateRetrievalRelevance(
  query: string,
  retrievedContent: string[]
): Promise<EvalResult> {
  // TODO: Implement with structured outputs
  return {
    score: 0,
    reasoning: 'Not implemented',
    pass: false,
  };
}

/**
 * Evaluate answer faithfulness (grounded in context)
 *
 * TODO: Implement this evaluator
 * Checks if the answer is grounded in the provided context (no hallucination)
 *
 * Scoring guide:
 * - 9-10: Fully grounded, no hallucination
 * - 7-8: Mostly grounded, minor extrapolations
 * - 5-6: Some unsupported claims
 * - 3-4: Significant hallucinations
 * - 0-2: Contradicts context or entirely hallucinated
 */
export async function evaluateAnswerFaithfulness(
  context: string,
  answer: string
): Promise<EvalResult> {
  // TODO: Implement with structured outputs
  return {
    score: 0,
    reasoning: 'Not implemented',
    pass: false,
  };
}

/**
 * Evaluate answer completeness
 *
 * TODO: Implement this evaluator
 * Checks if the answer fully addresses all aspects of the query
 *
 * Scoring guide:
 * - 9-10: Fully addresses all aspects
 * - 7-8: Addresses main points, minor gaps
 * - 5-6: Partially addresses query
 * - 3-4: Only addresses small part
 * - 0-2: Doesn't address query
 */
export async function evaluateAnswerCompleteness(
  query: string,
  answer: string
): Promise<EvalResult> {
  // TODO: Implement with structured outputs
  return {
    score: 0,
    reasoning: 'Not implemented',
    pass: false,
  };
}
