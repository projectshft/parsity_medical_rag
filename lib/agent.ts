import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { searchChunks, SearchResult } from "./pinecone";
import { rerankResults } from "./reranker";
import { traced } from "./langsmith";
import { detectSchedulingIntent, formatSchedulingAction } from "./scheduling";

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

const SCHEDULING_SYSTEM_PROMPT = `You are a helpful medical records assistant that can also help schedule patient appointments.

When the user asks to schedule an appointment:
1. Confirm the patient name and any relevant context from their records
2. Acknowledge the scheduling request
3. Let them know a scheduling form will appear for them to confirm

Keep your response brief when scheduling - the UI will handle the actual booking.`;

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

export interface AgentResponse {
  stream: ReturnType<typeof streamText>;
  schedulingAction?: {
    patientName: string;
    suggestedDate: string;
    suggestedTime: string;
    reason?: string | null;
  };
}

export async function runAgent(
  query: string,
  conversationHistory: Message[] = []
): Promise<AgentResponse> {
  // Check for scheduling intent first
  const schedulingIntent = await detectSchedulingIntent(query);

  // Search for relevant records (with optional tracing)
  const searchResults = await traced(
    'vector_search',
    () => searchChunks(query, 20),
    { runType: 'retriever', inputs: { query, topK: 20 } }
  );

  // Rerank results (with optional tracing)
  const rerankedResults = await traced(
    'rerank',
    () => rerankResults(query, searchResults, 10),
    { runType: 'chain', inputs: { query, resultsCount: searchResults.length } }
  );

  // Build context from results
  const context = buildContext(rerankedResults);

  // Choose system prompt based on scheduling intent
  const systemPrompt = schedulingIntent.isSchedulingRequest
    ? SCHEDULING_SYSTEM_PROMPT
    : SYSTEM_PROMPT;

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
  const stream = streamText({
    model: openai("gpt-4o-mini"),
    system: systemPrompt,
    messages,
  });

  // Return stream with scheduling action if applicable
  return {
    stream,
    schedulingAction: schedulingIntent.isSchedulingRequest && schedulingIntent.patientName
      ? {
          patientName: schedulingIntent.patientName,
          suggestedDate: schedulingIntent.suggestedDate || getDefaultDate(),
          suggestedTime: schedulingIntent.suggestedTime || '09:00',
          reason: schedulingIntent.reason,
        }
      : undefined,
  };
}

function getDefaultDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString().split('T')[0];
}
