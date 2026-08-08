// SAVE THIS AS:  lib/evals/evals.test.ts
/**
 * End-to-end eval — calls the REAL /api/chat route, then has an LLM judge the
 * answer against plain-English criteria.
 *
 *   npm run test:evals
 *   RUN_EVALS=1 npx vitest run lib/evals/evals.test.ts
 *
 * Start the app first — this posts to it over HTTP, the same request the browser
 * makes, through the whole pipeline: selector -> sql / rag -> aggregator.
 *
 *   npm run dev          (in one terminal)
 *   npm run test:evals   (in another)
 *
 * Why a judge? The answer is prose. "63 patients have hypertension" and "There
 * are 63 patients with a hypertension diagnosis" are both right, and no
 * toBe()/toContain() covers every phrasing a model might pick. So we state what
 * a good answer must DO, and a second model checks it.
 *
 * ONE case to start. Add rows to CASES — that's the homework.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { openai } from '@/lib/openai';
import type { Message } from '@/lib/agent';

/** Start the app first: `npm run dev`. Override the port with EVAL_BASE_URL. */
const BASE_URL = process.env.EVAL_BASE_URL ?? 'http://localhost:3000';

/** POST /api/chat over real HTTP — the exact request the browser makes. */
async function askChat(query: string, messages: Message[] = []): Promise<string> {
	const res = await fetch(`${BASE_URL}/api/chat`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ query, messages }),
	}).catch(() => {
		throw new Error(
			`Could not reach ${BASE_URL}. Start the app first:  npm run dev\n` +
				`(different port? EVAL_BASE_URL=http://localhost:3001 npm run test:evals)`,
		);
	});

	expect(res.status).toBe(200);
	return res.text();
}

const VerdictSchema = z.object({
	pass: z.boolean().describe('true only if EVERY criterion is met'),
	reasoning: z.string().describe('One sentence. Name the criterion that failed, if any.'),
});

/** Grade an answer against plain-English criteria. */
async function judge(query: string, answer: string, criteria: string[]) {
	const res = await openai.responses.parse({
		// gpt-4o, not mini: mini fails criteria the answer plainly meets. A cheap
		// judge that grades wrong is worse than no judge — you chase phantom bugs.
		model: 'gpt-4o',
		input: [
			{
				role: 'system',
				content: `You grade an AI assistant's answer against a checklist.

Mark each criterion met or not met, exactly as written. Do NOT add requirements
of your own — if a criterion asks for a number and the answer contains a number,
it is met, regardless of how much context surrounds it. Ignore style, length,
and tone. pass = true only if every criterion is met.`,
			},
			{
				role: 'user',
				content: `QUESTION:\n${query}\n\nANSWER:\n${answer}\n\nCRITERIA:\n${criteria
					.map((c, i) => `${i + 1}. ${c}`)
					.join('\n')}`,
			},
		],
		temperature: 0,
		text: { format: zodTextFormat(VerdictSchema, 'verdict') },
	});
	return VerdictSchema.parse(res.output_parsed);
}

// TODO(student): add rows. A notes question ("what do the notes say about
// fatigue?"), a hybrid one, a follow-up that needs `messages` to resolve "her",
// and a question the data CAN'T answer — where the right behavior is saying so.
const CASES: {
	name: string;
	query: string;
	messages?: Message[];
	criteria: string[];
}[] = [
	{
		name: 'counts patients with hypertension',
		query: 'how many patients have hypertension?',
		criteria: [
			'Gives a specific number of patients.',
			'Does not refuse, ask for clarification, or say it lacks the information.',
			'Does not invent patient names or clinical details that were not asked for.',
		],
	},
];

describe('chat route (end-to-end)', () => {
	it.each(CASES)('$name', async ({ query, messages, criteria }) => {
		const answer = await askChat(query, messages);
		const verdict = await judge(query, answer, criteria);

		console.log(`\nQ: ${query}\nA: ${answer}\nJUDGE: ${JSON.stringify(verdict)}`);

		expect(verdict.pass).toBe(true);
	}, 60000);
});
