/**
 * SELECTOR agent — Week 3. Structured output only (never streams).
 *
 * Week 3 · assignment: docs/CHALLENGE-TOOL-CALLING.md
 *
 * The selector just ROUTES: does this question need the SQL database (structured
 * facts, counts, filters), the clinical notes (meaning-based search), both, or
 * neither (a general question)? It does NOT extract conditions/filters/entities —
 * the SQL agent's LLM does that when it writes the query. Keep it tiny.
 *
 * Use the Responses API + zodTextFormat (see CLAUDE.md).
 */

import type { Message } from '../agent';

export type Plan = {
	useSql: boolean;
	useRag: boolean;
	useScheduler: boolean;
	/** false = a general question with no tie to the records — answer directly. */
	needsSearch: boolean;
	semanticQuery: string;
};

export async function select(
	query: string,
	history: Message[] = [],
): Promise<Plan> {
	throw new Error('Not built yet — Week 3 (lib/agents/selector.ts)');
}
