import { Pinecone } from "@pinecone-database/pinecone";
import { createEmbedding, createEmbeddings } from "./openai";

export const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

export const INDEX_NAME = process.env.PINECONE_INDEX || "medical-notes";

/**
 * Retry a Pinecone call on transient network errors. Bulk upserts intermittently
 * hit ECONNRESET / "fetch failed" / PineconeConnectionError on some networks;
 * without a retry the whole ingest aborts partway. Retries with backoff.
 */
async function withPineconeRetry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = (err as { cause?: { code?: string } })?.cause?.code;
      const transient =
        code === "ECONNRESET" ||
        code === "EPIPE" ||
        /ECONNRESET|EPIPE|fetch failed|Request failed to reach Pinecone|network/i.test(msg);
      if (!transient || attempt >= tries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

/**
 * Ensure the Pinecone index exists, create if not
 */
export async function ensureIndexExists(): Promise<void> {
  const existingIndexes = await pinecone.listIndexes();
  const indexExists = existingIndexes.indexes?.some((idx) => idx.name === INDEX_NAME);

  if (!indexExists) {
    console.log(`Creating Pinecone index: ${INDEX_NAME}`);
    await pinecone.createIndex({
      name: INDEX_NAME,
      dimension: 1536,
      metric: "cosine",
      spec: {
        serverless: {
          cloud: "aws",
          region: "us-east-1",
        },
      },
      waitUntilReady: true,
    });
    console.log(`Index ${INDEX_NAME} created successfully`);
  } else {
    console.log(`Index ${INDEX_NAME} already exists`);
  }
}

export interface MedicalChunk {
  id: string;
  content: string;
  metadata: {
    resourceType: string;
    patientId?: string;
    patientName?: string;
    recordDate?: string;
    source: string;
    chunkIndex: number;
    [key: string]: unknown;
  };
}

export interface SearchResult {
  id: string;
  score: number;
  content: string;
  metadata: MedicalChunk["metadata"];
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
  }

  return totalUpserted;
}

export async function searchChunks(
  query: string,
  topK: number = 10
): Promise<SearchResult[]> {
  const index = pinecone.Index(INDEX_NAME);
  const queryEmbedding = await createEmbedding(query);

  const results = await index.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
  });

  return results.matches?.map((match) => ({
    id: match.id,
    score: match.score || 0,
    content: (match.metadata?.content as string) || "",
    metadata: match.metadata as MedicalChunk["metadata"],
  })) || [];
}

export async function deleteAllChunks(): Promise<void> {
  const index = pinecone.Index(INDEX_NAME);
  await index.deleteAll();
}
