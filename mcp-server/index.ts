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

// Must precede lib/* — they build API clients at import time. Anchored to the
// repo root, not process.cwd(): MCP clients spawn this server from anywhere.
import { config } from 'dotenv';
// quiet: dotenv's "injected env" banner goes to stdout, which IS the JSON-RPC
// stream on a stdio transport — one stray byte and the client drops the server.
config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });

// .js is required — the SDK's package exports resolve `./*` verbatim, so a
// bare `server/mcp` becomes dist/cjs/server/mcp and nothing appends the extension.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { searchClinicalNotes } from '../lib/vector-search';
import { scheduleAppointment } from '../lib/calendar';

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
	'query_clinical_notes',
	{
		description:
			'Search clinical notes using semantic search. Use this for finding relevant medical notes, symptoms, treatments, or clinical observations.',
		inputSchema: {
			query: z
				.string()
				.describe(
					'Semantic search query (e.g., "chest pain", "breathing problems")',
				),
			patientName: z
				.string()
				.optional()
				.describe('Optional: limit to a specific patient name'),
			topK: z
				.number()
				.optional()
				.default(10)
				.describe('Number of results to return'),
		},
	},
	async ({ query, patientName, topK }) => {
		try {
			const results = await searchClinicalNotes(
				query,
				{
					topK,
					firstName: patientName?.split(' ')[0],
				},
				true,
			);

			if (!results.rerankedDocuments.length) {
				return {
					content: [
						{
							type: 'text',
							text: 'No matching clinical notes found.',
						},
					],
				};
			}

			return {
				content: [
					{
						type: 'text',
						text: `## Clinical Notes please do not show any PII \n${results.rerankedDocuments.map((doc: any) => JSON.stringify(doc.document)).join('\n')}`,
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{ type: 'text', text: `Error searching notes: ${error}` },
				],
				isError: true,
			};
		}
	},
);

server.registerTool(
	'schedule_appointment_for_patient',
	{
		description:
			'Schedule an appointment for a patient using their first name.',
		inputSchema: {
			patientName: z
				.string()
				.describe(
					'The first name of the patient to schedule an appointment for',
				),
			date: z
				.string()
				.describe('The date of the appointment in YYYY-MM-DD format'),
			time: z
				.string()
				.describe('The time of the appointment in HH:MM format'),
		},
	},
	async ({ patientName, date, time }) => {
		const appointment = await scheduleAppointment({
			patientName,
			dateTime: `${date}T${time}:00`,
		});
		if (!appointment.success) {
			return {
				content: [
					{
						type: 'text',
						text: `Error scheduling appointment: ${appointment.error}`,
					},
				],
				isError: true,
			};
		}
		return {
			content: [
				{
					type: 'text',
					text: `Appointment scheduled for ${patientName} on ${date} at ${time} successfully`,
				},
			],
		};
	},
);
// Start the server
async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error('Medical RAG MCP server running');
}

main().catch(console.error);
