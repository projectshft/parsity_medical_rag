/**
 * LangSmith Observability Client
 *
 * Provides tracing and observability for LLM calls throughout the RAG pipeline.
 *
 * Setup:
 * 1. Create account at https://smith.langchain.com
 * 2. Get API key from Settings
 * 3. Add to .env: LANGSMITH_API_KEY=your-key
 * 4. Optional: LANGSMITH_PROJECT=medical-rag (defaults to "default")
 */

import { Client } from 'langsmith';
import { RunTree } from 'langsmith';

export const langsmith = new Client({
  apiKey: process.env.LANGSMITH_API_KEY,
});

export const LANGSMITH_PROJECT = process.env.LANGSMITH_PROJECT || 'medical-rag';

/**
 * Create a traced run for observability
 */
export function createRun(name: string, runType: 'llm' | 'chain' | 'tool' = 'chain') {
  return new RunTree({
    name,
    run_type: runType,
    project_name: LANGSMITH_PROJECT,
  });
}

/**
 * Wrap an async function with LangSmith tracing
 */
export async function traced<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const run = createRun(name);

  if (metadata) {
    run.extra = { ...run.extra, metadata };
  }

  try {
    await run.postRun();
    const result = await fn();
    await run.end({ outputs: { result } });
    await run.patchRun();
    return result;
  } catch (error) {
    await run.end({ error: String(error) });
    await run.patchRun();
    throw error;
  }
}

/**
 * Check if LangSmith is configured
 */
export function isLangSmithEnabled(): boolean {
  return Boolean(process.env.LANGSMITH_API_KEY);
}
