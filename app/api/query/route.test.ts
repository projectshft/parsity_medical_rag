/**
 * Spec for app/api/query/route.ts (the direct clinician query endpoint).
 * No auth: access is channel-based, not login-based.
 * Run just this file: npx vitest run app/api/query/route.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/query-executor', () => ({
  executeQuery: vi.fn(async () => ({
    analysis: { intent: 'patient_lookup', requiresSQL: true, requiresVector: false },
    sqlResults: { type: 'patients', patients: [] },
  })),
  formatResultsForLLM: vi.fn(() => 'formatted'),
}));

import { executeQuery } from '@/lib/query-executor';
import { POST } from './route';

beforeEach(() => {
  vi.mocked(executeQuery).mockClear();
});

function queryRequest(body: object, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/query', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/query', () => {
  it('runs a query and returns the result (no auth required)', async () => {
    const res = await POST(queryRequest({ query: 'diabetics' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.analysis.intent).toBe('patient_lookup');
    expect(executeQuery).toHaveBeenCalledOnce();
  });

  it('passes obscurePII from the body through to executeQuery', async () => {
    await POST(queryRequest({ query: 'x', obscurePII: true }));
    expect(vi.mocked(executeQuery).mock.calls[0][1]).toMatchObject({ obscurePII: true });
  });

  it('returns formatted text when format=formatted', async () => {
    const res = await POST(queryRequest({ query: 'x', format: 'formatted' }));
    const body = await res.json();
    expect(body.formatted).toBe('formatted');
  });

  it('rejects an empty query with 400', async () => {
    const res = await POST(queryRequest({ query: '' }));
    expect(res.status).toBe(400);
    expect(executeQuery).not.toHaveBeenCalled();
  });
});
