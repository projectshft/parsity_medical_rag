/**
 * Contract spec for the Jev-backed judge — INSTRUCTOR REFERENCE.
 *
 * This lives OUTSIDE `lib/evals/` on purpose. Everything in that folder calls a
 * real provider and is excluded from `npm run test:run` (see `vitest.config.ts`)
 * because it costs money. The judge's *mapping* logic — rubric level to a 0-10
 * score, probability to a pass/fail, answers to a `reasoning` string — is pure,
 * so it can and should be tested for free on every commit.
 *
 * What this protects: the scaling arithmetic, the threshold, and the fact that
 * `retrieval.test.ts` keeps passing whoever is underneath. Swap Jev for another
 * provider and these assertions are the ones that tell you the contract held.
 *
 * Run just this file: npx vitest run lib/judge-contract.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Scripted Jev responses. `systemOne` answers both questions in one request, so
 * each entry supplies the score answer and the pass answer together.
 */
let next: {
	score: number;
	confidence: number;
	noul: number;
} = { score: 4, confidence: 0.9, noul: 1 };

let lastRequest: { state?: unknown; questions?: Record<string, unknown> } = {};

vi.mock('@typesafe-ai/sdk', () => ({
	// The helpers just build request objects; keep enough shape to assert on.
	score: (instructions: unknown, criteria: readonly unknown[]) => ({
		type: 'score',
		instructions,
		criteria,
	}),
	noul: (instructions: unknown) => ({ type: 'noul', instructions }),
	TypeSafeClient: class {
		async systemOne(request: {
			state: unknown;
			questions: Record<string, unknown>;
		}) {
			lastRequest = request;
			const criteria = (
				request.questions.quality as { criteria: readonly unknown[] }
			).criteria;
			// Mirror the real response: a legend and probabilities keyed by level.
			const legend = Object.fromEntries(
				criteria.map((c, i) => [String(i), c]),
			);
			const probabilities = Object.fromEntries(
				criteria.map((_, i) => [String(i), i === Math.round(next.score) ? 0.8 : 0.05]),
			);
			return {
				model: 'jev-test',
				usage: { input_tokens: 100, output_tokens: 0 },
				answers: {
					quality: {
						type: 'score',
						score: next.score,
						confidence: next.confidence,
						legend,
						probabilities,
					},
					acceptable: { type: 'noul', noul: next.noul },
				},
			};
		}
	},
}));

import {
	evaluateRetrievalRelevance,
	evaluateAnswerFaithfulness,
	evaluateAnswerCompleteness,
} from './evals/llm-judge';

beforeEach(() => {
	next = { score: 4, confidence: 0.9, noul: 1 };
	lastRequest = {};
});

describe('the 0-10 contract', () => {
	it('maps the top rubric level to 10', async () => {
		next = { score: 4, confidence: 0.95, noul: 1 }; // 5 levels -> index 4 is top
		const r = await evaluateRetrievalRelevance('q', ['doc']);
		expect(r.score).toBe(10);
	});

	it('maps the bottom rubric level to 0', async () => {
		next = { score: 0, confidence: 0.9, noul: 0 };
		const r = await evaluateRetrievalRelevance('q', ['doc']);
		expect(r.score).toBe(0);
	});

	it('keeps a between-levels answer continuous', async () => {
		// Jev returns an expected value; 2.4 is "mostly level 2, some level 3".
		next = { score: 2.4, confidence: 0.6, noul: 1 };
		const r = await evaluateRetrievalRelevance('q', ['doc']);
		expect(r.score).toBeCloseTo(6, 5);
	});

	it('never emits a score outside 0-10', async () => {
		for (const s of [0, 1, 2, 3, 4]) {
			next = { score: s, confidence: 0.8, noul: 1 };
			const r = await evaluateAnswerCompleteness('q', 'a');
			expect(r.score).toBeGreaterThanOrEqual(0);
			expect(r.score).toBeLessThanOrEqual(10);
		}
	});
});

describe('pass/fail comes from the probability, not the score', () => {
	it('passes when yes-probability is at or above 0.5', async () => {
		next = { score: 2, confidence: 0.5, noul: 0.5 };
		expect((await evaluateRetrievalRelevance('q', ['doc'])).pass).toBe(true);
	});

	it('fails just below the threshold', async () => {
		next = { score: 2, confidence: 0.5, noul: 0.49 };
		expect((await evaluateRetrievalRelevance('q', ['doc'])).pass).toBe(false);
	});

	it('can fail with a high score — the two questions are independent', async () => {
		// Worth knowing: a judge that rates quality highly but still says "not
		// acceptable" is informative, not a bug. Don't derive one from the other.
		next = { score: 4, confidence: 0.9, noul: 0.1 };
		const r = await evaluateAnswerFaithfulness('ctx', 'ans');
		expect(r.score).toBe(10);
		expect(r.pass).toBe(false);
	});
});

describe('the reasoning string', () => {
	it('is always present — retrieval.test.ts asserts it', async () => {
		const r = await evaluateRetrievalRelevance('q', ['doc']);
		expect(r.reasoning).toBeDefined();
		expect(r.reasoning.length).toBeGreaterThan(0);
	});

	it('reports the rubric level it landed on, not an invented rationale', async () => {
		next = { score: 4, confidence: 0.91, noul: 1 };
		const r = await evaluateRetrievalRelevance('q', ['doc']);
		expect(r.reasoning).toContain('10.0/10');
		expect(r.reasoning).toContain('Every document is directly relevant');
		expect(r.reasoning).toContain('confidence=0.91');
	});

	it('surfaces confidence as its own field', async () => {
		next = { score: 3, confidence: 0.42, noul: 1 };
		const r = await evaluateAnswerCompleteness('q', 'a');
		expect(r.confidence).toBe(0.42);
	});
});

describe('the request it sends', () => {
	it('asks both questions in ONE request', async () => {
		await evaluateRetrievalRelevance('q', ['doc']);
		// Two round trips would pay input tokens twice for the same state.
		expect(Object.keys(lastRequest.questions ?? {}).sort()).toEqual([
			'acceptable',
			'quality',
		]);
	});

	it('passes structured state, so questions can reference field names', async () => {
		await evaluateRetrievalRelevance('what meds?', ['note one', 'note two']);
		expect(lastRequest.state).toEqual({
			question: 'what meds?',
			retrieved_documents: ['note one', 'note two'],
		});
	});

	it('uses a five-level rubric for every evaluator', async () => {
		for (const run of [
			() => evaluateRetrievalRelevance('q', ['d']),
			() => evaluateAnswerFaithfulness('c', 'a'),
			() => evaluateAnswerCompleteness('q', 'a'),
		]) {
			await run();
			const q = lastRequest.questions!.quality as { criteria: unknown[] };
			// Jev caps rubrics at ten levels; five keeps each one distinguishable.
			expect(q.criteria).toHaveLength(5);
		}
	});
});
