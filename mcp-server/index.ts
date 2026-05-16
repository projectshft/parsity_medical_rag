/**
 * MCP Server for Medical RAG
 *
 * Exposes the RAG system as tools for Claude Desktop, Cursor, and other MCP clients.
 *
 * Setup:
 * 1. npm install @modelcontextprotocol/sdk
 * 2. Configure Claude Desktop or Cursor (see docs/WEEK5-MCP.html)
 * 3. Run: npx ts-node mcp-server/index.ts
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// Import your RAG functions
// TODO: Uncomment these once implemented
// import { executeQuery, formatResultsForLLM } from '../lib/query-executor';
// import { searchClinicalNotes } from '../lib/vector-search';
// import { prisma } from '../lib/prisma';

// Create the MCP server
const server = new McpServer({
  name: 'medical-rag',
  version: '1.0.0',
});

/**
 * Tool: Search for patients
 *
 * TODO: Implement this tool
 *
 * This tool should:
 * 1. Take a search query (name or condition)
 * 2. Call your query executor
 * 3. Return formatted results
 */
server.tool(
  'search_patients',
  'Search for patients by name, condition, or other criteria',
  {
    query: z.string().describe('Search query (e.g., "John Smith" or "diabetes")'),
    limit: z.number().optional().default(10).describe('Maximum results to return'),
  },
  async ({ query, limit }) => {
    // TODO: Implement patient search
    // const results = await executeQuery(query, { sqlLimit: limit });
    // return {
    //   content: [{ type: 'text', text: formatResultsForLLM(results) }],
    // };

    return {
      content: [
        {
          type: 'text',
          text: `TODO: Implement search for "${query}" with limit ${limit}`,
        },
      ],
    };
  }
);

/**
 * Tool: Query clinical notes
 *
 * TODO: Implement this tool
 *
 * This tool should:
 * 1. Take a semantic search query
 * 2. Optionally filter by patient ID
 * 3. Search clinical notes using vector search
 * 4. Return relevant note excerpts
 */
server.tool(
  'query_notes',
  'Search clinical notes using semantic search',
  {
    query: z.string().describe('Semantic search query (e.g., "chest pain", "breathing problems")'),
    patientId: z.string().optional().describe('Optional: limit to specific patient'),
    topK: z.number().optional().default(5).describe('Number of results to return'),
  },
  async ({ query, patientId, topK }) => {
    // TODO: Implement clinical notes search
    // const results = await searchClinicalNotes(query, {
    //   topK,
    //   patientIds: patientId ? [patientId] : undefined,
    // });
    // return {
    //   content: [{ type: 'text', text: formatVectorResults(results) }],
    // };

    return {
      content: [
        {
          type: 'text',
          text: `TODO: Search notes for "${query}"${patientId ? ` (patient: ${patientId})` : ''}`,
        },
      ],
    };
  }
);

/**
 * Tool: Get patient details
 *
 * TODO: Implement this tool
 *
 * This tool should:
 * 1. Take a patient ID
 * 2. Fetch full patient record from database
 * 3. Include conditions, medications, recent observations
 * 4. Return formatted patient summary
 */
server.tool(
  'get_patient',
  'Get detailed information about a specific patient',
  {
    patientId: z.string().describe('The patient ID'),
  },
  async ({ patientId }) => {
    // TODO: Implement patient lookup
    // const patient = await prisma.patient.findUnique({
    //   where: { id: patientId },
    //   include: {
    //     conditions: { where: { status: 'active' } },
    //     medications: { where: { status: 'active' } },
    //     observations: { take: 10, orderBy: { effectiveDate: 'desc' } },
    //   },
    // });
    // return {
    //   content: [{ type: 'text', text: formatPatientDetails(patient) }],
    // };

    return {
      content: [
        {
          type: 'text',
          text: `TODO: Get details for patient ${patientId}`,
        },
      ],
    };
  }
);

/**
 * Helper: Format vector search results
 */
function formatVectorResults(results: any[]): string {
  if (!results.length) {
    return 'No matching clinical notes found.';
  }

  const parts = ['## Clinical Notes\n'];
  for (const result of results) {
    parts.push(`### ${result.patientName || 'Unknown'} - ${result.date || 'undated'}`);
    parts.push(`Relevance: ${(result.score * 100).toFixed(1)}%`);
    parts.push('```');
    parts.push(result.contentPreview || result.content);
    parts.push('```\n');
  }
  return parts.join('\n');
}

/**
 * Helper: Format patient details
 */
function formatPatientDetails(patient: any): string {
  if (!patient) {
    return 'Patient not found.';
  }

  const parts = [`# ${patient.name}\n`];
  parts.push(`- **ID**: ${patient.id}`);
  parts.push(`- **Gender**: ${patient.gender}`);
  parts.push(`- **Birth Date**: ${patient.birthDate}`);

  if (patient.conditions?.length) {
    parts.push('\n## Active Conditions');
    for (const c of patient.conditions) {
      parts.push(`- ${c.display}`);
    }
  }

  if (patient.medications?.length) {
    parts.push('\n## Current Medications');
    for (const m of patient.medications) {
      parts.push(`- ${m.display}`);
    }
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
