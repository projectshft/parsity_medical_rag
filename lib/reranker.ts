import { Pinecone } from "@pinecone-database/pinecone";
import { SearchResult } from "./pinecone";

// Pinecone's hosted reranker — re-scores the vector-search candidates against
// the query and reorders them. No separate provider/key: it runs on the same
// PINECONE_API_KEY. bge-reranker-v2-m3 is the model Pinecone Inference exposes.
const RERANK_MODEL = "bge-reranker-v2-m3";

let _pc: Pinecone | null = null;
function pc(): Pinecone {
  if (!_pc) _pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  return _pc;
}

export async function rerankResults(
  query: string,
  results: SearchResult[],
  topN: number = 5
): Promise<SearchResult[]> {
  if (results.length === 0) return [];
  // No point paying to reorder a list that's already <= what we return.
  if (results.length <= topN) return results;

  try {
    const response = await pc().inference.rerank(
      RERANK_MODEL,
      query,
      results.map((r) => r.content),
      { topN, returnDocuments: false }
    );

    // response.data is [{ index, score }] in descending relevance order.
    return response.data.map((d) => ({
      ...results[d.index],
      score: d.score,
    }));
  } catch (error) {
    // Degraded search beats no search: fall back to the original vector order.
    // Fails SOFT — the only signal is this log line + a quiet drop in hit@5.
    console.error("Reranking failed, using original order:", error);
    return results.slice(0, topN);
  }
}
