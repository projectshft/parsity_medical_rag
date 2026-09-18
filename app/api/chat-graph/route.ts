import { NextResponse } from 'next/server';
import { z } from 'zod';

import { buildGraph } from '@/lib/graph';

const ChatGraphRequestSchema = z.object({
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
 * The tool-calling channel — YOUR TASK.
 *
 * Same contract as `/api/chat` (same body in, streamed text out) so you can
 * point the UI at either one and compare answers on the same question. The
 * difference is everything in between: there is no selector here, and this
 * route orchestrates nothing. It hands the graph the conversation and gets an
 * answer back. The model chose what to call.
 *
 * Steps:
 *   1. accept the message + history   (done — parsed below)
 *   2. build the graph                (lib/graph.ts → buildGraph)
 *   3. turn `messages` + `query` into LangChain messages and invoke it
 *   4. stream the final answer back
 */
export async function POST(request: Request) {
	try {
		const { query, messages } = ChatGraphRequestSchema.parse(
			await request.json(),
		);

		const graph = buildGraph();

		// TODO — run the graph and return its answer.
		//
		// Import `HumanMessage` / `AIMessage` from '@langchain/core/messages' and
		// map `messages` onto them (role 'user' -> Human, 'assistant' -> AI),
		// then append the new `query` as a HumanMessage.
		//
		// Start with the simple version and prove the loop works:
		//
		//   const result = await graph.invoke({ messages: [...history, new HumanMessage(query)] });
		//   const answer = result.messages.at(-1)?.content;
		//
		// `result.messages` is the WHOLE trace — the model's tool requests, the
		// tool results, and the final answer. Log it once and read it; that list
		// is the clearest picture of tool-calling you will get, and it's what you
		// compare against the selector's `{ useSql, useRag }` decision.
		//
		// Then make it stream, so this route behaves like the other one:
		// `graph.stream(input, { streamMode: 'messages' })` yields message chunks
		// you can pipe into a Response. (The AI SDK's `streamText` is not in play
		// here — LangGraph does its own streaming.)
		throw new Error(
			'Not implemented — your turn! (app/api/chat-graph/route.ts)',
		);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.message }, { status: 400 });
		}
		console.error('Chat graph error:', error);
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
