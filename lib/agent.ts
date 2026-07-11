/**
 * Shared chat-pipeline type.
 *
 * The chat pipeline is now built as one file per agent in `lib/agents/`
 * (selector → sql ‖ rag → aggregator) and orchestrated by
 * `app/api/chat/route.ts`. This module just holds the shared `Message` type the
 * agents and the route import.
 */

export type Message = {
  role: "user" | "assistant";
  content: string;
};
