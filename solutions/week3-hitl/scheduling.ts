/**
 * Scheduling Intent Detection
 *
 * Detects when a user wants to schedule an appointment and extracts relevant info.
 * This is the LLM component of the human-in-the-loop pattern.
 */

import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { openai } from './openai';
import { traced } from './langsmith';
import type { Message } from './agent';

/**
 * Schema for scheduling intent detection
 *
 * TODO: Define the Zod schema for scheduling intent
 * Fields needed:
 * - isSchedulingRequest: boolean - Whether this is a scheduling request
 * - patientName: string | null - Name of the patient to schedule
 * - suggestedDate: string | null - Date in YYYY-MM-DD format
 * - suggestedTime: string | null - Time in HH:MM 24h format
 * - reason: string | null - Appointment reason if mentioned
 */
const SchedulingIntentSchema = z.object({
  isSchedulingRequest: z
    .boolean()
    .describe('Whether the user wants to schedule/book an appointment'),
  patientName: z
    .string()
    .nullable()
    .describe('Name of the patient to schedule (from the message or conversation history)'),
  suggestedDate: z
    .string()
    .nullable()
    .describe('Requested date in YYYY-MM-DD (resolve "tomorrow", "next Tuesday" from today)'),
  suggestedTime: z
    .string()
    .nullable()
    .describe('Requested time in HH:MM 24-hour format; null if not mentioned'),
  reason: z.string().nullable().describe('Reason for the appointment if mentioned'),
});

export type SchedulingIntent = z.infer<typeof SchedulingIntentSchema>;

/**
 * Analyze a query for scheduling intent
 *
 * TODO: Implement this function
 * 1. Use openai.responses.parse() with zodTextFormat
 * 2. System prompt should:
 *    - Explain the task (detect appointment scheduling requests)
 *    - Include today's date for relative date parsing
 *    - Explain how to parse "next Tuesday", "tomorrow", etc.
 *    - Default to 09:00 if no time specified
 * 3. Return parsed scheduling intent
 */
export async function detectSchedulingIntent(
  query: string,
  history: Message[] = [],
): Promise<SchedulingIntent> {
  const todayStr = new Date().toISOString().split('T')[0];
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  const response = await openai.responses.parse({
    model: 'gpt-4o-mini',
    input: [
      {
        role: 'system',
        content: `You analyze user queries to detect appointment scheduling requests.
Today is ${dayName}, ${todayStr}.

If the user wants to schedule/book an appointment:
- Set isSchedulingRequest to true
- Extract the patient name if given
- Resolve relative dates to YYYY-MM-DD from today's date: "tomorrow" = the next
  day, "next Tuesday" = the Tuesday of NEXT week, "Friday" = the coming Friday.
- Parse times to HH:MM 24-hour ("2pm" -> "14:00"); leave null if not mentioned.
- Extract the appointment reason if mentioned.

Use the conversation history to resolve references like "him", "her", or
"that patient" to the actual patient name.

If it is not a scheduling request, set isSchedulingRequest to false and all
other fields to null.`,
      },
      ...history.slice(-5),
      { role: 'user', content: query },
    ],
    temperature: 0,
    text: { format: zodTextFormat(SchedulingIntentSchema, 'scheduling_intent') },
  });

  return SchedulingIntentSchema.parse(response.output_parsed);
}

/**
 * Build the scheduling action object the UI card needs, or null if this isn't
 * a bookable request. The route sends this in the X-Scheduling-Action header.
 */
export function buildSchedulingAction(intent: SchedulingIntent) {
  if (!intent.isSchedulingRequest || !intent.patientName) {
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
