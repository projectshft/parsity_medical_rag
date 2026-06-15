# LMS Setup & Deploy (course site)

The course site (`/learn`, `/admin`) lives in this repo's Next.js app and
deploys from **`main`**. It renders the lessons in `curriculum/day-NN.md`
— edit a day file, push to `main`, and the site updates on the next
Vercel deploy. This doc is instructor-facing.

## What you provision (one-time)

### 1. A SECOND Neon database (NOT the medical-rag one)
The medical-rag DB gets `prisma db push --force-reset` during class, which
would wipe student progress. The LMS needs its own Neon project.
- Create a new Neon project → copy the **pooled** connection string → that
  is `LMS_DATABASE_URL`.
- Create the tables: `npm run lms:push` (targets `prisma/lms/schema.prisma`).
- **Never** run `--force-reset` (or any `db push`) against the LMS schema.
  The `db:*` scripts only ever touch the medical-rag DB; the `lms:*`
  scripts only ever touch the LMS DB. Keep it that way.

### 2. A Clerk application
- Create an app at https://dashboard.clerk.com.
- Enable **Email** sign-in with a **verification code / magic link**.
- Set sign-up to **Restricted** (invite-only) so only invited emails join.
- Copy `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.

### 3. Env vars (`.env` locally, Vercel project settings in prod)
```
LMS_DATABASE_URL=postgresql://...          # the second Neon DB, pooled
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
LMS_ADMIN_EMAILS=brian@parsity.io          # comma-separated allowlist
NEXT_PUBLIC_APP_URL=https://your-domain    # used for invite redirects
```
Keep all the existing medical-rag vars too (the chat app shares the deploy).

## Run locally
```
npm install            # postinstall generates BOTH Prisma clients
npm run lms:push       # create LMS tables (first time)
npm run dev
```
- `/learn` → redirects to Clerk sign-in if not authenticated.
- Sign in with an `LMS_ADMIN_EMAILS` address → `/admin` to invite students.

## Deploy (Vercel, `main`)
- Connect the repo, production branch = `main`.
- Set all env vars above (Clerk **production** keys + a configured
  production instance domain).
- Build runs `postinstall` (generates both Prisma clients) then `next build`.
- Curriculum markdown ships in the bundle via `outputFileTracingIncludes`
  in `next.config.ts`.

## How the pieces map
- Identity / invites / bans: **Clerk** (revoke = ban → session killed).
- Student progress: the **LMS Neon DB** (`Student`, `LessonProgress`).
- Lesson content: the **markdown files** (`lib/lms/curriculum.ts` parses
  them; `AUTHORING.md`, `README.md`, `assets/` are excluded from rendering).
- The six 🎥 deliverable days keep their Typeform links inline (no in-app
  submission in this version).

## ⚠️ Branch discipline (do not skip)
`main` now carries the LMS + curriculum. The `student` branch is what
students fork — it must **never** receive any of:
`curriculum/`, `app/learn/`, `app/admin/`, `lib/lms/`, `prisma/lms/`,
`middleware.ts`, or the Clerk/markdown deps. Syncs to `student` are
path-scoped (never a full merge). Run `bash scripts/check-student-clean.sh`
on the `student` branch after any sync — it fails if any forbidden path
slipped in.
