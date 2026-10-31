import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clinicTimeToUtc, scheduleAppointment } from './calendar';

const fetchMock = vi.fn();

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
	vi.stubEnv('CAL_API_KEY', 'cal_test');
	vi.stubEnv('CAL_EVENT_TYPE_ID', '123');
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

describe('clinicTimeToUtc', () => {
	it('converts clinic wall-clock time to UTC, across daylight saving', () => {
		expect(clinicTimeToUtc('2026-11-03T14:00', 'America/Los_Angeles')).toBe('2026-11-03T22:00:00.000Z'); // PST
		expect(clinicTimeToUtc('2026-07-10T14:00:00', 'America/Los_Angeles')).toBe('2026-07-10T21:00:00.000Z'); // PDT
		expect(clinicTimeToUtc('2026-11-03T14:00', 'UTC')).toBe('2026-11-03T14:00:00.000Z');
	});
});

describe('scheduleAppointment', () => {
	it('posts a v2 booking and returns its id', async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ status: 'success', data: { id: 99, uid: 'abc' } }), { status: 201 }),
		);

		const result = await scheduleAppointment({ patientName: 'Avery Mueller', dateTime: '2026-11-03T14:00:00', notes: 'Follow-up' });

		expect(result).toEqual({ success: true, bookingId: '99', bookingUrl: 'https://app.cal.com/booking/abc' });
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('https://api.cal.com/v2/bookings');
		expect(init.headers).toMatchObject({ Authorization: 'Bearer cal_test', 'cal-api-version': '2026-02-25' });
		expect(JSON.parse(init.body)).toMatchObject({
			eventTypeId: 123,
			start: '2026-11-03T22:00:00.000Z',
			attendee: { name: 'Avery Mueller', timeZone: 'America/Los_Angeles' },
			metadata: { reason: 'Follow-up' },
		});
	});

	it("surfaces Cal.com's error message", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ status: 'error', error: { message: 'User either already has booking at this time or is not available' } }), { status: 400 }),
		);
		const result = await scheduleAppointment({ patientName: 'A', dateTime: '2026-11-03T14:00' });
		expect(result).toEqual({ success: false, error: 'Cal.com: User either already has booking at this time or is not available' });
	});

	it('does not call Cal.com when it is not configured', async () => {
		vi.stubEnv('CAL_API_KEY', '');
		expect((await scheduleAppointment({ patientName: 'A', dateTime: '2026-11-03T14:00' })).success).toBe(false);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
