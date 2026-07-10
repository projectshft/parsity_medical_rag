# Challenge: Build a Custom MCP Tool

Extend the MCP server with a new tool that exposes a useful capability to an AI
assistant (Claude Desktop / Cursor).

> **Capstone track:** Option 4 · **Competency:** C-AGT-1 (MCP server with defined tools, Advanced)

## Learning Objectives

- Design an MCP tool interface (name, description, input schema)
- Implement a handler backed by the existing data/RAG layers
- Document and demo the tool in a real MCP client

## Background

The MCP server (`mcp-server/index.ts`) already exposes five tools:

| Tool | Purpose |
|------|---------|
| `search_patients` | Search patients by query |
| `query_notes` | Semantic search over clinical notes |
| `get_patient` | Detailed patient info |
| `find_patient_by_name` | Lookup by name |
| `list_patients_by_condition` | Patients with a condition |

Tools are registered with `server.tool(name, description, zodShape, handler)` and
return `{ content: [{ type: 'text', text }] }`.

## Your Task

### 1. Design a new tool

Pick something genuinely useful and not already covered, e.g.:

- `summarize_patient` — a concise clinical summary for one patient
- `list_conditions` — distinct conditions across the cohort with counts
- `patient_timeline` — chronological events for a patient
- `compare_patients` — shared conditions/medications between two patients

### 2. Implement it — `mcp-server/index.ts`

- Define a **Zod input schema** with clear `.describe()` text for each field.
- Implement the handler using the existing `lib/` query/RAG functions.
- Return well-formed `content`; handle invalid input with an informative error.

### 3. Wire it up & demo

- Connect the server in an MCP client (Claude Desktop / Cursor).
- Demonstrate: natural language → your tool → result.

## Acceptance Criteria

- [ ] New tool registered with a validated input schema and clear description
- [ ] Handler returns correct, well-formed results from real data
- [ ] Invalid input returns an informative error (no unhandled throw)
- [ ] Works end-to-end in an MCP client (screenshot or recording)
- [ ] At least 3 tests for the handler (happy path, invalid input, empty result)

> **Security note:** if you completed the MCP auth challenge
> (`docs/CHALLENGE-MCP-AUTH.md`), wrap your new tool in the same
> authentication/authorization and audit logging as the others.

## Bonus

1. **Scoped permissions** — require an appropriate scope to call the tool.
2. **Pagination** — handle large result sets.
3. **Composed tool** — have your tool call two existing tools and merge results.

## Resources

- [MCP Specification](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
