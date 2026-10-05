/**
 * Store your chunks in Qdrant — INSTRUCTOR REFERENCE SOLUTION.
 *
 * Week 1 homework · assignment: docs/CHALLENGE-CHUNKING.md
 * On the student branch this file throws; this is the worked answer.
 *
 *   npm run bible:store -- data/bible/chunks-fixed.jsonl bible_fixed
 *   npm run bible:store -- data/bible/chunks-smart.jsonl bible_smart
 *
 * WHY QDRANT AND NOT PINECONE
 *
 * The medical notes live in Pinecone and that isn't changing. This lab is on a
 * second, different vector database on purpose. Pinecone's client is already
 * wrapped for you in `lib/pinecone.ts` — reusing it here would make the
 * assignment an import statement. On Qdrant you write the client code, and the
 * things Pinecone hides become decisions you have to make and defend:
 *
 *   - the collection does not exist until you create it, with an explicit
 *     vector size and distance metric, and neither can be changed afterwards
 *   - "payload", not "metadata" — a filterable JSON document, not a bag of tags
 *   - payload fields are not indexed for filtering until you say so
 *
 * Two collections, not one: fixed-size and structure-aware chunking produce
 * DIFFERENT chunks, so they cannot share points. (Qdrant's named vectors let one
 * point carry several embeddings — useful for comparing two embedding models on
 * the same text, which is not what this lab compares.)
 */

import 'dotenv/config';
import * as fs from 'fs';
import { QdrantClient } from '@qdrant/js-client-rest';
import { createEmbeddings } from '../../lib/openai';

/** text-embedding-3-small, as configured in lib/openai.ts. */
const VECTOR_SIZE = 1536;
/** Qdrant's distance values are capitalized string literals: 'Cosine' | 'Euclid' | 'Dot' | 'Manhattan'. */
const DISTANCE = 'Cosine' as const;
/** Embed and upsert in batches — one request per chunk would take all evening. */
const BATCH = 100;

type Chunk = {
	id: number;
	text: string;
	metadata?: Record<string, unknown>;
};

function client(): QdrantClient {
	const url = process.env.QDRANT_URL;
	if (!url) {
		throw new Error(
			'QDRANT_URL is not set. Create a free cluster at cloud.qdrant.io ' +
				'and put its URL and API key in .env (see .env.example).',
		);
	}
	// apiKey is required by Qdrant Cloud and ignored by a local Docker instance,
	// so passing it unconditionally works for both.
	return new QdrantClient({ url, apiKey: process.env.QDRANT_API_KEY });
}

async function main() {
	const [file, collection] = process.argv.slice(2);
	if (!file || !collection) {
		console.error(
			'Usage: npm run bible:store -- <chunks.jsonl> <collection-name>',
		);
		process.exit(1);
	}
	if (!fs.existsSync(file)) {
		console.error(`No such file: ${file} — run the chunker that produces it first.`);
		process.exit(1);
	}

	const chunks: Chunk[] = fs
		.readFileSync(file, 'utf-8')
		.split('\n')
		.filter(Boolean)
		.map((line) => JSON.parse(line));

	const qdrant = client();

	// `createCollection` is NOT idempotent — it 409s if the collection exists,
	// and you will re-run this script every time you change your chunker.
	// recreateCollection drops and recreates, which is what a reproducible
	// ingest wants anyway: no half-overwritten state from the previous run.
	console.log(`Creating collection '${collection}' (${VECTOR_SIZE}d, ${DISTANCE})…`);
	await qdrant.recreateCollection(collection, {
		vectors: { size: VECTOR_SIZE, distance: DISTANCE },
	});

	// Payload fields are not filterable until indexed. Qdrant Cloud runs in
	// strict mode, where filtering an unindexed field is an ERROR rather than
	// just a slow scan — so skipping this works locally and fails in the cloud.
	await qdrant.createPayloadIndex(collection, {
		field_name: 'book',
		field_schema: 'keyword',
		wait: true,
	});

	let stored = 0;
	for (let i = 0; i < chunks.length; i += BATCH) {
		const batch = chunks.slice(i, i + BATCH);
		const vectors = await createEmbeddings(batch.map((c) => c.text));

		await qdrant.upsert(collection, {
			// `wait` defaults to FALSE: without this the call returns
			// 'acknowledged' before the points are searchable, and a query run
			// straight afterwards legitimately comes back empty. That looks
			// exactly like broken embeddings and is not.
			wait: true,
			points: batch.map((chunk, n) => ({
				// Point ids must be an unsigned 64-bit integer or a UUID.
				// "Genesis-1-1" is rejected at runtime with a 400 — and the
				// TypeScript type is `number | string`, so the compiler will not
				// warn you. The human-readable reference goes in the payload.
				id: i + n,
				vector: vectors[n],
				payload: { text: chunk.text, ...(chunk.metadata ?? {}) },
			})),
		});

		stored += batch.length;
		process.stdout.write(`\r  stored ${stored.toLocaleString()} / ${chunks.length.toLocaleString()}`);
	}

	const { count } = await qdrant.count(collection, { exact: true });
	console.log(`\nDone. '${collection}' holds ${count.toLocaleString()} points.`);
	console.log(`Next: npm run bible:search -- ${collection} "a question in your own words"`);
}

main().catch((err) => {
	console.error('\n' + (err instanceof Error ? err.message : String(err)));
	process.exit(1);
});
