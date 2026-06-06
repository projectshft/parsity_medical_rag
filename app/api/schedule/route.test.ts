/**
 * HOMEWORK SPEC — add auth to app/api/schedule/route.ts to make these pass
 * Run just this file: npx vitest run app/api/schedule/route.test.ts
 *
 * Role rules: STAFF make appointments; DOCTORS do not.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

vi.mock('@/lib/calendar', () => ({
  isCalConfigured: vi.fn(() => true),
  scheduleAppointment: vi.fn(async () => ({
    success: true,
    bookingId: 'bk_123',
    bookingUrl: 'https://cal.test/bk_123',
  })),
}));

vi.mock('@/lib/langsmith', () => ({
  // Pass-through: just run the traced function
  traced: vi.fn(async (_name: string, fn: () => Promise<any>) => fn()),
}));

import { scheduleAppointment } from '@/lib/calendar';
import { createSessionToken, SESSION_COOKIE, Role } from '@/lib/auth';
import { POST } from './route';

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-do-not-use-in-prod';
});

beforeEach(() => {
  vi.mocked(scheduleAppointment).mockClear();
});

async function scheduleRequest(role?: Role): Promise<Request> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (role) {
    const token = await createSessionToken({ userId: `u-${role.toLowerCase()}`, role });
    headers.cookie = `${SESSION_COOKIE}=${token}`;
  }
  return new Request('http://localhost/api/schedule', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      patientName: 'Abe Frami',
      dateTime: '2026-06-10T14:00:00Z',
      notes: 'Follow-up visit',
    }),
  });
}

describe('POST /api/schedule', () => {
  it('rejects unauthenticated requests with 401 and never calls the calendar', async () => {
    const response = await POST(await scheduleRequest());
    expect(response.status).toBe(401);
    expect(scheduleAppointment).not.toHaveBeenCalled();
  });

  it('rejects DOCTOR with 403 — doctors do not make appointments', async () => {
    const response = await POST(await scheduleRequest('DOCTOR'));
    expect(response.status).toBe(403);
    expect(scheduleAppointment).not.toHaveBeenCalled();
  });

  it('allows STAFF to schedule an appointment', async () => {
    const response = await POST(await scheduleRequest('STAFF'));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({ success: true, bookingId: 'bk_123' });
    expect(scheduleAppointment).toHaveBeenCalledOnce();
  });
});
