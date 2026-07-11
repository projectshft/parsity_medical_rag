/**
 * Vector similarity — a tiny hands-on exercise.
 *
 *   npm run similarity
 *
 * Embeds a query and a few candidate phrases, then ranks the candidates by
 * COSINE SIMILARITY (the dot product of the vectors over their lengths). The
 * point to feel: the top match shares *meaning* with the query, not words —
 * "dyspnea on exertion" beats everything for "short of breath" despite having
 * zero words in common. That's the whole idea behind the vector store.
 *
 * Change the query / candidates below and re-run to build the intuition.
 * Needs OPENAI_API_KEY.
 */

import 'dotenv/config';
import { createEmbeddings } from '../lib/openai';

/** cosine(a, b) = (a · b) / (|a| × |b|) — 1.0 = same direction, 0 = unrelated */
function cosine(a: number[], b: number[]): number {
	let dot = 0;
	let magA = 0;
	let magB = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		magA += a[i] * a[i];
		magB += b[i] * b[i];
	}
	return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

async function main() {
	const query = 'best language to learn to code for backend development';
	const candidates = [
		'typescript sucks but it is useful and powerful',
		'javascript is a pain in the ass',
		'python is a great language',
		'java is a pain in the ass',
		'ruby is a great language',
		'php is a pain in the ass',
		'c# is a great language',
		'i rode a pony today and it was fun',
		'i went to the park and played with my dog',
		'i went to the gym and lifted weights',
		'i went to the store and bought some groceries',
		'i went to the movies and watched a movie',
		'i went to the beach and played in the sand',
		'i went to the mountains and hiked',
		'i went to the city and walked around',
		'i went to the country and farmed',
	];

	// One API call embeds them all: [query, ...candidates]
	const [queryVec, ...candidateVecs] = await createEmbeddings([
		query,
		...candidates,
	]);

	console.log(`\nquery: "${query}"\n`);
	candidates
		.map((text, i) => ({ text, score: cosine(queryVec, candidateVecs[i]) }))
		.sort((a, b) => b.score - a.score)
		.forEach((r) => console.log(`  ${r.score.toFixed(3)}  ${r.text}`));
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});
