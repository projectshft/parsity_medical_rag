/**
 * LangSmith Observability
 *
 * Provides tracing for LLM calls throughout the RAG pipeline.
 *
 * Setup:
 * 1. Create account at https://smith.langchain.com
 * 2. Get API key from Settings
 * 3. Add to .env: LANGSMITH_API_KEY=your-key
 */

import { Client } from 'langsmith';
import { RunTree } from 'langsmith';

export const langsmith = new Client({
  apiKey: process.env.LANGSMITH_API_KEY,
});

export const LANGSMITH_PROJECT = process.env.LANGSMITH_PROJECT || 'medical-rag';

/**
 * Check if LangSmith is configured
 */
export function isLangSmithEnabled(): boolean {
  return Boolean(process.env.LANGSMITH_API_KEY);
}

/**
 * Create a traced run for observability
 */
export function createRun(name: string, runType: 'llm' | 'chain' | 'tool' | 'retriever' = 'chain') {
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
  options?: {
    runType?: 'llm' | 'chain' | 'tool' | 'retriever';
    inputs?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }
): Promise<T> {
  if (!isLangSmithEnabled()) {
    return fn();
  }

  const run = new RunTree({
    name,
    run_type: options?.runType || 'chain',
    project_name: LANGSMITH_PROJECT,
    inputs: options?.inputs,
    extra: options?.metadata ? { metadata: options.metadata } : undefined,
  });

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
 * Create a child run for nested tracing
 */
export async function tracedChild<T>(
  parent: RunTree,
  name: string,
  fn: () => Promise<T>,
  options?: {
    runType?: 'llm' | 'chain' | 'tool' | 'retriever';
    inputs?: Record<string, unknown>;
  }
): Promise<T> {
  const child = await parent.createChild({
    name,
    run_type: options?.runType || 'chain',
    inputs: options?.inputs,
  });

  try {
    await child.postRun();
    const result = await fn();
    await child.end({ outputs: { result } });
    await child.patchRun();
    return result;
  } catch (error) {
    await child.end({ error: String(error) });
    await child.patchRun();
    throw error;
  }
}
