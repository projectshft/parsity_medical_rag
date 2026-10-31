/**
 * RAG agent — returns TEXT (never streams).
 *
 * Meaning-based search over the clinical notes (searchClinicalNotes from
 * lib/vector-search.ts), which already labels each note's patient/metadata.
 */

import { searchClinicalNotes } from '../vector-search';

export async function runRag(semanticQuery: string): Promise<string> {
	return searchClinicalNotes(semanticQuery);
}
