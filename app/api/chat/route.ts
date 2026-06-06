import { runAgent, Message } from "@/lib/agent";

export async function POST(request: Request) {
  try {
    const { query, messages = [] } = await request.json();

    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "Query is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const conversationHistory: Message[] = messages.map(
      (m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })
    );

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
    console.error("Chat error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
