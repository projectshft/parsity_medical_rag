import { NextResponse } from 'next/server';
import { generateText, stepCountIs, tool } from 'ai';
import { z } from 'zod';

import { openaiProvider } from '@/lib/openai';
import { runSql } from '@/lib/agents/sql';
import { runRag } from '@/lib/agents/rag';

const ChatSchema = z.object({
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

const SchedulingActionSchema = z.object({
	patientName: z.string().min(1),
	date: z.string().describe('YYYY-MM-DD'),
	time: z.string().describe('HH:MM, 24-hour'),
	reason: z.string().nullable().describe('null if not provided'),
});

/**
 * The tool-calling channel — Vercel AI SDK. Same contract as `/api/chat`
 * (`{ message, schedulingAction? }`), but there is no selector: the model
 * decides which tools to call, in as many steps as it wants.
 */
export async function POST(request: Request) {
	try {
		const { query, messages } = ChatSchema.parse(await request.json());

		const tools = {
			query_patient_database: tool({
				// when and where to use
				description:
					'Structured facts about the patient population: counts, lists, filters by age, gender, city, or diagnosis ("how many diabetic patients over 60"). Do NOT use for what a specific clinical note says.',
				inputSchema: z.object({
					elephants: z
						.string()
						.describe(
							'The question for the SQL agent to answer, which should be clear enough and ideally include things like age, gender, city, or diagnosis.',
						),
				}),
				execute: ({ elephants }) => runSql(elephants),
			}),
			search_clinical_notes: tool({
				description:
					'Meaning-based search over free-text clinical notes: symptoms, history, treatment ("what did the notes say about John Doe\'s chest pain"). Do NOT use for counts or population filters.',
				inputSchema: z.object({
					query: z
						.string()
						.describe(
							'What to look for in the notes. Rephrase the question to be more specific and well suited for the RAG agent which will query a vector database. The more specific, the better.',
						),
				}),
				execute: ({ query }) => runRag(query),
			}),
			// Books nothing: the route returns these args as `schedulingAction`
			// and the UI card + /api/schedule do the human-confirmed booking.
			schedule_appointment: tool({
				description:
					'Propose an appointment. Call ONLY when you have patient name, date, and time; otherwise ask the user for what is missing.',
				inputSchema: SchedulingActionSchema,
				execute: async () =>
					'Confirmation card shown to the user. Not booked until they confirm.',
			}),
			web_search: tool({
				description:
					'Search the web for information about a specific condition or medical paper to augment thre response from the SQL or RAG agents IF it makes sense to do so. ALWAYS use this tool when running RAG queries.',
				inputSchema: z.object({
					query: z
						.string()
						.describe('The question to search the web for.'),
					queryParams: z.object({
						query: z
							.string()
							.describe('The query to search the web for.'),
						maxResults: z
							.number()
							.describe(
								'The maximum number of results to return.',
							),
					}),
				}),
				execute: async ({ query, queryParams }) => {
					const argvixQuery = await fetch(
						`https://export.arxiv.org/api/query?search_query=all:${queryParams.query}&max_results=${queryParams.maxResults}`,
					);
					const webResponse = await fetch(
						'https://api.openai.com/v1/search',
						{
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
								Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
							},
							body: JSON.stringify({ query }),
						},
					);

					const argvixData = await argvixQuery.text();
					const webData = await webResponse.json();

					return `${argvixData}\n\n${webData}`;
				},
			}),
		};

		const result = await generateText({
			model: openaiProvider('gpt-6-luna'),
			system: `We are a medical facility helping staff look up patient info. Use the tools to answer; combine them when a question needs both. Never give medical advice, and decline non-medical questions. Today is ${new Date().toISOString().split('T')[0]}; resolve relative dates against it. Never invent scheduling details. Answer as a markdown list.`,
			messages: [...messages, { role: 'user', content: query }],
			stopWhen: stepCountIs(1),
			tools,
		}); //TEXT

		const toolCalls = result.steps.flatMap((s) => s.toolCalls);
		const scheduled = toolCalls.findLast(
			(c) => c.toolName === 'schedule_appointment',
		);

		return NextResponse.json({
			message: result.text,
			schedulingAction: scheduled?.input ?? null, //SchedulingActionSchema,
			// // workaround to get the input from the schedule_appointment tool because
			// // the API that we call EXPECTS the scheduling object (CAL API)
			// toolsCalled: toolCalls.map((c) => c.toolName), // for the selector evals
			// // for the UI: what the model could see, and what it did with it
			// availableTools: Object.entries(tools).map(([name, t]) => ({
			// 	name,
			// 	description: t.description,
			// })),
			// trace: result.steps.flatMap((step) =>
			// 	step.toolCalls.map((c) => ({
			// 		tool: c.toolName,
			// 		input: c.input,
			// 		output: step.toolResults.find(
			// 			(r) => r.toolCallId === c.toolCallId,
			// 		)?.output,
			// 	})),
			// ),
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.message }, { status: 400 });
		}
		console.error('Chat tool-calling error:', error);
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
