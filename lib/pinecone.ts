import { setDefaultResultOrder } from 'node:dns';
import { Pinecone } from '@pinecone-database/pinecone';
import { createEmbeddings } from './openai';

// Prefer IPv4. On many home/office networks Node's fetch tries a broken IPv6
// route first, which shows up as endless ECONNRESET / EPIPE / "fetch failed"
// against Pinecone. IPv4-first makes those disappear.
setDefaultResultOrder('ipv4first');

export const pinecone = new Pinecone({
	apiKey: process.env.PINECONE_API_KEY!,
});

export const INDEX_NAME = process.env.PINECONE_INDEX || 'medical-notes';

/**
 * Retry a Pinecone call on transient network errors. Bulk upserts intermittently
 * hit ECONNRESET / "fetch failed" / PineconeConnectionError on some networks;
 * without a retry the whole ingest aborts partway. Retries with backoff.
 */
async function withPineconeRetry<T>(
	fn: () => Promise<T>,
	tries = 8,
): Promise<T> {
	for (let attempt = 1; ; attempt++) {
		try {
			return await fn();
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			const code = (err as { cause?: { code?: string } })?.cause?.code;
			const transient =
				code === 'ECONNRESET' ||
				code === 'EPIPE' ||
				/ECONNRESET|EPIPE|fetch failed|Request failed to reach Pinecone|network/i.test(
					msg,
				);
			if (!transient || attempt >= tries) throw err;
			// First failure is almost always a stale keep-alive socket (the
			// connection idled out while we were embedding) — retry instantly
			// and silently on a fresh connection. Warn + back off from there.
			if (attempt === 1) continue;
			const delay = Math.min(2000 * attempt, 10_000); // ~45s of patience total
			console.warn(
				`Pinecone hiccup (attempt ${attempt}/${tries}), retrying in ${delay / 1000}s…`,
			);
			await new Promise((r) => setTimeout(r, delay));
		}
	}
}

/**
 * Ensure the Pinecone index exists, create if not
 */
export async function ensureIndexExists(): Promise<void> {
	const existingIndexes = await withPineconeRetry(() =>
		pinecone.listIndexes(),
	);
	const indexExists = existingIndexes.indexes?.some(
		(idx) => idx.name === INDEX_NAME,
	);

	if (!indexExists) {
		console.log(`Creating Pinecone index: ${INDEX_NAME}`);
		await withPineconeRetry(() =>
			pinecone.createIndex({
				name: INDEX_NAME,
				dimension: 1536,
				metric: 'cosine',
				spec: {
					serverless: {
						cloud: 'aws',
						region: 'us-east-1',
					},
				},
				waitUntilReady: true,
			}),
		);
		console.log(`Index ${INDEX_NAME} created successfully`);
	} else {
		console.log(`Index ${INDEX_NAME} already exists`);
	}
}

export interface MedicalChunk {
	id: string;
	content: string; // the note content
	metadata: {
		patientId?: string;
		firstName?: string;
		lastName?: string;
		age?: number;
		gender?: string;
		race?: string;
		city?: string;
		state?: string;
		source: string;
		currentMedications?: string[];
		[key: string]: unknown;
	};
}

export interface SearchResult {
	id: string;
	score: number;
	content: string;
	metadata: MedicalChunk['metadata'];
}

export async function upsertChunks(chunks: MedicalChunk[]): Promise<number> {
	const index = pinecone.Index(INDEX_NAME);

	const batchSize = 100;
	let totalUpserted = 0;

	for (let i = 0; i < chunks.length; i += batchSize) {
		const batch = chunks.slice(i, i + batchSize);
		const texts = batch.map((c) => c.content);
		const embeddings = await createEmbeddings(texts);

		const vectors = batch.map((chunk, idx) => ({
			id: chunk.id,
			values: embeddings[idx],
			metadata: {
				...chunk.metadata,
				content: chunk.content,
			},
		}));

		await withPineconeRetry(() => index.upsert(vectors));
		totalUpserted += vectors.length;

		// Small breather between batches — keeps us clear of rate limits and
		// gives flaky networks a moment to recover. Skipped after the last batch.
		if (i + batchSize < chunks.length) {
			await new Promise((r) => setTimeout(r, 250));
		}
	}

	return totalUpserted;
}

export async function deleteAllChunks(): Promise<void> {
	const index = pinecone.Index(INDEX_NAME);
	await index.deleteAll();
}
