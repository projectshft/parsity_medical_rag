/**
 * Login endpoint — HOMEWORK
 *
 * See docs/CHALLENGE-RBAC.md and app/api/auth/login/route.test.ts.
 *
 * TODO:
 * - Parse { email, password } from the body
 * - Look the user up with prisma.user.findUnique
 * - Verify the password with bcrypt.compare
 * - On success: createSessionToken() and set it as an httpOnly cookie
 * - Unknown email and wrong password must return IDENTICAL 401 responses
 */

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
