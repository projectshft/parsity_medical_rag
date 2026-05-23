/**
 * Medical RAG Agent
 *
 * Week 4: Build the agent that orchestrates queries and generates responses
 * Week 5: Add human-in-the-loop scheduling capability
 *
 * This agent:
 * 1. Analyzes the user query
 * 2. Detects scheduling intent (human-in-the-loop)
 * 3. Executes appropriate retrieval (SQL and/or vector)
 * 4. Formats results as context
 * 5. Generates a response using the LLM
 */

import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { executeQuery, formatResultsForLLM } from "./query-executor";
import { detectSchedulingIntent } from "./scheduling";
import { traced } from "./langsmith";

// TODO: Write the system prompt for the medical assistant
const SYSTEM_PROMPT = `You are a helpful medical records assistant.

TODO: Complete this system prompt!
`;

export interface Message {
  role: "user" | "assistant";
  content: string;
}

/**
 * Response from the agent, including optional scheduling action
 *
 * TODO: Understand this interface for human-in-the-loop pattern
 * - stream: The streaming LLM response
 * - schedulingAction: If detected, contains scheduling details for UI
 */
export interface AgentResponse {
  stream: ReturnType<typeof streamText>;
  schedulingAction?: {
    patientName: string;
    suggestedDate: string;
    suggestedTime: string;
    reason?: string | null;
  };
}

/**
 * Run the medical RAG agent
 *
 * TODO: Integrate scheduling detection for human-in-the-loop pattern
 * 1. Call detectSchedulingIntent(query) FIRST
 * 2. If scheduling detected, use a different system prompt
 * 3. Return schedulingAction in the response if applicable
 */
export async function runAgent(
  query: string,
  conversationHistory: Message[] = []
): Promise<AgentResponse> {
  // TODO: Step 1 - Detect scheduling intent
  // const schedulingIntent = await detectSchedulingIntent(query);

  // Step 2: Execute hybrid query (SQL + Vector) with LangSmith tracing
  const queryResult = await traced(
    'execute_query',
    () => executeQuery(query, { vectorTopK: 10 }),
    { runType: 'chain', inputs: { query } }
  );

  // Step 3: Format results for LLM context
  const context = formatResultsForLLM(queryResult);

  // Step 4: Include query analysis info for transparency
  const analysisInfo = `Query Analysis:
- Intent: ${queryResult.analysis.intent}
- Requires SQL: ${queryResult.analysis.requiresSQL}
- Requires Vector Search: ${queryResult.analysis.requiresVector}
${queryResult.analysis.semanticQuery ? `- Semantic Query: "${queryResult.analysis.semanticQuery}"` : ''}
${queryResult.analysis.entities.patientName ? `- Patient Name: "${queryResult.analysis.entities.patientName}"` : ''}
${queryResult.analysis.entities.conditions?.length ? `- Conditions: ${queryResult.analysis.entities.conditions.join(', ')}` : ''}
`;

  // TODO: Step 5 - Choose system prompt based on scheduling intent
  // const systemPrompt = schedulingIntent.isSchedulingRequest
  //   ? SCHEDULING_SYSTEM_PROMPT
  //   : SYSTEM_PROMPT;

  // Step 6: Build messages array
  const messages = [
    ...conversationHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    {
      role: "user" as const,
      content: `${analysisInfo}

Retrieved Data:
${context}

User Question: ${query}`,
    },
  ];

  // Step 7: Stream response
  const stream = streamText({
    model: openai("gpt-4o-mini"),
    system: SYSTEM_PROMPT,
    messages,
  });

  // TODO: Step 8 - Return scheduling action if detected
  // return {
  //   stream,
  //   schedulingAction: schedulingIntent.isSchedulingRequest && schedulingIntent.patientName
  //     ? {
  //         patientName: schedulingIntent.patientName,
  //         suggestedDate: schedulingIntent.suggestedDate || getDefaultDate(),
  //         suggestedTime: schedulingIntent.suggestedTime || '09:00',
  //         reason: schedulingIntent.reason,
  //       }
  //     : undefined,
  // };

  return { stream };
}

/**
 * Get default date (next business day)
 */
function getDefaultDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString().split('T')[0];
}
