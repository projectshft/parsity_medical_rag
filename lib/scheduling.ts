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
  isSchedulingRequest: z.boolean().describe('Whether this is a request to schedule an appointment'),
  patientName: z.string().nullable().describe('Name of the patient to schedule'),
  suggestedDate: z.string().nullable().describe('Suggested date in YYYY-MM-DD format'),
  suggestedTime: z.string().nullable().describe('Suggested time in HH:MM format (24h)'),
  reason: z.string().nullable().describe('Reason for the appointment if mentioned'),
});

export type SchedulingIntent = z.infer<typeof SchedulingIntentSchema>;

/**
 * Analyze a query for scheduling intent
 */
export async function detectSchedulingIntent(query: string): Promise<SchedulingIntent> {
  return traced(
    'detect_scheduling_intent',
    async () => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      const response = await openai.responses.parse({
        model: 'gpt-4o-mini',
        input: [
          {
            role: 'system',
            content: `You analyze user queries to detect appointment scheduling requests.
Today's date is ${todayStr}.

If the user wants to schedule/book an appointment:
- Set isSchedulingRequest to true
- Extract the patient name
- Parse relative dates (e.g., "next Tuesday", "tomorrow", "in 2 days") to YYYY-MM-DD
- Parse times to HH:MM 24-hour format (default to 09:00 if not specified)
- Extract appointment reason if mentioned

If not a scheduling request, set isSchedulingRequest to false and all other fields to null.`,
          },
          {
            role: 'user',
            content: query,
          },
        ],
        temperature: 0,
        text: {
          format: zodTextFormat(SchedulingIntentSchema, 'scheduling_intent'),
        },
      });

      return SchedulingIntentSchema.parse(response.output_parsed);
    },
    { runType: 'chain', inputs: { query } }
  );
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
