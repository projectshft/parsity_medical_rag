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

import { executeQuery, formatResultsForLLM } from '../lib/query-executor';
import { searchClinicalNotes } from '../lib/vector-search';
import { findPatientByName, getPatientSummary, findPatientsByConditions } from '../lib/sql-queries';
import { shouldObscurePII, obscureName, obscureDate, obscureLocation } from '../lib/pii';

const server = new McpServer({
  name: 'medical-rag',
  version: '1.0.0',
});

/**
 * Tool: Search for patients
 */
server.tool(
  'search_patients',
  'Search for patients by name, condition, or other criteria. Use this for finding patients.',
  {
    query: z.string().describe('Search query (e.g., "John Smith" or "patients with diabetes")'),
    limit: z.number().optional().default(10).describe('Maximum results to return'),
  },
  async ({ query, limit }) => {
    try {
      const result = await executeQuery(query, { sqlLimit: limit });
      const formatted = formatResultsForLLM(result);

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
 * Tool: Query clinical notes
 */
server.tool(
  'query_notes',
  'Search clinical notes using semantic search. Use this for finding relevant medical notes, symptoms, treatments, or clinical observations.',
  {
    query: z.string().describe('Semantic search query (e.g., "chest pain", "breathing problems", "diabetes management")'),
    patientId: z.string().optional().describe('Optional: limit to specific patient ID'),
    topK: z.number().optional().default(5).describe('Number of results to return'),
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

      const formatted = formatVectorResults(results);
      return {
        content: [{ type: 'text', text: formatted }],
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
 * Tool: Get patient details
 */
server.tool(
  'get_patient',
  'Get detailed information about a specific patient including conditions, medications, observations, and allergies.',
  {
    patientId: z.string().describe('The patient ID'),
  },
  async ({ patientId }) => {
    try {
      const patient = await getPatientSummary(patientId);

      if (!patient) {
        return {
          content: [{ type: 'text', text: `Patient not found: ${patientId}` }],
        };
      }

      const formatted = formatPatientDetails(patient);
      return {
        content: [{ type: 'text', text: formatted }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error getting patient: ${error}` }],
        isError: true,
      };
    }
  }
);

/**
 * Tool: Find patient by name
 */
server.tool(
  'find_patient_by_name',
  'Look up a patient by their name. Returns matching patients with basic info.',
  {
    name: z.string().describe('Patient name to search for (e.g., "John Smith")'),
  },
  async ({ name }) => {
    try {
      const patients = await findPatientByName(name);

      if (!patients.length) {
        return {
          content: [{ type: 'text', text: `No patients found matching "${name}"` }],
        };
      }

      const lines = [`## Patients matching "${name}"\n`];
      for (const patient of patients) {
        lines.push(`### ${fullName(patient)}`);
        lines.push(`- **ID**: ${patient.id}`);
        lines.push(`- **Gender**: ${patient.gender}`);
        lines.push(`- **Birth Date**: ${patient.birthDate?.toISOString().split('T')[0] || 'Unknown'}`);
        if (patient.conditions?.length) {
          lines.push(`- **Active Conditions**: ${patient.conditions.slice(0, 5).map(c => c.display).join(', ')}`);
        }
        lines.push('');
      }

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error finding patient: ${error}` }],
        isError: true,
      };
    }
  }
);

/**
 * Tool: List patients by condition
 */
server.tool(
  'list_patients_by_condition',
  'Find all patients with a specific medical condition (e.g., diabetes, hypertension, asthma).',
  {
    condition: z.string().describe('Medical condition to search for'),
    limit: z.number().optional().default(20).describe('Maximum number of patients to return'),
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
        const matchingConditions = patient.conditions?.map(c => c.display).join(', ') || condition;
        lines.push(`- **${fullName(patient)}** (ID: ${patient.id}) - ${matchingConditions}`);
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
 * Helper: Format vector search results
 */
function formatVectorResults(results: any[]): string {
  const obscure = shouldObscurePII();
  const parts = ['## Clinical Notes\n'];

  for (const result of results) {
    const patientName = obscure ? obscureName(result.patientName) : (result.patientName || 'Unknown');
    parts.push(`### ${patientName} - ${result.documentType || 'Clinical Note'} (${result.date || 'undated'})`);
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
  const obscure = shouldObscurePII();

  const name = obscure ? obscureName(fullName(patient)) : fullName(patient);
  const dob = obscure
    ? obscureDate(patient.birthDate)
    : (patient.birthDate?.toISOString().split('T')[0] || 'Unknown');
  const location = obscure
    ? obscureLocation(patient.city, patient.state, patient.postalCode)
    : [patient.city, patient.state, patient.postalCode].filter(Boolean).join(', ');

  const parts = [`# ${name}\n`];
  parts.push(`- **ID**: ${patient.id}`);
  parts.push(`- **Gender**: ${patient.gender}`);
  parts.push(`- **Birth Date**: ${dob}`);
  if (location) {
    parts.push(`- **Location**: ${location}`);
  }

  if (patient.conditions?.length) {
    parts.push('\n## Active Conditions');
    for (const c of patient.conditions.filter((c: any) => c.status === 'active').slice(0, 15)) {
      const onset = c.onsetDate?.toISOString().split('T')[0];
      parts.push(`- ${c.display}${onset ? ` (since ${onset})` : ''}`);
    }
  }

  if (patient.medications?.length) {
    parts.push('\n## Current Medications');
    for (const m of patient.medications.filter((m: any) => m.status === 'active').slice(0, 15)) {
      parts.push(`- ${m.display}${m.dosageInstruction ? ` - ${m.dosageInstruction}` : ''}`);
    }
  }

  if (patient.observations?.length) {
    parts.push('\n## Recent Observations');
    for (const o of patient.observations.slice(0, 10)) {
      const date = o.effectiveDate?.toISOString().split('T')[0];
      const value = o.valueNumeric !== null
        ? `${o.valueNumeric} ${o.unit || ''}`
        : o.valueString || 'N/A';
      parts.push(`- ${o.display}: ${value}${date ? ` (${date})` : ''}`);
    }
  }

  if (patient.allergies?.length) {
    parts.push('\n## Allergies');
    for (const a of patient.allergies) {
      parts.push(`- ${a.display} (${a.criticality || 'unknown criticality'})`);
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
