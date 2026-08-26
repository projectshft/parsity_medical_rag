/**
 * Shared types that don't belong to one module.
 *
 * Keep this file small. Types that describe a single module's surface live
 * next to that module (e.g. `MedicalChunk` in lib/pinecone.ts).
 */

/** One retrieved clinical note, after search + rerank. */
export type RetrievedNote = {
	id: string;
	/** Relevance score. Cosine similarity pre-rerank, rerank score post-rerank. */
	score: number;
	/** The note text — what was embedded. */
	content: string;
	metadata: Record<string, unknown>;
};
