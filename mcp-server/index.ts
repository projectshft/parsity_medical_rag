/**
 * MCP Server for Medical RAG — YOUR TASK
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
 * 2. Configure Claude Desktop or Cursor (see the Week 3 curriculum)
 * 3. Run: npx ts-node mcp-server/index.ts
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { searchClinicalNotes } from '../lib/vector-search';
import { obscureName } from '../lib/pii';

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
      const results = await searchClinicalNotes(query, {
        topK,
        patientIds: patientId ? [patientId] : undefined,
      });

      if (!results.length) {
        return { content: [{ type: 'text', text: 'No matching clinical notes found.' }] };
      }

      return { content: [{ type: 'text', text: formatVectorResults(results) }] };
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
//   - search_patients -> run executeQuery(query) from '../lib/query-executor',
//     then formatResultsForLLM(result, true) — the `true` obscures PII for the
//     front-office channel. (executeQuery uses the text-to-SQL agent under the hood.)
// For each: server.registerTool(name, { description, inputSchema: { ...zod } }, handler).
// The handler returns { content: [{ type: 'text', text }] }. NEVER leak a real
// patient name on this channel — the obscured formatter / obscureName() is the door.

/**
 * Helper: Format vector search results — always PII-obscured for MCP.
 */
function formatVectorResults(results: any[]): string {
  const parts = ['## Clinical Notes\n'];

  for (const result of results) {
    const patientName = obscureName(result.patientName || 'Unknown');
    parts.push(`### ${patientName} - ${result.documentType || 'Clinical Note'} (${result.date || 'undated'})`);
    parts.push(`Relevance: ${(result.score * 100).toFixed(1)}%`);
    parts.push('```');
    parts.push(result.contentPreview || result.content);
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
