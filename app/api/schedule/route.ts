/**
 * Appointment Scheduling API
 *
 * Human-in-the-loop endpoint: user confirms scheduling action from chat.
 */

import { NextResponse } from 'next/server';
import { scheduleAppointment, isCalConfigured } from '@/lib/calendar';
import { traced } from '@/lib/langsmith';
import { requireAuth, AuthError } from '@/lib/auth';

export async function POST(request: Request) {
	try {
		// INSTRUCTOR SOLUTION: only STAFF schedule appointments (docs/CHALLENGE-RBAC.md)
		await requireAuth(request, ['STAFF']);

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

		// Trace the scheduling action in LangSmith
		const result = await traced(
			'schedule_appointment',
			async () => {
				return scheduleAppointment({
					patientName,
					dateTime,
					notes,
				});
			},
			{
				runType: 'tool',
				inputs: { patientName, dateTime, notes },
				metadata: { action: 'human_confirmed_scheduling' },
			},
		);

		if (!result.success) {
			return NextResponse.json(
				{ error: result.error || 'Failed to schedule appointment' },
				{ status: 500 },
			);
		}

		return NextResponse.json({
			success: true,
			message: `Appointment scheduled for ${patientName}`,
			bookingId: result.bookingId,
			bookingUrl: result.bookingUrl,
		});
	} catch (error) {
		if (error instanceof AuthError) {
			return NextResponse.json({ error: error.message }, { status: error.status });
		}
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
