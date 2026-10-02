# Week 1 Runbook — The vector store

**~2h 15m** (cohort 3 ran over by ~25 minutes; budget it). Record and post the
same day.

**Student guide:** [`../student/week-1-vector-store.md`](../student/week-1-vector-store.md)

> This is the highest-risk session of the course. Every student has to get five
> services talking to each other and then push 21,000 vectors over a flaky
> connection. Everything else in the course is more forgiving. Front-load it, as
> we do, and accept that you will finish the session doing 1:1 debugging.

## Before you start

- [ ] **Email the API keys the day before** — `OPENAI_API_KEY` and
      `OPENAI_BASE_URL` (the proxy). Every cohort has someone who didn't get it;
      have it ready to paste in Slack.
- [ ] **Have `DATABASE_URL` ready to paste** — the read-only role. Never commit it.
- [ ] **Verify the proxy has budget** and per-student caps are set.
- [ ] **Post the repo link + branch** in the channel before you start.
- [ ] **Ask about Node versions in the first five minutes.** `node -v`. Anyone on
      22 or 24 gets sent to `nvm use 20` immediately, not at minute 90.
- [ ] Open in tabs: Pinecone console, the database browser, `scripts/similarity.ts`,
      `scripts/vectorize.ts`, `lib/pinecone.ts`.

## The arc

| Time | What | Notes |
|---|---|---|
| 0:00 | Housekeeping | Program shape, videos, office hours, Slack norms. Keep to 15 min — intros can go in Slack. |
| 0:15 | **Setup, hands-on** | Clone, `npm install`, `npm run db:generate`, keys into `.env`. Let people work while you talk. |
| 0:30 | **The problem** | Ask ChatGPT about your patients → it can't. Then dump one patient's notes in → useful summary. That contrast is the hook. |
| 0:45 | **What a vector is** | Whiteboard `sad` vs `melancholy`/`happy`/`cat`/`burrito`. Then `npm run similarity`. Have them edit the strings. |
| 1:05 | **Dimensions + the one-way door** | 512/1536/3072. Ask the room which for tweets, which for legal text. |
| 1:20 | **Metadata, decided together** | Read the database schema aloud, take suggestions, write the `MedicalChunk` type live. |
| 1:35 | **Vectorize — `--limit 5` first** | Verify in the console together, *then* run the full thing. |
| 1:50 | **Full run + homework** | It runs 15–25 min. Post homework while it runs; debug in the gaps. |

## Live-coding checkpoints

1. `npm run similarity` — edit `query` and `candidates`, re-run, discuss the ranking.
2. Create the Pinecone index together, **in the console**: name, `text-embedding-3-small`, **1536**, cosine, serverless. Narrate every choice.
3. Write `MedicalChunk`'s metadata fields from the room's suggestions.
4. `scripts/vectorize.ts` — the Prisma `findMany` with `include: { patient: {...} }`, then the `.map()` to chunks.
5. `npm run vectorize -- --limit 5` → open the console → confirm metadata → remove the limit.

**Type the Prisma query by hand, then hand the `.map()` to Claude.** Cohort 3 did
exactly this and it read as honest rather than lazy — it models how they'll
actually work. Don't hand-type the whole thing to prove a point; it's slow and
nobody learns from watching you fight autocomplete.

## Where it breaks

Ranked by how many people it hit in cohort 3:

| Symptom | Cause | Fix |
|---|---|---|
| `401`/`403` from OpenAI | `OPENAI_BASE_URL` commented out in `.env` | Uncomment it. **This was the single most common failure.** |
| `Unknown file extension ".ts"` | Node 22/24 | `nvm use 20` |
| Pinecone 404 | `PINECONE_INDEX` ≠ the console name | Copy the name exactly |
| `Can't reach database server` | wrong/pooled `DATABASE_URL` | Repaste; script prefers `DIRECT_URL` |
| Run dies at ~100–2000 vectors, `ECONNRESET` | flaky network | Re-run (ids make it idempotent). If persistent: **delete the index and start over** — that fixed it fastest for one student |
| `npm run vectorize` — script not found | wrong branch | `git branch` — they're on `main` when they need the canonical branch, or vice versa |
| Env vars not picked up at all | `.env` in the wrong directory, or shell weirdness | Fall back to `export VAR=value` inline before the command |

**Your own run may fail while everyone else's succeeds.** It happened in cohort 3
and cost credibility minutes. If yours dies, say "mine's flaky, yours is working,
let's keep moving" and debug it later — don't let the room watch you retry.

## Discussion prompts

- *"How would you find patients short of breath using SQL?"* → let them offer
  `LIKE`, then Elasticsearch. Both are good answers. Then: "what if the note says
  *dyspnea*?"
- *"How many dimensions for tweets? For legal contracts? Why?"*
- *"What metadata would a clinic actually filter on?"* → this produces the real
  `MedicalChunk` shape and gives them ownership of it.
- *"What's the risk of storing everything in metadata?"* → cost, and duplicating
  what SQL already does better.

## Homework to post

Post the Slack message with: the `npm run bible:fetch` command, the assignment
(chunk + store with metadata, own index, **pick dimensions and justify**), the
four-part video brief, and the chunking reading list. Full text in the student
guide.

**Say the framing out loud:** our notes don't need chunking — the Bible does. The
contrast is the lesson.

## Notes from cohort 3

- Ran ~25 minutes over. The data always does this. Consider a hard stop at 2h and
  an explicit "stay if you're stuck" — which is what happened organically.
- Several students stayed 45+ minutes after for 1:1 debugging. Plan for it.
- One student accidentally upserted Bible verses into their medical index during
  the homework. Good outcome — they wrote a cleanup script. Worth mentioning
  preemptively: *set `PINECONE_INDEX` deliberately before every run.*
- **Say early that the self-paced course is bonus material** and the homework is
  what's posted in Slack. Cohort 3 got confused about this and it needed a
  correction post.
