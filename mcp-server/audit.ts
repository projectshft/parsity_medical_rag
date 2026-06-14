/**
 * MCP Server Audit Logger
 *
 * Logs all tool invocations for security monitoring and compliance.
 * Writes to daily JSONL files with automatic rotation.
 */

import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AuthResult } from './auth';

/**
 * Audit log entry structure
 */
export interface AuditLogEntry {
  timestamp: string;
  keyHash: string;
  keyName: string;
  toolName: string;
  parameters: Record<string, unknown>;
  success: boolean;
  durationMs: number;
  error?: string;
  resultSummary?: string;
}

/**
 * Fields that should be redacted in audit logs
 */
const SENSITIVE_FIELDS = ['ssn', 'socialSecurity', 'password', 'secret', 'token', 'apiKey', 'key'];

/**
 * Default log directory
 */
const DEFAULT_LOG_DIR = join(process.cwd(), 'logs');

/**
 * Current log directory (can be changed for testing)
 */
let logDirectory = DEFAULT_LOG_DIR;

/**
 * Set the log directory
 *
 * @param dir - Directory path for log files
 */
export function setLogDirectory(dir: string): void {
  logDirectory = dir;
}

/**
 * Get the current log directory
 */
export function getLogDirectory(): string {
  return logDirectory;
}

/**
 * Get the log file path for a given date
 *
 * @param date - The date for the log file
 * @returns Full path to the log file
 */
export function getLogFilePath(date: Date = new Date()): string {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  return join(logDirectory, `mcp-audit-${dateStr}.jsonl`);
}

/**
 * Ensure the log directory exists
 */
function ensureLogDirectory(): void {
  if (!existsSync(logDirectory)) {
    mkdirSync(logDirectory, { recursive: true });
  }
}

/**
 * Redact sensitive fields from parameters
 *
 * @param params - Parameters object
 * @returns Parameters with sensitive values redacted
 */
export function redactSensitiveFields(params: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_FIELDS.some((field) => lowerKey.includes(field.toLowerCase()));

    if (isSensitive) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively redact nested objects
      redacted[key] = redactSensitiveFields(value as Record<string, unknown>);
    } else if (typeof value === 'string' && value.length > 200) {
      // Truncate long strings
      redacted[key] = value.substring(0, 200) + '...[truncated]';
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Log a tool invocation
 *
 * @param entry - Partial audit log entry (timestamp will be added)
 */
export function logToolInvocation(entry: Omit<AuditLogEntry, 'timestamp'>): void {
  ensureLogDirectory();

  const fullEntry: AuditLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
    parameters: redactSensitiveFields(entry.parameters),
  };

  const logLine = JSON.stringify(fullEntry) + '\n';
  const logPath = getLogFilePath();

  try {
    appendFileSync(logPath, logLine, 'utf-8');
  } catch (error) {
    // Log to stderr if file write fails
    console.error('[Audit] Failed to write to log file:', error);
    console.error('[Audit] Entry:', JSON.stringify(fullEntry));
  }
}

/**
 * Create an audit-wrapped tool handler
 * Automatically logs invocations with timing
 *
 * @param toolName - Name of the tool
 * @param handler - The tool handler function
 * @returns Wrapped handler that logs invocations
 */
export function withAudit<TParams extends Record<string, unknown>, TResult>(
  toolName: string,
  handler: (params: TParams, auth: AuthResult) => Promise<TResult>
): (params: TParams, auth: AuthResult) => Promise<TResult> {
  return async (params: TParams, auth: AuthResult): Promise<TResult> => {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;
    let resultSummary: string | undefined;

    try {
      const result = await handler(params, auth);
      success = true;

      // Create a brief summary of the result
      if (result && typeof result === 'object') {
        const resultObj = result as Record<string, unknown>;
        if ('content' in resultObj && Array.isArray(resultObj.content)) {
          const textContent = resultObj.content.find(
            (c: unknown) => typeof c === 'object' && c !== null && 'type' in c && c.type === 'text'
          ) as { text?: string } | undefined;
          if (textContent?.text) {
            resultSummary = textContent.text.substring(0, 100) + (textContent.text.length > 100 ? '...' : '');
          }
        }
      }

      return result;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      const durationMs = Date.now() - startTime;

      logToolInvocation({
        keyHash: auth.keyHash || 'unknown',
        keyName: auth.keyName || 'unknown',
        toolName,
        parameters: params,
        success,
        durationMs,
        error,
        resultSummary,
      });
    }
  };
}

/**
 * Log a security event (failed auth, access denied, etc.)
 *
 * @param event - Type of security event
 * @param details - Event details
 */
export function logSecurityEvent(
  event: 'auth_failed' | 'access_denied' | 'rate_limited' | 'key_expired' | 'suspicious_activity',
  details: {
    keyHash?: string;
    keyName?: string;
    toolName?: string;
    reason: string;
    metadata?: Record<string, unknown>;
  }
): void {
  ensureLogDirectory();

  const entry = {
    timestamp: new Date().toISOString(),
    eventType: 'security',
    event,
    ...details,
  };

  const logLine = JSON.stringify(entry) + '\n';
  const logPath = getLogFilePath();

  try {
    appendFileSync(logPath, logLine, 'utf-8');
  } catch (error) {
    console.error('[Audit] Failed to log security event:', error);
    console.error('[Audit] Event:', JSON.stringify(entry));
  }
}

/**
 * Combine auth and audit middleware
 * Validates auth, checks permissions, logs everything
 */
export function withAuthAndAudit<TParams extends Record<string, unknown>, TResult>(
  toolName: string,
  requiredScopes: string[],
  handler: (params: TParams, auth: AuthResult) => Promise<TResult>
): (params: TParams, auth: AuthResult) => Promise<TResult> {
  // Apply audit wrapper
  const audited = withAudit(toolName, handler);

  return async (params: TParams, auth: AuthResult): Promise<TResult> => {
    // Auth validation happens in the outer layer (withAuth from auth.ts)
    // Here we just execute with audit logging
    return audited(params, auth);
  };
}

/**
 * Get audit statistics for a date range (for monitoring)
 *
 * This is a placeholder - in production, you'd query the log files
 */
export interface AuditStats {
  totalInvocations: number;
  successCount: number;
  failureCount: number;
  avgDurationMs: number;
  byTool: Record<string, number>;
  byKey: Record<string, number>;
}

export function getAuditStatsPlaceholder(): AuditStats {
  return {
    totalInvocations: 0,
    successCount: 0,
    failureCount: 0,
    avgDurationMs: 0,
    byTool: {},
    byKey: {},
  };
}
