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

  // TODO: Format opts.dateTime into a friendly string for {{appointment_time}}:
  //   new Date(opts.dateTime).toLocaleString('en-US',
  //     { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  //
  // TODO: Create a Retell client and place the call:
  //   const client = new Retell({ apiKey: process.env.RETELL_API_KEY! });
  //   const call = await client.call.createPhoneCall({
  //     from_number: process.env.RETELL_FROM_NUMBER!,
  //     to_number: to,
  //     override_agent_id: process.env.RETELL_AGENT_ID, // targets your deployed agent
  //     retell_llm_dynamic_variables: {
  //       patient_name: opts.patientName,
  //       appointment_time: /* your formatted string */,
  //     },
  //     metadata: { purpose: 'appointment_confirmation', patientName: opts.patientName },
  //   });
  //   return { called: true, callId: call.call_id, to };

  // Remove this once implemented:
  return { called: false, reason: 'TODO: implement callToConfirmAppointment in lib/retell.ts' };
}
