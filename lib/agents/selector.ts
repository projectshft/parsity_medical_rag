/**
 * SELECTOR agent — YOUR TASK. Structured output only (never streams).
 *
 * The selector just ROUTES: does this question need the SQL database (structured
 * facts, counts, filters), the clinical notes (meaning-based search), scheduling,
 * both, or neither (a general/ambiguous question)? It does NOT extract
 * conditions/filters/entities — the SQL agent's LLM does that when it writes the
 * query. Keep it tiny.
 */

import { z } from 'zod';
import { openai } from '../openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type { Message } from '../agent';

const planAgentSchema = z.object({
	useSql: z
		.boolean()
		.describe(
			'Whether to use the SQL database, which has structured data about patients',
		),
	useRag: z
		.boolean()
		.describe(
			'Whether to use the vector store, which has information about patient notes BUT not structured data',
		),
	useScheduler: z
		.boolean()
		.describe('Whether to schedule/book an appointment for the patient'),
	reason: z
		.string()
		.describe(
			'The reason for choosing the SQL database, the vector store, scheduling, NONE, or clarification',
		),
	agentQuery: z
		.string()
		.describe(
			'The cleaned query to send to the downstream agent — fix spelling and resolve references (him/her/that patient) from history',
		)
		.nullable(),
	clarificationQuery: z
		.string()
		.describe(
			'If the request is unclear or missing a patient, the question to ask the user. Only about medical information or scheduling.',
		)
		.nullable(),
});

/** The exact shape the selector must emit — few-shot outputs are typed to this. */
type PlanOutput = z.infer<typeof planAgentSchema>;

export type Plan = {
	useSql: boolean;
	useRag: boolean;
	useScheduler: boolean;
	/** false = a general question with no tie to the records — answer directly. */
	needsSearch: boolean;
	semanticQuery: string;
};

/**
 * FEW-SHOT EXAMPLES — edit this array to tune routing. Each `output` is typed to
 * PlanOutput, so a malformed example won't compile. Keep ~2 per category.
 * Categories: sql | rag | hybrid | calendar | clarify.
 */
const FEW_SHOT: {
	category: 'sql' | 'rag' | 'hybrid' | 'calendar' | 'clarify';
	question: string;
	output: PlanOutput;
}[] = [
	{
		category: 'sql',
		question: 'How many patients have hypertension?',
		output: {
			useSql: true,
			useRag: false,
			useScheduler: false,
			reason: 'A count filtered by a condition — structured data lives in SQL.',
			agentQuery: 'How many patients have hypertension?',
			clarificationQuery: null,
		},
	},
	{
		category: 'sql',
		question: 'Who is the oldest patient with diabetes?',
		output: {
			useSql: true,
			useRag: false,
			useScheduler: false,
			reason: 'Superlative plus a condition filter over structured patient rows.',
			agentQuery: 'Who is the oldest patient with diabetes?',
			clarificationQuery: null,
		},
	},
	{
		category: 'rag',
		question: 'What do the clinical notes say about patients with breathing problems?',
		output: {
			useSql: false,
			useRag: true,
			useScheduler: false,
			reason: 'Meaning-based question over the free-text notes, not a structured filter.',
			agentQuery: 'clinical notes describing breathing problems / shortness of breath',
			clarificationQuery: null,
		},
	},
	{
		category: 'rag',
		question: 'Summarize the symptoms described for chest pain patients.',
		output: {
			useSql: false,
			useRag: true,
			useScheduler: false,
			reason: 'Summarizing note content — vector search over the notes.',
			agentQuery: 'notes describing chest pain symptoms',
			clarificationQuery: null,
		},
	},
	{
		// A demographic "trends" question is NOT vague — it's answerable from the
		// notes filtered to that group. Route to RAG, do not ask for clarification.
		category: 'rag',
		question: 'Of our black patients, what trends do you see?',
		output: {
			useSql: false,
			useRag: true,
			useScheduler: false,
			reason: 'A demographic question answered from the notes — scope to the group and read the notes for themes.',
			agentQuery: 'trends and common themes in the clinical notes for black patients',
			clarificationQuery: null,
		},
	},
	{
		category: 'hybrid',
		question: 'How many patients had a heart attack, and what symptoms do their notes describe?',
		output: {
			useSql: true,
			useRag: true,
			useScheduler: false,
			reason: 'A count (SQL) plus a description of note content (RAG) — hybrid.',
			agentQuery: 'patients with myocardial infarction and the symptoms described in their notes',
			clarificationQuery: null,
		},
	},
	{
		category: 'hybrid',
		question: 'List patients on statins and what their notes mention about side effects.',
		output: {
			useSql: true,
			useRag: true,
			useScheduler: false,
			reason: 'Structured medication filter (SQL) plus meaning over notes (RAG) — hybrid.',
			agentQuery: 'patients on statins and note mentions of side effects',
			clarificationQuery: null,
		},
	},
	{
		category: 'calendar',
		question: 'Book an appointment for Carmen Escobar next Tuesday at 2pm.',
		output: {
			useSql: false,
			useRag: false,
			useScheduler: true,
			reason: 'An explicit request to schedule/book an appointment.',
			agentQuery: 'Book an appointment for Carmen Escobar next Tuesday at 2pm',
			clarificationQuery: null,
		},
	},
	{
		category: 'calendar',
		question: 'Schedule a follow-up visit for John Smith.',
		output: {
			useSql: false,
			useRag: false,
			useScheduler: true,
			reason: 'A scheduling action for a named patient.',
			agentQuery: 'Schedule a follow-up visit for John Smith',
			clarificationQuery: null,
		},
	},
	{
		category: 'clarify',
		question: 'Tell me about him.',
		output: {
			useSql: false,
			useRag: false,
			useScheduler: false,
			reason: "Ambiguous reference — no patient named and no history to resolve 'him'.",
			agentQuery: null,
			clarificationQuery: 'Which patient do you mean? Please give a name.',
		},
	},
	{
		category: 'clarify',
		question: 'Can you help?',
		output: {
			useSql: false,
			useRag: false,
			useScheduler: false,
			reason: 'Too vague to route — no medical question or scheduling request stated.',
			agentQuery: null,
			clarificationQuery:
				'What would you like to know? I can answer questions about patients, their conditions, notes, or schedule an appointment.',
		},
	},
];

const INSTRUCTIONS = `You are the ROUTER for a medical-records assistant. Decide which
data source(s) a question needs. You do NOT answer the question and you do NOT extract
filters — the downstream agents do that.

Sources:
- SQL database — structured facts about patients: counts, filters, ages, conditions,
  medications, dates. Use for "how many", "which patients", "oldest/youngest", exact lookups.
- Vector store (RAG) — the free-text clinical notes: symptoms, descriptions, meaning-based
  questions. Use for "what do the notes say", "describe", "summarize symptoms".
- Scheduling — booking or scheduling an appointment for a patient.

Good vs bad routing:
- Counts and filters go to SQL, NOT RAG.
- Note meaning / descriptions go to RAG, NOT SQL.
- A question that needs BOTH a structured fact AND note content is HYBRID (useSql AND useRag).
- If the request is ambiguous, missing a patient, or not a medical/scheduling task, leave all
  flags false and set clarificationQuery.

Put a cleaned, reference-resolved version of the question in agentQuery (fix spelling; resolve
"him/her/that patient" from the conversation history). Use clarificationQuery only when you
truly cannot route.`;

// Build the prompt from the FEW_SHOT array so examples stay in one editable place.
const SYSTEM_PROMPT = `${INSTRUCTIONS}

Examples (the output shape you must produce):

${FEW_SHOT.map((ex) => `Q: "${ex.question}"\n${JSON.stringify(ex.output)}`).join('\n\n')}`;

export async function select(
	query: string,
	history: Message[] = [],
): Promise<Plan> {
	const answer = await openai.responses.parse({
		model: 'gpt-4o-mini',
		text: { format: zodTextFormat(planAgentSchema, 'plan') },
		input: [
			{ role: 'system', content: SYSTEM_PROMPT },
			{
				role: 'user',
				content: `Conversation history:\n${
					history.length > 0
						? history
								.slice(-5)
								.map((h) => `${h.role}: ${h.content}`)
								.join('\n')
						: '(none)'
				}\n\nUser query: ${query}`,
			},
		],
		temperature: 0,
	});

	console.log(answer.output_parsed);

	// Map the parsed answer onto the Plan the route expects.
	const p = planAgentSchema.parse(answer.output_parsed);
	return {
		useSql: p.useSql,
		useRag: p.useRag,
		useScheduler: p.useScheduler,
		needsSearch: p.useSql || p.useRag,
		semanticQuery: p.agentQuery ?? query,
	};
}
