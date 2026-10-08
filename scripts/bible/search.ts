/**
 * Search your Qdrant collection, then rerank — INSTRUCTOR REFERENCE SOLUTION.
 *
 * Week 2 homework. On the student branch this file throws; this is the answer.
 *
 *   npm run bible:search -- bible_smart "what does it say about forgiving your enemies"
 *   npm run bible:search -- bible_smart "a question" --candidates 25 --top 5
 *
 * THE POINT: the funnel, and where each half lives.
 *
 *   query → Qdrant vector search (wide, cheap, 25) → rerank (narrow, careful, 5)
 *
 * Reranking is NOT a feature of your vector database. The vectors are in
 * Qdrant; the reranker is Pinecone's hosted cross-encoder, on the
 * PINECONE_API_KEY you already have. It takes a query and a list of STRINGS and
 * knows nothing about where they came from. That separation is the lesson — it
 * is a stage in a pipeline, and you can put any two providers either side of it.
 *
 * Reranking was hard to see on the medical notes: long, similar documents, muddy
 * score changes. Bible chunks are short and distinct, so the reordering is
 * visible. Try a query that shares NO keywords with the passage it should find.
 */

import 'dotenv/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { Pinecone } from '@pinecone-database/pinecone';
import { createEmbedding } from '../../lib/openai';

const RERANK_MODEL = 'bge-reranker-v2-m3';

function arg(flag: string, fallback: number): number {
	const i = process.argv.indexOf(flag);
	return i === -1 ? fallback : parseInt(process.argv[i + 1], 10);
}

async function main() {
	const [collection, question] = process.argv.slice(2);
	if (!collection || !question || question.startsWith('--')) {
		console.error(
			'Usage: npm run bible:search -- <collection> "<question>" [--candidates 25] [--top 5]',
		);
		process.exit(1);
	}

	const CANDIDATES = arg('--candidates', 25);
	const TOP = arg('--top', 5);

	const qdrant = new QdrantClient({
		url: process.env.QDRANT_URL!,
		apiKey: process.env.QDRANT_API_KEY,
	});

	// ---- stage 1: over-fetch from Qdrant -----------------------------------
	// Over-fetching is what makes reranking able to help at all. Retrieve 5 and
	// rerank 5 and all you can do is reorder the 5 cosine already liked; the
	// right passage has to be IN the candidate set before a reranker can
	// promote it.
	const vector = await createEmbedding(question);

	// `query`, not `search`. The client removed `search`/`searchBatch` in
	// v1.19.0 — every tutorial and most LLM answers still use it, so
	// `client.search is not a function` is the first thing you'll hit if you
	// copy one. Note the response is an OBJECT with `.points`, not an array,
	// which is the second thing you'll hit.
	const { points } = await qdrant.query(collection, {
		query: vector,
		limit: CANDIDATES,
		with_payload: true,
	});

	if (points.length === 0) {
		console.error(
			`No points came back from '${collection}'. If you just ran bible:store, ` +
				'check it used `wait: true` — writes are async by default.',
		);
		process.exit(1);
	}

	const texts = points.map((p) => String(p.payload?.text ?? ''));
	const label = (i: number) =>
		String(points[i].payload?.reference ?? `point ${points[i].id}`);

	console.log(`\nQuery: "${question}"`);
	console.log(`\n--- stage 1: Qdrant cosine, top ${Math.min(TOP, points.length)} of ${points.length} candidates ---`);
	points.slice(0, TOP).forEach((p, i) => {
		console.log(`  ${i + 1}. [${p.score.toFixed(4)}] ${label(i)} — ${texts[i].slice(0, 90)}…`);
	});

	// ---- stage 2: rerank ----------------------------------------------------
	const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
	const reranked = await pinecone.inference.rerank({
		model: RERANK_MODEL,
		query: question,
		documents: texts,
		topN: TOP,
	});

	console.log(`\n--- stage 2: reranked, top ${TOP} ---`);
	reranked.data.forEach((row, i) => {
		const movedFrom = row.index;
		const move =
			movedFrom === i ? '  =' : movedFrom > i ? `▲${movedFrom - i}` : `▼${i - movedFrom}`;
		console.log(
			`  ${i + 1}. [${row.score.toFixed(4)}] ${move} was #${movedFrom + 1}  ${label(movedFrom)} — ${texts[movedFrom].slice(0, 90)}…`,
		);
	});

	const moved = reranked.data.filter((row, i) => row.index !== i).length;
	console.log(
		`\n${moved} of ${reranked.data.length} results changed position. If that's 0, ` +
			'try a question phrased in words the passage does not use.',
	);
}

main().catch((err) => {
	console.error('\n' + (err instanceof Error ? err.message : String(err)));
	process.exit(1);
});
