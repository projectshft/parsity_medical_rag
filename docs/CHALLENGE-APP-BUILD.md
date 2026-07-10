# Challenge: Build the Application Layer

Build (not just use) the web application layer that fronts the RAG pipeline: the
chat API route and the UI that renders answers with their sources.

> **Capstone track:** Option 5 · **Competency:** C-APP-1 (Chat interface & API routes)

## Learning Objectives

- Wire an API route to the RAG agent (analyze → retrieve → generate)
- Stream model output back to the browser
- Render answers in the UI with **source attribution**
- Handle empty, ambiguous, and error states gracefully

## Background

In the instructor build, the chat route (`app/api/chat/route.ts`) and the UI
(`app/page.tsx`) ship complete so earlier weeks can focus on retrieval. In this
capstone you build that layer yourself against the existing agent.

The agent entry point is already defined:

```typescript
// lib/agent.ts
export async function runAgent(
  query: string,
  conversationHistory: Message[]
): Promise<{ stream: /* streaming text */, schedulingAction?: unknown }>;
```

## Your Task

### 1. Implement the chat route — `app/api/chat/route.ts`

- Accept `POST` with `{ query: string, messages?: Message[] }`.
- Validate input; return `400` with a JSON error when `query` is missing or not a string.
- Map incoming `messages` to the agent's `Message[]` shape.
- Call `runAgent(query, conversationHistory)` and return its `stream` as a
  `text/plain; charset=utf-8` streaming `Response`.

### 2. Render results in the UI — `app/page.tsx`

- Send the user's query to `/api/chat` and stream the response into the view.
- Show a loading indicator while streaming.
- **Surface source attribution** — when the agent returns which records/notes were
  used, display them so a clinician can verify the answer.

### 3. Robustness

- Empty query → friendly prompt, no request fired.
- Network/route error → visible error state, app does not crash.

## Acceptance Criteria

- [ ] `POST /api/chat` returns a streamed answer for a valid query
- [ ] `POST /api/chat` returns `400` for a missing/invalid query
- [ ] The UI streams the answer and shows a loading state
- [ ] Sources/citations are visible to the user
- [ ] Empty and error states are handled without crashing
- [ ] At least 3 tests for the route (valid, invalid input, error path)

## Bonus

1. **Conversation view** — render the full back-and-forth, not just the latest answer.
2. **Stop/regenerate** controls for the streaming response.
3. **Keyboard UX** — submit on Enter, Shift+Enter for newline.

## Resources

- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Streaming responses](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream)
