import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createPhoneCall } = vi.hoisted(() => ({ createPhoneCall: vi.fn() }));
vi.mock('retell-sdk', () => ({
	default: class {
		call = { createPhoneCall };
	},
}));

import { callToConfirmAppointment, speakableTime } from './retell';

const env = { RETELL_API_KEY: 'key', RETELL_FROM_NUMBER: '+15550000000', RETELL_AGENT_ID: 'agent_1', DEMO_PHONE_NUMBER: '+15551112222' };

beforeEach(() => {
	createPhoneCall.mockReset();
	for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
});
afterEach(() => vi.unstubAllEnvs());

describe('callToConfirmAppointment', () => {
	it('calls the demo phone with the patient name and a speakable time', async () => {
		createPhoneCall.mockResolvedValueOnce({ call_id: 'call_1' });

		const result = await callToConfirmAppointment({ patientName: 'Avery Mueller', dateTime: '2026-11-03T14:00:00' });

		expect(result).toEqual({ called: true, callId: 'call_1', to: env.DEMO_PHONE_NUMBER });
		expect(createPhoneCall).toHaveBeenCalledWith(
			expect.objectContaining({
				from_number: env.RETELL_FROM_NUMBER,
				to_number: env.DEMO_PHONE_NUMBER,
				override_agent_id: env.RETELL_AGENT_ID,
				retell_llm_dynamic_variables: { patient_name: 'Avery Mueller', appointment_time: 'Tuesday, November 3 at 2:00 PM' },
			}),
		);
	});

	it('never calls anyone when DEMO_PHONE_NUMBER is missing', async () => {
		vi.stubEnv('DEMO_PHONE_NUMBER', '');
		const result = await callToConfirmAppointment({ patientName: 'A', dateTime: '2026-11-03T14:00' });
		expect(result.called).toBe(false);
		expect(createPhoneCall).not.toHaveBeenCalled();
	});

	it('skips quietly when Retell is not configured', async () => {
		vi.stubEnv('RETELL_API_KEY', '');
		expect((await callToConfirmAppointment({ patientName: 'A', dateTime: '2026-11-03T14:00' })).called).toBe(false);
	});

	it('returns a failure instead of throwing, so a booking still succeeds', async () => {
		createPhoneCall.mockRejectedValueOnce(new Error('insufficient credit'));
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(await callToConfirmAppointment({ patientName: 'A', dateTime: '2026-11-03T14:00' })).toEqual({
			called: false,
			reason: 'insufficient credit',
		});
		error.mockRestore();
	});
});

it('formats times the way a person would say them', () => {
	expect(speakableTime('2026-11-03T09:05')).toBe('Tuesday, November 3 at 9:05 AM');
});
