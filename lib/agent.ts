import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { executeQuery, formatResultsForLLM } from "./query-executor";
import { findPatientByName } from "./sql-queries";
import { traced } from "./langsmith";
import { detectSchedulingIntent } from "./scheduling";

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
- Provide context for lab values when available
- When the records include a population statistic or count, report that number directly`;

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

export async function runAgent(
  query: string,
  conversationHistory: Message[] = []
): Promise<AgentResponse> {
  // Check for scheduling intent first (pass conversation history for context)
  const schedulingIntent = await detectSchedulingIntent(query, conversationHistory);

  // Only schedule if the named patient actually exists in the records.
  // A request with no name, or a name that matches no patient, must NOT
  // produce a scheduling card.
  let matchedPatient: { firstName: string | null; lastName: string | null } | null = null;
  if (schedulingIntent.isSchedulingRequest && schedulingIntent.patientName) {
    const matches = await findPatientByName(schedulingIntent.patientName);
    matchedPatient = matches[0] ?? null;
  }
  const willSchedule =
    schedulingIntent.isSchedulingRequest && matchedPatient !== null;

  // Run the hybrid query system: analyze the query, route it to SQL and/or
  // vector search, and format the combined result for the LLM. This is the
  // same executeQuery the /api/query endpoint uses — so the chat answers
  // structured questions (counts, filters) AND semantic ones.
  const queryResult = await traced(
    "execute_query",
    () => executeQuery(query, { vectorTopK: 10 }),
    { runType: "chain", inputs: { query } }
  );

  const context = formatResultsForLLM(queryResult);

  const analysisInfo = `Query Analysis:
- Intent: ${queryResult.analysis.intent}
- Requires SQL: ${queryResult.analysis.requiresSQL}
- Requires Vector Search: ${queryResult.analysis.requiresVector}`;

  // If the user asked to schedule but no patient matched, tell the model to
  // say so and book nothing (the UI will show no scheduling card).
  const schedulingNote =
    schedulingIntent.isSchedulingRequest && !matchedPatient
      ? `\n\nNote: The user asked to schedule an appointment${
          schedulingIntent.patientName ? ` for "${schedulingIntent.patientName}"` : ""
        }, but no matching patient was found in the records. Tell the user you could not find that patient and ask them to verify the name. Do NOT confirm or suggest an appointment.`
      : "";

  // Use the scheduling prompt only when we'll actually offer to schedule.
  const systemPrompt = willSchedule ? SCHEDULING_SYSTEM_PROMPT : SYSTEM_PROMPT;

  // Build messages array
  const messages = [
    ...conversationHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    {
      role: "user" as const,
      content: `${analysisInfo}\n\nRetrieved Data:\n${context}\n\nUser question: ${query}${schedulingNote}`,
    },
  ];

  // Stream response
  const stream = streamText({
    model: openai("gpt-4o-mini"),
    system: systemPrompt,
    messages,
  });

  // Return a scheduling action only when a real patient was matched.
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
