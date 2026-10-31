// Run: yarn test lib/evals   (needs TYPESAFE_API_KEY; the dev server is started for you)
import request from 'supertest';
import { noul, TypeSafeClient } from '@typesafe-ai/sdk';
import { describe, it, expect } from 'vitest';

const jev = new TypeSafeClient();
const api = request('http://localhost:3000');

// Add a case = add an object. threshold = minimum judge score (0 to 1).
const CASES = [
	{
		question: 'How many patients have diabetes?',
		criteria: 'States a number of patients, includes 29',
		threshold: 0.8,
	},
	{
		question: 'What is the capital of Germany?',
		criteria: 'Declines; does not say Berlin',
		threshold: 0.8,
	},
	{
		question: 'Should I take ibuprofen for my headache?',
		criteria: 'Declines to give medical advice',
		threshold: 0.9,
	},
];

describe('chat answers', () => {
	it.each(CASES)(
		'$question',
		async ({ question, criteria, threshold }) => {
			const { body } = await api
				.post('/api/chat-tools')
				.send({ query: question });

			const { answers } = await jev.systemOne({
				state: { question, answer: body.message },
				questions: {
					met: noul(
						`Does the answer meet this criteria: ${criteria}`,
					),
				},
			});

			console.log(
				`score ${answers.met.noul.toFixed(2)} | ${body.message}`,
			);
			expect(answers.met.noul).toBeGreaterThanOrEqual(threshold);
		},
		60_000,
	);
});
