/**
 * RAG agent (Week 3) — YOUR TASK. Returns TEXT (never streams).
 *
 * Meaning-based search over the clinical notes, rendered into a context block
 * for the aggregator. Barely an agent — there's no LLM call in here. Not
 * everything needs one.
 */

import { searchClinicalNotes } from '../vector-search';

export async function runRag(semanticQuery: string): Promise<string> {
	// TODO (Week 3 homework) — pass a metadata filter.
	//
	// Right now this matches on MEANING alone, so "what do Avery Mueller's notes
	// say?" searches all 21,000 notes and returns whoever is semantically
	// nearest — which includes other patients named Avery. `searchClinicalNotes`
	// already accepts `patientIds`; the other fields you stored in week 1 (age,
	// gender, city…) are filterable too. Similarity is fuzzy; identity is exact.
	const { rerankedDocuments } = await searchClinicalNotes(semanticQuery, {
		topK: 20,
	});

	if (rerankedDocuments.length === 0) {
		return 'No clinical notes matched that query.';
	}

	// One block per note. The aggregator reads this as its only source of
	// truth, so label whose note it is — an unattributed wall of text is how
	// you get an answer about the wrong patient.
	return rerankedDocuments
		.map((note) => {
			const { firstName, lastName, age, gender } = note.metadata;
			const who =
				[firstName, lastName].filter(Boolean).join(' ') ||
				'Unknown patient';
			return [
				`Patient: ${who}${age !== undefined ? ` (age ${age}${gender ? `, ${gender}` : ''})` : ''}`,
				`Relevance: ${note.score.toFixed(3)}`,
				`Note: ${note.content}`,
			].join('\n');
		})
		.join('\n\n---\n\n');
}
