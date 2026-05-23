/**
 * Cal.com Integration
 *
 * Provides appointment scheduling via Cal.com API.
 * This is the "action" part of the human-in-the-loop pattern.
 *
 * Setup:
 * 1. Create account at https://cal.com
 * 2. Create an event type (e.g., "Patient Appointment")
 * 3. Get API key from Settings -> Developer -> API Keys
 * 4. Get event type ID from the URL when editing the event type
 * 5. Add to .env: CAL_API_KEY and CAL_EVENT_TYPE_ID
 */

const CAL_API_BASE = 'https://api.cal.com/v1';

export interface ScheduleRequest {
  patientName: string;
  dateTime: string; // ISO 8601 format
  patientEmail?: string;
  notes?: string | null;
}

export interface ScheduleResult {
  success: boolean;
  bookingId?: string;
  bookingUrl?: string;
  error?: string;
}

/**
 * Check if Cal.com is configured
 */
export function isCalConfigured(): boolean {
  return Boolean(process.env.CAL_API_KEY && process.env.CAL_EVENT_TYPE_ID);
}

/**
 * Schedule an appointment via Cal.com API
 *
 * TODO: Implement this function
 * 1. Check if Cal.com is configured
 * 2. Make POST request to Cal.com bookings API
 *    - Endpoint: ${CAL_API_BASE}/bookings?apiKey=${apiKey}
 *    - Body: { eventTypeId, start, responses: { name, email }, metadata }
 * 3. Handle response and errors appropriately
 * 4. Return ScheduleResult with booking details
 *
 * Cal.com API docs: https://cal.com/docs/api-reference/v1/bookings
 */
export async function scheduleAppointment(
  request: ScheduleRequest
): Promise<ScheduleResult> {
  // TODO: Implement Cal.com booking API call

  if (!isCalConfigured()) {
    return {
      success: false,
      error: 'Cal.com is not configured. Set CAL_API_KEY and CAL_EVENT_TYPE_ID.',
    };
  }

  // TODO: Make the API call to Cal.com
  // const apiKey = process.env.CAL_API_KEY;
  // const eventTypeId = parseInt(process.env.CAL_EVENT_TYPE_ID || '0', 10);

  return {
    success: false,
    error: 'Not implemented - your turn!',
  };
}

/**
 * Cancel an appointment
 *
 * TODO (Extension): Implement appointment cancellation
 */
export async function cancelAppointment(bookingId: string): Promise<ScheduleResult> {
  // TODO: Implement cancellation via Cal.com API
  return {
    success: false,
    error: 'Not implemented',
  };
}

/**
 * Reschedule an appointment
 *
 * TODO (Extension): Implement appointment rescheduling
 */
export async function rescheduleAppointment(
  bookingId: string,
  newDateTime: string
): Promise<ScheduleResult> {
  // TODO: Implement rescheduling via Cal.com API
  return {
    success: false,
    error: 'Not implemented',
  };
}
