/**
 * AGGREGATOR agent — the ONLY streamer. (Provided.)
 *
 * Week 3 · PROVIDED. Read it, don't rewrite it — streaming is plumbing.
 *
 * Takes the text blocks the SQL and RAG agents produced (either may be absent)
 * and streams one grounded answer. On a short-circuit (no context) it answers
 * the general question directly. The route may override the system prompt for
 * the scheduling flow.
 */

import type { Message } from '../agent';
import { openai } from '../openai';

export async function aggregate(
	query: string,
	history: Message[],
	results: string,
	model = 'gpt-6-sol',
): Promise<string> {
	const response = await openai.responses.create({
		model,
		input: [
			{
				role: 'system',
				content: 'Summarize the information provided.',
			},
			{
				role: 'user',
				content: `
					<user-question>
					Original user query: ${query}
					</user-question>	

					<conversation-history>
					${history.map((h) => `${h.role}: ${h.content}`).join('\n')}
					</conversation-history>

					<retrieved-data>
					${results}
					</retrieved-data>

					Format your response as a markdown list.
				`,
			},
		],
	});

	return response.output_text;
}
