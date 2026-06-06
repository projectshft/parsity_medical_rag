/**
 * HOMEWORK SPEC — add auth to app/api/query/route.ts to make these pass
 * Run just this file: npx vitest run app/api/query/route.test.ts
 *
 * Role rules: STAFF never see PII (the server enforces it — clients cannot
 * opt out); DOCTORS see PII.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

vi.mock('@/lib/query-executor', () => ({
  executeQuery: vi.fn(async () => ({
    analysis: { intent: 'patient_lookup', requiresSQL: true, requiresVector: false },
    sqlResults: { type: 'patients', patients: [] },
  })),
  formatResultsForLLM: vi.fn(() => 'formatted'),
}));

import { executeQuery } from '@/lib/query-executor';
import { createSessionToken, SESSION_COOKIE, Role } from '@/lib/auth';
import { POST } from './route';

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-do-not-use-in-prod';
});

beforeEach(() => {
  vi.mocked(executeQuery).mockClear();
});

async function queryRequest(
  role: Role | undefined,
  body: object,
  extraHeaders: Record<string, string> = {}
): Promise<Request> {
  const headers: Record<string, string> = { 'content-type': 'application/json', ...extraHeaders };
  if (role) {
    const token = await createSessionToken({ userId: `u-${role.toLowerCase()}`, role });
    headers.cookie = `${SESSION_COOKIE}=${token}`;
  }
  return new Request('http://localhost/api/query', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('POST /api/query', () => {
  it('rejects unauthenticated requests with 401 and never runs the query', async () => {
    const response = await POST(await queryRequest(undefined, { query: 'patients with diabetes' }));
    expect(response.status).toBe(401);
    expect(executeQuery).not.toHaveBeenCalled();
  });

  it('STAFF queries always run with obscurePII: true', async () => {
    const response = await POST(await queryRequest('STAFF', { query: 'patients with diabetes' }));
    expect(response.status).toBe(200);
    expect(executeQuery).toHaveBeenCalledWith(
      'patients with diabetes',
      expect.objectContaining({ obscurePII: true })
    );
  });

  it('STAFF cannot opt out of PII obscuring via the body — the role wins', async () => {
    await POST(await queryRequest('STAFF', { query: 'find Abe Frami', obscurePII: false }));
    expect(executeQuery).toHaveBeenCalledWith(
      'find Abe Frami',
      expect.objectContaining({ obscurePII: true })
    );
  });

  it('STAFF cannot opt out via the X-Obscure-PII header either', async () => {
    await POST(
      await queryRequest('STAFF', { query: 'find Abe Frami' }, { 'x-obscure-pii': 'false' })
    );
    expect(executeQuery).toHaveBeenCalledWith(
      'find Abe Frami',
      expect.objectContaining({ obscurePII: true })
    );
  });

  it('DOCTOR queries see PII (obscurePII is not forced on)', async () => {
    const response = await POST(await queryRequest('DOCTOR', { query: 'find Abe Frami' }));
    expect(response.status).toBe(200);

    const options = vi.mocked(executeQuery).mock.calls[0][1] ?? {};
    expect(options.obscurePII).not.toBe(true);
  });

  it('still validates the body: missing query is a 400 even when authenticated', async () => {
    const response = await POST(await queryRequest('DOCTOR', {}));
    expect(response.status).toBe(400);
  });
});
