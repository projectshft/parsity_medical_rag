/**
 * Retell AI — outbound appointment-confirmation call (EXTENSION / demo)
 *
 * After Cal.com books an appointment, place an automated voice call to confirm
 * the patient can attend. This is a teaching example of wiring a voice agent
 * into an action flow.
 *
 * Setup (in the Retell dashboard):
 * 1. Create an agent whose prompt uses the dynamic variables {{patient_name}}
 *    and {{appointment_time}} (e.g. "Hi {{patient_name}}, this is the clinic
 *    confirming your appointment on {{appointment_time}} — can you make it?").
 * 2. Buy a phone number and assign it to that agent.
 * 3. Set env: RETELL_API_KEY, RETELL_FROM_NUMBER (the number you bought).
 *
 * DEMO: set DEMO_PHONE_NUMBER to your own phone — the call goes there instead
 * of the (synthetic) patient's number, so it rings live in front of the class.
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
 * Place the confirmation call. Best-effort by design — the caller should not
 * let a call failure break a successful booking.
 */
export async function callToConfirmAppointment(opts: {
  patientName: string;
  dateTime: string; // ISO 8601
  phone?: string | null; // the patient's real number (used only if no DEMO override)
}): Promise<ConfirmationCallResult> {
  if (!isRetellConfigured()) {
    return { called: false, reason: 'Retell not configured (RETELL_API_KEY / RETELL_FROM_NUMBER)' };
  }

  // For the demo, ring your own phone; in a real deployment, the patient's.
  const to = process.env.DEMO_PHONE_NUMBER || opts.phone;
  if (!to) {
    return { called: false, reason: 'no destination phone (set DEMO_PHONE_NUMBER or pass a patient phone)' };
  }

  const client = new Retell({ apiKey: process.env.RETELL_API_KEY! });

  const appointmentTime = new Date(opts.dateTime).toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const call = await client.call.createPhoneCall({
    from_number: process.env.RETELL_FROM_NUMBER!,
    to_number: to,
    // Target the appointment-reminder agent directly (deploy it with
    // scripts/retell/deploy-agent.ts). With this set, the from_number does
    // not need an outbound agent bound in the dashboard.
    ...(process.env.RETELL_AGENT_ID
      ? { override_agent_id: process.env.RETELL_AGENT_ID }
      : {}),
    // Injected into the agent's prompt as {{patient_name}} / {{appointment_time}}
    retell_llm_dynamic_variables: {
      patient_name: opts.patientName,
      appointment_time: appointmentTime,
    },
    metadata: { purpose: 'appointment_confirmation', patientName: opts.patientName },
  });

  return { called: true, callId: call.call_id, to };
}
