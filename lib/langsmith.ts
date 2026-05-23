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
 *
 * TODO: Implement this function
 * - If LangSmith is not enabled, just run the function directly
 * - Create a RunTree with the given name and options
 * - Post the run, execute the function, end with outputs
 * - Handle errors by ending with error status
 * - Return the function result
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
  // TODO: Implement tracing wrapper
  // For now, just run the function without tracing
  return fn();
}

/**
 * Create a child run for nested tracing
 *
 * TODO: Implement this function for nested observability
 * - Create a child run from the parent
 * - Post, execute, and end the child run
 * - Handle errors appropriately
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
  // TODO: Implement child tracing
  // For now, just run the function without tracing
  return fn();
}
