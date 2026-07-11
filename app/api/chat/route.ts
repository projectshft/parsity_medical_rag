import { NextResponse } from "next/server";
import { z } from "zod";

import { runSpecialists } from "@/lib/agents/orchestrate";
import { aggregate, SCHEDULING_SYSTEM_PROMPT } from "@/lib/agents/aggregator";
import { detectSchedulingIntent, getDefaultDate } from "@/lib/scheduling";
import { findPatientByName } from "@/lib/patients";

const ChatRequestSchema = z.object({
  query: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .default([]),
});

/**
 * The chat pipeline lives here — this route orchestrates the agents:
 *
 *   selector → [ sql ‖ rag ] → aggregator (streams)
 *
 * The agents live in lib/agents/. selector, sql, and rag are YOURS to
 * implement; the aggregator and this wiring are provided so you can see how the
 * four compose. The selector returns a structured plan (and may short-circuit
 * when no retrieval is needed); sql and rag each return text; the aggregator is
 * the only one that streams.
 */
export async function POST(request: Request) {
  try {
    const { query, messages } = ChatRequestSchema.parse(await request.json());

    // --- Scheduling intent (separate). Only offer a card if the patient exists.
    const schedulingIntent = await detectSchedulingIntent(query);
    let matchedPatient: { firstName: string | null; lastName: string | null } | null = null;
    if (schedulingIntent.isSchedulingRequest && schedulingIntent.patientName) {
      const matches = await findPatientByName(schedulingIntent.patientName);
      matchedPatient = matches[0] ?? null;
    }
    const willSchedule = schedulingIntent.isSchedulingRequest && matchedPatient !== null;

    // --- SELECTOR → [ SQL ‖ RAG ]: the plan + retrieved text (short-circuit-aware).
    const { sqlText, ragText } = await runSpecialists(query, messages);

    // If a name was given but no patient matched, tell the model to say so.
    const schedulingNote =
      schedulingIntent.isSchedulingRequest && !matchedPatient
        ? `\n\n(Note: the user asked to schedule an appointment${
            schedulingIntent.patientName ? ` for "${schedulingIntent.patientName}"` : ""
          }, but no matching patient exists in the records. Tell them you couldn't find that patient and ask them to verify the name. Do NOT confirm or suggest an appointment.)`
        : "";

    // --- AGGREGATOR: the only streamer.
    const stream = aggregate({
      query: query + schedulingNote,
      history: messages,
      sqlText,
      ragText,
      system: willSchedule ? SCHEDULING_SYSTEM_PROMPT : undefined,
    });

    const schedulingAction =
      willSchedule && matchedPatient
        ? {
            patientName: [matchedPatient.firstName, matchedPatient.lastName]
              .filter(Boolean)
              .join(" "),
            suggestedDate: schedulingIntent.suggestedDate || getDefaultDate(),
            suggestedTime: schedulingIntent.suggestedTime || "09:00",
            reason: schedulingIntent.reason,
          }
        : undefined;

    // A scheduling card is delivered as a trailing marker on the text stream.
    if (schedulingAction) {
      const textStream = stream.textStream;
      const encoder = new TextEncoder();
      const marker = `\n\n<!-- SCHEDULING_ACTION ${JSON.stringify(schedulingAction)} -->`;

      const transformed = new ReadableStream({
        async start(controller) {
          for await (const chunk of textStream) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.enqueue(encoder.encode(marker));
          controller.close();
        },
      });

      return new Response(transformed, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    return stream.toTextStreamResponse();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
