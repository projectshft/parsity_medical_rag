/**
 * End-to-end evals for the tool-calling agent — Week 4.
 *
 *   npm run test:evals
 *
 * Runs every case in golden-set.ts through the real agent (real OpenAI,
 * Pinecone and Postgres, so it costs a little each run) and checks two things:
 *
 *   1. ROUTING — did the model call the tools the case expects? No judge
 *      needed: we know which tools it called. Cheap, deterministic, and the
 *      first thing to look at when an answer is wrong.
 *   2. FAITHFULNESS — is everything in the answer supported by what the tools
 *      returned? This needs a judge, because "supported by" can't be
 *      string-matched. It fails until you implement evaluateAnswerFaithfulness
 *      in llm-judge.ts. That's the in-class exercise.
 */

import { describe, it, expect } from 'vitest';
import { runToolAgent } from '../tool-agent';
import { evaluateAnswerFaithfulness } from './llm-judge';
import { GOLDEN_SET } from './golden-set';

describe.each(GOLDEN_SET)('$category: $query', (c) => {
	it(
		'calls the right tools, and the answer is grounded in what they returned',
		async () => {
			const { answer, steps } = await runToolAgent(c.query);
			const called = steps.map((s) => s.tool);

			// 1. Routing
			for (const tool of c.expectTools) expect(called, `expected ${tool}`).toContain(tool);
			if (c.expectTools.length === 0) expect(called, 'expected no tools').toEqual([]);

			for (const word of c.mustMention ?? []) {
				expect(answer.toLowerCase()).toContain(word.toLowerCase());
			}

			// 2. Faithfulness: judge the answer against exactly what the tools returned.
			// Nothing retrieved (off-topic, scheduling) means nothing to be faithful to.
			const context = steps.map((s) => `[${s.tool}]\n${s.output}`).join('\n\n');
			if (!context) return;
			const verdict = await evaluateAnswerFaithfulness(context, answer);
			expect(verdict.pass, verdict.reasoning).toBe(true);
		},
		120_000,
	);
});
