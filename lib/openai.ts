import OpenAI from 'openai';
import { wrapOpenAI } from 'langsmith/wrappers/openai';
import { createOpenAI } from '@ai-sdk/openai';

// wrapOpenAI auto-logs every call to LangSmith when LANGSMITH_TRACING=true.
// No per-call wrapper needed — just wrap the client once.
export const openai = wrapOpenAI(
	new OpenAI({
		apiKey: process.env.OPENAI_API_KEY,
		baseURL: process.env.OPENAI_BASE_URL,
	}),
);

// The Vercel AI SDK provider (for streamText in the aggregator), honoring the
// same OPENAI_BASE_URL proxy as the OpenAI SDK client above. Exported here so
// there's ONE place that configures how we talk to OpenAI.
export const openaiProvider = createOpenAI({
	apiKey: process.env.OPENAI_API_KEY,
	baseURL: process.env.OPENAI_BASE_URL,
});

// The embedding size. A one-way door: every vector in an index must have this
// many dimensions, so changing it means a new index and re-embedding everything.
export const EMBEDDING_DIMENSIONS = 1536;

export async function createEmbedding(text: string): Promise<number[]> {
	const response = await openai.embeddings.create({
		model: 'text-embedding-3-small',
		input: text,
		dimensions: EMBEDDING_DIMENSIONS,
	});
	return response.data[0].embedding;
}

export async function createEmbeddings(texts: string[]): Promise<number[][]> {
	const response = await openai.embeddings.create({
		model: 'text-embedding-3-small',
		input: texts,
		dimensions: EMBEDDING_DIMENSIONS,
	});
	return response.data.map((d) => d.embedding);
}
