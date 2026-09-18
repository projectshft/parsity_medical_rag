/**
 * LangSmith observability (Week 3) — CONFIGURATION, not code you write.
 *
 * There is exactly ONE place tracing gets turned on, and it isn't here — it's
 * the `wrapOpenAI(...)` call in `lib/openai.ts`. That wrapper reports every
 * request made through our OpenAI client: the selector's routing decision, the
 * SQL the model wrote, the aggregator's final answer, with latency and token
 * cost attached. Three lines, no per-call instrumentation, nothing to maintain.
 *
 * So your week-3 job is two environment variables and then *reading* traces:
 *
 *   LANGSMITH_TRACING=true      ← the switch. Without it you get silence.
 *   LANGSMITH_API_KEY=lsv2_...
 *   LANGSMITH_PROJECT=medical-rag
 *
 * `LANGSMITH_TRACING` is the one that catches people. Set the key, skip the
 * flag, and nothing is reported and nothing errors — the worst failure mode an
 * observability tool can have. If your project is empty, check that first.
 *
 * Why it matters more than console.log: you cannot debug a non-deterministic
 * system from printouts. When an answer is wrong you need the trace from
 * *before* you changed the prompt, to compare against. Wire it early; it's free.
 *
 * ── Going further (optional, not assigned) ─────────────────────────────────
 * `wrapOpenAI` only sees LLM calls. To make the non-LLM steps show up as spans
 * too — the Pinecone query, the rerank, the SQL execution — you'd wrap them in
 * `RunTree` from the `langsmith` package and nest them under one parent run per
 * request. Worth doing if you ever need to answer "where did the 4 seconds go?"
 * rather than "what did the model say?". See
 * https://docs.smith.langchain.com/observability/how_to_guides/trace_with_run_tree
 */

/**
 * Whether tracing is actually on. Both values are required — the key alone
 * does nothing, which is the trap described above.
 *
 * Useful in a health check or a startup log, so a misconfigured environment
 * announces itself instead of quietly reporting nothing.
 */
export function isLangSmithEnabled(): boolean {
	return (
		process.env.LANGSMITH_TRACING === 'true' &&
		Boolean(process.env.LANGSMITH_API_KEY)
	);
}

export const LANGSMITH_PROJECT = process.env.LANGSMITH_PROJECT || 'medical-rag';
