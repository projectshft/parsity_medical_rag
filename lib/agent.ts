import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

// Configure the AI SDK provider to honor OPENAI_BASE_URL (the LiteLLM proxy).
// The default `openai` export ignores OPENAI_BASE_URL and always hits
// api.openai.com — which 401s with a proxy-issued key and streams nothing
// (blank assistant bubble). baseURL undefined -> defaults to api.openai.com/v1.
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});
import { analyzeQuery } from "./query-analyzer";
import type { QueryAnalysis } from "./query-analyzer";
import { findPatientByName } from "./sql-queries";
import { textToSqlQuery } from "./text-to-sql";
import type { TextToSqlResult } from "./text-to-sql";
import { searchClinicalNotes } from "./vector-search";
import { formatResultsForLLM } from "./query-executor";
import type { QueryResult } from "./types";
import { traced } from "./langsmith";
import { detectSchedulingIntent } from "./scheduling";

/**
 * Multi-agent chat pipeline:
 *
 *   router  →  [ sql agent ‖ vector agent ]  →  aggregator  →  stream
 *
 * 1. ROUTER      — reads the question, decides which specialist agents to run.
 * 2. SPECIALISTS — the SQL agent (exact facts) and the vector agent (meaning)
 *                  run IN PARALLEL; each returns only its slice.
 * 3. AGGREGATOR  — an LLM synthesizes both slices into one grounded answer,
 *                  streamed back to the client (Vercel AI SDK `streamText`).
 */

const AGGREGATOR_PROMPT = `You are a medical records assistant. Two specialist agents have already retrieved data for you: a SQL agent (exact facts — patients, conditions, medications, labs, counts) and a vector-search agent (relevant clinical notes, matched by meaning). Your job is to synthesize their results into one clear answer.

Guidelines:
- Answer ONLY from the retrieved data below. If it isn't there, say so plainly — never invent or infer medical information.
- When the data includes a count or population statistic, report that number directly.
- Group related information (all conditions, all medications) and include dates for temporal context.
- Explain medical terminology when it helps; flag anything potentially concerning.
- If asked about multiple patients, organize the response by patient.
- Respect privacy: discuss only the records provided.`;

const SCHEDULING_SYSTEM_PROMPT = `You are a helpful medical records assistant that can also help schedule patient appointments.

When the user asks to schedule an appointment:
1. Confirm the patient name and any relevant context from their records
2. Acknowledge the scheduling request
3. Let them know a scheduling form will appear for them to confirm

Keep your response brief when scheduling - the UI will handle the actual booking.`;

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

// --- The agents -----------------------------------------------------------

/** ROUTER: massage the question into a plan — which agents to run, with what. */
async function routeQuery(
  query: string,
  history: Message[]
): Promise<QueryAnalysis> {
  return traced("router", () => analyzeQuery(query, history), {
    runType: "chain",
    inputs: { query },
  });
}

/** SQL AGENT: the LLM writes one read-only SELECT against the schema (text-to-SQL). */
async function runSqlAgent(query: string, history: Message[]) {
  return traced("sql_agent", () => textToSqlQuery(query, history), {
    runType: "chain",
    inputs: { query },
  });
}

/** Render the text-to-SQL result as context for the aggregator. */
function formatSqlResult(r: TextToSqlResult): string {
  const parts = [`## Structured data (SQL)`, `_${r.explanation}_`];
  if (r.error) {
    parts.push(`The query failed: ${r.error}. Tell the user you couldn't retrieve that.`);
  } else if (r.rows.length === 0) {
    parts.push(`0 rows — nothing in the records matches. Say there are none.`);
  } else {
    parts.push(`${r.rows.length} row(s):`);
    for (const row of r.rows.slice(0, 25)) {
      parts.push("- " + Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(", "));
    }
  }
  return parts.join("\n");
}

/** VECTOR AGENT: meaning-based search over the clinical notes. */
async function runVectorAgent(analysis: QueryAnalysis, query: string) {
  const semanticQuery = analysis.semanticQuery || query;
  return traced("vector_agent", () => searchClinicalNotes(semanticQuery, { topK: 10 }), {
    runType: "retriever",
    inputs: { query: semanticQuery },
  });
}

// --- Orchestration --------------------------------------------------------

export async function runAgent(
  query: string,
  conversationHistory: Message[] = []
): Promise<AgentResponse> {
  // Scheduling is a separate intent detector (unchanged). Only offer a
  // scheduling card when the named patient actually exists in the records.
  const schedulingIntent = await detectSchedulingIntent(query, conversationHistory);
  let matchedPatient: { firstName: string | null; lastName: string | null } | null = null;
  if (schedulingIntent.isSchedulingRequest && schedulingIntent.patientName) {
    const matches = await findPatientByName(schedulingIntent.patientName);
    matchedPatient = matches[0] ?? null;
  }
  const willSchedule = schedulingIntent.isSchedulingRequest && matchedPatient !== null;

  // 1. ROUTER — decide which specialist agents to run (history lets it
  //    resolve follow-up references like "their meds" / "the younger ones").
  const analysis = await routeQuery(query, conversationHistory);
  const useSql = analysis.requiresSQL;
  // Fall back to a note search when the router is unsure (neither flag set).
  const useVector = analysis.requiresVector || (!analysis.requiresSQL && !analysis.requiresVector);

  // 2. SPECIALIST AGENTS — run in parallel; each returns only its slice.
  //    SQL side is now text-to-SQL: the LLM writes the query from the schema.
  const [sqlResults, vectorResults] = await Promise.all([
    useSql ? runSqlAgent(query, conversationHistory) : Promise.resolve(undefined),
    useVector ? runVectorAgent(analysis, query) : Promise.resolve(undefined),
  ]);

  // 3. AGGREGATOR — hand both slices to the LLM to synthesize and stream.
  //    Vector formatting is unchanged; the SQL block comes from text-to-SQL.
  const vectorContext = vectorResults
    ? formatResultsForLLM({ analysis, vectorResults })
    : "";
  const sqlContext = sqlResults ? formatSqlResult(sqlResults) : "";
  const context = [sqlContext, vectorContext].filter(Boolean).join("\n\n");

  const analysisInfo = `Routing plan:
- Intent: ${analysis.intent}
- SQL agent: ${useSql ? "ran" : "skipped"}
- Vector agent: ${useVector ? "ran" : "skipped"}`;

  const schedulingNote =
    schedulingIntent.isSchedulingRequest && !matchedPatient
      ? `\n\nNote: The user asked to schedule an appointment${
          schedulingIntent.patientName ? ` for "${schedulingIntent.patientName}"` : ""
        }, but no matching patient was found in the records. Tell the user you could not find that patient and ask them to verify the name. Do NOT confirm or suggest an appointment.`
      : "";

  const systemPrompt = willSchedule ? SCHEDULING_SYSTEM_PROMPT : AGGREGATOR_PROMPT;

  const messages = [
    ...conversationHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    {
      role: "user" as const,
      content: `${analysisInfo}\n\nRetrieved data:\n${context}\n\nUser question: ${query}${schedulingNote}`,
    },
  ];

  const stream = streamText({
    model: openai("gpt-4o-mini"),
    system: systemPrompt,
    messages,
  });

  return {
    stream,
    schedulingAction:
      willSchedule && matchedPatient
        ? {
            patientName: [matchedPatient.firstName, matchedPatient.lastName]
              .filter(Boolean)
              .join(" "),
            suggestedDate: schedulingIntent.suggestedDate || getDefaultDate(),
            suggestedTime: schedulingIntent.suggestedTime || "09:00",
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
  return date.toISOString().split("T")[0];
}
