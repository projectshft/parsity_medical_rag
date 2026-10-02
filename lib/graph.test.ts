/**
 * Spec for the week-4 graph — INSTRUCTOR REFERENCE.
 *
 * Week 4 has never been delivered, so this file exists to make the reference
 * solution *provable* rather than merely plausible. It stubs the model, so it
 * runs offline, costs nothing, and still exercises the real LangGraph wiring:
 * the same `StateGraph`, `ToolNode` and `toolsCondition` students use.
 *
 * It also pins the two failures the runbook promises:
 *   - the missing `tools -> agent` edge (checkpoint 3, the instructive bug)
 *   - a vague tool description changing which tool gets called (the set piece)
 *
 * Run just this file: npx vitest run lib/graph.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIMessage, HumanMessage } from '@langchain/core/messages';

/**
 * The stub model. `invoke` is scripted per test: each entry is the message the
 * model returns on that turn, so we can make it ask for a tool and then — after
 * the tool result comes back — answer in prose.
 */
const turns: AIMessage[] = [];
let seenMessages: unknown[][] = [];

vi.mock('@langchain/openai', () => ({
	ChatOpenAI: class {
		bindTools() {
			return {
				invoke: async (messages: unknown[]) => {
					seenMessages.push(messages);
					return (
						turns.shift() ??
						new AIMessage({ content: 'no more scripted turns' })
					);
				},
			};
		}
	},
}));

// The tools call the real agents; we only care that the graph routes to them.
vi.mock('./agents/rag', () => ({
	runRag: vi.fn(async (q: string) => `NOTES RESULT for "${q}"`),
}));
vi.mock('./agents/sql', () => ({
	runSql: vi.fn(async (q: string) => `SQL RESULT for "${q}"`),
}));

import {
	StateGraph,
	MessagesAnnotation,
	START,
	END,
} from '@langchain/langgraph';
import { ToolNode, toolsCondition } from '@langchain/langgraph/prebuilt';

import { buildGraph, tools, chatModel } from './graph';
import { runRag } from './agents/rag';
import { runSql } from './agents/sql';

/** An assistant turn that asks for a tool, in the shape ToolNode executes. */
const wants = (name: string, args: Record<string, unknown>) =>
	new AIMessage({
		content: '',
		tool_calls: [{ id: `call_${name}`, name, args, type: 'tool_call' }],
	});

beforeEach(() => {
	turns.length = 0;
	seenMessages = [];
	vi.mocked(runRag).mockClear();
	vi.mocked(runSql).mockClear();
});

describe('the tools handed to the model', () => {
	it('exposes exactly the notes tool and the SQL tool', () => {
		expect(tools.map((t) => t.name).sort()).toEqual([
			'query_patient_records',
			'search_clinical_notes',
		]);
	});

	it('does NOT expose scheduling — it writes, and a human confirms first', () => {
		// Week 3's human-in-the-loop guarantee only holds if the model cannot
		// book an appointment mid-loop. If this ever fails, that guarantee is gone.
		expect(tools.map((t) => t.name)).not.toContain('schedule_appointment');
	});

	it('gives every tool a description that distinguishes it from the others', () => {
		for (const t of tools) {
			// The description IS the routing logic — a stub is a routing bug.
			expect(t.description.length).toBeGreaterThan(80);
		}
		const sql = tools.find((t) => t.name === 'query_patient_records')!;
		// The negative clause is the part that actually fixes misroutes.
		expect(sql.description).toMatch(/not for|NOT for/i);
	});
});

describe('the loop', () => {
	it('routes a prose question to the notes tool, then lets the model answer', async () => {
		turns.push(
			wants('search_clinical_notes', { semanticQuery: 'shortness of breath' }),
			new AIMessage({ content: 'Three patients report breathlessness.' }),
		);

		const result = await buildGraph().invoke({
			messages: [new HumanMessage('who is short of breath?')],
		});

		expect(runRag).toHaveBeenCalledWith('shortness of breath');
		// human -> assistant(tool_call) -> tool -> assistant(answer)
		expect(result.messages).toHaveLength(4);
		expect(result.messages.at(-1)?.content).toBe(
			'Three patients report breathlessness.',
		);
	});

	it('routes a counting question to the SQL tool', async () => {
		turns.push(
			wants('query_patient_records', {
				question: 'how many patients have hypertension',
			}),
			new AIMessage({ content: '63 patients.' }),
		);

		const result = await buildGraph().invoke({
			messages: [new HumanMessage('how many patients have hypertension?')],
		});

		expect(runSql).toHaveBeenCalled();
		expect(runRag).not.toHaveBeenCalled();
		expect(result.messages.at(-1)?.content).toBe('63 patients.');
	});

	it('feeds the tool result BACK to the model — the edge people forget', async () => {
		turns.push(
			wants('search_clinical_notes', { semanticQuery: 'chest pain' }),
			new AIMessage({ content: 'done' }),
		);

		await buildGraph().invoke({
			messages: [new HumanMessage('chest pain?')],
		});

		// Two model turns means the loop came back round. Without
		// `.addEdge('tools', 'agent')` there is exactly one, and the user gets
		// silence after a successful retrieval.
		expect(seenMessages).toHaveLength(2);
		// And the second turn can see what the tool returned.
		expect(JSON.stringify(seenMessages[1])).toContain('NOTES RESULT');
	});

	it('WITHOUT the tools->agent edge: retrieves, then says nothing', async () => {
		// Proves the runbook's checkpoint-3 claim, so you can promise the room
		// this failure before you demonstrate it. Same primitives, one edge
		// missing — the graph goes START -> agent -> tools -> END.
		const broken = new StateGraph(MessagesAnnotation)
			.addNode('agent', async (state: typeof MessagesAnnotation.State) => ({
				messages: [await chatModel.bindTools(tools).invoke(state.messages)],
			}))
			.addNode('tools', new ToolNode(tools))
			.addEdge(START, 'agent')
			.addConditionalEdges('agent', toolsCondition, {
				tools: 'tools',
				[END]: END,
			})
			.addEdge('tools', END) // <-- the mistake
			.compile();

		turns.push(
			wants('search_clinical_notes', { semanticQuery: 'chest pain' }),
			new AIMessage({ content: 'this turn never happens' }),
		);

		const result = await broken.invoke({
			messages: [new HumanMessage('chest pain?')],
		});

		// The tool DID run...
		expect(runRag).toHaveBeenCalled();
		// ...the model was only ever asked once...
		expect(seenMessages).toHaveLength(1);
		// ...and the last thing in state is the tool's raw output, not an answer.
		expect(result.messages.at(-1)?.content).toContain('NOTES RESULT');
		expect(result.messages.at(-1)?.getType()).toBe('tool');
	});

	it('ends without calling a tool when the model just answers', async () => {
		turns.push(new AIMessage({ content: 'A normal A1C is below 5.7%.' }));

		const result = await buildGraph().invoke({
			messages: [new HumanMessage("what's a normal A1C?")],
		});

		expect(runRag).not.toHaveBeenCalled();
		expect(runSql).not.toHaveBeenCalled();
		expect(result.messages).toHaveLength(2);
	});

	it('runs several tools across turns and accumulates the whole trace', async () => {
		// The multi-hop case the selector handles badly: look, then look again.
		turns.push(
			wants('query_patient_records', { question: 'oldest patient' }),
			wants('search_clinical_notes', { semanticQuery: 'her recent notes' }),
			new AIMessage({ content: 'Carmen Escobar, and her notes mention...' }),
		);

		const result = await buildGraph().invoke({
			messages: [new HumanMessage('who is oldest, and what do her notes say?')],
		});

		expect(runSql).toHaveBeenCalled();
		expect(runRag).toHaveBeenCalled();
		// human + (assistant, tool) x2 + final answer — the full story, in order.
		expect(result.messages).toHaveLength(6);
	});
});
