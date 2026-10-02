/**
 * THE GRAPH — tool-calling with LangGraph. INSTRUCTOR REFERENCE SOLUTION.
 *
 * Week 4 · student exercise: docs/CHALLENGE-LANGGRAPH.md
 * Runbook: curriculum/instructor/week-4-runbook.md
 *
 * The student branch ships this file with the SQL tool as a TODO and
 * `buildGraph()` throwing. This is the finished version — the one the runbook's
 * pre-flight checklist tells you to have working before you walk in the room.
 *
 * In `/api/chat` (the pipeline you already built) YOUR CODE decides what runs:
 * the selector returns `{ useSql, useRag }` and the route calls the specialists.
 * Here the MODEL decides. You hand it a list of tools; it picks which to call,
 * with what arguments, how many times, and when it has enough to answer.
 *
 * LangGraph is what runs that loop. A graph is nodes (functions) + edges (what
 * runs next). The whole tool-calling loop is two nodes and one condition:
 *
 *     START ──▶ agent ──(wants a tool?)──▶ tools ──┐
 *                 │                                │
 *                 └◀───────────────────────────────┘
 *                 │
 *              (done) ──▶ END
 *
 * The state flowing between nodes is just a list of messages, and it ACCUMULATES
 * — that's why the model remembers it already called a tool and what came back.
 * `MessagesAnnotation` is the prebuilt state that does the accumulating for you.
 *
 * The old pipeline stays exactly where it is (`/api/chat`). This is a second
 * route so you can ask both the same question and compare.
 */

import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import { StateGraph, MessagesAnnotation, START, END } from '@langchain/langgraph';
import { ToolNode, toolsCondition } from '@langchain/langgraph/prebuilt';
import { z } from 'zod';

import { runRag } from './agents/rag';
import { runSql } from './agents/sql';

/**
 * The model. (Provided — boring plumbing.) Same key and proxy `baseURL` as
 * `lib/openai.ts`, so there's still ONE place that decides how we reach OpenAI.
 *
 * `bindTools` is the whole trick: it sends your tools' names, descriptions and
 * JSON schemas along with the prompt, so the model can answer with "call
 * search_clinical_notes with {semanticQuery: ...}" instead of prose.
 */
export const chatModel = new ChatOpenAI({
	model: 'gpt-4o-mini',
	temperature: 0,
	apiKey: process.env.OPENAI_API_KEY,
	configuration: { baseURL: process.env.OPENAI_BASE_URL },
});

/**
 * WORKING EXAMPLE — the clinical-notes tool.
 *
 * A tool is four things: a `name`, a `description`, a `schema`, and a function.
 * The description and the schema are not documentation — they are the ONLY
 * thing the model sees when deciding whether to call this. A vague description
 * is a routing bug. Write it for the model, not for yourself.
 *
 * The body is one line because the work already exists: `runRag` is the same
 * function `/api/chat` calls. Tool-calling doesn't replace your agents — it
 * replaces the code that chose between them.
 */
const searchClinicalNotes = tool(
	async ({ semanticQuery }) => runRag(semanticQuery),
	{
		name: 'search_clinical_notes',
		description:
			"Search the clinical notes by MEANING. Use this for anything a doctor would have written in prose — symptoms, how a visit went, what the patient reported, what was observed. There is no 'short of breath' column, so questions like that belong here.",
		schema: z.object({
			semanticQuery: z
				.string()
				.describe(
					'What to search the notes for, in clinical language. Spell out the intent — "patient reports shortness of breath on exertion" retrieves better than "breathing".',
				),
		}),
	},
);

/**
 * The SQL tool — the one students write.
 *
 * Its description does the job `useSql` used to do, and most of it is spent
 * drawing the LINE against `search_clinical_notes`. If both descriptions sound
 * plausible for the same question the model coin-flips, and nothing tells you.
 * Three things earn their place here, in this order:
 *
 *   - what it IS for (counts, exact lookups, filters on real columns)
 *   - what it is NOT for (prose, symptoms, narrative)
 *   - the decisive heuristic ("anything with its own column")
 *
 * The negative clause is the part people leave out, and it's the part that
 * fixes misroutes. Have the room write descriptions before any code and read
 * three aloud next to each other — see the runbook's live-coding checkpoint 1.
 */
const queryPatientRecords = tool(
	async ({ question }) => runSql(question),
	{
		name: 'query_patient_records',
		description:
			'Query the structured patient database. Use this for anything with its own column: counts ("how many patients have hypertension"), exact lookups by name, filters on diagnosis, medication, age, city or date, superlatives ("oldest patient with..."), and any question whose answer is a precise number or a specific list of people. NOT for symptoms, narrative, or anything a doctor wrote in prose — that is search_clinical_notes.',
		schema: z.object({
			question: z
				.string()
				.describe(
					'The question to answer from the database, in plain English. This tool writes its own SQL and already grounds itself in the real column values, so pass the question — not SQL.',
				),
		}),
	},
);

/**
 * Deliberately NOT a tool: `schedule_appointment`.
 *
 * Week 3's whole point was that a human confirms before anything reaches the
 * calendar. A tool in this list can be called mid-loop, with no confirmation
 * and no way for the model to pause. Scheduling stays on `/api/chat`, where the
 * route short-circuits retrieval and hands the UI a card.
 *
 * The version that WOULD belong here is one that only *proposes* — returns
 * patient, date and time for a human to approve, and writes nothing. That's the
 * answer to let the room arrive at in the discussion slot; don't hand it over.
 */
export const tools = [searchClinicalNotes, queryPatientRecords];

/**
 * Build the graph — YOUR TASK.
 *
 * Everything you need is imported at the top of this file:
 *
 *   - `new StateGraph(MessagesAnnotation)` — the accumulating message state
 *   - `.addNode(name, fn)` — a node is `(state) => ({ messages: [...] })`
 *   - `new ToolNode(tools)` — the prebuilt node that actually runs a tool call
 *     and appends the result as a tool message. You don't write this one.
 *   - `.addEdge(from, to)` and `START` / `END`
 *   - `.addConditionalEdges(from, toolsCondition, { tools: 'tools', [END]: END })`
 *     — `toolsCondition` reads the last message and answers "did the model ask
 *     for a tool, or is it done?"
 *   - `.compile()` — returns the runnable graph
 *
 * The agent node is the one real function you write: bind the tools to the
 * model, invoke it with `state.messages`, and return the reply as
 * `{ messages: [reply] }`.
 *
 * Watch for: the edge FROM the tool node back to the agent. Forget it and the
 * model retrieves, then never gets to say anything about what it found.
 */
export function buildGraph() {
	const modelWithTools = chatModel.bindTools(tools);

	// The one real function. Returns the reply wrapped in an ARRAY because the
	// state reducer appends — hand back a bare message and you replace the
	// history instead of adding to it.
	const agentNode = async (state: typeof MessagesAnnotation.State) => {
		const reply = await modelWithTools.invoke(state.messages);
		return { messages: [reply] };
	};

	return new StateGraph(MessagesAnnotation)
		.addNode('agent', agentNode)
		.addNode('tools', new ToolNode(tools))
		.addEdge(START, 'agent')
		// `toolsCondition` reads the last message and answers "did the model ask
		// for a tool, or is it done?". Hand-writing this check is how you get
		// `Recursion limit reached`.
		.addConditionalEdges('agent', toolsCondition, {
			tools: 'tools',
			[END]: END,
		})
		// THE edge people forget. Without it the tool runs, the result lands in
		// state, and the model never gets another turn to say anything about it.
		// Omit it on purpose first (runbook checkpoint 3) — it's the single most
		// instructive bug in the session.
		.addEdge('tools', 'agent')
		.compile();
}
