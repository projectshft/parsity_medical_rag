import { CohereClient } from "cohere-ai";
import { SearchResult } from "./pinecone";

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

export async function rerankResults(
  query: string,
  results: SearchResult[],
  topN: number = 5
): Promise<SearchResult[]> {
  if (results.length === 0) return [];
  if (results.length <= topN) return results;

  try {
    const response = await cohere.rerank({
      model: "rerank-english-v3.0",
      query,
      documents: results.map((r) => r.content),
      topN,
    });

    return response.results.map((r) => ({
      ...results[r.index],
      score: r.relevanceScore,
    }));
  } catch (error) {
    console.error("Reranking failed, using original order:", error);
    return results.slice(0, topN);
  }
}
