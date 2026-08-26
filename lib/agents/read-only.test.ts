/**
 * Spec for the read-only gate on LLM-authored SQL.
 *
 * These are the negatives that matter. Your database is writable now, so every
 * one of these strings is something a model could hand you — after a poisoned
 * note, a clever user, or just a bad day for gpt-4o-mini.
 *
 * Run just this file: npx vitest run lib/agents/read-only.test.ts
 */
import { describe, it, expect } from 'vitest';
import { assertReadOnly, UnsafeSqlError } from './read-only';

describe('assertReadOnly — lets real queries through', () => {
	it('accepts a plain SELECT', () => {
		const sql = 'SELECT count(*) FROM patients WHERE "deletedAt" IS NULL';
		expect(assertReadOnly(sql)).toBe(sql);
	});

	it('accepts a CTE that only reads', () => {
		const sql =
			'WITH recent AS (SELECT * FROM notes LIMIT 10) SELECT * FROM recent';
		expect(assertReadOnly(sql)).toBe(sql);
	});

	it('strips a single trailing semicolon rather than rejecting it', () => {
		expect(assertReadOnly('SELECT 1;')).toBe('SELECT 1');
	});

	it('is not fooled by a column called "updated_at"', () => {
		// The keyword scan is on word boundaries, so ordinary column names that
		// merely contain a forbidden word must still pass.
		const sql = 'SELECT id, "deletedAt" FROM notes LIMIT 5';
		expect(assertReadOnly(sql)).toBe(sql);
	});
});

describe('assertReadOnly — refuses everything else', () => {
	const refuses = (label: string, sql: string) =>
		it(label, () => {
			expect(() => assertReadOnly(sql)).toThrow(UnsafeSqlError);
		});

	refuses('a bare DELETE', 'DELETE FROM patients');
	refuses('an UPDATE', 'UPDATE patients SET "firstName" = \'x\'');
	refuses('a DROP', 'DROP TABLE patients');
	refuses('a TRUNCATE', 'TRUNCATE patients');
	refuses(
		'a second statement smuggled in after a semicolon',
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
		'SELECT 1 /* nothing to see */ ; TRUNCATE patients',
	);
	refuses('an empty string', '   ');
	refuses('prose instead of SQL', 'I cannot help with that request.');

	it('says which keyword it objected to', () => {
		expect(() => assertReadOnly('DELETE FROM patients')).toThrow(/DELETE/);
	});
});
