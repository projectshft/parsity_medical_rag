import OpenAI from "openai";

let _openaiClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!_openaiClient) {
    _openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openaiClient;
}

export async function createEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIClient();
  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    dimensions: 1536,
  });
  return response.data[0].embedding;
}

export async function createEmbeddings(
  texts: string[]
): Promise<number[][]> {
  const client = getOpenAIClient();
  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
    dimensions: 1536,
  });
  return response.data.map((d) => d.embedding);
}
