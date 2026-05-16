import { Pinecone } from "@pinecone-database/pinecone";
import { createEmbedding, createEmbeddings } from "./openai";

export const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

export const INDEX_NAME = process.env.PINECONE_INDEX || "medical-notes";

// Backwards compatibility
export function getPinecone(): Pinecone {
  return pinecone;
}

export function getIndexName(): string {
  return INDEX_NAME;
}

/**
 * Ensure the Pinecone index exists, create if not
 */
export async function ensureIndexExists(): Promise<void> {
  const pinecone = getPinecone();
  const indexName = getIndexName();

  const existingIndexes = await pinecone.listIndexes();
  const indexExists = existingIndexes.indexes?.some(idx => idx.name === indexName);

  if (!indexExists) {
    console.log(`Creating Pinecone index: ${indexName}`);
    await pinecone.createIndex({
      name: indexName,
      dimension: 1536,
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1',
        },
      },
      waitUntilReady: true,
    });
    console.log(`Index ${indexName} created successfully`);
  } else {
    console.log(`Index ${indexName} already exists`);
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
  const index = getPinecone().Index(getIndexName());

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

    await index.upsert(vectors);
    totalUpserted += vectors.length;
  }

  return totalUpserted;
}

export async function searchChunks(
  query: string,
  topK: number = 10
): Promise<SearchResult[]> {
  const index = getPinecone().Index(getIndexName());
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
  const index = getPinecone().Index(getIndexName());
  await index.deleteAll();
}
