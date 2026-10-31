import { describe, expect, it, vi } from 'vitest';

vi.mock('../openai', () => ({ openai: {} }));
vi.mock('../prisma', () => ({ prisma: {} }));
import { buildWhere, type Filters } from './sql';

const none: Filters = {
	conditions: [],
	conditionLogic: 'all',
	gender: null,
	minAge: null,
	maxAge: null,
	city: null,
	alive: null,
};

describe('buildWhere', () => {
	it('is empty when no filter is set', () => {
		expect(buildWhere(none)).toEqual({});
	});

	it('ANDs conditions for "all" and ORs them for "any"', () => {
		const c = ['Hypertension', 'Diabetes'];
		expect(buildWhere({ ...none, conditions: c }).AND).toHaveLength(2);
		expect(buildWhere({ ...none, conditions: c, conditionLogic: 'any' }).OR).toHaveLength(2);
	});

	it('maps alive to deathDate and ages to a birthDate range', () => {
		expect(buildWhere({ ...none, alive: true }).deathDate).toBeNull();
		expect(buildWhere({ ...none, alive: false }).deathDate).toEqual({ not: null });
		const b = buildWhere({ ...none, minAge: 40, maxAge: 60 }).birthDate as { lte: Date; gt: Date };
		expect(b.lte.getTime()).toBeGreaterThan(b.gt.getTime());
	});
});
