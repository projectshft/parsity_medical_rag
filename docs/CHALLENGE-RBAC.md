# Challenge: Role-Based Access Control for the API

The tests are already written — make them pass. Add authentication with two database-backed roles:

| | STAFF | DOCTOR |
|---|---|---|
| See PII (names, dates, locations) | ❌ always obscured | ✅ |
| Make appointments (`/api/schedule`) | ✅ | ❌ |
| Run queries (`/api/query`) | ✅ (PII-scrubbed) | ✅ (full) |

Front office staff schedule visits but don't need to see clinical PII. Doctors read charts but don't book their own calendars.

## Learning Objectives

- Implement password auth from scratch: hashing, JWT sessions, httpOnly cookies
- Enforce authorization on the server — the client must not be able to opt out
- Work test-first: the spec is executable and already in the repo

## The Spec (start here)

Four test files define exactly what to build. They fail right now — your job is to turn them green without editing them:

```bash
npx vitest run lib/auth.test.ts                      # session tokens + requireAuth
npx vitest run app/api/auth/login/route.test.ts      # login flow
npx vitest run app/api/schedule/route.test.ts        # STAFF schedule, DOCTORS don't
npx vitest run app/api/query/route.test.ts           # STAFF never see PII
```

Read the tests before writing any code. Every requirement below is asserted in them.

## Part 1: Sessions (`lib/auth.ts`)

The file exists with TODO stubs. Implement:

- `createSessionToken(session)` — HS256 JWT via `jose`, secret from `AUTH_SECRET`, ~8h expiry
- `getSession(request)` — parse the `session` cookie, verify, return the session or `null` (never throw — tampered tokens, garbage, and missing cookies all return `null`)
- `requireAuth(request, allowedRoles?)` — return the session, or throw `AuthError(401)` when unauthenticated / `AuthError(403)` when the role isn't allowed. 401 and 403 are different failures — the tests check both.

`bcryptjs` and `jose` are already installed.

## Part 2: Login (`app/api/auth/login/route.ts`)

The `User` model and `Role` enum are already in `prisma/schema.prisma`. Implement the stub route:

1. Validate the body with a Zod schema — `.parse()` and let it throw; map `ZodError` to `400` in the catch (see CLAUDE.md "API Route Input Validation")
2. `prisma.user.findUnique` + `bcrypt.compare`
3. On success, set the token as an **httpOnly** cookie — never return it in the body
4. Unknown email and wrong password must produce **identical** `401` responses (no email enumeration)

Then write `scripts/seed-users.ts` that creates one DOCTOR and one STAFF user with bcrypt-hashed passwords, so you can try it in the browser.

## Part 3: Protect the Routes

- `app/api/schedule/route.ts` — `requireAuth(request, ['STAFF'])`. Doctors get a `403`. The calendar must never be called for rejected requests.
- `app/api/query/route.ts` — any authenticated user, but **the role decides PII visibility**:

```typescript
const session = await requireAuth(request);
// STAFF are always obscured — body and X-Obscure-PII header cannot override
const shouldObscure = session.role === 'STAFF' ? true : clientRequestedObscure;
```

This is the heart of the challenge: today `obscurePII` is client-controlled, which means it's not a security control at all. After your change, a STAFF user sending `{ obscurePII: false }` still gets `Patient-A7B3` instead of real names. The tests attack this from both the body and the header.

## Hints

- `jose`'s `SignJWT` / `jwtVerify` are async and Edge-compatible — that's why we're not using `jsonwebtoken`
- Routes should catch `AuthError` and convert it to a response with `error.status` — auth check goes *before* body parsing, so a 401 wins over a 400
- The cookie header can contain many cookies (`theme=dark; session=...`) — there's a test for that
- In tests, look at how the specs build a session: `createSessionToken` + a `cookie` header on a plain `Request`. Your implementation must work with standard `Request` objects, not just Next's wrappers

## Stretch Goals

- `POST /api/auth/logout` (clear the cookie) + protect `/api/chat` and `/api/upload` (DOCTOR-only — pairs with CHALLENGE-UPLOAD-API)
- Audit log: who accessed which patient, when (mirror `mcp-server/audit.ts`) — HIPAA requires it
- Rate limit `/api/query` per user — auth doesn't stop a logged-in scraper
- Unify with the MCP server: derive its API-key scopes (`read`, `read_pii`) from `User.role` so there's one permission system
