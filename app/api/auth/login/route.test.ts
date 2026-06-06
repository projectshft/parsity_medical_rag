/**
 * HOMEWORK SPEC — make these pass by implementing app/api/auth/login/route.ts
 * Run just this file: npx vitest run app/api/auth/login/route.test.ts
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { getSession, SESSION_COOKIE } from '@/lib/auth';
import { POST } from './route';

const findUnique = vi.mocked(prisma.user.findUnique);

const PASSWORD = 'correct-horse-battery';
let staffUser: { id: string; email: string; passwordHash: string; role: 'STAFF' };

beforeAll(async () => {
  process.env.AUTH_SECRET = 'test-secret-do-not-use-in-prod';
  staffUser = {
    id: 'u-staff-1',
    email: 'frontdesk@clinic.test',
    passwordHash: await bcrypt.hash(PASSWORD, 4),
    role: 'STAFF',
  };
});

beforeEach(() => {
  findUnique.mockReset();
});

function loginRequest(body: object): Request {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/login', () => {
  it('sets an httpOnly session cookie on success', async () => {
    findUnique.mockResolvedValue(staffUser as any);

    const response = await POST(loginRequest({ email: staffUser.email, password: PASSWORD }));
    expect(response.status).toBe(200);

    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(`${SESSION_COOKIE}=`);
    expect(setCookie.toLowerCase()).toContain('httponly');
  });

  it('the cookie verifies to a session with the user id and role', async () => {
    findUnique.mockResolvedValue(staffUser as any);

    const response = await POST(loginRequest({ email: staffUser.email, password: PASSWORD }));
    const setCookie = response.headers.get('set-cookie') ?? '';
    const token = setCookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1];
    expect(token).toBeTruthy();

    const session = await getSession(
      new Request('http://localhost/x', { headers: { cookie: `${SESSION_COOKIE}=${token}` } })
    );
    expect(session).toMatchObject({ userId: 'u-staff-1', role: 'STAFF' });
  });

  it('never returns the token in the response body', async () => {
    findUnique.mockResolvedValue(staffUser as any);

    const response = await POST(loginRequest({ email: staffUser.email, password: PASSWORD }));
    const body = JSON.stringify(await response.json());
    const token = (response.headers.get('set-cookie') ?? '').match(/=([^;]{20,})/)?.[1] ?? '';
    expect(body).not.toContain(token);
  });

  it('rejects a wrong password with 401', async () => {
    findUnique.mockResolvedValue(staffUser as any);

    const response = await POST(loginRequest({ email: staffUser.email, password: 'wrong' }));
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('unknown email and wrong password return IDENTICAL responses (no email enumeration)', async () => {
    findUnique.mockResolvedValue(null);
    const unknownEmail = await POST(loginRequest({ email: 'nobody@clinic.test', password: 'x' }));

    findUnique.mockResolvedValue(staffUser as any);
    const wrongPassword = await POST(loginRequest({ email: staffUser.email, password: 'x' }));

    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(await unknownEmail.json()).toEqual(await wrongPassword.json());
  });

  it('rejects a malformed body with 400', async () => {
    const response = await POST(loginRequest({ email: 'no-password@clinic.test' }));
    expect(response.status).toBe(400);
  });
});
