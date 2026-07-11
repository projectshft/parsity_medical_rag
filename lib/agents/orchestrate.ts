/**
 * Shared specialist fan-out: selector → [ sql ‖ rag ]. (Provided.)
 *
 * The one place the retrieval pipeline lives. The chat route feeds the result
 * to the aggregator (streaming); /api/query and the MCP server combine the text
 * and apply the channel's PII policy. On a short-circuit (a pure general
 * question) it returns just the selection — no retrieval ran.
 */

import { select, type Selection } from './selector';
import { runSql } from './sql';
import { runRag } from './rag';
import type { Message } from '../agent';

export type Specialists = {
  selection: Selection;
  sqlText?: string;
  ragText?: string;
};

export async function runSpecialists(
  query: string,
  history: Message[] = [],
): Promise<Specialists> {
  const selection = await select(query, history);
  if (!selection.needsSearch) return { selection };

  const [sqlText, ragText] = await Promise.all([
    selection.useSql ? runSql(query, history) : Promise.resolve(undefined),
    selection.useRag ? runRag(selection.semanticQuery) : Promise.resolve(undefined),
  ]);

  return { selection, sqlText, ragText };
}
