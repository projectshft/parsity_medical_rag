/**
 * LLM-as-judge, on Jev — INSTRUCTOR REFERENCE SOLUTION.
 *
 * Week 5 · student exercise: the stubs on `cohort_4`
 * Spec it must satisfy: `lib/evals/retrieval.test.ts`
 *
 * These call a real provider on every run. That's the point — `npm run test:run`
 * stays offline and free, and `npm run test:evals` costs money because judging
 * is a model's job. Don't mock the provider here to make it cheap; mock it in a
 * unit test (see `lib/judge-contract.test.ts`) and leave this path honest.
 *
 * WHY JEV AND NOT gpt-4o
 *
 * A judge does not need to write prose. It needs to land on a level and tell you
 * how sure it is. Jev (TypeSafe AI) is built for exactly that: typed questions
 * in, calibrated probabilities out, no free-text generation. Three consequences
 * worth teaching:
 *
 *   1. **Cost.** $0.04 per million input tokens, and output is free. A judging
 *      pass over a 30-case golden set is effectively free, so students can run
 *      the suite on every change instead of rationing it.
 *   2. **Calibration you don't have to take on faith.** Every answer carries a
 *      `confidence` and the full probability distribution over rubric levels.
 *      Week 5's "calibrate the judge" exercise stops being a vibe check.
 *   3. **No rationalisation.** An LLM judge writes its `reasoning` AFTER picking
 *      a score, to justify it — the same post-hoc story the week-4 runbook warns
 *      about with the selector's `reason` field. Jev can't do that, so the
 *      `reasoning` below is assembled from what actually decided the answer:
 *      the rubric level, its probability, and the confidence.
 *
 * The tradeoff, stated plainly: Jev is weak at arithmetic, counting and dates,
 * and it reads questions literally — negations and scoping words land at face
 * value. Write rubric levels as plain descriptions of what "good" looks like,
 * not as instructions.
 */

import { TypeSafeClient, noul, score } from '@typesafe-ai/sdk';
import { z } from 'zod';

/**
 * The contract the student spec asserts against. Unchanged from the OpenAI
 * version, so `retrieval.test.ts` doesn't care which provider is underneath —
 * which is the point of having a contract.
 */
const EvalResultSchema = z.object({
	score: z.number().min(0).max(10).describe('Score from 0-10'),
	reasoning: z.string().describe('Brief explanation for the score'),
	pass: z.boolean().describe('Whether this meets the quality threshold'),
	/** 0-1, how sure the judge is. New with Jev; absent on an LLM judge. */
	confidence: z.number().min(0).max(1).optional(),
});

export type EvalResult = z.infer<typeof EvalResultSchema>;

/**
 * `TYPESAFE_API_KEY` and `TYPESAFE_BASE_URL` are both read from the environment
 * by the SDK, so there is nothing to wire here. Constructed lazily so importing
 * this module never throws — the contract tests import it without a key.
 *
 * In the classroom both point at the LiteLLM proxy, not at TypeSafe: students
 * have no TypeSafe account (Jev is early access, no free tier), so the key they
 * send is their LiteLLM key and the proxy swaps in the real one on a
 * pass-through route. A 401 from here is a key/base-URL problem, not an outage.
 * See `infra/litellm/litellm-config.yaml`.
 */
let client: TypeSafeClient | undefined;
function getClient(): TypeSafeClient {
	if (!client) {
		client = new TypeSafeClient({
			// `jev-latest` floats; pin when you want a result you can reproduce
			// next month. An eval suite is exactly the place to pin.
			defaultModel: process.env.TYPESAFE_DEFAULT_MODEL ?? 'jev-latest',
			timeout: 30_000,
		});
	}
	return client;
}

/**
 * A five-level rubric, scaled onto the 0-10 the contract promises.
 *
 * Jev caps rubrics at ten levels and returns an expected value that can fall
 * BETWEEN levels (2.4 means "mostly level 2, some level 3"), so the scaled
 * score is continuous — it just isn't a number the model invented.
 */
const LEVELS = 5;
const toTen = (raw: number) => (raw / (LEVELS - 1)) * 10;

/** Build the `reasoning` string out of what actually decided the answer. */
function explain(
	label: string,
	raw: number,
	legend: Record<string, unknown>,
	probabilities: Record<string, number>,
	confidence: number,
	yesProbability: number,
): string {
	const nearest = String(Math.round(raw));
	const level = legend[nearest];
	const p = probabilities[nearest];
	return [
		`${label}: ${toTen(raw).toFixed(1)}/10`,
		`(rubric level ${nearest}${level ? ` — "${level}"` : ''}`,
		`p=${p !== undefined ? p.toFixed(2) : 'n/a'}, confidence=${confidence.toFixed(2)})`,
		`· passes threshold with probability ${yesProbability.toFixed(2)}`,
	].join(' ');
}

/**
 * Ask Jev one score question and one pass/fail question about the same state,
 * in a single request, and assemble the contract from the answers.
 *
 * Both questions go in one call because Jev answers them in parallel against
 * the same state — two round trips would cost twice the input tokens to learn
 * the same thing.
 */
async function judge(
	label: string,
	state: unknown,
	rubric: readonly [string, string, string, string, string],
	scoreQuestion: string,
	passQuestion: string,
): Promise<EvalResult> {
	const { answers } = await getClient().systemOne({
		state: state as never,
		questions: {
			quality: score(scoreQuestion, rubric),
			acceptable: noul(passQuestion),
		},
	});

	const raw = answers.quality.score;
	const confidence = answers.quality.confidence;
	// `noul` is the PROBABILITY of yes, not a boolean. Thresholding it is a
	// decision you are making; 0.5 is the obvious default and not the only one.
	const yesProbability = answers.acceptable.noul;

	return EvalResultSchema.parse({
		score: toTen(raw),
		pass: yesProbability >= 0.5,
		confidence,
		reasoning: explain(
			label,
			raw,
			answers.quality.legend as Record<string, unknown>,
			answers.quality.probabilities as Record<string, number>,
			confidence,
			yesProbability,
		),
	});
}

/**
 * Did retrieval return the right documents?
 *
 * Judge this BEFORE blaming the answer. A wrong answer over the wrong documents
 * is a retrieval bug, and no amount of prompt work on the aggregator fixes it.
 */
export async function evaluateRetrievalRelevance(
	query: string,
	retrievedContent: string[],
): Promise<EvalResult> {
	return judge(
		'Retrieval relevance',
		{ question: query, retrieved_documents: retrievedContent },
		[
			'None of the documents relate to the question at all',
			'One document is loosely on topic; the rest are unrelated',
			'Some documents are relevant, mixed with clearly unrelated ones',
			'Most documents are relevant to the question',
			'Every document is directly relevant to the question',
		],
		'How relevant are `retrieved_documents` to `question`?',
		'Do `retrieved_documents` contain enough relevant material to answer `question`?',
	);
}

/**
 * Is every claim in the answer supported by the context?
 *
 * This is the hallucination detector and the load-bearing one for medical data.
 * Keep its threshold strict even when the others are lenient.
 */
export async function evaluateAnswerFaithfulness(
	context: string,
	answer: string,
): Promise<EvalResult> {
	return judge(
		'Faithfulness',
		{ context, answer },
		[
			'The answer contradicts the context or is entirely invented',
			'The answer contains significant claims absent from the context',
			'The answer contains some claims the context does not support',
			'The answer is mostly supported, with minor extrapolation',
			'Every claim in the answer is supported by the context',
		],
		'How well is `answer` supported by `context`?',
		'Is every factual claim in `answer` supported by `context`?',
	);
}

/**
 * Did the answer address the whole question?
 *
 * The quiet failure: a faithful, well-grounded answer to half of what was
 * asked. "What medication and what dose?" answered with just the drug name
 * scores perfectly on faithfulness and is still wrong.
 */
export async function evaluateAnswerCompleteness(
	query: string,
	answer: string,
): Promise<EvalResult> {
	return judge(
		'Completeness',
		{ question: query, answer },
		[
			'The answer does not address the question',
			'The answer addresses a small part of the question',
			'The answer addresses the question partially, leaving gaps',
			'The answer addresses the main points, with minor gaps',
			'The answer fully addresses every part of the question',
		],
		'How completely does `answer` address `question`?',
		'Does `answer` address every part of `question`?',
	);
}
