/**
 * Cal.com Integration
 *
 * Week 3. Prove a booking works with STATIC test data before you wire the
 * agent to it — cohort 3 lost an hour to a v1-vs-v2 API mismatch that had
 * nothing to do with the LLM.
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
 *    Optional: CAL_TIMEZONE (default America/Los_Angeles), CAL_ATTENDEE_EMAIL
 */

const CAL_API_BASE = 'https://api.cal.com/v2';
// Cal.com versions its API by header. Without this it silently falls back to an
// older request shape, which is the v1-vs-v2 trap from cohort 3.
const CAL_API_VERSION = '2026-02-25';
// The card's date/time has no timezone; this is the clinic's local time.
const CLINIC_TIMEZONE = process.env.CAL_TIMEZONE || 'America/Los_Angeles';

export interface ScheduleRequest {
  patientName: string;
  dateTime: string; // local clinic time, e.g. 2026-11-03T14:00:00
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
 * "2026-11-03T14:00" in America/Los_Angeles -> "2026-11-03T22:00:00.000Z".
 * Cal.com wants UTC; the user picked a wall-clock time at the clinic.
 */
export function clinicTimeToUtc(local: string, timeZone = CLINIC_TIMEZONE): string {
  const [date, time = '09:00'] = local.replace('Z', '').split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const asIfUtc = Date.UTC(y, m - 1, d, hh, mm);
  // How far is that zone from UTC at this moment? Format the instant in the zone
  // and compare. (Run twice so a DST change between the two guesses settles.)
  const offset = (instant: number) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      }).formatToParts(instant).map((x) => [x.type, x.value]),
    );
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - instant;
  };
  let utc = asIfUtc - offset(asIfUtc);
  utc = asIfUtc - offset(utc);
  return new Date(utc).toISOString();
}

/**
 * Book an appointment with the Cal.com v2 API.
 * Docs: https://cal.com/docs/api-reference/v2/bookings/create-a-booking
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
    const res = await fetch(`${CAL_API_BASE}/bookings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.CAL_API_KEY}`,
        'cal-api-version': CAL_API_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        start: clinicTimeToUtc(request.dateTime),
        eventTypeId: Number(process.env.CAL_EVENT_TYPE_ID),
        attendee: {
          name: request.patientName,
          // Cal.com emails the attendee. Synthetic patients have no inbox, so use
          // your own address (CAL_ATTENDEE_EMAIL) for the demo.
          email: request.patientEmail || process.env.CAL_ATTENDEE_EMAIL || 'patient@example.com',
          timeZone: CLINIC_TIMEZONE,
        },
        metadata: request.notes ? { reason: request.notes.slice(0, 500) } : {},
      }),
    });

    const body = await res.json().catch(() => null);
    if (!res.ok || body?.status !== 'success') {
      // Cal.com's message is the useful part ("no available users", "booking in the past"...).
      const message = body?.error?.message ?? body?.message ?? `HTTP ${res.status}`;
      return { success: false, error: `Cal.com: ${message}` };
    }

    return {
      success: true,
      bookingId: String(body.data.id),
      bookingUrl: `https://app.cal.com/booking/${body.data.uid}`,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Cal.com request failed' };
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
