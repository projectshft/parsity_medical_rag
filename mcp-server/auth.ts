/**
 * MCP Server Authentication Module
 *
 * Provides API key-based authentication with permission scopes for MCP tools.
 * Demonstrates secure patterns for protecting tool access.
 */

import { createHash, randomBytes } from 'crypto';

/**
 * Permission scopes for MCP tools
 */
export type Scope = 'read' | 'read_pii' | 'admin';

/**
 * Tool to scope mapping
 */
export const TOOL_SCOPES: Record<string, Scope[]> = {
  // Read scope - basic search operations
  search_patients: ['read'],
  query_notes: ['read'],

  // Read PII scope - tools that return personally identifiable information
  get_patient: ['read_pii'],
  find_patient_by_name: ['read_pii'],

  // Admin scope - tools with broader access
  list_patients_by_condition: ['admin'],
};

/**
 * API key metadata
 */
export interface ApiKeyRecord {
  keyHash: string;
  name: string;
  scopes: Scope[];
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
  rateLimit?: number; // requests per minute
  requestCount?: number;
  rateLimitResetAt?: Date;
}

/**
 * Authentication result
 */
export interface AuthResult {
  success: boolean;
  keyName?: string;
  scopes?: Scope[];
  keyHash?: string;
  error?: string;
}

/**
 * In-memory key store (in production, use a database)
 */
const keyStore = new Map<string, ApiKeyRecord>();

/**
 * Hash an API key for secure storage
 *
 * @param key - The raw API key
 * @returns SHA-256 hash of the key
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Generate a new API key
 *
 * @returns A new API key in format: mcp_<64-hex-chars>
 */
export function generateApiKey(): string {
  const randomPart = randomBytes(32).toString('hex');
  return `mcp_${randomPart}`;
}

/**
 * Register a new API key
 *
 * @param key - The raw API key
 * @param name - Human-readable name for the key
 * @param scopes - Permission scopes
 * @param options - Additional options
 * @returns The key hash for reference
 */
export function registerApiKey(
  key: string,
  name: string,
  scopes: Scope[],
  options?: {
    expiresAt?: Date;
    rateLimit?: number;
  }
): string {
  const keyHash = hashApiKey(key);

  keyStore.set(keyHash, {
    keyHash,
    name,
    scopes,
    createdAt: new Date(),
    expiresAt: options?.expiresAt,
    rateLimit: options?.rateLimit,
    requestCount: 0,
    rateLimitResetAt: new Date(),
  });

  return keyHash;
}

/**
 * Revoke an API key
 *
 * @param keyHash - The hash of the key to revoke
 * @returns true if key was found and revoked
 */
export function revokeApiKey(keyHash: string): boolean {
  return keyStore.delete(keyHash);
}

/**
 * Validate an API key and return auth result
 *
 * @param key - The raw API key to validate
 * @returns AuthResult with success status and details
 */
export function validateApiKey(key: string | undefined): AuthResult {
  if (!key) {
    return {
      success: false,
      error: 'API key is required',
    };
  }

  // Check for environment-based keys first
  const envResult = checkEnvironmentKeys(key);
  if (envResult) {
    return envResult;
  }

  // Check registered keys
  const keyHash = hashApiKey(key);
  const record = keyStore.get(keyHash);

  if (!record) {
    return {
      success: false,
      error: 'Invalid API key',
    };
  }

  // Check expiration
  if (record.expiresAt && record.expiresAt < new Date()) {
    return {
      success: false,
      error: 'API key has expired',
    };
  }

  // Check rate limit
  if (record.rateLimit) {
    const now = new Date();
    const resetAt = record.rateLimitResetAt || now;

    // Reset counter if a minute has passed
    if (now >= resetAt) {
      record.requestCount = 0;
      record.rateLimitResetAt = new Date(now.getTime() + 60000);
    }

    if ((record.requestCount || 0) >= record.rateLimit) {
      return {
        success: false,
        error: `Rate limit exceeded. Try again after ${resetAt.toISOString()}`,
      };
    }

    record.requestCount = (record.requestCount || 0) + 1;
  }

  // Update last used
  record.lastUsedAt = new Date();

  return {
    success: true,
    keyName: record.name,
    scopes: record.scopes,
    keyHash: keyHash.substring(0, 8), // Only return first 8 chars for logging
  };
}

/**
 * Check environment-configured API keys
 */
function checkEnvironmentKeys(key: string): AuthResult | null {
  // Check MCP_API_KEY for standard read + read_pii access
  if (process.env.MCP_API_KEY && key === process.env.MCP_API_KEY) {
    return {
      success: true,
      keyName: 'env:MCP_API_KEY',
      scopes: ['read', 'read_pii'],
      keyHash: hashApiKey(key).substring(0, 8),
    };
  }

  // Check MCP_ADMIN_KEY for full admin access
  if (process.env.MCP_ADMIN_KEY && key === process.env.MCP_ADMIN_KEY) {
    return {
      success: true,
      keyName: 'env:MCP_ADMIN_KEY',
      scopes: ['read', 'read_pii', 'admin'],
      keyHash: hashApiKey(key).substring(0, 8),
    };
  }

  return null;
}

/**
 * Check if a set of scopes can access a specific tool
 *
 * @param scopes - The scopes to check
 * @param tool - The tool name
 * @returns true if access is allowed
 */
export function canAccessTool(scopes: Scope[], tool: string): boolean {
  const requiredScopes = TOOL_SCOPES[tool];

  if (!requiredScopes) {
    // Unknown tool - deny by default
    return false;
  }

  // Check if any of the user's scopes satisfies the requirement
  // Admin scope has access to everything
  if (scopes.includes('admin')) {
    return true;
  }

  // Check if user has at least one of the required scopes
  return requiredScopes.some((required) => scopes.includes(required));
}

/**
 * Get a human-readable description of scope permissions
 *
 * @param scope - The scope to describe
 * @returns Description string
 */
export function describeScope(scope: Scope): string {
  switch (scope) {
    case 'read':
      return 'Search patients and query clinical notes';
    case 'read_pii':
      return 'Access patient details and lookup by name';
    case 'admin':
      return 'Full access including bulk patient listing';
    default:
      return 'Unknown scope';
  }
}

/**
 * Get all tools accessible with given scopes
 *
 * @param scopes - The scopes to check
 * @returns Array of accessible tool names
 */
export function getAccessibleTools(scopes: Scope[]): string[] {
  return Object.entries(TOOL_SCOPES)
    .filter(([, requiredScopes]) => {
      if (scopes.includes('admin')) return true;
      return requiredScopes.some((required) => scopes.includes(required));
    })
    .map(([tool]) => tool);
}

/**
 * Middleware type for authenticated tool handlers
 */
export interface AuthenticatedContext {
  auth: AuthResult;
}

/**
 * Extract API key from various sources
 *
 * @param headers - Request headers
 * @returns The API key if found
 */
export function extractApiKey(headers: Record<string, string | undefined>): string | undefined {
  // Check Authorization header (Bearer token)
  const authHeader = headers['authorization'] || headers['Authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Check X-API-Key header
  return headers['x-api-key'] || headers['X-API-Key'];
}

/**
 * Create an authenticated tool wrapper
 * Validates API key and checks tool permissions before executing handler
 *
 * @param toolName - Name of the tool
 * @param handler - The tool handler function
 * @returns Wrapped handler with auth checks
 */
export function withAuth<TParams, TResult>(
  toolName: string,
  handler: (params: TParams, auth: AuthResult) => Promise<TResult>
): (params: TParams, apiKey?: string) => Promise<TResult> {
  return async (params: TParams, apiKey?: string): Promise<TResult> => {
    // Validate API key
    const auth = validateApiKey(apiKey);

    if (!auth.success) {
      throw new Error(`Authentication failed: ${auth.error}`);
    }

    // Check tool permissions
    if (!canAccessTool(auth.scopes!, toolName)) {
      throw new Error(
        `Access denied: Tool '${toolName}' requires one of [${TOOL_SCOPES[toolName]?.join(', ')}] scope(s). ` +
          `Your key has: [${auth.scopes?.join(', ')}]`
      );
    }

    // Execute handler with auth context
    return handler(params, auth);
  };
}

/**
 * Initialize default keys from environment on module load
 */
export function initializeFromEnvironment(): void {
  // Keys are checked dynamically in validateApiKey
  // This function is for any additional initialization needed
  console.error('[Auth] Initialized. Environment keys will be checked on each request.');
}
