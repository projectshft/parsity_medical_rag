/**
 * Create the confirmation-call voice agent in Retell — run ONCE.
 *
 *   npm run retell:setup
 *
 * A Retell agent is two things: an LLM config (the prompt the voice agent
 * follows) and the agent itself (which voice speaks it). This creates both and
 * prints the agent id to paste into .env as RETELL_AGENT_ID.
 *
 * The {{patient_name}} and {{appointment_time}} placeholders get filled per call
 * by `retell_llm_dynamic_variables` in lib/retell.ts. Edit the prompt in the
 * Retell dashboard afterwards if you want to change how it talks.
 *
 * Needs: RETELL_API_KEY.
 */

import 'dotenv/config';
import Retell from 'retell-sdk';

const PROMPT = `You are a friendly scheduling assistant calling from Parsity Medical Clinic.

You are calling {{patient_name}} to confirm their appointment on {{appointment_time}}.

1. Greet them and say who you are calling for.
2. Confirm the appointment day and time.
3. Ask if they can still make it.
   - If yes: thank them and remind them to arrive 10 minutes early.
   - If no: tell them the clinic will call back to reschedule. Do NOT pick a new time yourself.
4. Say goodbye and end the call.

Keep it short, warm and natural. Never give medical advice. If they ask a medical
question, say a clinician will follow up.`;

async function main() {
	if (!process.env.RETELL_API_KEY) throw new Error('Set RETELL_API_KEY in .env first.');
	const retell = new Retell({ apiKey: process.env.RETELL_API_KEY });

	const llm = await retell.llm.create({
		general_prompt: PROMPT,
		begin_message: 'Hi, this is the scheduling assistant from Parsity Medical Clinic. Am I speaking with {{patient_name}}?',
		start_speaker: 'agent',
	});

	const agent = await retell.agent.create({
		agent_name: 'Appointment confirmation (medical RAG)',
		response_engine: { type: 'retell-llm', llm_id: llm.llm_id },
		voice_id: 'retell-Cimo',
		language: 'en-US',
	});

	console.log('\nAgent created. Add this to your .env:\n');
	console.log(`RETELL_AGENT_ID=${agent.agent_id}\n`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
