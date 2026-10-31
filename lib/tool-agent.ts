/**
 * TOOL CALLING — the model picks what to run. Week 4.
 *
 * In `/api/chat` YOUR CODE decides: the selector returns actions and the route's
 * `if`s call the agents. Here the MODEL decides. We hand it a list of tools; it
 * answers with "call this tool with these arguments", we run it, hand back the
 * result, and ask again — until it answers in plain text.
 *
 *     question ──▶ model ──(wants a tool?)──▶ run it ──┐
 *                    ▲                                 │
 *                    └──────── tool result ◀───────────┘
 *                    │
 *                 (done) ──▶ answer
 *
 * No framework: the whole loop is `runToolAgent` below. Every model call goes
 * through the same wrapped `openai` client, so each turn shows up in LangSmith.
 *
 * The tools REUSE the work you already did. `searchClinicalNotes` and `runSql`
 * are the same functions `/api/chat` calls. Tool calling doesn't replace your
 * agents; it replaces the code that chose between them.
 */

import { z } from 'zod';
import type { ResponseInputItem } from 'openai/resources/responses/responses';

import { openai } from './openai';
import { searchClinicalNotes } from './vector-search';
import { runSql } from './agents/sql';
import type { Message } from './agent';

const MODEL = 'gpt-6-luna';
const MAX_TURNS = 6; // a loop that never stops is the classic tool-calling bug

/**
 * A tool is four things: a name, a description, an argument schema, and a
 * function. The description and schema are the ONLY things the model sees when
 * deciding whether to call it, so a vague description is a routing bug.
 */
type Tool = {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
	run: (rawArgs: string) => Promise<string>;
};

function defineTool<S extends z.ZodObject>(def: {
	name: string;
	description: string;
	schema: S;
	run: (args: z.infer<S>) => Promise<string>;
}): Tool {
	// Zod can emit JSON Schema directly; drop the `$schema` header the API doesn't need.
	const { $schema, ...parameters } = z.toJSONSchema(def.schema);
	return {
		name: def.name,
		description: def.description,
		parameters,
		// The model sends arguments as a JSON string. Validate them like any other
		// untrusted input; a bad argument becomes an error the model can read and fix.
		run: async (rawArgs) => def.run(def.schema.parse(JSON.parse(rawArgs))),
	};
}

const searchNotesTool = defineTool({
	name: 'search_clinical_notes',
	description:
		"Search the clinical notes by MEANING. Use for anything a clinician wrote in prose: symptoms, how a visit went, what the patient reported or was told. There is no 'short of breath' column, so questions like that belong here.",
	schema: z.object({
		query: z
			.string()
			.describe('What to look for in the notes, in clinical language, e.g. "shortness of breath on exertion".'),
	}),
	run: ({ query }) => searchClinicalNotes(query),
});

const patientRecordsTool = defineTool({
	name: 'query_patient_records',
	description:
		'Query the structured patient database. Use for anything with its own column: counts ("how many patients have hypertension"), lookups by name, filters on condition, age, gender, city, alive/deceased, and any answer that is a precise number or list of people. NOT for symptoms or anything written in prose; that is search_clinical_notes.',
	schema: z.object({
		question: z
			.string()
			.describe('The question to answer from the database, in plain English. Not SQL.'),
	}),
	run: ({ question }) => runSql(question),
});

/**
 * Human-in-the-loop as a tool: it PROPOSES, it never books.
 *
 * The model can call this mid-loop, so it must not have side effects. The route
 * turns the proposal into the same confirm card `/api/chat` uses, and nothing
 * reaches Cal.com until a person clicks confirm. Rule of thumb: the model can
 * read anything, but it can only propose writes.
 */
export const AppointmentProposalSchema = z.object({
	patientName: z.string().min(1).describe('Full name of the patient.'),
	date: z.iso.date().describe('YYYY-MM-DD. Resolve "tomorrow", "next Tuesday" from today.'),
	time: z
		.string()
		.regex(/^([01]\d|2[0-3]):[0-5]\d$/)
		.describe('HH:MM, 24-hour, no seconds.'),
	reason: z.string().nullable().describe('Reason for the visit, or null.'),
});

const proposeAppointmentTool = defineTool({
	name: 'propose_appointment',
	description:
		'Propose an appointment for the user to confirm. Does NOT book anything: the user sees a confirm card and books it themselves. Only call this when you know the patient name, date and time; otherwise ask the user for what is missing.',
	schema: AppointmentProposalSchema,
	run: async ({ patientName, date, time }) =>
		`Proposed ${patientName} on ${date} at ${time}. The user will see a confirm card; nothing is booked until they confirm it. Tell them to review and confirm.`,
});

/**
 * TODO (in class): your own tool — search the web.
 *
 * Think it through before you code it:
 *   - When SHOULD the model reach for the web instead of our records? Write
 *     that into the description, including when NOT to use it.
 *   - Where do results come from? Options: OpenAI's built-in web search
 *     (`tools: [{ type: 'web_search' }]` in a separate responses.create call),
 *     or an API like Tavily, Exa or Brave Search.
 *   - What do you hand back? The model reads your return value, so keep it
 *     short: titles, snippets, URLs. Not whole pages.
 *
 * Then add it to TOOLS below and ask something only the web knows.
 */
// const searchWebTool = defineTool({ ... });

export const TOOLS: Tool[] = [searchNotesTool, patientRecordsTool, proposeAppointmentTool];

export type ToolStep = { tool: string; args: unknown; output: string };

const systemPrompt = () => `You are a medical records assistant for a clinic.
Use the tools to look things up. Never invent patient information: if the tools
return nothing relevant, say so. Never give medical advice.
Today is ${new Date().toISOString().slice(0, 10)}.`;

/** The loop. Returns the final answer plus every tool call, in order. */
export async function runToolAgent(
	query: string,
	history: Message[] = [],
): Promise<{ answer: string; steps: ToolStep[] }> {
	const input: ResponseInputItem[] = [
		{ role: 'system', content: systemPrompt() },
		...history.slice(-5),
		{ role: 'user', content: query },
	];
	const tools = TOOLS.map((t) => ({
		type: 'function' as const,
		name: t.name,
		description: t.description,
		parameters: t.parameters,
		strict: false,
	}));
	const steps: ToolStep[] = [];

	for (let turn = 0; turn < MAX_TURNS; turn++) {
		const response = await openai.responses.create({ model: MODEL, input, tools });

		const calls = response.output.filter((item) => item.type === 'function_call');
		// No tool calls means the model is done and this is the answer.
		if (calls.length === 0) return { answer: response.output_text, steps };

		// Hand the model's own turn back first: each tool result has to point at
		// the call that asked for it (call_id), or the API rejects it.
		input.push(...(response.output as ResponseInputItem[]));

		for (const call of calls) {
			const tool = TOOLS.find((t) => t.name === call.name);
			let output: string;
			try {
				output = tool ? await tool.run(call.arguments) : `Unknown tool: ${call.name}`;
			} catch (err) {
				output = `Error: ${err instanceof Error ? err.message : String(err)}`;
			}
			steps.push({ tool: call.name, args: safeJson(call.arguments), output });
			input.push({ type: 'function_call_output', call_id: call.call_id, output });
		}
	}

	return { answer: 'I could not finish that in time. Try a more specific question.', steps };
}

function safeJson(raw: string): unknown {
	try {
		return JSON.parse(raw);
	} catch {
		return raw;
	}
}
