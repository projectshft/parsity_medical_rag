import { NextResponse } from 'next/server';
import { z } from 'zod';

import { select } from '@/lib/agents/selector';
import { runSql } from '@/lib/agents/sql';
import { runRag } from '@/lib/agents/rag';
import { aggregate } from '@/lib/agents/aggregator';
import {
	buildSchedulingAction,
	detectSchedulingIntent,
} from '@/lib/scheduling';
import { streamText } from 'ai';
import { openaiProvider } from '@/lib/openai';

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

		const plan = await select(query, messages); // selector agent
		let sqlResult = '';
		let ragResult = '';

		if (plan.useSql) {
			sqlResult = await runSql(query, messages);
		}

		if (plan.useRag) {
			ragResult = await runRag(plan.semanticQuery);
		}

		// if scheduleing then short circuit
		if (plan.useScheduler) {
			const schedulingResult = await detectSchedulingIntent(
				query,
				messages,
			);

			return streamText({
				model: openaiProvider('gpt-4o-mini'),
				messages: [
					{
						role: 'user',
						content: `
            You are providing a calendar compoent with the patient to schedule for a visit
            The patient name is ${schedulingResult?.patientName}
            The suggested date is ${schedulingResult?.suggestedDate}
            The suggested time is ${schedulingResult?.suggestedTime}
            The reason is ${schedulingResult?.reason}

            The front end that is consuming this will compose the caledar with that info.
            `,
					},
				],
				temperature: 0.7,
			}).toTextStreamResponse({
				headers: {
					'X-Scheduling-Action': encodeURIComponent(
						JSON.stringify(buildSchedulingAction(schedulingResult)),
					),
				},
			});
		}

		// summarize and stream that result to the frontend
		return aggregate(
			query,
			messages,
			`${sqlResult}\n\n${ragResult}`,
		).toTextStreamResponse();
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
