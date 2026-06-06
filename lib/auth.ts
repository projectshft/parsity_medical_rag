/**
 * Session auth with database-backed roles — HOMEWORK
 *
 * See docs/CHALLENGE-RBAC.md. The tests in lib/auth.test.ts,
 * app/api/auth/login/route.test.ts, app/api/schedule/route.test.ts, and
 * app/api/query/route.test.ts define the expected behavior — make them pass.
 *
 * Role rules:
 * - STAFF:  cannot see PII, CAN make appointments
 * - DOCTOR: can see PII, CANNOT make appointments
 */

export type Role = 'DOCTOR' | 'STAFF';

export interface Session {
  userId: string;
  role: Role;
}

/** Name of the session cookie set by /api/auth/login */
export const SESSION_COOKIE = 'session';

/**
 * Thrown by requireAuth. Routes should catch it and return a response
 * with the given status.
 */
export class AuthError extends Error {
  constructor(
    public status: 401 | 403,
    message: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Sign a session into a compact JWT.
 *
 * TODO:
 * - Use `SignJWT` from `jose` with the HS256 algorithm
 * - Secret comes from process.env.AUTH_SECRET
 * - Include userId and role in the payload, expire in ~8h (a hospital shift)
 */
export async function createSessionToken(session: Session): Promise<string> {
  throw new Error('Not implemented');
}

/**
 * Read and verify the session from the request's cookie.
 *
 * TODO:
 * - Parse the `session` cookie from the Cookie header
 * - Verify with `jwtVerify` from `jose`
 * - Return null (do NOT throw) when the cookie is missing, invalid, or expired
 */
export async function getSession(request: Request): Promise<Session | null> {
  throw new Error('Not implemented');
}

/**
 * Guard for API routes.
 *
 * TODO:
 * - No valid session -> throw AuthError(401, ...)
 * - Session present but role not in allowedRoles -> throw AuthError(403, ...)
 * - Otherwise return the session
 */
export async function requireAuth(request: Request, allowedRoles?: Role[]): Promise<Session> {
  throw new Error('Not implemented');
}
