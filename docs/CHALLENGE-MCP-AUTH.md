# Challenge: Securing MCP Server with Authentication

## Overview

In this challenge, you'll implement authentication and authorization for the MCP (Model Context Protocol) server that exposes medical RAG tools. You'll add API key validation, permission scopes, and audit logging.

## Learning Objectives

- Understand MCP server security requirements
- Implement API key-based authentication
- Design permission scopes for medical data access
- Add comprehensive audit logging
- Apply the principle of least privilege

## Background

The MCP server in `mcp-server/index.ts` exposes 5 tools:

| Tool | Description | Current Security |
|------|-------------|------------------|
| `search_patients` | Search patients by query | None |
| `query_notes` | Semantic search clinical notes | None |
| `get_patient` | Get detailed patient info | None |
| `find_patient_by_name` | Lookup patient by name | None |
| `list_patients_by_condition` | List patients with condition | None |

**Current vulnerability**: Anyone who can connect to the MCP server has full access to all tools and all patient data.

## Part 1: Understanding the Problem

### Examine Current Code

Read `mcp-server/index.ts` and note:
1. No authentication check before tool execution
2. No permission differentiation between tools
3. No logging of who accessed what data

### Threat Model

Consider these scenarios:
1. An unauthorized user connects to the MCP server
2. A user with limited permissions tries to access PII
3. An attacker wants to enumerate all patients
4. An audit is required to see who accessed specific records

## Part 2: Implement Authentication

The auth module is provided in `mcp-server/auth.ts`. Your task is to integrate it.

### Task 2.1: Add Auth Middleware to MCP Server

Modify `mcp-server/index.ts` to require authentication:

```typescript
import {
  validateApiKey,
  canAccessTool,
  extractApiKey,
  withAuth,
  AuthResult
} from './auth';

// Create a helper for authenticated tools
function authenticatedTool<TParams extends Record<string, unknown>>(
  name: string,
  description: string,
  schema: z.ZodType<TParams>,
  handler: (params: TParams, auth: AuthResult) => Promise<{ content: Array<{ type: string; text: string }> }>
) {
  server.tool(
    name,
    description,
    {
      ...schema.shape,
      _apiKey: z.string().optional().describe('API key for authentication'),
    },
    async (params: TParams & { _apiKey?: string }) => {
      // Extract API key from params
      const apiKey = params._apiKey;
      delete params._apiKey;

      // Validate authentication
      const auth = validateApiKey(apiKey);
      if (!auth.success) {
        return {
          content: [{ type: 'text', text: `Authentication failed: ${auth.error}` }],
          isError: true,
        };
      }

      // Check tool permissions
      if (!canAccessTool(auth.scopes!, name)) {
        return {
          content: [{ type: 'text', text: `Access denied: insufficient permissions for ${name}` }],
          isError: true,
        };
      }

      // Execute handler
      return handler(params as TParams, auth);
    }
  );
}
```

### Task 2.2: Convert Existing Tools

Convert each tool to use the authenticated wrapper:

```typescript
// Before
server.tool('search_patients', ...);

// After
authenticatedTool(
  'search_patients',
  'Search for patients by name, condition, or other criteria.',
  z.object({
    query: z.string(),
    limit: z.number().optional().default(10),
  }),
  async ({ query, limit }, auth) => {
    // Handler code here
    // You now have access to auth.keyName, auth.scopes
  }
);
```

### Task 2.3: Environment Variable Configuration

Add environment variable support:

```bash
# .env
MCP_API_KEY=your-read-key-here
MCP_ADMIN_KEY=your-admin-key-here
MCP_REQUIRE_AUTH=true
```

## Part 3: Add Audit Logging

The audit module is in `mcp-server/audit.ts`. Integrate it with authentication.

### Task 3.1: Log All Tool Invocations

```typescript
import { logToolInvocation, logSecurityEvent, withAudit } from './audit';

// In your authenticated tool handler:
const startTime = Date.now();
try {
  const result = await handler(params, auth);
  logToolInvocation({
    keyHash: auth.keyHash!,
    keyName: auth.keyName!,
    toolName: name,
    parameters: params,
    success: true,
    durationMs: Date.now() - startTime,
  });
  return result;
} catch (error) {
  logToolInvocation({
    keyHash: auth.keyHash || 'unknown',
    keyName: auth.keyName || 'unknown',
    toolName: name,
    parameters: params,
    success: false,
    durationMs: Date.now() - startTime,
    error: error instanceof Error ? error.message : String(error),
  });
  throw error;
}
```

### Task 3.2: Log Security Events

Add logging for:
- Failed authentication attempts
- Permission denied events
- Rate limit exceeded
- Suspicious query patterns

```typescript
logSecurityEvent('auth_failed', {
  reason: 'Invalid API key',
  metadata: { keyPrefix: apiKey?.substring(0, 8) }
});

logSecurityEvent('access_denied', {
  keyHash: auth.keyHash,
  keyName: auth.keyName,
  toolName: name,
  reason: 'Insufficient scope',
});
```

## Part 4: Test the Implementation

### Run the Demo

```bash
npx ts-node scripts/security/demo-mcp-auth.ts
```

### Run the Test Suite

```bash
npm test mcp-server/auth.test.ts
```

### Manual Testing

1. Set up environment variables:
   ```bash
   export MCP_API_KEY="test-read-key"
   export MCP_ADMIN_KEY="test-admin-key"
   ```

2. Start the MCP server:
   ```bash
   npx ts-node mcp-server/index.ts
   ```

3. Test with Claude Desktop or via direct connection

### Create Test Scenarios

Write tests for:

```typescript
describe('MCP Server Authentication Integration', () => {
  it('rejects requests without API key');
  it('rejects requests with invalid API key');
  it('allows read scope to search_patients');
  it('denies read scope to get_patient');
  it('allows read_pii scope to get_patient');
  it('logs successful invocations');
  it('logs failed authentication');
  it('respects rate limits');
});
```

## Part 5: Advanced Challenges

### Challenge 5.1: Token-based Auth for MCP

MCP doesn't have built-in auth headers. Design a solution:

```typescript
// Option 1: API key in first message
// Client sends: { "type": "auth", "key": "..." }

// Option 2: API key as tool parameter (implemented above)

// Option 3: Environment variable on server side
// The server reads process.env.MCP_CLIENT_KEY

// Research: What's the best approach for MCP security?
```

### Challenge 5.2: Fine-grained Permissions

Extend the scope system:

```typescript
interface DetailedScope {
  tool: string;
  actions: ('read' | 'write' | 'delete')[];
  patientIds?: string[];  // Limit to specific patients
  conditions?: string[];  // Limit to specific conditions
}

// Example: Cardiologist can only access heart-related records
const cardiologistKey = registerApiKey(key, 'dr-smith', {
  tools: ['get_patient', 'query_notes'],
  conditions: ['cardiac', 'heart', 'cardiovascular'],
});
```

### Challenge 5.3: Key Rotation

Implement automatic key rotation:

```typescript
interface KeyRotationConfig {
  maxAgeHours: number;
  warningHours: number;
}

function scheduleKeyRotation(keyHash: string, config: KeyRotationConfig): void {
  // 1. Create new key before old one expires
  // 2. Notify key owner
  // 3. Grace period where both work
  // 4. Revoke old key
}
```

### Challenge 5.4: Audit Dashboard

Create a simple audit dashboard:

```typescript
// scripts/security/audit-dashboard.ts
async function showAuditDashboard(): Promise<void> {
  // Read today's audit log
  // Show:
  // - Total requests
  // - Requests by tool
  // - Requests by key
  // - Failed auth attempts
  // - Error rate
}
```

## Deliverables

1. Modified `mcp-server/index.ts` with authentication
2. Integration tests for auth flow
3. Working audit logging with log files in `logs/`
4. Documentation of your permission model
5. (Bonus) Fine-grained permissions or key rotation

## Testing Your Implementation

Use this checklist:

- [ ] Server rejects requests without API key
- [ ] Server rejects invalid API keys
- [ ] Read scope can access `search_patients`, `query_notes`
- [ ] Read scope cannot access `get_patient`
- [ ] Read_pii scope can access `get_patient`, `find_patient_by_name`
- [ ] Admin scope can access all tools
- [ ] Failed auth attempts are logged
- [ ] Successful requests are logged with timing
- [ ] Sensitive parameters are redacted in logs
- [ ] Environment keys (MCP_API_KEY, MCP_ADMIN_KEY) work

## Resources

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [API Key Best Practices](https://cloud.google.com/docs/authentication/api-keys)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

## Hints

<details>
<summary>Hint 1: MCP API Key Passing</summary>

Since MCP doesn't have native auth headers, the cleanest approach is:
1. Add `_apiKey` as an optional parameter to all tools
2. Extract and remove it before processing
3. Consider environment variable fallback for CLI usage
</details>

<details>
<summary>Hint 2: Testing MCP Auth</summary>

You can test the auth flow without a full MCP client:
```typescript
import { validateApiKey, canAccessTool } from './auth';

const auth = validateApiKey('test-key');
console.log('Auth result:', auth);
console.log('Can access get_patient:', canAccessTool(auth.scopes || [], 'get_patient'));
```
</details>

<details>
<summary>Hint 3: Audit Log Analysis</summary>

Parse JSONL logs with:
```bash
# All failed requests
cat logs/mcp-audit-*.jsonl | grep '"success":false'

# Requests by a specific key
cat logs/mcp-audit-*.jsonl | grep '"keyHash":"a1b2c3d4"'

# Security events only
cat logs/mcp-audit-*.jsonl | grep '"eventType":"security"'
```
</details>
