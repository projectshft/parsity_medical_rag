/**
 * Reranking (Week 2) — PROVIDED, and built together in class.
 *
 * Vector search returns the top-K by cosine, but cosine is a coarse ranker: the
 * query was embedded alone, the notes were embedded alone, and nothing ever
 * looked at the two *together*. A reranker does — it's a cross-encoder, scoring
 * each (query, document) pair. Far more accurate, far too slow to run over
 * 21,000 documents. So you build a funnel:
 *
 *   query → vector search (wide, cheap, topK=100) → rerank (narrow, careful, topN=10)
 *
 * Pinecone hosts the reranker (bge-reranker-v2-m3) on your existing
 * PINECONE_API_KEY — no extra provider, no extra key.
 *
 * `lib/vector-search.ts` calls this. It's also the piece to reuse for the week-2
 * Bible homework: over-fetch candidates from your `bible-kjv` index, pass them
 * here, and watch the order change.
 *
 * Docs: https://docs.pinecone.io/guides/search/rerank-results
 */

import { Pinecone } from '@pinecone-database/pinecone';

import { SearchResult } from './pinecone';

const RERANK_MODEL = 'bge-reranker-v2-m3';

const pinecone = new Pinecone({
	apiKey: process.env.PINECONE_API_KEY!,
});

/**
 * Render one candidate as the string the reranker will actually read.
 *
 * This is the part worth understanding: **the reranker only sees this string.**
 * It gets no metadata object, no schema, no field names it can query — just
 * text. So anything you want it to weigh when judging relevance has to be *in*
 * here. Leave the medications out and it cannot rank on medications.
 */
function toRerankText(result: SearchResult): string {
	const m = result.metadata;
	return [
		`Patient note: ${result.content}`,
		m.currentMedications?.length
			? `Current medications: ${m.currentMedications.join(', ')}`
			: null,
		m.age !== undefined ? `Age: ${m.age}` : null,
		m.gender ? `Gender: ${m.gender}` : null,
		m.race ? `Race: ${m.race}` : null,
		m.firstName || m.lastName
			? `Patient: ${[m.firstName, m.lastName].filter(Boolean).join(' ')}`
			: null,
	]
		.filter(Boolean)
		.join('\n');
}

/**
 * Rerank candidates against the query and return the best `topN`, in order.
 *
 * Returns the same `SearchResult` objects, reordered, each carrying the
 * reranker's relevance score in `score` (it replaces the cosine score — they're
 * different scales and mixing them is meaningless).
 */
export async function rerankResults(
	query: string,
	results: SearchResult[],
	topN: number = 10,
): Promise<SearchResult[]> {
	// Nothing to reorder.
	if (results.length === 0) return [];
	if (results.length === 1) return results;

	try {
		const reranked = await pinecone.inference.rerank(
			RERANK_MODEL,
			query,
			results.map(toRerankText),
			// topN is an option on rerank(), NOT an argument to .map() above —
			// put it there and it becomes the callback's `thisArg` and is
			// silently ignored, which is a very quiet way to disable reranking.
			{ topN },
		);

		// `data[i].index` points back at the position in what we sent, which is
		// how we recover the original object (the reranker only returns text).
		return reranked.data
			.map((row) => {
				const original = results[row.index];
				return original ? { ...original, score: row.score } : null;
			})
			.filter((r): r is SearchResult => r !== null);
	} catch (error) {
		// Degraded search beats no search. Cosine order is already sorted by
		// relevance — just less carefully — so fall back to it rather than
		// failing the whole query because one model call timed out.
		console.error(
			'[reranker] rerank failed, falling back to cosine order:',
			error,
		);
		return results.slice(0, topN);
	}
}
