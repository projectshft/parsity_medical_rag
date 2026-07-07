import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // Route through the LiteLLM proxy when set (dogfoods it + enforces budgets).
  // Unset -> SDK falls back to api.openai.com.
  baseURL: process.env.OPENAI_BASE_URL,
});

// Backwards compatibility
export function getOpenAIClient(): OpenAI {
  return openai;
}

export async function createEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    dimensions: 1536,
  });
  return response.data[0].embedding;
}

export async function createEmbeddings(
  texts: string[]
): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
    dimensions: 1536,
  });
  return response.data.map((d) => d.embedding);
}
