import { NextResponse } from 'next/server';
import { z } from 'zod';

import { select } from '@/lib/agents/selector';
import { runSql } from '@/lib/agents/sql';
import { runRag } from '@/lib/agents/rag';
import { aggregate, SCHEDULING_SYSTEM_PROMPT } from '@/lib/agents/aggregator';
import { detectSchedulingIntent, buildSchedulingAction } from '@/lib/scheduling';

const ChatRequestSchema = z.object({
	query: z.string().min(1),
	messages: z
		.array(
			z.object({
				role: z.enum(['user', 'assistant']),
				content: z.string(),
			}),
		)
		.default([]),
});

/**
 * The chat pipeline — YOUR TASK. This route IS the orchestrator:
 *
 *   1. accept the message + history   (done — parsed below)
 *   2. the selector decides which stores to hit
 *   3. call 0, 1, or 2 specialists (sql / rag)
 *   4. the aggregator streams the answer back
 *
 * You implement `select`, `runSql`, and `runRag` (lib/agents/). `aggregate` is
 * provided — it's the only piece that streams.
 */
export async function POST(request: Request) {
	try {
		const { query, messages } = ChatRequestSchema.parse(
			await request.json(),
		);

		const plan = await select(query, messages);

		// SCHEDULING — an action, not a lookup. Short-circuit: skip SQL/RAG.
		// The aggregator STREAMS a confirmation (same OpenAI method as every
		// other answer); the action rides in a response header for the UI card.
		// (We build the action JSON in code — never the LLM.)
		if (plan.needsAppt) {
			const intent = await detectSchedulingIntent(query, messages);
			const action = buildSchedulingAction(intent);
			return aggregate({
				query,
				history: messages,
				system: SCHEDULING_SYSTEM_PROMPT,
			}).toTextStreamResponse({
				headers: action
					? { 'X-Scheduling-Action': encodeURIComponent(JSON.stringify(action)) }
					: undefined,
			});
		}

		// GENERAL question — nothing to look up, the aggregator answers directly.
		if (!plan.needsSearch) {
			return aggregate({ query, history: messages }).toTextStreamResponse();
		}

		// LOOKUP — run the specialists the plan called for, in parallel.
		const [sqlText, ragText] = await Promise.all([
			plan.useSql ? runSql(query, messages) : undefined,
			plan.useRag ? runRag(plan.semanticQuery) : undefined,
		]);

		return aggregate({
			query,
			history: messages,
			sqlText,
			ragText,
		}).toTextStreamResponse();
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.message }, { status: 400 });
		}
		console.error('Chat error:', error);
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: 'Internal server error',
			},
			{ status: 500 },
		);
	}
}
