import { NextResponse } from 'next/server';
import { z } from 'zod';
import { streamText, tool } from 'ai';

import { openaiProvider } from '@/lib/openai';
import { runSql } from '@/lib/agents/sql';
import { runRag } from '@/lib/agents/rag';
import { buildSchedulingAction, getDefaultDate } from '@/lib/scheduling';

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
 * SAME pipeline, different control flow. /api/chat hard-codes the order
 * (selector -> sql ‖ rag -> aggregator). Here the MODEL decides: it sees three
 * tools, picks which to call (and in what order, and how many times), then
 * streams the answer. Same specialist functions underneath — only the
 * orchestration moved from our code into the model.
 */
export async function POST(request: Request) {
	try {
		const { query, messages } = ChatRequestSchema.parse(
			await request.json(),
		);

		// Set by the scheduling tool mid-stream, so it can't ride in a response
		// header (those are already sent). It goes out as a trailing marker the
		// UI strips — see the end of this file.
		let schedulingAction: ReturnType<typeof buildSchedulingAction> = null;

		const result = streamText({
			model: openaiProvider('gpt-4o'),
			system: `You answer questions about a medical-records database for a clinician.
Today is ${new Date().toISOString().split('T')[0]}.

Use the tools to get data. queryDatabase for counts/filters/exact facts,
searchNotes for anything about what the notes SAY, both when the question needs
both. NEVER INVENT OR INFER MEDICAL INFORMATION — answer only from tool results,
and if the tools return nothing, say so plainly.`,
			messages: [...messages, { role: 'user' as const, content: query }],
			maxSteps: 15,
			temperature: 0.7,
			tools: {
				queryDatabase: tool({
					description:
						'Text-to-SQL over the structured records (patients, conditions, medications, observations, encounters). Use for counts, filters, "which patients...", and exact facts. Pass the question in plain English.',
					parameters: z.object({
						cats: z
							.string()
							.describe(
								'The question in plain English, with pronouns resolved to real names',
							),
					}),
					execute: ({ cats }) => runSql(cats, messages),
				}),
				searchNotes: tool({
					description:
						'Semantic search over the free-text clinical notes. Use for anything about what the notes say — symptoms, lifestyle, narrative history. Set the filters only when the question names a specific patient or group.',
					parameters: z.object({
						query: z
							.string()
							.describe('What to search the notes for'),
						firstName: z.string().optional(),
						lastName: z.string().optional(),
						gender: z.enum(['male', 'female']).optional(),
					}),
					execute: ({ query, ...filters }) => runRag(query, filters),
				}),
				proposeAppointment: tool({
					description:
						'Propose an appointment slot for the clinician to confirm. This does NOT book it — the UI shows a confirmation card.',
					parameters: z.object({
						patientName: z.string(),
						date: z
							.string()
							.optional()
							.describe(
								'YYYY-MM-DD; resolve "next Tuesday" yourself',
							),
						time: z.string().optional().describe('HH:MM, 24-hour'),
						reason: z.string().optional(),
					}),
					execute: async ({ patientName, date, time, reason }) => {
						schedulingAction = buildSchedulingAction({
							patientName,
							suggestedDate: date ?? getDefaultDate(),
							suggestedTime: time ?? '09:00',
							reason: reason ?? null,
						});
						return `Proposed ${patientName} for ${schedulingAction?.suggestedDate} at ${schedulingAction?.suggestedTime}. Tell the clinician to confirm below; do not describe a form.`;
					},
				}),
			},
			// The whole point of the demo: watch the model pick tools.
			onStepFinish: ({ toolCalls }) => {
				for (const c of toolCalls) {
					console.log(`[tool] ${c.toolName}`, c.args);
				}
			},
		});

		const encoder = new TextEncoder();
		return new Response(
			new ReadableStream({
				async start(controller) {
					for await (const chunk of result.textStream) {
						controller.enqueue(encoder.encode(chunk));
					}
					if (schedulingAction) {
						controller.enqueue(
							encoder.encode(
								`\n<!-- SCHEDULING_ACTION ${JSON.stringify(schedulingAction)} -->`,
							),
						);
					}
					controller.close();
				},
			}),
			{ headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
		);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.message }, { status: 400 });
		}
		console.error('Chat-tools error:', error);
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
