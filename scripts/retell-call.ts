/**
 * Place one confirmation call directly — no chat, no Cal.com booking.
 *
 *   npm run retell:call -- "Avery Mueller" 2026-11-03T14:00
 *
 * The same function the schedule route calls after a booking, run on its own.
 * Handy in class: prove the phone rings before showing the full flow
 * (chat → confirm card → Cal.com → call).
 *
 * Rings DEMO_PHONE_NUMBER, never a patient. Needs: RETELL_API_KEY,
 * RETELL_FROM_NUMBER, RETELL_AGENT_ID, DEMO_PHONE_NUMBER.
 */

import 'dotenv/config';
import { callToConfirmAppointment, speakableTime } from '../lib/retell';

async function main() {
	const [patientName = 'Avery Mueller', dateTime = '2026-11-03T14:00'] = process.argv.slice(2);

	console.log(`Calling ${process.env.DEMO_PHONE_NUMBER ?? '(no DEMO_PHONE_NUMBER)'} about`);
	console.log(`  ${patientName}, ${speakableTime(dateTime)}\n`);

	const result = await callToConfirmAppointment({ patientName, dateTime });
	console.log(result);
	if (!result.called) process.exit(1);
}

main();
