/**
 * Scheduling Intent Detection
 *
 * Detects when a user wants to schedule an appointment and extracts relevant info.
 */

import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { openai } from './openai';
import { traced } from './langsmith';

const SchedulingIntentSchema = z.object({
	isSchedulingRequest: z
		.boolean()
		.describe('Whether this is a request to schedule an appointment'),
	patientName: z
		.string()
		.nullable()
		.describe('Name of the patient to schedule'),
	suggestedDate: z
		.string()
		.nullable()
		.describe('Suggested date in YYYY-MM-DD format'),
	suggestedTime: z
		.string()
		.nullable()
		.describe('Suggested time in HH:MM format (24h)'),
	reason: z
		.string()
		.nullable()
		.describe('Reason for the appointment if mentioned'),
});

export type SchedulingIntent = z.infer<typeof SchedulingIntentSchema>;

export interface ConversationMessage {
	role: 'user' | 'assistant';
	content: string;
}

/**
 * Analyze a query for scheduling intent, using conversation history for context
 */
export async function detectSchedulingIntent(
	query: string,
	conversationHistory: ConversationMessage[] = [],
): Promise<SchedulingIntent> {
	return traced(
		'detect_scheduling_intent',
		async () => {
			const today = new Date();
			const todayStr = today.toISOString().split('T')[0];

			// Build context from recent conversation (last 4 messages)
			const recentHistory = conversationHistory.slice(-4);
			const historyContext =
				recentHistory.length > 0
					? `\n\nRecent conversation:\n${recentHistory.map((m) => `${m.role}: ${m.content}`).join('\n')}`
					: '';

			const response = await openai.responses.parse({
				model: 'gpt-4o-mini',
				input: [
					{
						role: 'system',
						content: `You analyze user queries to detect appointment scheduling requests.
Today's date is ${todayStr}.

If the user wants to schedule/book an appointment:
- Set isSchedulingRequest to true
- Extract the patient name (look in conversation history if user says "him", "her", "them", "this patient", etc.)
- Parse relative dates (e.g., "next Monday", "tomorrow", "in 2 days") to YYYY-MM-DD
- Parse times to HH:MM 24-hour format (default to 09:00 if not specified)
- Extract appointment reason if mentioned

IMPORTANT: If the user confirms a scheduling request (e.g., "yes", "yeah", "do it", "schedule him"), look at the conversation history to find the patient name being discussed.

If not a scheduling request, set isSchedulingRequest to false and all other fields to null.`,
					},
					{
						role: 'user',
						content: `${historyContext}\n\nCurrent message: ${query}`,
					},
				],
				temperature: 0,
				text: {
					format: zodTextFormat(
						SchedulingIntentSchema,
						'scheduling_intent',
					),
				},
			});

			const result = SchedulingIntentSchema.parse(response.output_parsed);
			console.log('Scheduling intent detected:', result);
			return result;
		},
		{
			runType: 'chain',
			inputs: { query, historyLength: conversationHistory.length },
		},
	);
}

/**
 * Get default date (next business day)
 */
function getDefaultDate(): string {
	const date = new Date();
	date.setDate(date.getDate() + 1);

	// Skip weekends
	while (date.getDay() === 0 || date.getDay() === 6) {
		date.setDate(date.getDate() + 1);
	}

	return date.toISOString().split('T')[0];
}
