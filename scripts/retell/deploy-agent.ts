/**
 * Deploy the appointment-reminder Retell agent (STUDENT STUB).
 *
 *   npm run retell:deploy
 *
 * 👉 YOUR JOB: create a Retell "LLM" (a prompt) and an agent that runs it, so
 *    the call placed by lib/retell.ts has an agent to speak. Make it
 *    update-in-place by name so re-running doesn't create duplicates.
 *
 * Reference: ../voice_ai/agents and https://docs.retellai.com. Needs RETELL_API_KEY.
 */

import 'dotenv/config';
// TODO: import the Retell SDK.

async function main() {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) {
    console.error('RETELL_API_KEY is not set. Add it to .env.');
    process.exit(1);
  }

  // TODO — deploy the agent, in this shape:
  //   1. Create a Retell client from the API key.
  //   2. Create an "LLM": a single prompt that greets {{patient_name}}, states
  //      {{appointment_time}}, asks if they can make it, and ends the call.
  //      (Give it the ability to hang up when it's done.)
  //   3. Create an agent that runs that LLM — pick a voice and language.
  //   4. Print the agent id and put it in .env as RETELL_AGENT_ID.
  //   BONUS: find an existing agent by name and UPDATE it, so re-running the
  //          script doesn't create duplicates.
  //   Look up the exact client methods + params in the Retell SDK docs and
  //   see how ../voice_ai/agents wires the LLM and agent together.

  console.log('TODO: implement the Retell agent deploy. See lib/retell.ts and ../voice_ai/agents.');
}

main().catch((err) => {
  console.error('Deploy failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
