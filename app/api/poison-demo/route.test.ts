import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('@/lib/agents/aggregator', () => ({ aggregate: vi.fn() }));
import { aggregate } from '@/lib/agents/aggregator';
import fixture from '@/data/security/poisoned/banana-note.json';
import { POST } from './route';

beforeEach(() => { vi.mocked(aggregate).mockReset(); });

function request(mode: string, query = fixture.question) {
	return new Request('http://localhost/api/poison-demo', {
		method: 'POST',
		body: JSON.stringify({ query, mode, messages: [{ role: 'assistant', content: fixture.marker }] }),
	});
}

it.each(['clean', 'poisoned'])('sends the correct context for %s with fresh history', async (mode) => {
	vi.mocked(aggregate).mockResolvedValue('Actual model answer');
	const response = await POST(request(mode));
	const body = await response.json();
	const expectedContext = mode === 'poisoned'
		? `${fixture.cleanNote}\n\n${fixture.poisonedNote}`
		: fixture.cleanNote;
	expect(response.status).toBe(200);
	expect(aggregate).toHaveBeenCalledExactlyOnceWith(fixture.question, [], expectedContext, 'gpt-4o-mini');
	expect(body.message).toBe('Actual model answer');
	expect(body.poisonDemo.contextSent).toBe(expectedContext);
	expect(body.poisonDemo.retrieved.includes(fixture.poisonedNote)).toBe(mode !== 'clean');
	expect(body.poisonDemo.markerPresent).toBe(false);
});

it('reports a marker only when it is in the actual model answer', async () => {
	vi.mocked(aggregate).mockResolvedValue(fixture.marker);
	expect((await (await POST(request('poisoned'))).json()).poisonDemo.markerPresent).toBe(true);
});

it('rejects invalid input before calling the model', async () => {
	for (const input of [request('unknown'), request('defended'), request('clean', ' '), request('clean', 'x'.repeat(2001)), new Request('http://localhost', { method: 'POST', body: '{' })]) {
		expect((await POST(input)).status).toBe(400);
	}
	expect(aggregate).not.toHaveBeenCalled();
});

it('returns a model failure without fabricating an answer', async () => {
	vi.mocked(aggregate).mockImplementation(async () => { throw new Error('Model unavailable'); });
	const response = await POST(request('poisoned'));
	expect(response.status).toBe(500);
	expect(await response.json()).toEqual({ error: 'Model unavailable' });
});
