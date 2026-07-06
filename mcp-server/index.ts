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
import { findPatientsByConditions } from '../lib/sql-queries';
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
      limit: z.number().optional().default(10).describe('Maximum results to return'),
    },
  },
  async ({ query, limit }) => {
    try {
      const result = await executeQuery(query, { sqlLimit: limit });
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
 * Tool: List patients by condition (PII-obscured)
 */
server.registerTool(
  'list_patients_by_condition',
  {
    description: 'Find all patients with a specific medical condition (e.g., diabetes, hypertension, asthma).',
    inputSchema: {
      condition: z.string().describe('Medical condition to search for'),
      limit: z.number().optional().default(20).describe('Maximum number of patients to return'),
    },
  },
  async ({ condition, limit }) => {
    try {
      const patients = await findPatientsByConditions([condition]);
      const limited = patients.slice(0, limit);

      if (!limited.length) {
        return {
          content: [{ type: 'text', text: `No patients found with condition: ${condition}` }],
        };
      }

      const lines = [`## Patients with ${condition} (${patients.length} total, showing ${limited.length})\n`];
      for (const patient of limited) {
        // Obscure the name — front-office staff get a pseudonym, not the real name.
        const name = obscureName(fullName(patient));
        const matchingConditions = patient.conditions?.map(c => c.display).join(', ') || condition;
        lines.push(`- **${name}** (ID: ${patient.id}) - ${matchingConditions}`);
      }

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error listing patients: ${error}` }],
        isError: true,
      };
    }
  }
);

/**
 * Helper: Full name from the patient row (schema stores first/last separately)
 */
function fullName(patient: { firstName?: string | null; lastName?: string | null }): string {
  return [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Unknown';
}

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
