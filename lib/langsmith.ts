/**
 * LangSmith observability.
 *
 * There is deliberately almost nothing here. Tracing is turned on by wrapping
 * the OpenAI client ONCE — see `wrapOpenAI(...)` in `lib/openai.ts`. Every
 * agent in the pipeline shares that client, so every LLM call shows up in
 * LangSmith with its prompt, response, token count and latency, for free.
 *
 * Setup:
 *   1. Create an account at https://smith.langchain.com
 *   2. Settings → API Keys
 *   3. In .env:  LANGSMITH_TRACING=true, LANGSMITH_API_KEY=..., LANGSMITH_PROJECT=medical-rag
 *
 * (Cohort 3 shipped hand-rolled `traced()` / `tracedChild()` wrappers here.
 * They were never implemented and never needed — the client wrapper does the
 * job. They're gone. If you want a span around non-LLM work, reach for
 * `langsmith`'s `traceable` rather than rebuilding this.)
 */

export const LANGSMITH_PROJECT = process.env.LANGSMITH_PROJECT || 'medical-rag';

/** True when tracing is configured; use it to skip eval bookkeeping locally. */
export function isLangSmithEnabled(): boolean {
	return (
		Boolean(process.env.LANGSMITH_API_KEY) &&
		process.env.LANGSMITH_TRACING === 'true'
	);
}
