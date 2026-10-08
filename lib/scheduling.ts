/**
 * Scheduling Intent Detection
 *
 * Week 3 · YOUR TASK · assignment: docs/CHALLENGE-TOOL-CALLING.md
 *
 * Detects when a user wants to schedule an appointment and extracts relevant info.
 * This is the LLM component of the human-in-the-loop pattern.
 */

import type { Message } from './agent';

/**
 * TODO: Define a Zod schema for the scheduling intent and infer this type
 * from it (`z.infer<typeof SchedulingIntentSchema>`). Fields:
 * - patientName: string | null - Name of the patient to schedule
 * - suggestedDate: string | null - Date in YYYY-MM-DD format
 * - suggestedTime: string | null - Time in HH:MM 24h format
 * - reason: string | null - Appointment reason if mentioned
 */
export type SchedulingIntent = {
	patientName: string | null;
	suggestedDate: string | null;
	suggestedTime: string | null;
	reason: string | null;
};

/**
 * Analyze a query for scheduling intent
 *
 * TODO: Implement this function
 * 1. Use openai.responses.parse() with zodTextFormat (see CLAUDE.md)
 * 2. System prompt should:
 *    - Explain the task (detect appointment scheduling requests)
 *    - Include today's date for relative date parsing
 *    - Explain how to parse "next Tuesday", "tomorrow", etc.
 *    - Use the history to resolve "her" / "that patient" to a name
 * 3. Return the parsed scheduling intent
 */
export async function detectSchedulingIntent(
	query: string,
	history: Message[] = [],
): Promise<SchedulingIntent> {
	throw new Error('Not built yet — Week 3 (lib/scheduling.ts)');
}

/**
 * Build the scheduling action object the UI card needs, or null if this isn't
 * a bookable request. The route sends this in the X-Scheduling-Action header.
 */
export function buildSchedulingAction(intent: SchedulingIntent) {
	if (!intent.patientName) {
		return null;
	}
	return {
		type: 'scheduling_action' as const,
		patientName: intent.patientName,
		suggestedDate: intent.suggestedDate || getDefaultDate(),
		suggestedTime: intent.suggestedTime || '09:00',
		reason: intent.reason,
	};
}

/**
 * Get default date (next business day)
 */
export function getDefaultDate(): string {
	const date = new Date();
	date.setDate(date.getDate() + 1);

	// Skip weekends
	while (date.getDay() === 0 || date.getDay() === 6) {
		date.setDate(date.getDate() + 1);
	}

	return date.toISOString().split('T')[0];
}
