/**
 * MCP Server for Medical RAG
 *
 * Exposes the RAG system as tools for Claude Desktop, Cursor, and other MCP clients.
 *
 * SCOPE: this is a FRONT-OFFICE (STAFF) tool. Front-office staff never see PII,
 * so every response here is PII-obscured, and only non-identifying tools are
 * exposed (search / notes / condition lists) — no patient-detail lookups.
 *
 * Setup:
 * 1. npm install @modelcontextprotocol/sdk
 * 2. Configure Claude Desktop or Cursor (see the Week 3 curriculum)
 * 3. Run: npx ts-node mcp-server/index.ts
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { executeQuery, formatResultsForLLM } from '../lib/query-executor';
import { searchClinicalNotes } from '../lib/vector-search';
import { obscureName } from '../lib/pii';

const server = new McpServer({
  name: 'medical-rag',
  version: '1.0.0',
});

/**
 * Tool: Search for patients (PII-obscured)
 */
server.registerTool(
  'search_patients',
  {
    description: 'Search for patients by name, condition, or other criteria. Use this for finding patients.',
    inputSchema: {
      query: z.string().describe('Search query (e.g., "John Smith" or "patients with diabetes")'),
    },
  },
  async ({ query }) => {
    try {
      const result = await executeQuery(query);
      // Front-office channel — always obscure PII in the rendered results.
      const formatted = formatResultsForLLM(result, true);

      return {
        content: [{ type: 'text', text: formatted || 'No matching patients found.' }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error searching patients: ${error}` }],
        isError: true,
      };
    }
  }
);

/**
 * Tool: Query clinical notes (PII-obscured)
 */
server.registerTool(
  'query_notes',
  {
    description: 'Search clinical notes using semantic search. Use this for finding relevant medical notes, symptoms, treatments, or clinical observations.',
    inputSchema: {
      query: z.string().describe('Semantic search query (e.g., "chest pain", "breathing problems", "diabetes management")'),
      patientId: z.string().optional().describe('Optional: limit to specific patient ID'),
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
        return {
          content: [{ type: 'text', text: 'No matching clinical notes found.' }],
        };
      }

      return {
        content: [{ type: 'text', text: formatVectorResults(results) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error searching notes: ${error}` }],
        isError: true,
      };
    }
  }
);

/**
 * Helper: Format vector search results (always PII-obscured for MCP)
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
