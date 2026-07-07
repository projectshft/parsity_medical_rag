/**
 * Deploy the appointment-reminder Retell agent.
 *
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/retell/deploy-agent.ts
 *   (or: npm run retell:deploy)
 *
 * Mirrors the voice_ai deploy pattern (../voice_ai/agents): create a Retell
 * LLM (a single prompt), then an agent that points at it. Runs update-in-place
 * by agent name, so re-running just updates the prompt/config — never creates
 * duplicates.
 *
 * The agent's whole job: call a patient and confirm an upcoming appointment.
 * It reads {{patient_name}} and {{appointment_time}} — the same dynamic
 * variables lib/retell.ts injects on each call.
 *
 * After it prints the agent id, put it in .env as RETELL_AGENT_ID so
 * lib/retell.ts calls with override_agent_id (no dashboard binding needed).
 *
 * Needs: RETELL_API_KEY.
 */

import 'dotenv/config';
import Retell from 'retell-sdk';

const AGENT_NAME = 'Appointment Reminder';
const MODEL = 'gpt-4.1';

const PROMPT = `You are a warm, efficient scheduling assistant calling on behalf of the medical clinic to confirm an upcoming appointment. This is an outbound reminder call.

The patient's name is {{patient_name}}.
Their appointment is scheduled for {{appointment_time}}.

Your call, start to finish:
1. Greet them by name and say you're calling from the clinic about their upcoming appointment.
2. State the appointment time clearly ({{appointment_time}}).
3. Ask if they'll be able to make it.
4. If YES: thank them, confirm the appointment stands, and wrap up.
   If NO or UNSURE: tell them no problem, the office will follow up to reschedule.
5. Thank them and end the call.

Rules:
- Keep it brief and friendly — well under a minute.
- Do NOT give any medical advice. If asked something clinical or anything you
  can't answer, say the office will follow up, and continue.
- One appointment, one purpose: confirm attendance. Don't collect other info.
- When the conversation is done, end the call.`;

async function main() {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) {
    console.error('RETELL_API_KEY is not set. Add it to .env.');
    process.exit(1);
  }

  const client = new Retell({ apiKey });

  // Let the model hang up when the reminder is done.
  const tools = [
    {
      type: 'end_call',
      name: 'end_call',
      description: 'End the call once the appointment has been confirmed or the patient has said they cannot make it.',
    },
  ];

  // Find an existing agent by name so re-runs update in place (Retell keeps
  // version history on update, and preserves any phone-number linkage).
  // agent.list() may return an array or a { data } page depending on SDK.
  const listResp: unknown = await client.agent.list();
  const existingAgents: Array<{ agent_id: string; agent_name?: string; response_engine?: { type?: string; llm_id?: string } }> =
    Array.isArray(listResp) ? listResp : ((listResp as { data?: unknown[] })?.data ?? []) as never;
  const existing = existingAgents.find((a) => a.agent_name === AGENT_NAME);
  const existingLlmId =
    existing?.response_engine?.type === 'retell-llm'
      ? existing.response_engine.llm_id
      : undefined;

  console.log(`Deploying "${AGENT_NAME}" (model: ${MODEL})...`);

  // 1. LLM (the prompt + the end_call tool)
  const llmParams = { model: MODEL, general_prompt: PROMPT, general_tools: tools } as never;
  const llm = existingLlmId
    ? await client.llm.update(existingLlmId, llmParams)
    : await client.llm.create(llmParams);
  console.log(`  LLM ${existingLlmId ? 'updated' : 'created'}: ${llm.llm_id}`);

  // 2. Agent pointing at the LLM
  const agentParams = {
    agent_name: AGENT_NAME,
    voice_id: 'cartesia-Andrew', // natural American male voice
    language: 'en-US',
    response_engine: { type: 'retell-llm', llm_id: llm.llm_id },
    max_call_duration_ms: 120_000, // 2 min ceiling — it's a reminder
    end_call_after_silence_ms: 10_000,
  } as never;

  const agent = existing
    ? await client.agent.update(existing.agent_id, agentParams)
    : await client.agent.create(agentParams);
  console.log(`  Agent ${existing ? 'updated' : 'created'}: ${agent.agent_id}`);

  console.log('\nDone.');
  console.log('Next: add this to .env so calls target it directly —');
  console.log(`  RETELL_AGENT_ID=${agent.agent_id}`);
  console.log('\nA phone number is still required to place calls: buy/import one in the');
  console.log('Retell dashboard and set RETELL_FROM_NUMBER to it (bind this agent as its');
  console.log('outbound agent, or rely on RETELL_AGENT_ID override).');
}

main().catch((err) => {
  console.error('Deploy failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
