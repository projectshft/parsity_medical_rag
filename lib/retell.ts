/**
 * Retell AI — outbound appointment-confirmation call (EXTENSION)
 *
 * ⭐ Bonus, optional, costs a few dollars of Retell credit. Nothing depends on it:
 * with no Retell env vars the schedule route skips this and booking works as before.
 *
 * After Cal.com books an appointment, an AI voice agent phones to confirm the
 * patient can make it. Same human-in-the-loop shape as the booking itself: the
 * call only happens AFTER a person clicked "confirm" on the scheduling card.
 *
 * Setup (once):
 *   1. RETELL_API_KEY from the Retell dashboard, and a Retell phone number you
 *      bought there → RETELL_FROM_NUMBER (E.164, e.g. +15551234567).
 *   2. `npm run retell:setup` creates the voice agent and prints RETELL_AGENT_ID.
 *   3. DEMO_PHONE_NUMBER = your own cell. The call ALWAYS goes there.
 *
 * Try it without booking anything: `npm run retell:call -- "Avery Mueller" 2026-11-03T14:00`
 */

import Retell from 'retell-sdk';

export function isRetellConfigured(): boolean {
	return Boolean(process.env.RETELL_API_KEY && process.env.RETELL_FROM_NUMBER);
}

export interface ConfirmationCallResult {
	called: boolean;
	callId?: string;
	to?: string;
	reason?: string;
}

/**
 * "2026-11-03T14:00:00" → "Tuesday, November 3 at 2:00 PM".
 *
 * The voice agent reads this out loud, so it has to sound like a person said it.
 * The booking time has no timezone (it's what the user picked on the card), so
 * format it as-is in UTC rather than letting the server's timezone shift it.
 */
export function speakableTime(dateTime: string): string {
	const [date, time = '09:00'] = dateTime.split('T');
	const [y, m, d] = date.split('-').map(Number);
	const [hh, mm] = time.split(':').map(Number);
	const when = new Date(Date.UTC(y, m - 1, d, hh, mm));
	const day = when.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
	const clock = when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
	return `${day} at ${clock}`;
}

/**
 * Place the confirmation call. Best-effort by design — a call failure must not
 * break a successful booking, so this returns a result object and never throws.
 */
export async function callToConfirmAppointment(opts: {
	patientName: string;
	dateTime: string; // ISO 8601, e.g. 2026-11-03T14:00:00
}): Promise<ConfirmationCallResult> {
	if (!isRetellConfigured()) {
		return { called: false, reason: 'Retell not configured (RETELL_API_KEY / RETELL_FROM_NUMBER)' };
	}

	// Only ever your own phone. The patients are synthetic, but their phone
	// numbers look real, and some of them ARE real numbers belonging to strangers.
	const to = process.env.DEMO_PHONE_NUMBER;
	if (!to) {
		return { called: false, reason: 'set DEMO_PHONE_NUMBER to your own cell (E.164)' };
	}
	const agentId = process.env.RETELL_AGENT_ID;
	if (!agentId) {
		return { called: false, reason: 'set RETELL_AGENT_ID (run `npm run retell:setup`)' };
	}

	try {
		const retell = new Retell({ apiKey: process.env.RETELL_API_KEY! });
		const call = await retell.call.createPhoneCall({
			from_number: process.env.RETELL_FROM_NUMBER!,
			to_number: to,
			override_agent_id: agentId,
			// Fills {{patient_name}} and {{appointment_time}} in the agent's prompt.
			// This is the whole integration: our app decides WHAT to say, the voice
			// agent decides HOW to say it.
			retell_llm_dynamic_variables: {
				patient_name: opts.patientName,
				appointment_time: speakableTime(opts.dateTime),
			},
			metadata: { source: 'medical-rag-scheduler' },
		});
		return { called: true, callId: call.call_id, to };
	} catch (err) {
		console.error('Retell call failed:', err);
		return { called: false, reason: err instanceof Error ? err.message : 'Retell call failed' };
	}
}
