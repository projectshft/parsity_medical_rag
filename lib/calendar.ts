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

// Cal.com API v2 (v1 is decommissioned): Bearer auth header, a dated
// `cal-api-version` header on every request, responses wrapped in { status, data }.
const CAL_API_BASE = 'https://api.cal.com/v2';
const CAL_API_VERSION_BOOKINGS = '2024-08-13';

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
 */
export async function scheduleAppointment(
  request: ScheduleRequest
): Promise<ScheduleResult> {
  if (!isCalConfigured()) {
    return {
      success: false,
      error: 'Cal.com is not configured. Set CAL_API_KEY and CAL_EVENT_TYPE_ID.',
    };
  }

  try {
    const response = await fetch(`${CAL_API_BASE}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.CAL_API_KEY}`,
        'cal-api-version': CAL_API_VERSION_BOOKINGS,
      },
      body: JSON.stringify({
        eventTypeId: parseInt(process.env.CAL_EVENT_TYPE_ID!, 10),
        start: new Date(request.dateTime).toISOString(), // v2 wants UTC
        attendee: {
          name: request.patientName,
          email: request.patientEmail || process.env.DEMO_EMAIL || 'patient@example.com',
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: 'en',
          // Required when the event type has SMS reminders on. Must be E.164 (+15551234567).
          ...(process.env.DEMO_PHONE_NUMBER
            ? { phoneNumber: process.env.DEMO_PHONE_NUMBER }
            : {}),
        },
        bookingFieldsResponses: {
          notes: request.notes || `Appointment for ${request.patientName}`,
        },
        metadata: { source: 'medical-rag', patientName: request.patientName },
      }),
    });

    if (!response.ok) {
      // v2 errors: { status: "error", error: { message } }
      const err = await response.json().catch(() => ({}));
      return {
        success: false,
        error: err?.error?.message || err?.message || `Cal.com API error: ${response.status}`,
      };
    }

    const { data } = await response.json();
    return {
      success: true,
      bookingId: (data?.id ?? data?.uid)?.toString(),
      bookingUrl: data?.uid ? `https://app.cal.com/booking/${data.uid}` : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
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
