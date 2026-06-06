// INSTRUCTOR REFERENCE SOLUTION — see docs/CHALLENGE-RBAC.md
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { createSessionToken, SESSION_COOKIE } from '@/lib/auth';

const invalidCredentials = () =>
  NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

export async function POST(request: Request) {
  const { email, password } = await request.json().catch(() => ({}));

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return invalidCredentials();

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return invalidCredentials();

  const token = await createSessionToken({ userId: user.id, role: user.role as 'DOCTOR' | 'STAFF' });

  const response = NextResponse.json({ success: true, role: user.role });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 8 * 60 * 60,
  });
  return response;
}
