/**
 * MCP Server for Medical RAG — ⭐ BONUS, NOT COVERED THIS COHORT.
 *
 * This cohort builds tool-calling with LangGraph instead (`lib/graph.ts` +
 * `docs/CHALLENGE-LANGGRAPH.md`). MCP is the same idea — a model choosing tools —
 * but over a wire protocol, so another client (Claude Desktop, Cursor) does the
 * choosing instead of your own graph. Do this one if you want your RAG reachable
 * from Claude Desktop; nothing else depends on it. The bonus challenge for
 * hardening it is `docs/bonus/CHALLENGE-MCP-AUTH.md`.
 *
 * Expose your RAG system as tools that Claude Desktop / Cursor can call.
 *
 * SCOPE: this is a FRONT-OFFICE (STAFF) tool. Front-office staff never see PII,
 * so every response MUST be PII-obscured, and you only expose non-identifying
 * tools (search / notes / condition lists) — no raw patient-detail lookups.
 *
 * One tool — `query_notes` — is implemented below as a WORKING EXAMPLE of the
 * pattern: define the tool with registerTool, call a RAG function, obscure PII,
 * return text content. 👉 YOUR JOB: add more tools following that shape (see the
 * TODO near the bottom).
 *
 * Setup:
 * 1. npm install (@modelcontextprotocol/sdk is already a dependency)
 * 2. Verify the tools first with `npm run mcp:inspect` (a Swagger-like UI for
 *    MCP — list tools, call one with arguments, read the error). Only wire up
 *    Claude Desktop / Cursor once a tool works there.
 * 3. Run: npm run mcp
 *
 * Heads up: every response on this channel is PII-obscured, so this server does
 * not work until `obscureContent` in lib/pii.ts is implemented
 * (docs/CHALLENGE-PII.md). That ordering is deliberate — the obscuring is the
 * door, not a decoration.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { searchClinicalNotes } from '../lib/vector-search';
import { obscureContent } from '../lib/pii';

const server = new McpServer({
  name: 'medical-rag',
  version: '1.0.0',
});

/**
 * WORKING EXAMPLE — Tool: Query clinical notes (semantic search, PII-obscured).
 *
 * This is the whole pattern: a tool is a name + description + input schema +
 * a handler that returns { content: [{ type: 'text', text }] }. Here the handler
 * runs semantic search and obscures names before returning them.
 */
server.registerTool(
  'query_notes',
  {
    description:
      'Search clinical notes using semantic search. Use this for finding relevant medical notes, symptoms, treatments, or clinical observations.',
    inputSchema: {
      query: z
        .string()
        .describe('Semantic search query (e.g., "chest pain", "breathing problems")'),
      patientId: z.string().optional().describe('Optional: limit to a specific patient ID'),
      topK: z.number().optional().default(5).describe('Number of results to return'),
    },
  },
  async ({ query, patientId, topK }) => {
    try {
      const { rerankedDocuments } = await searchClinicalNotes(query, {
        topK,
        patientIds: patientId ? [patientId] : undefined,
      });

      if (!rerankedDocuments.length) {
        return { content: [{ type: 'text', text: 'No matching clinical notes found.' }] };
      }

      return { content: [{ type: 'text', text: formatVectorResults(rerankedDocuments) }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error searching notes: ${error}` }],
        isError: true,
      };
    }
  }
);

// TODO — add at least one more tool, following the query_notes example above.
// Idea (front-office appropriate, since every response must be PII-obscured):
//   - search_patients -> select(query) then runSql/runRag (lib/agents/*),
//     combine the text, then obscureContent(combined) — the regex de-identifier
//     obscures PII for the front-office channel.
// For each: server.registerTool(name, { description, inputSchema: { ...zod } }, handler).
// The handler returns { content: [{ type: 'text', text }] }. NEVER leak a real
// patient name on this channel — obscureContent() over the rendered text is the
// door, and every new tool has to walk through it.

/**
 * Helper: Format reranked results — always PII-obscured for MCP.
 *
 * The reranker hands back rendered TEXT blocks (note content plus the metadata
 * `lib/vector-search.ts` stitched in), not patient-shaped objects — so there is
 * no "name field" to pseudonymize. That's why the whole block goes through
 * `obscureContent`: on this channel the de-identifier has to be shape-agnostic.
 * Imperfect by design — a regex misses formats it has never seen, which is the
 * point of the PII challenge.
 */
function formatVectorResults(rerankedDocuments: any[]): string {
  const parts = ['## Clinical Notes\n'];

  for (const result of rerankedDocuments) {
    const text = result.document?.text ?? JSON.stringify(result.document);
    parts.push(`### Note (relevance ${(result.score * 100).toFixed(1)}%)`);
    parts.push('```');
    parts.push(obscureContent(text));
    parts.push('```\n');
  }

  return parts.join('\n');
}

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Medical RAG MCP server running');
}

main().catch(console.error);
