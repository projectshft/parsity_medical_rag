#!/usr/bin/env npx ts-node

/**
 * Demo: MCP Authentication
 *
 * This script demonstrates the MCP authentication system including:
 * - API key generation and validation
 * - Permission scopes and tool access control
 * - Audit logging
 *
 * Run: npx ts-node scripts/security/demo-mcp-auth.ts
 *
 * Environment variables:
 *   MCP_API_KEY - Standard read + read_pii access
 *   MCP_ADMIN_KEY - Full admin access
 */

import {
  generateApiKey,
  registerApiKey,
  validateApiKey,
  revokeApiKey,
  canAccessTool,
  getAccessibleTools,
  describeScope,
  hashApiKey,
  withAuth,
  TOOL_SCOPES,
  Scope,
} from '../../mcp-server/auth';
import { logToolInvocation, logSecurityEvent, getLogFilePath } from '../../mcp-server/audit';

// ANSI color codes for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

function log(message: string, color?: keyof typeof colors): void {
  const prefix = color ? colors[color] : '';
  const suffix = color ? colors.reset : '';
  console.log(`${prefix}${message}${suffix}`);
}

function header(title: string): void {
  console.log('\n' + '='.repeat(70));
  log(` ${title} `, 'bold');
  console.log('='.repeat(70) + '\n');
}

function section(title: string): void {
  console.log('\n' + '-'.repeat(50));
  log(title, 'cyan');
  console.log('-'.repeat(50) + '\n');
}

/**
 * Demo: API Key Generation
 */
function demoKeyGeneration(): void {
  header('1. API Key Generation');

  log('Generating a new API key:', 'cyan');
  const key = generateApiKey();

  log(`  Key: ${key.substring(0, 20)}...`, 'green');
  log(`  Format: mcp_<64-hex-characters>`, 'dim');
  log(`  Length: ${key.length} characters`, 'dim');

  section('Key Hashing (for secure storage)');

  const hash = hashApiKey(key);
  log('Keys are stored as SHA-256 hashes, never in plaintext:', 'yellow');
  log(`  Original: ${key.substring(0, 20)}...`, 'dim');
  log(`  Hash: ${hash.substring(0, 32)}...`, 'dim');
}

/**
 * Demo: Key Registration
 */
function demoKeyRegistration(): { readKey: string; adminKey: string } {
  header('2. API Key Registration');

  log('Registering keys with different permission scopes:\n', 'cyan');

  // Register a read-only key
  const readKey = generateApiKey();
  const readHash = registerApiKey(readKey, 'demo-read-only', ['read']);
  log('READ-ONLY KEY:', 'green');
  log(`  Name: demo-read-only`, 'dim');
  log(`  Scopes: [read]`, 'dim');
  log(`  Hash: ${readHash.substring(0, 16)}...`, 'dim');

  // Register a key with PII access
  const piiKey = generateApiKey();
  const piiHash = registerApiKey(piiKey, 'demo-pii-access', ['read', 'read_pii']);
  log('\nPII ACCESS KEY:', 'yellow');
  log(`  Name: demo-pii-access`, 'dim');
  log(`  Scopes: [read, read_pii]`, 'dim');
  log(`  Hash: ${piiHash.substring(0, 16)}...`, 'dim');

  // Register an admin key
  const adminKey = generateApiKey();
  const adminHash = registerApiKey(adminKey, 'demo-admin', ['read', 'read_pii', 'admin']);
  log('\nADMIN KEY:', 'red');
  log(`  Name: demo-admin`, 'dim');
  log(`  Scopes: [read, read_pii, admin]`, 'dim');
  log(`  Hash: ${adminHash.substring(0, 16)}...`, 'dim');

  // Register a rate-limited key
  const limitedKey = generateApiKey();
  registerApiKey(limitedKey, 'demo-rate-limited', ['read'], { rateLimit: 5 });
  log('\nRATE-LIMITED KEY:', 'magenta');
  log(`  Name: demo-rate-limited`, 'dim');
  log(`  Scopes: [read]`, 'dim');
  log(`  Rate Limit: 5 requests/minute`, 'dim');

  // Register an expiring key
  const expiringKey = generateApiKey();
  const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now
  registerApiKey(expiringKey, 'demo-expiring', ['read'], { expiresAt });
  log('\nEXPIRING KEY:', 'blue');
  log(`  Name: demo-expiring`, 'dim');
  log(`  Scopes: [read]`, 'dim');
  log(`  Expires: ${expiresAt.toISOString()}`, 'dim');

  return { readKey, adminKey };
}

/**
 * Demo: Key Validation
 */
function demoKeyValidation(readKey: string, adminKey: string): void {
  header('3. API Key Validation');

  log('Testing key validation:\n', 'cyan');

  // Valid read key
  log('Valid read-only key:', 'green');
  const readResult = validateApiKey(readKey);
  log(`  Success: ${readResult.success}`, 'dim');
  log(`  Name: ${readResult.keyName}`, 'dim');
  log(`  Scopes: ${readResult.scopes?.join(', ')}`, 'dim');

  // Valid admin key
  log('\nValid admin key:', 'green');
  const adminResult = validateApiKey(adminKey);
  log(`  Success: ${adminResult.success}`, 'dim');
  log(`  Name: ${adminResult.keyName}`, 'dim');
  log(`  Scopes: ${adminResult.scopes?.join(', ')}`, 'dim');

  // Invalid key
  log('\nInvalid key:', 'red');
  const invalidResult = validateApiKey('invalid-key-12345');
  log(`  Success: ${invalidResult.success}`, 'dim');
  log(`  Error: ${invalidResult.error}`, 'dim');

  // Missing key
  log('\nMissing key:', 'red');
  const missingResult = validateApiKey(undefined);
  log(`  Success: ${missingResult.success}`, 'dim');
  log(`  Error: ${missingResult.error}`, 'dim');

  // Environment key (if set)
  if (process.env.MCP_API_KEY) {
    log('\nEnvironment MCP_API_KEY:', 'blue');
    const envResult = validateApiKey(process.env.MCP_API_KEY);
    log(`  Success: ${envResult.success}`, 'dim');
    log(`  Name: ${envResult.keyName}`, 'dim');
    log(`  Scopes: ${envResult.scopes?.join(', ')}`, 'dim');
  }
}

/**
 * Demo: Tool Access Control
 */
function demoToolAccess(): void {
  header('4. Tool Access Control');

  log('Permission scope definitions:\n', 'cyan');

  const scopes: Scope[] = ['read', 'read_pii', 'admin'];
  for (const scope of scopes) {
    log(`${scope}: ${describeScope(scope)}`, scope === 'admin' ? 'red' : scope === 'read_pii' ? 'yellow' : 'green');
  }

  section('Tool -> Scope Mapping');

  for (const [tool, requiredScopes] of Object.entries(TOOL_SCOPES)) {
    const color = requiredScopes.includes('admin') ? 'red' : requiredScopes.includes('read_pii') ? 'yellow' : 'green';
    log(`${tool}: [${requiredScopes.join(', ')}]`, color);
  }

  section('Access Testing');

  const testCases = [
    { scopes: ['read'] as Scope[], tool: 'search_patients', expected: true },
    { scopes: ['read'] as Scope[], tool: 'get_patient', expected: false },
    { scopes: ['read_pii'] as Scope[], tool: 'get_patient', expected: true },
    { scopes: ['read'] as Scope[], tool: 'list_patients_by_condition', expected: false },
    { scopes: ['admin'] as Scope[], tool: 'list_patients_by_condition', expected: true },
  ];

  for (const { scopes, tool, expected } of testCases) {
    const result = canAccessTool(scopes, tool);
    const pass = result === expected;
    const icon = pass ? (result ? '  ' : '  ') : '  ';
    const color = pass ? (result ? 'green' : 'yellow') : 'red';
    log(`${icon} [${scopes.join(', ')}] -> ${tool}: ${result ? 'ALLOWED' : 'DENIED'}`, color);
  }

  section('Accessible Tools by Scope');

  log('read scope:', 'green');
  log(`  ${getAccessibleTools(['read']).join(', ')}`, 'dim');

  log('\nread + read_pii scopes:', 'yellow');
  log(`  ${getAccessibleTools(['read', 'read_pii']).join(', ')}`, 'dim');

  log('\nadmin scope:', 'red');
  log(`  ${getAccessibleTools(['admin']).join(', ')}`, 'dim');
}

/**
 * Demo: Audit Logging
 */
function demoAuditLogging(): void {
  header('5. Audit Logging');

  log('Audit logs capture all tool invocations:\n', 'cyan');

  const logPath = getLogFilePath();
  log(`Log file: ${logPath}`, 'dim');

  section('Sample Audit Log Entry');

  // Log a successful invocation
  logToolInvocation({
    keyHash: 'a1b2c3d4',
    keyName: 'demo-user',
    toolName: 'search_patients',
    parameters: { query: 'diabetes', limit: 10 },
    success: true,
    durationMs: 45,
    resultSummary: 'Found 5 patients matching query...',
  });

  log('Logged successful invocation:', 'green');
  console.log(
    colors.dim +
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          keyHash: 'a1b2c3d4',
          keyName: 'demo-user',
          toolName: 'search_patients',
          parameters: { query: 'diabetes', limit: 10 },
          success: true,
          durationMs: 45,
        },
        null,
        2
      ) +
      colors.reset
  );

  // Log a failed invocation
  logToolInvocation({
    keyHash: 'e5f6g7h8',
    keyName: 'unknown',
    toolName: 'get_patient',
    parameters: { patientId: '12345' },
    success: false,
    durationMs: 12,
    error: 'Access denied: insufficient permissions',
  });

  log('\nLogged failed invocation:', 'red');
  console.log(
    colors.dim +
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          keyHash: 'e5f6g7h8',
          keyName: 'unknown',
          toolName: 'get_patient',
          parameters: { patientId: '12345' },
          success: false,
          durationMs: 12,
          error: 'Access denied: insufficient permissions',
        },
        null,
        2
      ) +
      colors.reset
  );

  section('Security Events');

  // Log security events
  logSecurityEvent('auth_failed', {
    reason: 'Invalid API key provided',
    metadata: { attemptedKey: 'invalid...' },
  });

  logSecurityEvent('access_denied', {
    keyHash: 'a1b2c3d4',
    keyName: 'demo-user',
    toolName: 'list_patients_by_condition',
    reason: 'Insufficient scope',
  });

  log('Security events are logged separately:', 'yellow');
  log('  - auth_failed: Invalid key attempts', 'dim');
  log('  - access_denied: Permission violations', 'dim');
  log('  - rate_limited: Rate limit exceeded', 'dim');
  log('  - key_expired: Expired key usage', 'dim');
  log('  - suspicious_activity: Unusual patterns', 'dim');

  section('Sensitive Data Redaction');

  logToolInvocation({
    keyHash: 'demo1234',
    keyName: 'demo-user',
    toolName: 'search_patients',
    parameters: {
      query: 'John Smith',
      ssn: '123-45-6789', // Will be redacted
      password: 'secret123', // Will be redacted
      apiKey: 'sk-xxx', // Will be redacted
    },
    success: true,
    durationMs: 50,
  });

  log('Sensitive fields are automatically redacted:', 'green');
  console.log(
    colors.dim +
      JSON.stringify(
        {
          parameters: {
            query: 'John Smith',
            ssn: '[REDACTED]',
            password: '[REDACTED]',
            apiKey: '[REDACTED]',
          },
        },
        null,
        2
      ) +
      colors.reset
  );
}

/**
 * Demo: Authenticated Tool Wrapper
 */
async function demoAuthWrapper(): Promise<void> {
  header('6. Authenticated Tool Wrapper');

  log('The withAuth() wrapper combines validation and access control:\n', 'cyan');

  // Register a test key
  const testKey = generateApiKey();
  registerApiKey(testKey, 'wrapper-test', ['read']);

  // Create a mock tool handler
  const mockHandler = async (params: { query: string }, auth: any) => {
    return {
      content: [{ type: 'text', text: `Searched for: ${params.query}` }],
      auth: auth.keyName,
    };
  };

  // Wrap with auth
  const wrappedTool = withAuth('search_patients', mockHandler);

  section('Successful Invocation');

  try {
    const result = await wrappedTool({ query: 'test' }, testKey);
    log('Result:', 'green');
    console.log(colors.dim + JSON.stringify(result, null, 2) + colors.reset);
  } catch (error) {
    log(`Error: ${error}`, 'red');
  }

  section('Failed: Invalid Key');

  try {
    await wrappedTool({ query: 'test' }, 'invalid-key');
    log('Should not reach here', 'red');
  } catch (error) {
    log(`Expected error: ${error instanceof Error ? error.message : error}`, 'yellow');
  }

  section('Failed: Insufficient Permissions');

  // Try to access PII tool with read-only key
  const piiWrapped = withAuth('get_patient', async () => ({ content: [{ type: 'text', text: 'patient data' }] }));

  try {
    await piiWrapped({ patientId: '123' }, testKey);
    log('Should not reach here', 'red');
  } catch (error) {
    log(`Expected error: ${error instanceof Error ? error.message : error}`, 'yellow');
  }
}

/**
 * Demo: Key Revocation
 */
function demoKeyRevocation(): void {
  header('7. Key Revocation');

  const key = generateApiKey();
  const hash = registerApiKey(key, 'revocation-test', ['read']);

  log('Key before revocation:', 'green');
  const before = validateApiKey(key);
  log(`  Valid: ${before.success}`, 'dim');

  section('Revoking Key');

  const revoked = revokeApiKey(hash);
  log(`Revocation result: ${revoked ? 'success' : 'failed'}`, revoked ? 'green' : 'red');

  log('\nKey after revocation:', 'red');
  const after = validateApiKey(key);
  log(`  Valid: ${after.success}`, 'dim');
  log(`  Error: ${after.error}`, 'dim');
}

/**
 * Main demo runner
 */
async function main(): Promise<void> {
  console.clear();
  log('\n' + '='.repeat(70), 'magenta');
  log(' MCP AUTHENTICATION DEMO ', 'bold');
  log('='.repeat(70) + '\n', 'magenta');

  log('This demo shows how to secure MCP tools with authentication and audit logging.\n', 'cyan');

  demoKeyGeneration();
  const { readKey, adminKey } = demoKeyRegistration();
  demoKeyValidation(readKey, adminKey);
  demoToolAccess();
  demoAuditLogging();
  await demoAuthWrapper();
  demoKeyRevocation();

  console.log('\n' + '='.repeat(70));
  log(' Demo Complete! ', 'green');
  console.log('='.repeat(70) + '\n');

  log('Check the audit log at:', 'cyan');
  log(`  ${getLogFilePath()}`, 'dim');

  log('\nNext steps:', 'cyan');
  log('  1. Read docs/CHALLENGE-MCP-AUTH.md for the hands-on challenge', 'dim');
  log('  2. Set MCP_API_KEY and MCP_ADMIN_KEY environment variables', 'dim');
  log('  3. Integrate auth into mcp-server/index.ts', 'dim');

  process.exit(0);
}

// Run the demo
main().catch(console.error);
