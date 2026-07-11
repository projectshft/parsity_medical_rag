/**
 * Shared chat-pipeline type.
 *
 * The chat orchestration now lives in `app/api/chat/route.ts`
 * (selector → sql ‖ rag → aggregator); the individual agents are in
 * `lib/agents/`. This module just holds the `Message` type that the chat
 * routes and the tool-calling variant (`lib/agent-tools.ts`) import.
 */

export type Message = {
  role: "user" | "assistant";
  content: string;
};
