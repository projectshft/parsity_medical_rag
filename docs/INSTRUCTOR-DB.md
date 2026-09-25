# Instructor: the course database

How the database students receive gets built and handed out. Students never read
this; their whole database story is "paste the URL from Slack."

## The model

One Neon project. One **golden branch** carrying the schema and the full
dataset. Then one branch per student, forked off the golden branch.

```
project: parsity-medical-rag
└── golden                 ← schema + ~200 patients + ~21k notes. Nobody connects to this.
    ├── cohort4-alex       ← writable fork. Alex gets this connection string.
    ├── cohort4-sam
    └── …
```

Neon branches are copy-on-write, so twenty forks of the same dataset cost close
to one dataset's storage, and creating one is effectively instant. That's what
makes "everyone owns a writable database" affordable — and it's why students
never run a seed.

## One-time: build the golden branch

Only needed when the schema changes or you're starting a new cohort from scratch.

```bash
# 1. Point at the golden branch
export DATABASE_URL="postgresql://…@ep-golden…/medical?sslmode=require"

# 2. Create the tables
npm run db:generate
npm run db:push

# 3. Load the data
#    Either drop the previous cohort's artifact at data/seed/medical-rag-seed.jsonl.gz,
#    or set SEED_DATA_URL in .env and let it download.
npm run db:seed

# 4. Confirm
npm run doctor        # expects ~200 patients, ~21k notes
```

`npm run db:seed` is idempotent — it no-ops if patients already exist. Use
`-- --force` to top up, `-- --limit 25` for a fast smoke test against a scratch
branch.

### Regenerating the seed artifact

If the dataset itself changes (new patients, a new column, corrected notes),
rebuild the file the loader reads:

```bash
export DATABASE_URL="postgresql://…@ep-golden…/medical?sslmode=require"
npm run db:export-seed                  # -> data/seed/medical-rag-seed.jsonl.gz
npm run db:export-seed -- --limit 200   # or cap the patient count
```

It writes gzipped JSONL, one `{"table":…,"row":…}` per line, parents before
children so a top-to-bottom load never trips a foreign key. Host it somewhere
durable and put the link in `SEED_DATA_URL`.

Keep the artifact around between cohorts. It's the only thing that makes the
golden branch reproducible, and `data/seed/` is gitignored precisely so nobody
commits a 30 MB blob by accident.

## Per student: fork a branch

In the Neon console (or via `neonctl`), create a branch from `golden` named for
the student, then hand them its pooled connection string.

```bash
neonctl branches create --project-id <id> --name cohort4-alex --parent golden
neonctl connection-string cohort4-alex --project-id <id> --pooled
```

Two things worth getting right:

- **Give them the pooled string** (the one with `-pooler` in the host). The app
  opens a connection per request; the pooler is what keeps that from exhausting
  the compute's connection limit. The bulk scripts strip `-pooler` themselves
  when they need a direct connection.
- **Keep the database name consistent.** `doctor` reports "no patients" when a
  student is connected to the right server but the wrong database, which is the
  most common way this goes sideways.

## When a student wrecks their data

In order of preference:

1. **`npm run db:reset`** — theirs to run. Replays `audit_log` backwards and
   clears soft deletes. No seed file needed, because nothing was ever really
   deleted. This handles essentially every week 4 mishap.
2. **Reset the branch from its parent** — `neonctl branches reset cohort4-alex
   --parent`. Instant, genuinely pristine, and the connection string doesn't
   change. Use this when they've done something `db:reset` can't reach (dropped a
   table, ran `db:push` against a modified schema).
3. **A brand new branch** — only if the old one is somehow unusable. New
   connection string, so they have to update `.env`.

Whichever you use, tell them to re-run `npm run vectorize` afterwards. Restoring
a Postgres row does not restore the vector that was deleted with it, and a stale
index is a confusing thing to debug.

## Cost notes

- Branches are copy-on-write, but a student who rewrites a lot of rows starts
  paying for real storage on their branch. Resetting from parent reclaims it.
- Computes scale to zero when idle. A student's first query after a quiet week
  can take a few seconds to wake — worth saying out loud in week 1, because it
  looks like a hang.
- If you're near the project's storage ceiling mid-cohort, reset the branches of
  students who've finished the write-actions week rather than raising the plan.
