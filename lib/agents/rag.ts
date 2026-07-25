/**
 * RAG agent — YOUR TASK. Returns TEXT (never streams).
 *
 * Meaning-based search over the clinical notes, rendered into a context block
 * for the aggregator.
 */

import { searchClinicalNotes } from '../vector-search';

export async function runRag(semanticQuery: string): Promise<string> {
	// TODO: add metadata
	const notes = await searchClinicalNotes(semanticQuery, { topK: 20 });

	console.log('notes', notes);
	return notes.rerankedDocuments
		.map((note) => `${JSON.stringify(note.document)}`)
		.join(`\n\n`);
}
