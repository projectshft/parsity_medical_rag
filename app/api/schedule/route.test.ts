/**
 * Spec for app/api/schedule/route.ts (human-in-the-loop scheduling).
 * No auth: the gate is the UI confirmation, not a login.
 * Run just this file: npx vitest run app/api/schedule/route.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/calendar', () => ({
  isCalConfigured: vi.fn(() => true),
  scheduleAppointment: vi.fn(async () => ({
    success: true,
    bookingId: 'bk_123',
    bookingUrl: 'https://cal.test/bk_123',
  })),
}));

vi.mock('@/lib/langsmith', () => ({
  traced: vi.fn(async (_name: string, fn: () => Promise<any>) => fn()),
}));

import { scheduleAppointment, isCalConfigured } from '@/lib/calendar';
import { POST } from './route';

beforeEach(() => {
  vi.mocked(scheduleAppointment).mockClear();
  vi.mocked(isCalConfigured).mockReturnValue(true);
});

function scheduleRequest(
  body: object = { patientName: 'Abe Frami', dateTime: '2026-07-10T14:00:00Z', notes: 'Follow-up' }
): Request {
  return new Request('http://localhost/api/schedule', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/schedule', () => {
  it('schedules an appointment (no auth required)', async () => {
    const res = await POST(scheduleRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.bookingId).toBe('bk_123');
    expect(scheduleAppointment).toHaveBeenCalledOnce();
  });

  it('returns 503 when Cal.com is not configured', async () => {
    vi.mocked(isCalConfigured).mockReturnValue(false);
    const res = await POST(scheduleRequest());
    expect(res.status).toBe(503);
    expect(scheduleAppointment).not.toHaveBeenCalled();
  });
});
