# Day 32 — RBAC I: Sessions, Login, and the Auth Guard

**Needs: `docs/CHALLENGE-RBAC.md`; the failing RBAC test specs on your branch**

## Today you will

- Add real human authentication — login, sessions, password hashing — to a system that has had none
- Implement the guard that every protected route will pass through
- Make the first batch of those long-standing failing tests turn green

## Concept

Two days ago you secured the *machine* front door (MCP API keys — process-to-process). Today you build the *human* front door. They are different problems: a person logs in once and carries a session; a key is presented on every call. Both answer "who is this," but for different kinds of caller.

Remember Day 2, when you ran the test suite and saw `24 failed`? Those failures have been your progress bar the whole course. A chunk of them are auth tests — written before you, waiting. Today you start clearing them. The tests are the spec: you do not invent the behavior, you discover it by making them pass.

The pieces of human auth, and why each exists:

| Piece | Job | If you skip it |
|---|---|---|
| Password hashing | Store a one-way hash, never the password | A database leak hands attackers every password |
| Login endpoint | Verify credentials, issue a session | No way to establish identity |
| Session token (JWT) | A signed, expiring proof of "who" | Re-authenticate on every request |
| httpOnly cookie | Hold the token where page scripts cannot read it | A single XSS bug steals the session |
| The auth guard | One reusable "is this caller allowed" check | Auth logic copy-pasted into every route, drifting |

Two design commitments worth stating before the challenge spells them out:

- **Identical errors for "unknown email" and "wrong password."** If the two differ, an attacker learns which emails are real by reading your error messages — free account enumeration. Same 401, same body, both cases.
- **The token never appears in a response body.** It lives in an httpOnly cookie, set by the server, unreadable by JavaScript. Putting a session token in JSON is handing it to any script on the page.

## Implementation

The full spec is `docs/CHALLENGE-RBAC.md`, Parts 1–3 today (Part 4 is tomorrow). The shape:

### 1. Sessions — `lib/auth.ts`

Three functions sit as stubs that `throw new Error('Not implemented')`. Implement them with `jose` (JWT) and the patterns the challenge describes:

- `createSessionToken(session)` — sign `{ userId, role }` HS256, ~8h expiry (a hospital shift), secret from `AUTH_SECRET`
- `getSession(request)` — parse the cookie, verify, return the session or `null`. Never throw — a tampered or missing token is `null`, not a crash
- `requireAuth(request, allowedRoles?)` — the guard. No session, throw `AuthError(401)`; wrong role, `AuthError(403)`. Those are different failures and get different codes

### 2. Login — `app/api/auth/login/route.ts`

Validate the body (zod `.parse()`), look the user up, `bcrypt.compare` the password, and on success set the httpOnly cookie. Unknown-email and wrong-password return the identical 401. Seed a couple of users first with the script the challenge describes.

### 3. The guard goes on

`requireAuth(request)` at the top of a protected route, inside the try, before any work. Catch `AuthError` and return its status. The challenge has you protect the routes; the pattern is one line per route, which is the entire point of a reusable guard.

### 4. Watch the number drop

```bash
npm run test:run
```

The auth-related failures should flip to passing. The count that has read `24 failed` since Day 2 starts falling — and *that* is the feedback loop. You are not guessing whether auth works; the specs tell you, case by case.

### Common mistakes

- **A `requireAuth` that throws inside `getSession`.** Reading a session must tolerate garbage input — bad cookies arrive constantly (expired, tampered, absent). `getSession` returns `null` on all of them; only `requireAuth` throws, and only deliberately.
- **Distinguishable login failures.** A 404 for unknown email and 401 for bad password is account enumeration with extra steps. The test for this exists; do not "fix" it by making the messages helpful.
- **Token in the body "just for debugging."** It ends up logged, screenshotted, committed. The cookie is the only place it goes. (If a test asserts the body has no token, that is why.)
- **`AUTH_SECRET` missing from `.env`.** `jose` will throw at sign time and every auth test fails opaquely. The challenge added it to `.env.example`; copy it over with a real random value.

## Your turn

The challenge Parts 1–3 are the your-turn. Additionally, in your notes: the failing-test count before you started and after, and the one test whose *expected behavior* surprised you (there is usually one — often the identical-errors rule, which feels user-hostile until you see it as a security control).

## Check yourself

- Why must `getSession` return `null` rather than throw, while `requireAuth` does the opposite?
- Your login returns 404 for unknown emails and 401 for wrong passwords. Describe the attack this enables.

<details>
<summary>Solution / discussion</summary>

**The null/throw split** is a separation of *reading* from *enforcing*. `getSession` is a question — "is anyone logged in?" — whose honest answer for a bad cookie is "no" (`null`), not an exception; plenty of callers want to behave differently for logged-out users without wrapping every read in try/catch. `requireAuth` is a *demand* — "you must be logged in (with this role) to proceed" — and the only way to halt a request mid-flight is to throw, caught at the route boundary and turned into 401/403. One reports, one enforces; conflating them either crashes on every expired cookie or lets unauthenticated requests slip past a guard that "returned null" and got ignored.

**The enumeration attack:** an attacker submits `victim@hospital.com` with a junk password. A 404 means "no such user" — the email is not registered. A 401 means "wrong password" — the email *is* registered. Iterate a list of emails and you have sorted the world into "has an account here" and "doesn't," which for a medical system is itself sensitive (it reveals who is a patient) and the first step of credential stuffing. Identical responses close the oracle. This is the day's quiet lesson: security sometimes means making your system *less* helpful on purpose, and you cannot tell which cases those are without thinking like the attacker — which is exactly what tomorrow and the poisoned-document day train.

</details>

## Further reading (optional)

- [OWASP: authentication cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) — the section on "incorrect and correct response discrepancies" is today's enumeration lesson, formalized
