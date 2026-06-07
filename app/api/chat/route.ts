/**
 * Chat API Route
 *
 * Handles chat requests with the medical RAG agent.
 *
 * TODO: Add scheduling action handling for human-in-the-loop pattern
 * When runAgent returns a schedulingAction, append it to the stream
 * as a marker the frontend can parse: <!-- SCHEDULING_ACTION {...} -->
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { runAgent, Message } from "@/lib/agent";

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

export async function POST(request: Request) {
  try {
    const { query, messages } = ChatRequestSchema.parse(await request.json());

    const conversationHistory: Message[] = messages;

    const { stream, schedulingAction } = await runAgent(query, conversationHistory);

    // TODO: If there's a scheduling action, append it to the stream
    // The frontend parses: <!-- SCHEDULING_ACTION {"patientName":...} -->
    // Use a TransformStream to append the marker after the LLM response completes
    //
    // if (schedulingAction) {
    //   const textStream = stream.textStream;
    //   const encoder = new TextEncoder();
    //   const actionMarker = `\n\n<!-- SCHEDULING_ACTION ${JSON.stringify(schedulingAction)} -->`;
    //
    //   const transformedStream = new ReadableStream({
    //     async start(controller) {
    //       for await (const chunk of textStream) {
    //         controller.enqueue(encoder.encode(chunk));
    //       }
    //       controller.enqueue(encoder.encode(actionMarker));
    //       controller.close();
    //     },
    //   });
    //
    //   return new Response(transformedStream, {
    //     headers: { "Content-Type": "text/plain; charset=utf-8" },
    //   });
    // }

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
