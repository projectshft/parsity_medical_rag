/**
 * Deploy the appointment-reminder Retell agent (STUDENT STUB).
 *
 *   npm run retell:deploy
 *
 * 👉 YOUR JOB: create a Retell LLM (a prompt) and an agent that points at it,
 *    so the call placed by lib/retell.ts has an agent to run. Make it
 *    update-in-place by name so re-running doesn't create duplicates.
 *
 * Reference: ../voice_ai/agents (the pattern is llm.create -> agent.create) and
 * https://docs.retellai.com. Needs RETELL_API_KEY.
 */

import 'dotenv/config';
// TODO: import Retell from 'retell-sdk';

async function main() {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) {
    console.error('RETELL_API_KEY is not set. Add it to .env.');
    process.exit(1);
  }

  // TODO 1: const client = new Retell({ apiKey });
  //
  // TODO 2: Create the LLM — the appointment-reminder prompt + an end_call tool:
  //   const llm = await client.llm.create({
  //     model: 'gpt-4.1',
  //     general_prompt: `Greet {{patient_name}}, state their appointment is
  //       {{appointment_time}}, ask if they can make it, thank them, end the call.`,
  //     general_tools: [{ type: 'end_call', name: 'end_call', description: 'End when done.' }],
  //   });
  //
  // TODO 3: Create the agent pointing at the LLM:
  //   const agent = await client.agent.create({
  //     agent_name: 'Appointment Reminder',
  //     voice_id: 'cartesia-Andrew',
  //     language: 'en-US',
  //     response_engine: { type: 'retell-llm', llm_id: llm.llm_id },
  //   });
  //
  // TODO 4: console.log(agent.agent_id) → put it in .env as RETELL_AGENT_ID.
  //
  // BONUS: look up an existing agent by name first (client.agent.list()) and
  //        update() instead of create() so re-runs don't make duplicates.

  console.log('TODO: implement the Retell agent deploy. See lib/retell.ts and ../voice_ai/agents.');
}

main().catch((err) => {
  console.error('Deploy failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
