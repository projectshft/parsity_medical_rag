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

    // Debug: log scheduling action detection
    console.log('Scheduling action detected:', schedulingAction);

    // If there's a scheduling action, we need to append it to the stream
    if (schedulingAction) {
      const textStream = stream.textStream;
      const encoder = new TextEncoder();
      const actionMarker = `\n\n<!-- SCHEDULING_ACTION ${JSON.stringify(schedulingAction)} -->`;

      const transformedStream = new ReadableStream({
        async start(controller) {
          for await (const chunk of textStream) {
            controller.enqueue(encoder.encode(chunk));
          }
          // Append the scheduling action marker at the end
          controller.enqueue(encoder.encode(actionMarker));
          controller.close();
        },
      });

      return new Response(transformedStream, {
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
