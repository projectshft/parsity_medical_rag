# Week 0 — Before we start

**No session. No homework.** Posted the Monday before kickoff.

## Watch these

Three videos. None are required reading in the "you'll be quizzed" sense — they
exist so that the words *vector*, *dot product*, and *model* mean something
concrete on Saturday instead of washing over you.

1. **[Vectors, what even are they?](https://www.youtube.com/watch?v=fNk_zzaMoSs)** — 3Blue1Brown, Essence of Linear Algebra Ch. 1
2. **[Dot products and duality](https://www.youtube.com/watch?v=LyGKycYT2v0)** — 3Blue1Brown, Ch. 9
3. **[What is a GPT?](https://www.youtube.com/watch?v=yMQPQuz5WpA)** — 3Blue1Brown

The dot product one is the one that pays off fastest. Session 1 spends real time
on "how does a database find things that *mean* the same thing," and the answer is
an angle between two arrows. If you've seen the arrows, that lands in ninety
seconds instead of twenty minutes.

## Set up accounts

You do not need every key on day one, but you need these before Saturday:

| Service | What for | Cost |
|---|---|---|
| **[Pinecone](https://www.pinecone.io/)** | the vector store you'll build | free tier is plenty |
| **[Qdrant Cloud](https://cloud.qdrant.io)** | a *second* vector DB, for the chunking lab | free tier, **no credit card** |
| **[cal.com](https://cal.com/)** | appointment booking, from session 3 on | free |
| **OpenAI** | embeddings + the models | **provided** — a key is emailed to you |
| **TypeSafe / Jev** | the eval judge, week 5 | **provided** — same key, nothing to sign up for |

The OpenAI key is ours, routed through a proxy, and capped. You'll get it, plus
an `OPENAI_BASE_URL`, in an email before kickoff. Both go in your `.env`. If you'd
rather use your own OpenAI account, you can — just leave `OPENAI_BASE_URL` unset.

That same key also gets you Jev, the decision model the week-5 eval judge runs
on. It rides the same proxy, so you'll set `TYPESAFE_API_KEY` to the *same value*
as `OPENAI_API_KEY` and `TYPESAFE_BASE_URL` to the same host. Not a typo — see the
comment in `.env.example`. Nothing to sign up for, which is deliberate: Jev is
early access and has no free tier, so there may be no self-serve key to get.

Two vector databases is not an accident. The medical notes live in Pinecone;
the Bible chunking lab runs on Qdrant, so you meet a second API instead of
reusing ours. Grab the Qdrant **URL and API key** at cluster creation — the key
is shown once. Free clusters also sleep after a week unused, so if yours looks
empty in week 2, wake it in the dashboard before debugging your code.

The database is **pre-loaded and read-only**. You'll get a `DATABASE_URL` in the
first session. You never run an ingest, and you can't break it.

## Get the repo running

```bash
git clone <repo-url> && cd parsity_medical_rag
npm install
npm run db:generate
npm run doctor
npm run dev
```

`npm run db:generate` builds the Prisma client from the schema — without it,
every database call fails at import. `npm run dev` should give you a chat
interface at `localhost:3000` that doesn't work yet. That's correct; it's what
you're building.

### `npm run doctor` — run this before asking for help

It checks your Node version, your `.env`, and whether the Prisma client was
generated, and for anything wrong it prints the fix. **It works on any Node
version**, including one too old to run the project — that's the point, since
"your Node is too old" is the single most common thing it has to tell you.

Run it whenever something stops working. If it's all green and you're still
stuck, post its output in Slack; that's much faster than describing the symptom.

### Node version

**You need Node 22.12 or newer** (22.12+, any 24.x, or 26+). Check with
`node -v`.

Odd-numbered releases like 23 and 25 are *not* supported — several dependencies
skip them deliberately — and **Node 20 will not work**: our test runner excludes
it outright. If you're on 20 and everything seems fine until `npm test`
mysteriously fails, this is why.

**macOS / Linux:**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# close and reopen your terminal, then, inside the project folder:
nvm install 22
nvm use          # reads .nvmrc, so you get the right version automatically
```

**Windows:** install [nvm-windows](https://github.com/coreybutler/nvm-windows/releases)
(`nvm-setup.exe`), then in a **new** terminal:

```
nvm install 22.12.0
nvm use 22.12.0
```

If you upgrade Node *after* already running `npm install`, reinstall — native
packages built against the old version stay broken otherwise:

```bash
rm -rf node_modules package-lock.json && npm install
```

## What you're walking into

A clinic's data lives in two shapes that don't talk to each other. Structured
facts — diagnoses, medications, lab values, demographics — sit in database rows.
The *story* of each visit lives in free-text clinical notes that nobody ever
turned into columns.

SQL can count every patient with high blood pressure. It cannot find the note that
says "short of breath climbing stairs" when someone asks about *dyspnea* — same
meaning, no shared letters. And a language model on its own knows neither, so it
will confidently invent both.

You're building the thing that fixes that. See you Saturday.
