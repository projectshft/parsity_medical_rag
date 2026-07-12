/**
 * Tool-calling agent (instructor answer for the "manual router → tool calling" refactor)
 *
 * The working agent in `lib/agent.ts` uses a MANUAL router: an LLM classifier
 * (`analyzeQuery`) decides up front which specialists to run, then the code runs
 * them and hands the results to an aggregator.
 *
 * This version removes the hand-coded router entirely. We hand the LLM two TOOLS
 * and let *it* decide — per turn — whether to search notes, query the database,
 * both, or neither, and in what order. The Vercel AI SDK runs the tool-call loop
 * (`maxSteps`) and streams the final grounded answer.
 *
 * It is deliberately a SEPARATE module + route (`/api/chat-tools`) so the current
 * working `/api/chat` pipeline is untouched.
 */

import { streamText, tool } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { searchClinicalNotes } from "./vector-search";
import { textToSqlQuery } from "./agents/sql";
import type { Message } from "./agent";

// Honor OPENAI_BASE_URL (the LiteLLM proxy) — same wiring as lib/agent.ts.
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

const SYSTEM_PROMPT = `You are a medical records assistant with access to two tools.

- search_clinical_notes: semantic search over free-text clinical notes (SOAP notes), matched by MEANING. Use it for symptoms, narrative history, "why" questions, and anything qualitative.
- query_structured_data: answers a natural-language question with SQL over structured tables (patients, conditions, medications, observations, encounters). Use it for exact facts: counts, filters, dates, "how many", "which patients".

Decide which tool(s) to call — you may call both, call one twice, or answer directly if no lookup is needed. Then answer ONLY from the tool results. If the data isn't there, say so plainly — never invent or infer medical information. Report counts directly, group related facts, and include dates for temporal context.`;

/**
 * Run the tool-calling agent. Returns the AI SDK stream result (the caller
 * streams it back or awaits `.text`).
 */
export function runAgentWithTools(query: string, history: Message[] = []) {
  return streamText({
    model: openai("gpt-4o-mini"),
    system: SYSTEM_PROMPT,
    // Let the model take several turns: call a tool, read the result, maybe call
    // another, then produce the final answer.
    maxSteps: 6,
    messages: [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: query },
    ],
    tools: {
      search_clinical_notes: tool({
        description:
          "Semantic search over clinical notes. Returns notes matched by meaning (not exact keywords). Use for symptoms, narrative, and qualitative questions.",
        parameters: z.object({
          query: z
            .string()
            .describe("What to look for, phrased in natural language"),
          topK: z
            .number()
            .int()
            .positive()
            .max(20)
            .default(8)
            .describe("How many notes to return"),
        }),
        execute: async ({ query, topK }) => {
          const results = await searchClinicalNotes(query, { topK });
          // Return only what the model needs to reason and cite.
          return results.map((r) => ({
            patient: r.patientName ?? "unknown",
            date: r.date ?? "",
            type: r.documentType,
            score: Number(r.score.toFixed(3)),
            note: r.contentPreview,
          }));
        },
      }),
      query_structured_data: tool({
        description:
          "Answer a question using SQL over the structured tables (patients, conditions, medications, observations, encounters). Use for exact facts, counts, filters, and dates.",
        parameters: z.object({
          question: z
            .string()
            .describe("A natural-language question to answer from the database"),
        }),
        execute: async ({ question }) => {
          const r = await textToSqlQuery(question, history);
          return {
            sql: r.sql,
            explanation: r.explanation,
            rowCount: r.rows.length,
            rows: r.rows.slice(0, 25),
            error: r.error ?? null,
          };
        },
      }),
    },
  });
}
