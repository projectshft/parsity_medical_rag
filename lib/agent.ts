/**
 * Medical RAG Agent
 *
 * Week 4: Build the agent that orchestrates queries and generates responses
 *
 * This agent:
 * 1. Analyzes the user query
 * 2. Executes appropriate retrieval (SQL and/or vector)
 * 3. Formats results as context
 * 4. Generates a response using the LLM
 */

import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { executeQuery, formatResultsForLLM } from "./query-executor";

/**
 * TODO: Write the system prompt for the medical assistant
 *
 * The prompt should:
 * 1. Define the assistant's role
 * 2. Explain what data sources are available
 * 3. List the types of queries it can handle
 * 4. Set guidelines for:
 *    - Accuracy (only use retrieved data)
 *    - Privacy (respect patient confidentiality)
 *    - Formatting (organize information clearly)
 *    - Limitations (what to do if info not found)
 *
 * Discussion points:
 * - What tone is appropriate for healthcare providers?
 * - What safety guardrails should we include?
 * - How should we handle uncertain or missing information?
 */
const SYSTEM_PROMPT = `You are a helpful medical records assistant.

TODO: Complete this system prompt!

Your capabilities:
- ...

Guidelines:
- ...
`;

export interface Message {
  role: "user" | "assistant";
  content: string;
}

/**
 * Run the medical RAG agent
 *
 * TODO: Review and understand this function
 *
 * The flow is:
 * 1. Execute hybrid query to retrieve relevant data
 * 2. Format results as context for the LLM
 * 3. Build the messages array with conversation history
 * 4. Stream the response
 *
 * Consider:
 * - How does the query analysis info help the LLM?
 * - Why do we include conversation history?
 * - What happens if no results are found?
 */
export async function runAgent(
  query: string,
  conversationHistory: Message[] = []
) {
  // Step 1: Execute hybrid query (SQL + Vector)
  const queryResult = await executeQuery(query, { vectorTopK: 10 });

  // Step 2: Format results for LLM context
  const context = formatResultsForLLM(queryResult);

  // Step 3: Include query analysis info for transparency
  const analysisInfo = `Query Analysis:
- Intent: ${queryResult.analysis.intent}
- Requires SQL: ${queryResult.analysis.requiresSQL}
- Requires Vector Search: ${queryResult.analysis.requiresVector}
${queryResult.analysis.semanticQuery ? `- Semantic Query: "${queryResult.analysis.semanticQuery}"` : ''}
${queryResult.analysis.entities.patientName ? `- Patient Name: "${queryResult.analysis.entities.patientName}"` : ''}
${queryResult.analysis.entities.conditions?.length ? `- Conditions: ${queryResult.analysis.entities.conditions.join(', ')}` : ''}
`;

  // Step 4: Build messages array
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

  // Step 5: Stream response
  const response = await streamText({
    model: openai("gpt-4o-mini"),
    system: SYSTEM_PROMPT,
    messages,
  });

  return response;
}
