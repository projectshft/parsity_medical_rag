import { NextResponse } from "next/server";
import { z } from "zod";

import { select } from "@/lib/agents/selector";
import { runSql } from "@/lib/agents/sql";
import { runRag } from "@/lib/agents/rag";
import { aggregate } from "@/lib/agents/aggregator";

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
 * The chat pipeline — YOUR TASK. This route IS the orchestrator:
 *
 *   1. accept the message + history   (done — parsed below)
 *   2. the selector decides which stores to hit
 *   3. call 0, 1, or 2 specialists (sql / rag)
 *   4. the aggregator streams the answer back
 *
 * You implement `select`, `runSql`, and `runRag` (lib/agents/). `aggregate` is
 * provided — it's the only piece that streams.
 */
export async function POST(request: Request) {
  try {
    const { query, messages } = ChatRequestSchema.parse(await request.json());

    // TODO — build the pipeline:
    //  1. Ask the selector what to run:  const plan = await select(query, messages)
    //  2. Run the specialists the plan calls for, in parallel (runSql / runRag).
    //     Skip retrieval when plan.needsSearch is false (a general question).
    //  3. Hand the text to the aggregator and stream it back:
    //       const stream = aggregate({ query, history: messages, sqlText, ragText })
    //       return stream.toTextStreamResponse()
    void select;
    void runSql;
    void runRag;
    void aggregate;
    throw new Error("Not implemented — your turn! (app/api/chat/route.ts)");
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
