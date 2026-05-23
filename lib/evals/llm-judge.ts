/**
 * LLM-as-Judge Evaluator
 *
 * Uses an LLM to evaluate RAG system outputs against quality criteria.
 * This pattern is useful when human evaluation isn't scalable.
 */

import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { openai } from '../openai';

/**
 * Evaluation result schema
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
 * Measures how relevant the retrieved documents are to the query.
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
Given a user query and retrieved documents, rate the relevance of the retrieved content.

Scoring guide:
- 9-10: All documents highly relevant, directly answer the query
- 7-8: Most documents relevant, some tangentially related
- 5-6: Mixed relevance, some useful content
- 3-4: Mostly irrelevant with a few relevant pieces
- 0-2: Retrieved content doesn't address the query

A score of 7 or above is considered passing.`,
      },
      {
        role: 'user',
        content: `Query: ${query}

Retrieved Content:
${retrievedContent.map((c, i) => `[${i + 1}] ${c}`).join('\n\n')}

Evaluate the relevance of these retrieved documents to the query.`,
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
 * Evaluate answer faithfulness
 *
 * Measures whether the generated answer is grounded in the retrieved context.
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
Given context (retrieved documents) and a generated answer, evaluate whether
the answer is faithful to the context (doesn't hallucinate or add information
not present in the context).

Scoring guide:
- 9-10: Answer is fully grounded in context, no hallucination
- 7-8: Answer mostly grounded, minor extrapolations that are reasonable
- 5-6: Some claims not supported by context
- 3-4: Significant unsupported claims or hallucinations
- 0-2: Answer contradicts context or is entirely hallucinated

A score of 7 or above is considered passing.`,
      },
      {
        role: 'user',
        content: `Context:
${context}

Generated Answer:
${answer}

Evaluate the faithfulness of this answer to the context.`,
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
 *
 * Measures whether the answer fully addresses the user's question.
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
Given a user query and a generated answer, evaluate whether the answer
completely addresses all aspects of the query.

Scoring guide:
- 9-10: Answer fully addresses all aspects of the query
- 7-8: Answer addresses main points, minor aspects missing
- 5-6: Answer partially addresses the query, some aspects missing
- 3-4: Answer only addresses a small part of the query
- 0-2: Answer doesn't address the query at all

A score of 7 or above is considered passing.`,
      },
      {
        role: 'user',
        content: `Query: ${query}

Generated Answer:
${answer}

Evaluate the completeness of this answer.`,
      },
    ],
    temperature: 0,
    text: {
      format: zodTextFormat(EvalResultSchema, 'answer_completeness'),
    },
  });

  return EvalResultSchema.parse(response.output_parsed);
}
