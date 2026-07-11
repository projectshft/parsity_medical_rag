/**
 * Appointment Scheduling API
 *
 * Human-in-the-loop endpoint: user confirms scheduling action from chat.
 */

import { NextResponse } from 'next/server';
import { scheduleAppointment, isCalConfigured } from '@/lib/calendar';
import { callToConfirmAppointment, isRetellConfigured } from '@/lib/retell';

export async function POST(request: Request) {
	try {
		// The gate here is the human-in-the-loop confirmation in the UI, not a
		// login — a scheduling card only posts after the user confirms it.
		const body = await request.json();
		const { patientName, dateTime, notes } = body;

		if (!isCalConfigured()) {
			return NextResponse.json(
				{
					error: 'Calendar integration not configured. Set CAL_API_KEY and CAL_EVENT_TYPE_ID.',
				},
				{ status: 503 },
			);
		}

		const result = await scheduleAppointment({
			patientName,
			dateTime,
			notes,
		});

		if (!result.success) {
			return NextResponse.json(
				{ error: result.error || 'Failed to schedule appointment' },
				{ status: 500 },
			);
		}

		// EXTENSION: after booking, place a Retell confirmation call. Best-effort
		// — a call failure must never undo a successful booking. (For the demo,
		// set DEMO_PHONE_NUMBER to ring your own phone right after booking.)
		let confirmationCall;
		if (isRetellConfigured()) {
			try {
				confirmationCall = await callToConfirmAppointment({ patientName, dateTime });
			} catch (err) {
				console.error('Confirmation call failed (non-blocking):', err);
				confirmationCall = { called: false, reason: 'call failed' };
			}
		}

		return NextResponse.json({
			success: true,
			message: `Appointment scheduled for ${patientName}`,
			bookingId: result.bookingId,
			bookingUrl: result.bookingUrl,
			confirmationCall,
		});
	} catch (error) {
		console.error('Schedule error:', error);
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: 'Internal server error',
			},
			{ status: 500 },
		);
	}
}
