/**
 * RAG agent — meaning-based search over the clinical notes. Returns TEXT.
 *
 * Two steps:
 *   1. extractRagFilters — a cheap mini call pulls structured metadata (patient
 *      name, gender) out of the query, so the vector search can be scoped.
 *   2. runRag — embed + search + rerank, applying those filters as a Pinecone
 *      metadata filter before the vector search runs.
 */

import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { openai } from '../openai';
import { searchClinicalNotes } from '../vector-search';
import { loadPoisonedNote } from '../security/poison';

const RagFiltersSchema = z.object({
	firstName: z
		.string()
		.nullable()
		.describe(
			'Patient first name if the query names a specific patient, else null',
		),
	lastName: z
		.string()
		.nullable()
		.describe(
			'Patient last name if the query names a specific patient, else null',
		),
	gender: z
		.enum(['male', 'female'])
		.nullable()
		.describe('Patient gender if the query specifies one, else null'),
	race: z
		.enum(['Asian', 'Black or African American', 'White'])
		.nullable()
		.describe(
			'Patient race if the query specifies one, mapped to the exact stored value (e.g. "black" -> "Black or African American"), else null',
		),
});

export type RagFilters = {
	firstName?: string;
	lastName?: string;
	gender?: string;
	race?: string;
};

/**
 * FEW-SHOT EXAMPLES for metadata extraction — edit this array to tune it. Each
 * `output` is typed to the schema, so a malformed example won't compile. The key
 * lesson: map lay terms to the EXACT stored value ("black" -> "Black or African
 * American"), and leave a field null when the query doesn't specify it.
 */
const EXTRACT_FEW_SHOT: {
	question: string;
	output: z.infer<typeof RagFiltersSchema>;
}[] = [
	{
		question: 'of our black patients, what trends do you see?',
		output: {
			firstName: null,
			lastName: null,
			gender: null,
			race: 'Black or African American',
		},
	},
	{
		question: 'summarize the notes for female patients with diabetes',
		output: {
			firstName: null,
			lastName: null,
			gender: 'female',
			race: null,
		},
	},
	{
		question: "what does Angel Reinger's chart say about smoking?",
		output: {
			firstName: 'Angel',
			lastName: 'Reinger',
			gender: null,
			race: null,
		},
	},
	{
		question: 'what do the clinical notes say about chest pain?',
		output: { firstName: null, lastName: null, gender: null, race: null },
	},
];

const EXTRACT_SYSTEM = `Extract patient metadata filters from the query for a clinical-notes
search. Only fill a field if the query clearly specifies it; otherwise use null. Do not guess.
Map lay terms to the exact stored value (e.g. "black" -> "Black or African American").

Examples:

${EXTRACT_FEW_SHOT.map((ex) => `Q: "${ex.question}"\n${JSON.stringify(ex.output)}`).join('\n\n')}`;

/**
 * Pull metadata filters out of the query with a cheap mini call. These become an
 * exact-match Pinecone filter, narrowing the vector search before it runs. Fields
 * are only set when the query clearly specifies them.
 */
export async function extractRagFilters(query: string): Promise<RagFilters> {
	const res = await openai.responses.parse({
		model: 'gpt-4o-mini',
		input: [
			{ role: 'system', content: EXTRACT_SYSTEM },
			{ role: 'user', content: query },
		],
		temperature: 0,
		text: { format: zodTextFormat(RagFiltersSchema, 'ragFilters') },
	});

	const p = RagFiltersSchema.parse(res.output_parsed);
	// Drop nulls so we only pass filters the model was confident about.
	const filters: RagFilters = {
		...(p.firstName ? { firstName: p.firstName } : {}),
		...(p.lastName ? { lastName: p.lastName } : {}),
		...(p.gender ? { gender: p.gender } : {}),
		...(p.race ? { race: p.race } : {}),
	};
	return filters;
}

export async function runRag(
	semanticQuery: string,
	filters: RagFilters = {},
): Promise<string> {
	const notes = await searchClinicalNotes(semanticQuery, {
		topK: 20,
		...(Object.keys(filters).length > 0 ? filters : {}),
	});

	const docs = notes.rerankedDocuments.map((note) =>
		JSON.stringify(note.document),
	);

	// SECURITY DEMO — POISON_DEMO=1 adds one poisoned note to the results, exactly
	// where a real one would land. Nothing else changes: same search, same prompt.
	// If you don't see the log line below, the flag never reached this process.
	if (process.env.POISON_DEMO) {
		docs.push(loadPoisonedNote());
		console.log(`[poison] injected 1 note into ${docs.length} results`);
	}

	return docs.join('\n\n');
}
