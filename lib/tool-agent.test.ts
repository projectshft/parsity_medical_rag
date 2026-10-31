/**
 * Spec for the tool-calling loop. The model is scripted, so this runs offline
 * and free, and still exercises the real loop: tool requests, results going
 * back with their call_id, bad arguments, and the turn limit.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('./openai', () => ({ openai: { responses: { create } } }));
vi.mock('./vector-search', () => ({ searchClinicalNotes: vi.fn(async (q: string) => `NOTES for "${q}"`) }));
vi.mock('./agents/sql', () => ({ runSql: vi.fn(async (q: string) => `SQL for "${q}"`) }));

import { runToolAgent, TOOLS } from './tool-agent';
import { POST } from '../app/api/chat-tools/route';
import { searchClinicalNotes } from './vector-search';
import { runSql } from './agents/sql';

/** A model turn that asks for one tool. */
const wants = (name: string, args: unknown, id = `call_${name}`) => ({
	output: [{ type: 'function_call', name, arguments: JSON.stringify(args), call_id: id }],
	output_text: '',
});
/** A model turn that answers in text. */
const says = (text: string) => ({ output: [{ type: 'message', content: [] }], output_text: text });

beforeEach(() => {
	create.mockReset();
	vi.mocked(searchClinicalNotes).mockClear();
	vi.mocked(runSql).mockClear();
});

describe('the tools', () => {
	it('exposes notes, records and propose_appointment, and nothing that books', () => {
		expect(TOOLS.map((t) => t.name)).toEqual(['search_clinical_notes', 'query_patient_records', 'propose_appointment']);
		expect(TOOLS.map((t) => t.name)).not.toContain('schedule_appointment');
	});

	it('sends each tool to the model as a JSON schema', () => {
		const notes = TOOLS.find((t) => t.name === 'search_clinical_notes')!;
		expect(notes.parameters).toMatchObject({ type: 'object', properties: { query: { type: 'string' } } });
	});
});

describe('the loop', () => {
	it('runs the tool the model asked for, then returns its answer', async () => {
		create.mockResolvedValueOnce(wants('search_clinical_notes', { query: 'shortness of breath' }));
		create.mockResolvedValueOnce(says('Three patients report breathlessness.'));

		const { answer, steps } = await runToolAgent('who is short of breath?');

		expect(searchClinicalNotes).toHaveBeenCalledWith('shortness of breath');
		expect(answer).toBe('Three patients report breathlessness.');
		expect(steps).toEqual([
			{ tool: 'search_clinical_notes', args: { query: 'shortness of breath' }, output: 'NOTES for "shortness of breath"' },
		]);
	});

	it('hands the result back with the call_id the model used', async () => {
		create.mockResolvedValueOnce(wants('query_patient_records', { question: 'how many have hypertension' }, 'call_42'));
		create.mockResolvedValueOnce(says('63.'));

		await runToolAgent('how many have hypertension?');

		const secondInput = create.mock.calls[1][0].input;
		expect(secondInput).toContainEqual({ type: 'function_call_output', call_id: 'call_42', output: 'SQL for "how many have hypertension"' });
		// ...and the model's own tool request is in the transcript before it.
		expect(secondInput).toContainEqual(expect.objectContaining({ type: 'function_call', call_id: 'call_42' }));
	});

	it('can call several tools before answering', async () => {
		create.mockResolvedValueOnce(wants('query_patient_records', { question: 'smokers' }));
		create.mockResolvedValueOnce(wants('search_clinical_notes', { query: 'cough' }));
		create.mockResolvedValueOnce(says('Both.'));

		const { steps } = await runToolAgent('smokers with a cough?');

		expect(steps.map((s) => s.tool)).toEqual(['query_patient_records', 'search_clinical_notes']);
	});

	it('feeds bad arguments back as an error instead of crashing', async () => {
		create.mockResolvedValueOnce(wants('search_clinical_notes', { wrong: 'field' }));
		create.mockResolvedValueOnce(says('Sorry.'));

		const { steps } = await runToolAgent('anything');

		expect(steps[0].output).toMatch(/^Error:/);
		expect(searchClinicalNotes).not.toHaveBeenCalled();
	});

	it('stops after the turn limit if the model never answers', async () => {
		create.mockResolvedValue(wants('search_clinical_notes', { query: 'x' }));

		const { answer } = await runToolAgent('loop forever');

		expect(create).toHaveBeenCalledTimes(6);
		expect(answer).toMatch(/could not finish/);
	});
});

describe('POST /api/chat-tools', () => {
	const ask = (query: string) =>
		POST(new Request('http://localhost/api/chat-tools', { method: 'POST', body: JSON.stringify({ query }) }));

	it('turns a proposed appointment into the confirm card, without booking', async () => {
		const proposal = { patientName: 'Avery Mueller', date: '2026-11-03', time: '14:00', reason: null };
		create.mockResolvedValueOnce(wants('propose_appointment', proposal));
		create.mockResolvedValueOnce(says('Please confirm Avery Mueller on Nov 3 at 2pm.'));

		const body = await (await ask('book Avery Mueller next Tuesday 2pm')).json();

		expect(body).toEqual({
			message: 'Please confirm Avery Mueller on Nov 3 at 2pm.',
			schedulingAction: proposal,
			toolsUsed: ['propose_appointment'],
		});
	});

	it('returns no card for a normal question', async () => {
		create.mockResolvedValueOnce(says('Hello.'));
		const body = await (await ask('hi')).json();
		expect(body.schedulingAction).toBeNull();
	});
});
