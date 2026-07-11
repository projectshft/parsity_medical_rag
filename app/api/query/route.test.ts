/**
 * Spec for app/api/query/route.ts (the direct clinician query endpoint).
 * No auth: access is channel-based, not login-based.
 * Run just this file: npx vitest run app/api/query/route.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/agents/selector', () => ({
  select: vi.fn(async () => ({
    analysis: { intent: 'population_analytics' },
    needsSearch: true,
    useSql: true,
    useRag: false,
    semanticQuery: 'diabetes',
  })),
}));
vi.mock('@/lib/agents/sql', () => ({
  runSql: vi.fn(async () => 'Dr. Jane Roe has diabetes'),
}));
vi.mock('@/lib/agents/rag', () => ({
  runRag: vi.fn(async () => ''),
}));

import { select } from '@/lib/agents/selector';
import { POST } from './route';

beforeEach(() => {
  vi.mocked(select).mockClear();
});

function queryRequest(body: object, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/query', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/query', () => {
  it('runs the agents and returns the combined text (no auth required)', async () => {
    const res = await POST(queryRequest({ query: 'diabetics' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.analysis.intent).toBe('population_analytics');
    expect(body.text).toContain('diabetes');
    expect(select).toHaveBeenCalledOnce();
  });

  it('returns full data by default (clinician channel)', async () => {
    const res = await POST(queryRequest({ query: 'x' }));
    const body = await res.json();
    // No obscuring requested → the name comes through untouched.
    expect(body.text).toContain('Jane Roe');
  });

  it('scrubs PII when obscurePII is set', async () => {
    const res = await POST(queryRequest({ query: 'x', obscurePII: true }));
    const body = await res.json();
    // The regex de-identifier redacts the "First Last" name.
    expect(body.text).not.toContain('Jane Roe');
    expect(body.text).toContain('[NAME]');
  });

  it('rejects an empty query with 400', async () => {
    const res = await POST(queryRequest({ query: '' }));
    expect(res.status).toBe(400);
    expect(select).not.toHaveBeenCalled();
  });
});
