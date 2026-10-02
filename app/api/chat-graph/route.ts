import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

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
 * The tool-calling channel — INSTRUCTOR REFERENCE SOLUTION.
 *
 * Week 4 · student exercise: docs/CHALLENGE-LANGGRAPH.md
 *
 * Same contract as `/api/chat` (same body in, streamed text out) so you can
 * point the UI at either one and compare answers on the same question. The
 * difference is everything in between: there is no selector here, and this
 * route orchestrates nothing. It hands the graph the conversation and gets an
 * answer back. The model chose what to call.
 *
 * Building the graph per request is deliberate: it costs nothing (object wiring,
 * no network) and it means editing a tool description shows up on the next
 * request without a restart — which is exactly what the description set piece
 * in the runbook needs. In production you'd compile once at module scope.
 */
export async function POST(request: Request) {
	try {
		const { query, messages } = ChatGraphRequestSchema.parse(
			await request.json(),
		);

		const graph = buildGraph();

		const history = messages.map((m) =>
			m.role === 'user'
				? new HumanMessage(m.content)
				: new AIMessage(m.content),
		);

		// `streamMode: 'messages'` yields [chunk, metadata] as the model produces
		// tokens. We forward only chunks from the `agent` node: tool output is
		// intermediate reasoning, and streaming it would dump raw retrieved notes
		// into the chat window.
		//
		// Teaching note: `graph.invoke()` + `result.messages.at(-1)` is the version
		// to show FIRST. Get the loop working, log the whole trace, read it as a
		// story. Streaming is polish and it hides the thing worth seeing.
		const stream = await graph.stream(
			{ messages: [...history, new HumanMessage(query)] },
			{ streamMode: 'messages' },
		);

		const encoder = new TextEncoder();
		const body = new ReadableStream<Uint8Array>({
			async start(controller) {
				try {
					for await (const [chunk, metadata] of stream as AsyncIterable<
						[{ content?: unknown }, { langgraph_node?: string }]
					>) {
						if (metadata?.langgraph_node !== 'agent') continue;
						// Chunks emitted mid-tool-call carry no text.
						const text =
							typeof chunk?.content === 'string' ? chunk.content : '';
						if (text) controller.enqueue(encoder.encode(text));
					}
					controller.close();
				} catch (err) {
					// Headers are already sent, so the status can't change. Surfacing
					// the message beats a truncation that looks like the model just
					// stopped talking mid-sentence.
					controller.enqueue(
						encoder.encode(
							`\n\n[graph error: ${
								err instanceof Error ? err.message : String(err)
							}]`,
						),
					);
					controller.close();
				}
			},
		});

		return new Response(body, {
			headers: {
				'Content-Type': 'text/plain; charset=utf-8',
				'Cache-Control': 'no-cache',
			},
		});
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
