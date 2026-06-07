// INSTRUCTOR REFERENCE SOLUTION — see docs/CHALLENGE-RBAC.md
import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { createSessionToken, SESSION_COOKIE } from '@/lib/auth';

const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const invalidCredentials = () =>
  NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

export async function POST(request: Request) {
  try {
    const { email, password } = LoginRequestSchema.parse(await request.json());

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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
