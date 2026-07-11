import OpenAI from 'openai';
import { createOpenAI } from '@ai-sdk/openai';

export const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
	baseURL: process.env.OPENAI_BASE_URL,
});

// Backwards compatibility
export function getOpenAIClient(): OpenAI {
	return openai;
}

// The Vercel AI SDK provider (for streamText in the aggregator), honoring the
// same OPENAI_BASE_URL proxy as the OpenAI SDK client above. Exported here so
// there's ONE place that configures how we talk to OpenAI.
export const openaiProvider = createOpenAI({
	apiKey: process.env.OPENAI_API_KEY,
	baseURL: process.env.OPENAI_BASE_URL,
});

export async function createEmbedding(text: string): Promise<number[]> {
	const response = await openai.embeddings.create({
		model: 'text-embedding-3-small',
		input: text,
		dimensions: 1536,
	});
	return response.data[0].embedding;
}

export async function createEmbeddings(texts: string[]): Promise<number[][]> {
	const response = await openai.embeddings.create({
		model: 'text-embedding-3-small',
		input: texts,
		dimensions: 1536,
	});
	return response.data.map((d) => d.embedding);
}
