# Archive — the pre-cohort self-paced track

**This is not the course of record.** For that, see
[`../README.md`](../README.md) and the six session guides in `../student/`.

## What this is

A 24-lesson, five-week self-paced curriculum written *before* cohort 3 ran
(content-complete 2026-06-13, restructured 2026-07-05). It was authored as the
primary artifact, then overtaken by events.

Partway through cohort 3 — 2026-07-12, in `#cohort-3` — students were told:

> *"the course you have access to is BONUS material. ONLY do the homework you see
> in Slack."*

So this track was deliberately demoted. What students actually did diverged from
it in shape (six live sessions, not 24 self-paced lessons), in sequence, and in
assignments.

## Why it's kept

Several of the deep-dives go further than the live sessions had time for, and
they're good:

| File | Worth mining for |
|---|---|
| `w1-04-embeddings.md`, `w1-05-similarity-by-hand.md` | the "be the vector database by hand" exercise |
| `w1-08-chunking-intro.md`, `homework-bible-chunking.md` | chunking failure modes, measured |
| `w2-02-reranking.md` | the cross-encoder explanation |
| `w3-05-observability.md`, `w3-06-failure-day.md` | tracing; six categories of adversarial bait |
| `w4-06-pii.md`, `w4-03-securing-mcp.md` | de-identification and the channel access model |
| `w5-01`–`w5-03` evals | hit@5, exact-match routing evals, "no metric, no decision" |
| `homework-poisoned-docs.md` | indirect prompt injection — never taught live |
| `slides/` | five HTML decks + runbooks from the pre-cohort design |

**Use it for explanation, not as a syllabus.** Its assignments contradict the ones
students were actually given.

## Contents

- `README-selfpaced.md` — the original five-week index
- `AUTHORING-selfpaced.md` — the original authoring tracker (17 rules, link and
  screenshot registries, full decisions log). Still the reference for how the
  self-paced files were written.
- `BACKLOG-live-cohort.md` — a first-pass reconciliation between this track and
  the live cohort, written before the decision to rebuild. Superseded by the
  session guides, but its "considered and rejected" list is still useful.
- `day-00.md`, `w1-*` … `w5-*` — the 24 lessons
- `homework-*.md` — the standalone assignment docs
- `slides/` — HTML decks + facilitator runbooks

## If you want to revive any of it

Two rules. Verify it against the current repo first — several files reference
paths and npm scripts that have since moved. And fold it into a session guide
rather than assigning it standalone; the six-session shape is what students
follow, and a stray assignment outside it just recreates the confusion that
prompted the "this is bonus material" post.
