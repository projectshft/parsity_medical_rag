import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { searchChunks, SearchResult } from "./pinecone";
import { rerankResults } from "./reranker";

const SYSTEM_PROMPT = `You are a helpful medical records assistant. You help users query and understand medical records from FHIR data.

Important guidelines:
- Provide accurate information based only on the retrieved medical records
- If information is not in the records, clearly state that
- Never make up or infer medical information that isn't explicitly in the records
- Present information in a clear, organized manner
- Use medical terminology appropriately but explain it when needed
- Respect patient privacy - only discuss records in the context provided
- If asked about multiple patients, organize responses by patient
- Highlight important medical information like diagnoses, medications, and allergies
- Include dates when available to provide temporal context

When presenting medical information:
- Group related information together (e.g., all medications, all conditions)
- Note any potentially concerning findings
- Provide context for lab values when available`;

function buildContext(results: SearchResult[]): string {
  if (results.length === 0) {
    return "No relevant medical records found.";
  }

  const byPatient = new Map<string, SearchResult[]>();
  const noPatient: SearchResult[] = [];

  for (const result of results) {
    const patientId = result.metadata.patientId;
    if (patientId) {
      const existing = byPatient.get(patientId) || [];
      existing.push(result);
      byPatient.set(patientId, existing);
    } else {
      noPatient.push(result);
    }
  }

  let context = "=== Retrieved Medical Records ===\n\n";

  Array.from(byPatient.entries()).forEach(([patientId, patientResults]) => {
    const patientName = patientResults[0]?.metadata.patientName || "Unknown";
    context += `--- Patient: ${patientName} (ID: ${patientId}) ---\n\n`;

    const byType = new Map<string, SearchResult[]>();
    for (const result of patientResults) {
      const type = result.metadata.resourceType;
      const existing = byType.get(type) || [];
      existing.push(result);
      byType.set(type, existing);
    }

    Array.from(byType.entries()).forEach(([type, typeResults]) => {
      context += `[${type}]\n`;
      for (const result of typeResults) {
        context += result.content + "\n";
        if (result.metadata.recordDate) {
          context += `(Recorded: ${result.metadata.recordDate})\n`;
        }
        context += "\n";
      }
    });
  });

  if (noPatient.length > 0) {
    context += "--- Additional Records ---\n\n";
    for (const result of noPatient) {
      context += `[${result.metadata.resourceType}]\n`;
      context += result.content + "\n\n";
    }
  }

  return context;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function runAgent(
  query: string,
  conversationHistory: Message[] = []
) {
  // Search for relevant records
  const searchResults = await searchChunks(query, 20);

  // Rerank results
  const rerankedResults = await rerankResults(query, searchResults, 10);

  // Build context from results
  const context = buildContext(rerankedResults);

  // Build messages array
  const messages = [
    ...conversationHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    {
      role: "user" as const,
      content: `Context from medical records:\n\n${context}\n\nUser question: ${query}`,
    },
  ];

  // Stream response
  const response = await streamText({
    model: openai("gpt-4o-mini"),
    system: SYSTEM_PROMPT,
    messages,
  });

  return response;
}
