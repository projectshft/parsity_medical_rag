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

// Cal.com API v2. v1 was decommissioned. v2 differs from v1 in three ways:
//   - auth is an `Authorization: Bearer <key>` header (not a `?apiKey=` query param)
//   - every request must send a dated `cal-api-version` header
//   - responses are wrapped in `{ status, data }`
const CAL_API_BASE = 'https://api.cal.com/v2';
// Pin the API version per endpoint (Cal.com versions them by date).
const CAL_API_VERSION_BOOKINGS = '2024-08-13';
const CAL_API_VERSION_SLOTS = '2024-09-04';

export interface ScheduleRequest {
  patientName: string;
  patientEmail?: string;
  patientPhone?: string; // E.164; falls back to DEMO_PHONE_NUMBER
  dateTime: string; // ISO 8601 format
  notes?: string;
}

/** Cal.com wants E.164 (+15551234567). Add the leading + if missing. */
function toE164(phone: string): string {
  const trimmed = phone.trim();
  return trimmed.startsWith('+') ? trimmed : `+${trimmed.replace(/[^\d]/g, '')}`;
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
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // v2 requires `start` in UTC (ISO 8601). Normalize whatever we were given.
    const start = new Date(request.dateTime).toISOString();

    // phoneNumber is required when the event type has SMS reminders enabled.
    const rawPhone = request.patientPhone || process.env.DEMO_PHONE_NUMBER;

    const response = await fetch(`${CAL_API_BASE}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'cal-api-version': CAL_API_VERSION_BOOKINGS,
      },
      body: JSON.stringify({
        eventTypeId,
        start,
        attendee: {
          name: request.patientName,
          email: request.patientEmail || 'patient@example.com',
          timeZone,
          language: 'en',
          ...(rawPhone ? { phoneNumber: toE164(rawPhone) } : {}),
        },
        bookingFieldsResponses: {
          notes: request.notes || `Appointment for ${request.patientName}`,
        },
        metadata: {
          source: 'medical-rag',
          patientName: request.patientName,
        },
      }),
    });

    if (!response.ok) {
      // v2 errors: { status: "error", error: { message } }
      const err = await response.json().catch(() => ({}));
      return {
        success: false,
        error:
          err?.error?.message ||
          err?.message ||
          `Cal.com API error: ${response.status}`,
      };
    }

    // v2 wraps the payload: { status: "success", data: { id, uid, ... } }
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
 * Get available time slots for a date
 */
export async function getAvailableSlots(
  date: string // YYYY-MM-DD
): Promise<string[]> {
  try {
    const apiKey = getApiKey();
    const eventTypeId = getEventTypeId();

    const params = new URLSearchParams({
      eventTypeId: String(eventTypeId),
      start: date,
      end: date,
    });
    const response = await fetch(`${CAL_API_BASE}/slots?${params}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'cal-api-version': CAL_API_VERSION_SLOTS,
      },
    });

    if (!response.ok) {
      return [];
    }

    // v2: { status, data: { "YYYY-MM-DD": [{ start: "ISO" }, ...] } }
    const { data } = await response.json();
    return Object.values(data ?? {})
      .flat()
      .map((slot: any) => slot?.start)
      .filter(Boolean);
  } catch {
    return [];
  }
}
