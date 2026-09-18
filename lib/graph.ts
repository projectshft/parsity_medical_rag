/**
 * THE GRAPH — tool-calling with LangGraph. YOUR TASK.
 *
 * Week 4 · assignment: docs/CHALLENGE-LANGGRAPH.md
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

// TODO — add the SQL tool. `runSql(query, history)` is already written and
// already grounds itself in the real column values; you just need to describe
// WHEN the model should reach for it (counts, exact lookups, filters, "how
// many", anything with its own column) and give it a schema. Note the
// description has to draw the line against search_clinical_notes above —
// if both sound plausible for the same question, the model will coin-flip.
//
// Then: does scheduling become a tool too? An appointment WRITES to the real
// world, and `/api/chat` keeps a human in the loop before anything hits the
// calendar. Decide deliberately, and be able to defend it.
export const tools = [searchClinicalNotes];

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
	throw new Error('Not implemented — your turn! (lib/graph.ts → buildGraph)');
}
