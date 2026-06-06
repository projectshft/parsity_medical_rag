/**
 * MCP Authentication Tests
 *
 * Run with: npm test mcp-server/auth.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  hashApiKey,
  generateApiKey,
  registerApiKey,
  revokeApiKey,
  validateApiKey,
  canAccessTool,
  getAccessibleTools,
  describeScope,
  withAuth,
  extractApiKey,
  TOOL_SCOPES,
} from './auth';

describe('hashApiKey', () => {
  it('returns consistent hash for same key', () => {
    const key = 'test-api-key-123';
    const hash1 = hashApiKey(key);
    const hash2 = hashApiKey(key);
    expect(hash1).toBe(hash2);
  });

  it('returns different hash for different keys', () => {
    const hash1 = hashApiKey('key-one');
    const hash2 = hashApiKey('key-two');
    expect(hash1).not.toBe(hash2);
  });

  it('returns 64-character hex string', () => {
    const hash = hashApiKey('test');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('generateApiKey', () => {
  it('generates key with mcp_ prefix', () => {
    const key = generateApiKey();
    expect(key.startsWith('mcp_')).toBe(true);
  });

  it('generates 68-character key (mcp_ + 64 hex chars)', () => {
    const key = generateApiKey();
    expect(key.length).toBe(68);
  });

  it('generates unique keys', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 100; i++) {
      keys.add(generateApiKey());
    }
    expect(keys.size).toBe(100);
  });
});

describe('registerApiKey', () => {
  it('returns key hash', () => {
    const key = 'test-register-key';
    const hash = registerApiKey(key, 'Test Key', ['read']);
    expect(hash).toBe(hashApiKey(key));
  });

  it('registers key with correct scopes', () => {
    const key = generateApiKey();
    registerApiKey(key, 'Multi-scope Key', ['read', 'read_pii']);

    const result = validateApiKey(key);
    expect(result.success).toBe(true);
    expect(result.scopes).toContain('read');
    expect(result.scopes).toContain('read_pii');
  });
});

describe('revokeApiKey', () => {
  it('returns true when key exists', () => {
    const key = generateApiKey();
    const hash = registerApiKey(key, 'Revoke Test', ['read']);

    const result = revokeApiKey(hash);
    expect(result).toBe(true);
  });

  it('returns false when key does not exist', () => {
    const result = revokeApiKey('nonexistent-hash');
    expect(result).toBe(false);
  });

  it('invalidates the key', () => {
    const key = generateApiKey();
    const hash = registerApiKey(key, 'Revoke Test 2', ['read']);

    // Verify key works before revocation
    expect(validateApiKey(key).success).toBe(true);

    // Revoke
    revokeApiKey(hash);

    // Verify key no longer works
    expect(validateApiKey(key).success).toBe(false);
  });
});

describe('validateApiKey', () => {
  it('rejects undefined key', () => {
    const result = validateApiKey(undefined);
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('rejects empty string', () => {
    const result = validateApiKey('');
    expect(result.success).toBe(false);
  });

  it('rejects invalid key', () => {
    const result = validateApiKey('invalid-random-key');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid');
  });

  it('accepts valid registered key', () => {
    const key = generateApiKey();
    registerApiKey(key, 'Valid Key Test', ['read']);

    const result = validateApiKey(key);
    expect(result.success).toBe(true);
    expect(result.keyName).toBe('Valid Key Test');
    expect(result.scopes).toContain('read');
  });

  it('returns truncated key hash', () => {
    const key = generateApiKey();
    registerApiKey(key, 'Hash Test', ['read']);

    const result = validateApiKey(key);
    expect(result.keyHash?.length).toBe(8);
  });

  describe('environment keys', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('accepts MCP_API_KEY from environment', () => {
      process.env.MCP_API_KEY = 'env-test-key-123';

      const result = validateApiKey('env-test-key-123');
      expect(result.success).toBe(true);
      expect(result.keyName).toBe('env:MCP_API_KEY');
      expect(result.scopes).toContain('read');
      expect(result.scopes).toContain('read_pii');
    });

    it('accepts MCP_ADMIN_KEY with admin scope', () => {
      process.env.MCP_ADMIN_KEY = 'admin-key-456';

      const result = validateApiKey('admin-key-456');
      expect(result.success).toBe(true);
      expect(result.keyName).toBe('env:MCP_ADMIN_KEY');
      expect(result.scopes).toContain('admin');
    });
  });

  describe('expiration', () => {
    it('rejects expired key', () => {
      const key = generateApiKey();
      registerApiKey(key, 'Expired Key', ['read'], {
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      });

      const result = validateApiKey(key);
      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('accepts non-expired key', () => {
      const key = generateApiKey();
      registerApiKey(key, 'Future Expiry', ['read'], {
        expiresAt: new Date(Date.now() + 60000), // Expires in 1 minute
      });

      const result = validateApiKey(key);
      expect(result.success).toBe(true);
    });
  });

  describe('rate limiting', () => {
    it('rejects when rate limit exceeded', () => {
      const key = generateApiKey();
      registerApiKey(key, 'Rate Limited', ['read'], {
        rateLimit: 2, // 2 requests per minute
      });

      // First two requests should succeed
      expect(validateApiKey(key).success).toBe(true);
      expect(validateApiKey(key).success).toBe(true);

      // Third request should fail
      const result = validateApiKey(key);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit');
    });
  });
});

describe('canAccessTool', () => {
  it('grants read scope access to search_patients', () => {
    expect(canAccessTool(['read'], 'search_patients')).toBe(true);
  });

  it('grants read scope access to query_notes', () => {
    expect(canAccessTool(['read'], 'query_notes')).toBe(true);
  });

  it('denies read scope access to get_patient', () => {
    expect(canAccessTool(['read'], 'get_patient')).toBe(false);
  });

  it('grants read_pii scope access to get_patient', () => {
    expect(canAccessTool(['read_pii'], 'get_patient')).toBe(true);
  });

  it('grants read_pii scope access to find_patient_by_name', () => {
    expect(canAccessTool(['read_pii'], 'find_patient_by_name')).toBe(true);
  });

  it('denies read_pii scope access to list_patients_by_condition', () => {
    expect(canAccessTool(['read_pii'], 'list_patients_by_condition')).toBe(false);
  });

  it('grants admin scope access to all tools', () => {
    expect(canAccessTool(['admin'], 'search_patients')).toBe(true);
    expect(canAccessTool(['admin'], 'get_patient')).toBe(true);
    expect(canAccessTool(['admin'], 'list_patients_by_condition')).toBe(true);
  });

  it('denies access to unknown tools', () => {
    expect(canAccessTool(['admin'], 'unknown_tool')).toBe(false);
  });
});

describe('getAccessibleTools', () => {
  it('returns read tools for read scope', () => {
    const tools = getAccessibleTools(['read']);
    expect(tools).toContain('search_patients');
    expect(tools).toContain('query_notes');
    expect(tools).not.toContain('get_patient');
  });

  it('returns all read and pii tools for read + read_pii scopes', () => {
    const tools = getAccessibleTools(['read', 'read_pii']);
    expect(tools).toContain('search_patients');
    expect(tools).toContain('query_notes');
    expect(tools).toContain('get_patient');
    expect(tools).toContain('find_patient_by_name');
    expect(tools).not.toContain('list_patients_by_condition');
  });

  it('returns all tools for admin scope', () => {
    const tools = getAccessibleTools(['admin']);
    expect(tools.length).toBe(Object.keys(TOOL_SCOPES).length);
  });
});

describe('describeScope', () => {
  it('describes read scope', () => {
    const desc = describeScope('read');
    expect(desc).toContain('Search');
    expect(desc).toContain('query');
  });

  it('describes read_pii scope', () => {
    const desc = describeScope('read_pii');
    expect(desc).toContain('patient');
  });

  it('describes admin scope', () => {
    const desc = describeScope('admin');
    expect(desc).toContain('Full access');
  });
});

describe('extractApiKey', () => {
  it('extracts from Bearer token', () => {
    const key = extractApiKey({ authorization: 'Bearer my-api-key' });
    expect(key).toBe('my-api-key');
  });

  it('extracts from X-API-Key header', () => {
    const key = extractApiKey({ 'x-api-key': 'header-key' });
    expect(key).toBe('header-key');
  });

  it('handles uppercase headers', () => {
    const key = extractApiKey({ Authorization: 'Bearer upper-key' });
    expect(key).toBe('upper-key');
  });

  it('returns undefined for missing headers', () => {
    const key = extractApiKey({});
    expect(key).toBeUndefined();
  });
});

describe('withAuth', () => {
  it('wraps handler with authentication', async () => {
    const key = generateApiKey();
    registerApiKey(key, 'Wrap Test', ['read']);

    const handler = vi.fn().mockResolvedValue('result');
    const wrapped = withAuth('search_patients', handler);

    const result = await wrapped({ query: 'test' }, key);
    expect(result).toBe('result');
    expect(handler).toHaveBeenCalled();
  });

  it('throws on invalid API key', async () => {
    const handler = vi.fn().mockResolvedValue('result');
    const wrapped = withAuth('search_patients', handler);

    await expect(wrapped({ query: 'test' }, 'invalid-key')).rejects.toThrow('Authentication failed');
    expect(handler).not.toHaveBeenCalled();
  });

  it('throws on insufficient permissions', async () => {
    const key = generateApiKey();
    registerApiKey(key, 'Read Only', ['read']);

    const handler = vi.fn().mockResolvedValue('result');
    const wrapped = withAuth('get_patient', handler); // Requires read_pii

    await expect(wrapped({ patientId: '123' }, key)).rejects.toThrow('Access denied');
    expect(handler).not.toHaveBeenCalled();
  });

  it('passes auth context to handler', async () => {
    const key = generateApiKey();
    registerApiKey(key, 'Context Test', ['read', 'read_pii']);

    const handler = vi.fn().mockResolvedValue('result');
    const wrapped = withAuth('get_patient', handler);

    await wrapped({ patientId: '123' }, key);

    const authArg = handler.mock.calls[0][1];
    expect(authArg.keyName).toBe('Context Test');
    expect(authArg.scopes).toContain('read');
    expect(authArg.scopes).toContain('read_pii');
  });
});
