/**
 * HOMEWORK SPEC — make these pass by implementing lib/auth.ts
 * Run just this file: npx vitest run lib/auth.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createSessionToken, getSession, requireAuth, AuthError, SESSION_COOKIE } from './auth';

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-do-not-use-in-prod';
});

function requestWithCookie(token?: string): Request {
  return new Request('http://localhost/api/anything', {
    headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {},
  });
}

describe('session tokens', () => {
  it('round-trips: a created token verifies back to the same session', async () => {
    const token = await createSessionToken({ userId: 'u-1', role: 'DOCTOR' });
    const session = await getSession(requestWithCookie(token));
    expect(session).toMatchObject({ userId: 'u-1', role: 'DOCTOR' });
  });

  it('returns null when there is no cookie', async () => {
    expect(await getSession(requestWithCookie())).toBeNull();
  });

  it('returns null for a tampered token (never throws)', async () => {
    const token = await createSessionToken({ userId: 'u-1', role: 'STAFF' });
    // Flip a character in the signature
    const tampered = token.slice(0, -2) + (token.endsWith('a') ? 'bb' : 'aa');
    expect(await getSession(requestWithCookie(tampered))).toBeNull();
  });

  it('returns null for garbage that is not a JWT at all', async () => {
    expect(await getSession(requestWithCookie('not-a-jwt'))).toBeNull();
  });

  it('finds the session cookie among other cookies', async () => {
    const token = await createSessionToken({ userId: 'u-2', role: 'STAFF' });
    const request = new Request('http://localhost/api/anything', {
      headers: { cookie: `theme=dark; ${SESSION_COOKIE}=${token}; tracking=no` },
    });
    expect(await getSession(request)).toMatchObject({ userId: 'u-2' });
  });
});

describe('requireAuth', () => {
  it('throws AuthError 401 when there is no session', async () => {
    await expect(requireAuth(requestWithCookie())).rejects.toThrowError(AuthError);
    await expect(requireAuth(requestWithCookie())).rejects.toMatchObject({ status: 401 });
  });

  it('returns the session when authenticated and no roles are required', async () => {
    const token = await createSessionToken({ userId: 'u-1', role: 'DOCTOR' });
    const session = await requireAuth(requestWithCookie(token));
    expect(session).toMatchObject({ userId: 'u-1', role: 'DOCTOR' });
  });

  it('throws AuthError 403 when the role is not allowed', async () => {
    const token = await createSessionToken({ userId: 'u-1', role: 'DOCTOR' });
    await expect(requireAuth(requestWithCookie(token), ['STAFF'])).rejects.toMatchObject({
      status: 403,
    });
  });

  it('passes when the role is in the allowed list', async () => {
    const token = await createSessionToken({ userId: 'u-1', role: 'STAFF' });
    const session = await requireAuth(requestWithCookie(token), ['STAFF', 'DOCTOR']);
    expect(session.role).toBe('STAFF');
  });
});
