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
  // TODO: Define schema fields with descriptions
  isSchedulingRequest: z.boolean(),
  patientName: z.string().nullable(),
  suggestedDate: z.string().nullable(),
  suggestedTime: z.string().nullable(),
  reason: z.string().nullable(),
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
 * 4. Wrap in traced() for LangSmith observability
 */
export async function detectSchedulingIntent(query: string): Promise<SchedulingIntent> {
  // TODO: Implement intent detection with structured outputs
  // For now, return a non-scheduling response
  return {
    isSchedulingRequest: false,
    patientName: null,
    suggestedDate: null,
    suggestedTime: null,
    reason: null,
  };
}

/**
 * Format a scheduling action for the UI
 * Returns a special JSON block that the frontend can parse
 */
export function formatSchedulingAction(intent: SchedulingIntent): string {
  if (!intent.isSchedulingRequest || !intent.patientName) {
    return '';
  }

  const action = {
    type: 'scheduling_action',
    patientName: intent.patientName,
    suggestedDate: intent.suggestedDate || getDefaultDate(),
    suggestedTime: intent.suggestedTime || '09:00',
    reason: intent.reason,
  };

  return `\n\n<!-- SCHEDULING_ACTION ${JSON.stringify(action)} -->`;
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
