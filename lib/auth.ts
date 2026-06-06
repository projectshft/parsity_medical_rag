// INSTRUCTOR REFERENCE SOLUTION — see docs/CHALLENGE-RBAC.md
import { SignJWT, jwtVerify } from 'jose';

export type Role = 'DOCTOR' | 'STAFF';

export interface Session {
  userId: string;
  role: Role;
}

export const SESSION_COOKIE = 'session';

export class AuthError extends Error {
  constructor(
    public status: 401 | 403,
    message: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(process.env.AUTH_SECRET);
}

export async function createSessionToken(session: Session): Promise<string> {
  return new SignJWT({ userId: session.userId, role: session.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secretKey());
}

export async function getSession(request: Request): Promise<Session | null> {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;

  try {
    const { payload } = await jwtVerify(match[1], secretKey());
    return { userId: payload.userId as string, role: payload.role as Role };
  } catch {
    return null;
  }
}

export async function requireAuth(request: Request, allowedRoles?: Role[]): Promise<Session> {
  const session = await getSession(request);
  if (!session) throw new AuthError(401, 'Authentication required');
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    throw new AuthError(403, 'Insufficient permissions');
  }
  return session;
}
