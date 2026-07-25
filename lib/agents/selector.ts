/**
 * SELECTOR agent — YOUR TASK. Structured output only (never streams).
 *
 * The selector just ROUTES: does this question need the SQL database (structured
 * facts, counts, filters), the clinical notes (meaning-based search), both, or
 * neither (a general question)? It does NOT extract conditions/filters/entities —
 * the SQL agent's LLM does that when it writes the query. Keep it tiny.
 */

import { z } from 'zod';
import { openai } from '../openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type { Message } from '../agent';
import { Prisma } from '@prisma/client';

// useSql: boolean;
// useRag: boolean;
// reason: string;
// agentQuery: string;

const planAgentSchema = z.object({
	useSql: z
		.boolean()
		.describe(
			'Whether to use the sql database which has structured data about patients',
		),
	useRag: z
		.boolean()
		.describe(
			'Whether to use the vector store which has infomration about patient notes BUT not structured data',
		),
	useScheduler: z
		.boolean()
		.describe('Decide whether to schedule an appointment for the patient'),
	reason: z
		.string()
		.describe(
			'The reason for the decision to use the sql database or the vector store or NONE or to schedule an appointment',
		),
	agentQuery: z
		.string()
		.describe(
			'The optimized query to be sent to RAG agent - fix spelling and grammar errors',
		)
		.nullable(), // if useRag is true, this is the query to be sent to the RAG agent
	clarificationQuery: z
		.string()
		.describe(
			'If the query is not clear, ask for clarification. You can only answer questions about medical information.',
		)
		.nullable(),
});

export type Plan = {
	useSql: boolean;
	useRag: boolean;
	useScheduler: boolean;
	/** false = a general question with no tie to the records — answer directly. */
	needsSearch: boolean;
	semanticQuery: string;
};
// TODO: Write the system prompt. Describe the two stores (SQL DB of structured
// facts; vector store of clinical notes) and when each is needed. A pure general
// question (a greeting, "what's a normal A1C range?") needs NEITHER. When unsure,
// prefer searching the notes.

export async function select(
	query: string,
	history: Message[] = [],
): Promise<Plan> {
	//query -> decide what to do?

	// query vector or query sql OR BOTH
	//CONTEXT:
	// we have notes on patiens in a vector store including....
	// we have structured data on patients in a sql database including .....
	// sql schema / types

	// choose 1 or both or none

	const answer = await openai.responses.parse({
		model: 'gpt-4o-mini',
		text: { format: zodTextFormat(planAgentSchema, 'plan') },
		input: [
			{
				role: 'user',
				content: `
				Convo history:${
					history.length > 0
						? history
								.slice(-5)
								.map((h) => `${h.role}: ${h.content}`)
								.join('\n')
						: ''
				} 

				\n\n User Query: ${query}`,
			}, // the query from the user
		],
		temperature: 0.5,
	});

	console.log(answer.output_parsed);

	// Map the parsed answer onto the Plan the route expects.
	const p = planAgentSchema.parse(answer.output_parsed);
	return {
		useSql: p.useSql,
		useRag: p.useRag,
		useScheduler: p.useScheduler,
		needsSearch: p.useSql || p.useRag,
		semanticQuery: p.agentQuery ?? query,
	};
}
