/**
 * Medical RAG Agent — YOUR TASK
 *
 * Build the chat agent as an explicit multi-agent pipeline:
 *
 *   router  →  [ sql agent ‖ vector agent ]  →  aggregator  →  stream
 *
 * 1. ROUTER      — read the question and decide which specialists to run.
 * 2. SPECIALISTS — a SQL agent (exact facts) and a vector agent (meaning)
 *                  run IN PARALLEL; each returns only its slice.
 * 3. AGGREGATOR  — an LLM synthesizes both slices into one grounded answer,
 *                  streamed back to the client (Vercel AI SDK `streamText`).
 * (Later: detect a scheduling intent and return a schedulingAction for the UI.)
 *
 * Reuse what exists: `analyzeQuery` (the router), `textToSqlQuery` (the SQL
 * agent — it writes the query) + `searchClinicalNotes` (the two specialists),
 * `formatResultsForLLM` (turns results into context), `detectSchedulingIntent`,
 * `traced`.
 */

import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { analyzeQuery } from "./query-analyzer";
import type { QueryAnalysis } from "./query-analyzer";
import { textToSqlQuery } from "./text-to-sql";
import { findPatientByName } from "./patients";
import { searchClinicalNotes } from "./vector-search";
import { formatResultsForLLM } from "./query-executor";
import type { QueryResult } from "./types";
import { detectSchedulingIntent } from "./scheduling";
import { traced } from "./langsmith";

// TODO: Write the aggregator system prompt — it synthesizes the SQL agent's
// facts + the vector agent's notes into one answer, grounded ONLY in that data.
const AGGREGATOR_PROMPT = `You are a medical records assistant.

TODO: Complete this prompt (synthesize the retrieved data; never invent facts).`;

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

// TODO: ROUTER — return the analysis that decides which agents run.
// async function routeQuery(query: string): Promise<QueryAnalysis> { ... analyzeQuery ... }

// TODO: SQL AGENT — return textToSqlQuery(query, conversationHistory).
// TODO: VECTOR AGENT — return searchClinicalNotes(analysis.semanticQuery || query, { topK: 10 }).

export async function runAgent(
  query: string,
  conversationHistory: Message[] = []
): Promise<AgentResponse> {
  // TODO 1 — ROUTER: const analysis = await analyzeQuery(query)
  //          Decide useSql / useVector from analysis.requiresSQL / requiresVector
  //          (fall back to a vector search when the router sets neither).

  // TODO 2 — SPECIALISTS IN PARALLEL:
  //   const [sql, vectorResults] = await Promise.all([
  //     useSql ? textToSqlQuery(query, conversationHistory) : Promise.resolve(undefined),
  //     useVector ? searchClinicalNotes(analysis.semanticQuery || query, { topK: 10 }) : Promise.resolve(undefined),
  //   ]);
  //   (Wrap each in `traced("sql_agent" | "vector_agent", ...)` so you can see them.)

  // TODO 3 — AGGREGATOR: build a QueryResult { analysis, sql?, vectorResults? },
  //          const context = formatResultsForLLM(result), then stream the answer.

  // TODO (later) — scheduling: detectSchedulingIntent + findPatientByName; only
  //          return a schedulingAction when the named patient actually exists.

  const stream = streamText({
    model: openai("gpt-4o-mini"),
    system: AGGREGATOR_PROMPT,
    messages: [{ role: "user" as const, content: query }],
  });

  return { stream };
}

// Helper you'll want once scheduling is wired in.
function getDefaultDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString().split("T")[0];
}
