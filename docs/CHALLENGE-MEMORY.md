# Challenge: Conversation Memory

Add conversation history so users can ask natural follow-up questions
("What about *his* medications?") and keep the patient in focus across turns.

> **Capstone track:** Option 3 · **Competency:** C-APP-1 (Application layer) + query understanding

## Learning Objectives

- Thread conversation state through the RAG pipeline
- Resolve pronouns and elliptical follow-ups against prior turns
- Maintain entity focus (the current patient) across a session

## Background

The plumbing for history already exists — the chat route passes prior turns to
the agent:

```typescript
// app/api/chat/route.ts
const { query, messages = [] } = await request.json();
// → runAgent(query, conversationHistory)
```

```typescript
// lib/agent.ts
export async function runAgent(query: string, conversationHistory: Message[]): Promise<...>;
```

What's missing is **using** that history: today each query is analyzed in
isolation, so "his medications" has no referent.

## Your Task

### 1. Use history during query analysis

- In query analysis (`lib/query-analyzer.ts` / `lib/agent.ts`), incorporate the
  last N turns so the analyzer can resolve references.
- Resolve pronouns/follow-ups to the patient in focus (e.g., carry `patientId`
  forward when the new query doesn't name a patient).

### 2. Maintain focus

- Track the "current patient" for the session and clear/replace it when the user
  names a different patient.

### 3. Keep context bounded

- Cap how much history is sent (token budget); summarize or truncate older turns.

## Acceptance Criteria

- [ ] A follow-up like "what about his medications?" resolves to the prior patient
- [ ] Naming a new patient switches focus correctly
- [ ] History is bounded (no unbounded growth of context)
- [ ] At least 3 tests: pronoun resolution, focus switch, no-history (first turn)

## Bonus

1. **Coreference edge cases** — "the first one", "her latest visit".
2. **Session reset** — a way to clear memory and start fresh.
3. **Summary memory** — compress old turns into a running summary.

## Resources

- [Coreference resolution](https://nlp.stanford.edu/projects/coref.shtml)
- [Managing context windows](https://platform.openai.com/docs/guides/prompt-engineering)
