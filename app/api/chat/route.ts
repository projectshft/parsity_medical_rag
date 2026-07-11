import { NextResponse } from "next/server";
import { z } from "zod";

import { select } from "@/lib/agents/selector";
import { runSql } from "@/lib/agents/sql";
import { runRag } from "@/lib/agents/rag";
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
 * The chat pipeline. This route IS the orchestrator:
 *
 *   1. accept the message + history
 *   2. selector decides what to do
 *   3. call 0, 1, or 2 specialists (sql / rag)
 *   4. aggregator streams the answer back
 *
 * A scheduling action (when the intent fires) rides in the X-Scheduling-Action
 * response header. The agents live in lib/agents/ — selector, sql, and rag are
 * yours to implement.
 */
export async function POST(request: Request) {
  try {
    const { query, messages } = ChatRequestSchema.parse(await request.json());

    // 1. Scheduling intent (offer a card only if the named patient exists).
    const scheduling = await detectSchedulingIntent(query);
    let patient: { firstName: string | null; lastName: string | null } | null = null;
    if (scheduling.isSchedulingRequest && scheduling.patientName) {
      patient = (await findPatientByName(scheduling.patientName))[0] ?? null;
    }

    // 2. SELECTOR — decide what to run.
    const plan = await select(query, messages);

    // 3. Call 0, 1, or 2 specialists (each returns text). Skipped on short-circuit.
    const [sqlText, ragText] = plan.needsSearch
      ? await Promise.all([
          plan.useSql ? runSql(query, messages) : undefined,
          plan.useRag ? runRag(plan.semanticQuery) : undefined,
        ])
      : [undefined, undefined];

    // 4. Aggregator streams the answer.
    const stream = aggregate({
      query,
      history: messages,
      sqlText,
      ragText,
      system: patient ? SCHEDULING_SYSTEM_PROMPT : undefined,
    });

    // The scheduling card rides in a header (the UI reads it off the response).
    const headers: Record<string, string> = {};
    if (patient) {
      headers["X-Scheduling-Action"] = JSON.stringify({
        patientName: [patient.firstName, patient.lastName].filter(Boolean).join(" "),
        suggestedDate: scheduling.suggestedDate || getDefaultDate(),
        suggestedTime: scheduling.suggestedTime || "09:00",
        reason: scheduling.reason,
      });
    }

    return stream.toTextStreamResponse({ headers });
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
