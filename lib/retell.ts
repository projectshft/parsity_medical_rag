/**
 * Retell AI — outbound appointment-confirmation call (EXTENSION / STUDENT STUB)
 *
 * After Cal.com books an appointment, place an automated voice call to confirm
 * the patient can attend — wiring a voice agent into an action flow.
 *
 * 👉 YOUR JOB: implement callToConfirmAppointment below, and deploy the agent it
 *    calls in scripts/retell/deploy-agent.ts. The schedule route already calls
 *    this function; until you finish it, the booking still succeeds and the call
 *    just no-ops. Reference: ../voice_ai/agents for the pattern and
 *    https://docs.retellai.com.
 *
 * Setup you'll need:
 * 1. Deploy an agent (npm run retell:deploy) whose prompt uses {{patient_name}}
 *    and {{appointment_time}}.
 * 2. A Retell phone number you own → RETELL_FROM_NUMBER.
 * 3. Env: RETELL_API_KEY, RETELL_FROM_NUMBER, RETELL_AGENT_ID.
 *    DEMO: set DEMO_PHONE_NUMBER to your own cell so it rings you, not a patient.
 */

// TODO: import Retell from 'retell-sdk';

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
 * Place the confirmation call. Best-effort by design — a call failure must not
 * break a successful booking, so this returns a result object and never throws.
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

  // TODO — build the message and place the call, then return the result:
  //   1. Turn opts.dateTime (ISO) into a human-friendly string for the agent's
  //      {{appointment_time}} variable.
  //   2. Create a Retell client (RETELL_API_KEY) and place an outbound phone
  //      call: from your Retell number, to `to`, running your deployed agent
  //      (RETELL_AGENT_ID), passing the dynamic variables its prompt expects
  //      (the patient name + the appointment time).
  //   3. Return { called: true, callId, to } on success.
  //   Look up the call method + parameters in the Retell SDK docs, and see
  //   ../voice_ai/agents for the shape.

  // Replace this once implemented:
  return { called: false, reason: 'TODO: implement callToConfirmAppointment in lib/retell.ts' };
}
