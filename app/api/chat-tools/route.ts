import { NextResponse } from "next/server";
import { z } from "zod";
import { runAgentWithTools } from "@/lib/agent-tools";
import type { Message } from "@/lib/agent";

/**
 * Tool-calling chat route (instructor answer).
 *
 * Deliberately separate from `/api/chat` so the working manual-router pipeline is
 * untouched. Same request shape, so a client can point at either endpoint.
 *
 *   curl -N localhost:3000/api/chat-tools \
 *     -H 'content-type: application/json' \
 *     -d '{"query":"how many patients are diabetic, and what do their notes say about control?"}'
 */

const ChatToolsRequestSchema = z.object({
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

export async function POST(request: Request) {
  try {
    const { query, messages } = ChatToolsRequestSchema.parse(await request.json());
    const result = runAgentWithTools(query, messages as Message[]);
    // Plain text stream — the LLM's final answer after any tool calls.
    return result.toTextStreamResponse();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
