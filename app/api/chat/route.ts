import { runAgent, Message } from '@/lib/agent';

export async function POST(request: Request) {
	try {
		const { query, messages = [] } = await request.json();

		const conversationHistory: Message[] = messages
			.map((m: { role: string; content: string }) => ({
				role: m.role as 'user' | 'assistant',
				content: m.content,
			}))
			.slice(-5);

		const response = await runAgent(query, conversationHistory);

		return response.toTextStreamResponse();
	} catch (error) {
		console.error('Chat error:', error);
		return new Response(
			JSON.stringify({
				error:
					error instanceof Error
						? error.message
						: 'Internal server error',
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			},
		);
	}
}
