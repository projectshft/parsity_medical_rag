/**
 * Book one appointment with static data — no chat, no LLM.
 *
 *   npm run cal:book -- "Avery Mueller" 2026-11-03T14:00
 *
 * Prove Cal.com works on its own before wiring the agent to it. Pick a time
 * your event type actually has free, or Cal.com will (correctly) refuse it.
 * Then cancel the test booking in the Cal.com dashboard.
 */

import 'dotenv/config';
import { scheduleAppointment, clinicTimeToUtc } from '../lib/calendar';

async function main() {
	const [patientName = 'Avery Mueller', dateTime = '2026-11-03T14:00'] = process.argv.slice(2);
	console.log(`Booking ${patientName} at ${dateTime} clinic time (${clinicTimeToUtc(dateTime)} UTC)\n`);
	const result = await scheduleAppointment({ patientName, dateTime, notes: 'Test booking from scripts/cal-book.ts' });
	console.log(result);
	if (!result.success) process.exit(1);
}

main();
