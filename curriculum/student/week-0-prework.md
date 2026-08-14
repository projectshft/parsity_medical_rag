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
| **[cal.com](https://cal.com/)** | appointment booking, from session 3 on | free |
| **OpenAI** | embeddings + the models | **provided** — a key is emailed to you |

The OpenAI key is ours, routed through a proxy, and capped. You'll get it, plus
an `OPENAI_BASE_URL`, in an email before kickoff. Both go in your `.env`. If you'd
rather use your own OpenAI account, you can — just leave `OPENAI_BASE_URL` unset.

The database is **pre-loaded and read-only**. You'll get a `DATABASE_URL` in the
first session. You never run an ingest, and you can't break it.

## Get the repo running

```bash
git clone <repo-url> && cd parsity_medical_rag
npm install
npm run db:generate
npm run dev
```

`npm run db:generate` builds the Prisma client from the schema — without it,
every database call fails at import. `npm run dev` should give you a chat
interface at `localhost:3000` that doesn't work yet. That's correct; it's what
you're building.

> **Node 20.** Not 22, not 24. Later versions handle TypeScript files differently
> and several of the scripts — the MCP server especially — will fail with
> `Unknown file extension ".ts"`. If you don't have a version manager, install
> [nvm](https://github.com/nvm-sh/nvm) and run `nvm install 20 && nvm use 20`.
> This bit multiple people in cohort 3 and it is a five-minute fix now versus a
> lost hour later.

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
