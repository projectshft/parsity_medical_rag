/**
 * Cal.com API Client
 *
 * Integrates with Cal.com for patient appointment scheduling.
 *
 * Setup:
 * 1. Create account at https://cal.com
 * 2. Go to Settings → Developer → API Keys
 * 3. Create new API key
 * 4. Add to .env: CAL_API_KEY=your-key
 * 5. Get your event type ID from Cal.com dashboard
 */

const CAL_API_BASE = 'https://api.cal.com/v1';

export interface ScheduleRequest {
  patientName: string;
  patientEmail?: string;
  dateTime: string; // ISO 8601 format
  notes?: string;
}

export interface ScheduleResult {
  success: boolean;
  bookingId?: string;
  bookingUrl?: string;
  error?: string;
}

/**
 * Get Cal.com API key from environment
 */
function getApiKey(): string {
  const key = process.env.CAL_API_KEY;
  if (!key) {
    throw new Error('CAL_API_KEY not configured');
  }
  return key;
}

/**
 * Get default event type ID
 */
function getEventTypeId(): number {
  const id = process.env.CAL_EVENT_TYPE_ID;
  if (!id) {
    throw new Error('CAL_EVENT_TYPE_ID not configured');
  }
  return parseInt(id, 10);
}

/**
 * Check if Cal.com is configured
 */
export function isCalConfigured(): boolean {
  return Boolean(process.env.CAL_API_KEY && process.env.CAL_EVENT_TYPE_ID);
}

/**
 * Schedule an appointment via Cal.com
 */
export async function scheduleAppointment(
  request: ScheduleRequest
): Promise<ScheduleResult> {
  try {
    const apiKey = getApiKey();
    const eventTypeId = getEventTypeId();

    // Cal.com booking API
    const response = await fetch(`${CAL_API_BASE}/bookings?apiKey=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventTypeId,
        start: request.dateTime,
        responses: {
          name: request.patientName,
          email: request.patientEmail || 'patient@example.com',
          notes: request.notes || `Appointment for ${request.patientName}`,
        },
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: 'en',
        metadata: {
          source: 'medical-rag',
          patientName: request.patientName,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.message || `Cal.com API error: ${response.status}`,
      };
    }

    const booking = await response.json();

    return {
      success: true,
      bookingId: booking.id?.toString(),
      bookingUrl: booking.bookingUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get available time slots for a date
 */
export async function getAvailableSlots(
  date: string // YYYY-MM-DD
): Promise<string[]> {
  try {
    const apiKey = getApiKey();
    const eventTypeId = getEventTypeId();

    const response = await fetch(
      `${CAL_API_BASE}/availability?apiKey=${apiKey}&eventTypeId=${eventTypeId}&dateFrom=${date}&dateTo=${date}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.slots || [];
  } catch {
    return [];
  }
}
