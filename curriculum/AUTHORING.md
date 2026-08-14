# Authoring guide

How to keep this curriculum accurate. Read before editing anything in `student/`
or `instructor/`.

## What this curriculum is

A **record of a course that was actually delivered**, not a design for one that
might be. Cohort 3 ran six Saturdays, 2026-07-11 → 2026-08-15, and every claim in
these files is traceable to a session recording or a `#cohort-3` Slack post.

That constraint is the whole value. Anyone can write a syllabus; this one names
the failures that actually happened, in the order they happened, with the fixes
that worked. Don't dilute it with content nobody taught.

## Structure

```
curriculum/
├── README.md                 the six-session map — start here
├── AUTHORING.md              this file
├── INSTRUCTOR-NOTES.md       cross-cutting teaching context (HIPAA framing, etc.)
├── student/                  what students get — one file per session
│   ├── week-0-prework.md
│   ├── week-1-vector-store.md … week-6-demo-day.md
│   └── bonus-voice-ai.md
├── instructor/               one runbook per session
│   └── week-1-runbook.md … week-6-runbook.md
└── archive/                  the pre-cohort self-paced track (bonus material)
```

**Both versions live on the `instructor` branch only.** "Student version" means
student-*facing*, not the `student` branch. Students receive this content through
the delivery platform and Slack — never by reading `curriculum/` in the repo.
Never sync this directory to `main` or `student`.

## The two shapes

### Student session guides

```markdown
# Week N — Title
**Session:** Saturday · [recording posted in Slack]
**Needs:** keys/accounts required

## What we built          ← narrative of the live session, in the order it happened
## Homework               ← the assignment as posted in Slack
### The video             ← the deliverable, when there is one
## Reading                ← only links actually posted
## When it breaks         ← real failures from the cohort, with fixes
## Check yourself         ← 3–4 concrete finish-line checks
```

### Instructor runbooks

```markdown
# Week N Runbook — Title
**Duration.** Student guide link.

## Before you start       ← checklist, including things to do days earlier
## The arc                ← timed table
## Live-coding checkpoints
## Where it breaks        ← symptom / cause / fix table
## Discussion prompts
## Homework to post
## Notes from cohort 3    ← what actually happened; what to change next time
```

## Rules

1. **Every failure listed must have actually happened.** "Where it breaks" and
   "When it breaks" are evidence sections. If you're speculating, say so or leave
   it out. Their credibility is the reason people read them.
2. **Every command and file path must be real.** Verify against the repo. No
   invented npm scripts, no invented exports.
3. **Only link what was posted.** The reading lists are the actual Slack links.
   Adding "better" resources nobody assigned makes the record wrong. If you want
   to add one, verify it and note that it's new.
4. **Student guides stay in the student register** — direct, concrete, lightly
   wry, no filler. Household-name medicine only (aspirin, insulin, "blood pressure
   medication"), never clinician jargon in examples.
5. **Runbooks may break every student rule.** Timings, week numbers, forward
   references, candid assessments of what went badly — all fine and all useful.
   They're for the person teaching.
6. **No time estimates in student guides.** Runbooks are all timings; guides have
   none.
7. **Code style in examples follows the repo** (see `CLAUDE.md`): zod `.parse()`
   not `safeParse`, Responses API + `zodTextFormat`, `type` over `interface`.
8. **Solutions are not hidden.** Unlike the archived self-paced track, these are
   session records — the code was on screen. Show it.

## When you teach a new cohort

Update in this order:

1. **Runbooks first, during or right after each session** — while the failures are
   fresh. The "Notes from cohort N" section is the highest-value thing in the file
   and it is unreconstructible a month later.
2. **Student guides after** — fold in anything that changed, and re-check that the
   homework matches what you actually posted in Slack.
3. **`README.md`** if the session shape changed.
4. Rename "Notes from cohort 3" → keep both, oldest last. Two cohorts of evidence
   is better than one.

## The archive

`archive/` holds the 24-lesson self-paced track written before cohort 3, plus its
slide decks, its authoring tracker, and its standalone homework docs.

Partway through cohort 3 it was explicitly demoted to **bonus material** —
students were told to do only the homework posted in Slack. It is kept because
several deep-dives (embeddings, chunking failure modes, evals, PII, poisoned
documents) go further than the live sessions had time for.

**Mine it for explanation. Don't hand it out as the syllabus.** Its assignments
contradict the ones students were actually given, and its five-week shape doesn't
match the six live sessions.

## Repo facts (check here before writing)

- Branches: **`main`** = canonical student-facing · **`instructor`** = solutions +
  this curriculum · **`student`** = legacy mirror. Students clone a snapshot repo,
  `projectshft/medical-rag-student`.
- Data: Synthea Coherent, ~200-patient subset, ~21,000 notes, pre-loaded in Neon,
  read-only. Students never run an ingest.
- One note = one vector. The medical corpus is **not** chunked. The Bible homework
  exists to teach chunking on a corpus that needs it.
- Pinecone: `text-embedding-3-small`, 1536 dims, cosine. Reranker is
  `bge-reranker-v2-m3` via `pinecone.inference.rerank` (hosted, free).
- Node **20**. Later versions break `ts-node` on the scripts and the MCP server.
- npm scripts: `dev`, `test`, `test:run`, `test:evals`, `db:generate`, `db:push`,
  `db:studio`, `vectorize`, `similarity`, `bible:fetch`, `bible:fixed`,
  `bible:smart`, `bible:audit`, `retell:deploy`.
- Known repo wart: `lib/vector-search.ts` has a hardcoded `INDEX_NAME`. It 404s
  students in weeks 2 and 4. Fix it or warn about it — both runbooks say so.
