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
import { scheduleAppointment, isCalConfigured } from '../lib/calendar';

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

      if (!results.rerankedDocuments.length) {
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

/**
 * Tool: Schedule an appointment (front-office ACTION via Cal.com).
 *
 * Channel note: obscuring guards *retrieved clinical data*, not an action
 * confirmation. The staff member supplied this patient name in order to book, so
 * echoing it back is not a chart leak — the confirmation keeps the real name.
 */
server.registerTool(
  'schedule_appointment',
  {
    description:
      'Book a patient appointment at a specific time (ISO 8601).',
    inputSchema: {
      patientName: z.string().describe('Full patient name to book'),
      dateTime: z.string().describe('Appointment start, ISO 8601 (e.g. 2026-08-06T14:00:00)'),
      notes: z.string().optional().describe('Optional reason/notes for the visit'),
    },
  },
  async ({ patientName, dateTime, notes }) => {
    if (!isCalConfigured()) {
      return {
        content: [{ type: 'text', text: 'Calendar not configured — set CAL_API_KEY and CAL_EVENT_TYPE_ID.' }],
      };
    }
    try {
      const result = await scheduleAppointment({ patientName, dateTime, notes });
      if (!result.success) {
        return { content: [{ type: 'text', text: `Could not book: ${result.error}` }], isError: true };
      }
      const url = result.bookingUrl ? `\nConfirmation: ${result.bookingUrl}` : '';
      return { content: [{ type: 'text', text: `Booked ${patientName} for ${dateTime}.${url}` }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error booking: ${error}` }], isError: true };
    }
  }
);

/**
 * Helper: Format vector search results — always PII-obscured for MCP.
 */
function formatVectorResults(results: { docs: any[]; rerankedDocuments: any[] }): string {
  const parts = ['## Clinical Notes\n'];

  // rerankedDocuments carry the relevance order + score; docs carry the metadata.
  // ranked.index maps back into docs (both derive from the same matches array).
  for (const ranked of results.rerankedDocuments) {
    const meta = results.docs[ranked.index]?.metadata ?? {};
    const patientName = obscureName(`${meta.firstName ?? ''} ${meta.lastName ?? ''}`.trim() || 'Unknown');
    parts.push(`### ${patientName} (relevance ${(ranked.score * 100).toFixed(1)}%)`);
    parts.push('```');
    parts.push(meta.content ?? '');
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
