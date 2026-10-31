import { NextResponse } from 'next/server';
import { z } from 'zod';

import { runToolAgent, AppointmentProposalSchema } from '@/lib/tool-agent';

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
 * The tool-calling channel — Week 4.
 *
 * Same request and response as `/api/chat` ({ message, schedulingAction }), so
 * the page can switch between them and you can ask both the same question.
 * The difference is everything in between: no selector, no `if`s. The model
 * chose which tools to run (see lib/tool-agent.ts).
 */
export async function POST(request: Request) {
	try {
		const { query, messages } = ChatRequestSchema.parse(await request.json());

		const { answer, steps } = await runToolAgent(query, messages);
		console.log('tool calls:', steps.map((s) => `${s.tool}(${JSON.stringify(s.args)})`));

		// If the model proposed an appointment, show the confirm card. It's the
		// same card /api/chat uses; booking still waits for a human click.
		const proposal = steps.findLast((s) => s.tool === 'propose_appointment');
		const parsed = proposal && AppointmentProposalSchema.safeParse(proposal.args);

		return NextResponse.json({
			message: answer,
			schedulingAction: parsed?.success ? parsed.data : null,
			toolsUsed: steps.map((s) => s.tool),
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.message }, { status: 400 });
		}
		console.error('Chat tools error:', error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 },
		);
	}
}
