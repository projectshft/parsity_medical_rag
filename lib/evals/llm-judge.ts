/**
 * LLM-as-Judge Evaluator
 *
 * Uses an LLM to evaluate RAG system outputs against quality criteria.
 */

import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { openai } from '../openai';

const EvalResultSchema = z.object({
  score: z.number().min(0).max(10).describe('Score from 0-10'),
  reasoning: z.string().describe('Brief explanation for the score'),
  pass: z.boolean().describe('Whether this meets the quality threshold'),
});

export type EvalResult = z.infer<typeof EvalResultSchema>;

/**
 * Evaluate retrieval relevance
 */
export async function evaluateRetrievalRelevance(
  query: string,
  retrievedContent: string[]
): Promise<EvalResult> {
  const response = await openai.responses.parse({
    model: 'gpt-4o-mini',
    input: [
      {
        role: 'system',
        content: `You are an expert evaluator for retrieval systems.
Given a user query and retrieved documents, rate the relevance.

Scoring:
- 9-10: All documents highly relevant
- 7-8: Most documents relevant
- 5-6: Mixed relevance
- 3-4: Mostly irrelevant
- 0-2: Doesn't address the query

Score 7+ is passing.`,
      },
      {
        role: 'user',
        content: `Query: ${query}

Retrieved Content:
${retrievedContent.map((c, i) => `[${i + 1}] ${c}`).join('\n\n')}

Evaluate relevance.`,
      },
    ],
    temperature: 0,
    text: {
      format: zodTextFormat(EvalResultSchema, 'retrieval_relevance'),
    },
  });

  return EvalResultSchema.parse(response.output_parsed);
}

/**
 * Evaluate answer faithfulness (grounded in context)
 */
export async function evaluateAnswerFaithfulness(
  context: string,
  answer: string
): Promise<EvalResult> {
  const response = await openai.responses.parse({
    model: 'gpt-4o-mini',
    input: [
      {
        role: 'system',
        content: `You are an expert evaluator for RAG systems.
Evaluate whether the answer is faithful to the context (no hallucination).

Scoring:
- 9-10: Fully grounded, no hallucination
- 7-8: Mostly grounded, minor extrapolations
- 5-6: Some unsupported claims
- 3-4: Significant hallucinations
- 0-2: Contradicts context or entirely hallucinated

Score 7+ is passing.`,
      },
      {
        role: 'user',
        content: `Context:
${context}

Answer:
${answer}

Evaluate faithfulness.`,
      },
    ],
    temperature: 0,
    text: {
      format: zodTextFormat(EvalResultSchema, 'answer_faithfulness'),
    },
  });

  return EvalResultSchema.parse(response.output_parsed);
}

/**
 * Evaluate answer completeness
 */
export async function evaluateAnswerCompleteness(
  query: string,
  answer: string
): Promise<EvalResult> {
  const response = await openai.responses.parse({
    model: 'gpt-4o-mini',
    input: [
      {
        role: 'system',
        content: `You are an expert evaluator for question-answering systems.
Evaluate whether the answer fully addresses the query.

Scoring:
- 9-10: Fully addresses all aspects
- 7-8: Addresses main points, minor gaps
- 5-6: Partially addresses query
- 3-4: Only addresses small part
- 0-2: Doesn't address query

Score 7+ is passing.`,
      },
      {
        role: 'user',
        content: `Query: ${query}

Answer:
${answer}

Evaluate completeness.`,
      },
    ],
    temperature: 0,
    text: {
      format: zodTextFormat(EvalResultSchema, 'answer_completeness'),
    },
  });

  return EvalResultSchema.parse(response.output_parsed);
}
