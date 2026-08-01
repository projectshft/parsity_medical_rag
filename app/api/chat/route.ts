import { NextResponse } from 'next/server';
import { z } from 'zod';

import { select } from '@/lib/agents/selector';
import { runSql } from '@/lib/agents/sql';
import { runRag, extractRagFilters } from '@/lib/agents/rag';
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
			// Pass the selector's RESOLVED query (pronouns/typos fixed, "her" ->
			// "Carmen Escobar"), same as the RAG path — not the raw user text.
			sqlResult = await runSql(plan.semanticQuery, messages);
		}

		if (plan.useRag) {
			// Pull metadata filters (patient name, gender) from the query with mini,
			// then scope the vector search to them.
			const ragFilters = await extractRagFilters(plan.semanticQuery);
			ragResult = await runRag(plan.semanticQuery, ragFilters);
		}

		// Scheduling short-circuits: it streams its own confirmation (with the
		// action in a header) and never reaches the SQL/RAG/aggregator path.
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
            You are talking to a CLINICIAN/scheduler, NOT the patient. Write ONE short
            sentence that PROPOSES this appointment slot for them to book. Do not greet
            or address the patient, and do not say "your appointment" — refer to the
            patient in the third person.
            Use only these details — do not invent any:
            - Patient: ${schedulingResult?.patientName}
            - Date: ${schedulingResult?.suggestedDate}
            - Time: ${schedulingResult?.suggestedTime}
            - Reason: ${schedulingResult?.reason ?? 'not specified'}

            Example tone: "I can book ${schedulingResult?.patientName} for ${schedulingResult?.suggestedDate} at ${schedulingResult?.suggestedTime} — confirm below to schedule."

            You are ONLY writing the message. The app renders the scheduling card from
            structured data sent separately (the X-Scheduling-Action header) — do not
            describe a form or UI.
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
