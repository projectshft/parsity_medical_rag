/**
 * Spec for the week-3 SQL guardrail — INSTRUCTOR REFERENCE.
 *
 * These are the negatives worth showing the room. Every string here is
 * something a model could hand you after a poisoned note, a clever user, or
 * just a bad sampling draw.
 *
 * Remember the ordering when you teach it: `student_ro` is what actually stops
 * a write. This function explains the refusal early and loudly; it is not the
 * security boundary.
 *
 * Run just this file: npx vitest run lib/agents/sql.test.ts
 */
import { describe, it, expect, vi } from 'vitest';

// `sql.ts` imports the shared OpenAI client, which is constructed at module
// scope and throws without a key. The guard under test is a pure function, so
// stub the client out rather than requiring an API key to run unit tests.
vi.mock('../openai', () => ({ openai: {} }));
vi.mock('../prisma', () => ({ prisma: {} }));

import { assertReadOnly } from './sql';

describe('assertReadOnly — lets real queries through', () => {
	it('accepts a plain SELECT', () => {
		const sql = 'SELECT count(*) FROM patients';
		expect(assertReadOnly(sql)).toBe(sql);
	});

	it('accepts a read-only CTE', () => {
		const sql =
			'WITH recent AS (SELECT * FROM notes LIMIT 10) SELECT * FROM recent';
		expect(assertReadOnly(sql)).toBe(sql);
	});

	it('strips one trailing semicolon rather than refusing', () => {
		expect(assertReadOnly('SELECT 1;')).toBe('SELECT 1');
	});

	it('is not fooled by a column name containing a keyword', () => {
		const sql = 'SELECT id, "createdAt" FROM notes LIMIT 5';
		expect(assertReadOnly(sql)).toBe(sql);
	});
});

describe('assertReadOnly — refuses everything else', () => {
	const refuses = (label: string, sql: string) =>
		it(label, () => {
			expect(() => assertReadOnly(sql)).toThrow(/Refused model SQL/);
		});

	refuses('a bare DELETE', 'DELETE FROM patients');
	refuses('an UPDATE', `UPDATE patients SET "firstName" = 'x'`);
	refuses('a DROP', 'DROP TABLE patients');
	refuses('a TRUNCATE', 'TRUNCATE patients');
	refuses(
		'a second statement after a semicolon',
		'SELECT 1; DROP TABLE patients',
	);
	refuses(
		'a writing CTE dressed up as a SELECT',
		'WITH gone AS (DELETE FROM notes RETURNING *) SELECT * FROM gone',
	);
	refuses(
		'a write hidden behind a line comment',
		'SELECT 1 -- harmless\n; DELETE FROM patients',
	);
	refuses(
		'a write hidden behind a block comment',
		'SELECT 1 /* nothing here */ ; TRUNCATE patients',
	);
	refuses('an empty string', '   ');
	refuses('prose instead of SQL', 'I cannot help with that request.');

	it('names the keyword it objected to', () => {
		expect(() => assertReadOnly('DELETE FROM patients')).toThrow(/DELETE/);
	});
});
