// SAVE THIS AS:  lib/evals/selector.test.ts
/**
 * Selector eval — hits the real model, so it's gated behind RUN_EVALS.
 *   npm run test:evals
 *   RUN_EVALS=1 npx vitest run lib/evals/selector.test.ts
 *
 * The selector's output is a STRUCTURED object, so grading it is just `expect` —
 * no judge, no second model, no vibes. Reach for the judge (evals.test.ts) only
 * when the output is prose.
 *
 * ONE case to start. Add rows to CASES — that's the homework.
 */

import { describe, it, expect } from 'vitest';
import { select } from '@/lib/agents/selector';

// TODO(student): add a case per category — rag ("what do the notes say about
// fatigue?"), hybrid, calendar ("book Angel Reinger for Monday"), and clarify
// ("what about them?", where all three flags stay false). Use queries the
// few-shot examples in lib/agents/selector.ts do NOT already contain verbatim —
// that's the "did it generalize?" check.
const CASES: {
	query: string;
	useSql: boolean;
	useRag: boolean;
	useScheduler: boolean;
}[] = [
	{
		query: 'how many patients are taking metformin?',
		useSql: true,
		useRag: false,
		useScheduler: false,
	},
];

describe('selector routing', () => {
	it.each(CASES)(
		'routes "$query" -> sql=$useSql rag=$useRag sched=$useScheduler',
		async ({ query, useSql, useRag, useScheduler }) => {
			const plan = await select(query, []);

			expect(plan.useSql).toBe(useSql);
			expect(plan.useRag).toBe(useRag);
			expect(plan.useScheduler).toBe(useScheduler);

			// Invariant the route depends on — needsSearch is derived, never guessed.
			expect(plan.needsSearch).toBe(plan.useSql || plan.useRag);
			// The downstream agent always gets a real query, never an empty string.
			expect(plan.semanticQuery.trim().length).toBeGreaterThan(0);
		},
		// Generous: this is a live API call, and an occasional slow one shouldn't
		// read as a routing bug.
		60000,
	);
});
