---
name: create-lesson
description: Build the instructor-facing teaching package for a week/block of the medical RAG course — a self-contained HTML slide deck plus a facilitator runbook — so another engineer can pick it up and teach the live session. Use when asked to create, build, or update a lesson, slideshow, slide deck, weekly session, or facilitator runbook. Encodes Brian's live-teaching arc (problem → solve → concept → examples → hands-on → discussion/breakouts → code together → break it / extend).
---

# Building a Lesson (instructor slide deck + facilitator runbook)

The deliverable is a **package another engineer can teach from cold**: a slide deck the room sees, and a runbook the facilitator reads. The course content already exists as self-paced student day files (`curriculum/day-NN.md`); a lesson is the **live cohort session** that anchors a 6-day block. One package per block, six total.

Goal of every lesson: the facilitator runs Brian's arc without having to invent timing, prompts, or the "let's break it" moment — it's all written down, grounded in that block's day files.

## The two artifacts (per block)

| File | Audience | What it is |
|---|---|---|
| `curriculum/slides/week-N.html` | the room (projected) | self-contained HTML deck, arrow/click nav, ~13–18 slides |
| `curriculum/slides/week-N-runbook.md` | the facilitator only | timed script: talk track, breakout prompts + answer keys, the break-it/extend bank, deliverable rubric |

The two exemplars are **`week-1.html` + `week-1-runbook.md`** — read both before authoring any other week. Match them.

## CRITICAL: instructor-facing ≠ student-facing

The student day files obey `curriculum/AUTHORING.md` (no week numbers, no time estimates, vague forward refs, household-name meds only, no untaught concepts). **Slides and runbooks are the opposite** — they are the facilitator's tool:

- **Weeks, days, and timing are fine and wanted** ("Week 3 of 6", "Mon–Fri", "0:40 — code together", "by Friday's deliverable").
- **Forward references are fine** ("this thread pays off in Week 5's audit log").
- **Real medical vocabulary is fine** in facilitator notes — but keep what's *on the slides the students see* to the same household-name register as the day files (aspirin, insulin, diabetes — not metformin/lisinopril), since the room reads those.
- The runbook may name the planted failures and the "answer key" openly — only the facilitator reads it.

When in doubt: the **runbook** is backstage (say anything), the **deck** is on stage (student-facing register applies to slide text).

## Brian's teaching arc (the spine of every session)

Every deck and runbook walks this order. It maps to the engagement pills already in `week-1.html`.

1. **Problem statement** — cold open with the question the system can't yet answer. Make them feel the gap before any solution.
2. **How it can be solved** — the move, in one or two sentences. Not the code yet — the idea.
3. **High-level concept** — the mental model + one diagram. This is the "why it works."
4. **Practical examples** — concrete, from the real corpus. Show the actual data/notes/queries.
5. **Hands-on work** — `💻 Code walkthrough` slides: real commands, real file paths, run it live.
6. **Questions & discussion** — `💬 Discussion` slide(s). Breakout rooms when the prompt has room to argue. Always has a debrief.
7. **Code together** — build the block's core thing live, narrating the why at each step.
8. **Go off the rails** — `🛠 Mini-challenge` + the runbook's **break-it / extend** bank: deliberately sabotage it, watch it fail, fix it; then extend it past where the day file stops. This is where understanding gets proven.
9. **Recap + send-off** — where they are, Friday's deliverable framing, a `🔍 Research` question to bring back.

The break-it/extend step is non-negotiable — it's the difference between "watched a demo" and "stressed the system." Every runbook ships a break-it bank with **expected failure + the fix** so the facilitator can run it confidently even on a system they didn't build.

## Deck conventions (match `week-1.html` exactly)

- **Copy the `<style>` and `<script>` blocks from `week-1.html` verbatim** — same CSS variables, same nav. Decks must be visually identical across weeks; do not restyle.
- Plain palette: white bg, ink text, **calm blue accent — NO purple**. The four engagement pills and their muted colors are fixed: `.discuss` amber, `.code` blue, `.challenge` green, `.research` slate.
- Diagrams are **inline** — ASCII-art in a `<pre>` (like the week-1 architecture slide) or simple CSS cards. No external images, no `.excalidraw` files, no mermaid runtime.
- Instructor cues live on slides in the `.cue` block ("Facilitate:", "Say it plainly:", "Design point to land:") — short, in-the-moment prompts. The *full* script is the runbook, not the slide.
- Slide budget ~13–18. Title slide → "this week" day map → the arc → recap. At least one of each pill per deck.
- Slide text stays in the student-facing register (household meds, plain language).

## Runbook conventions (match `week-1-runbook.md`)

Sections, in order:
1. **Header** — week N of 6, block name, days covered, session length (target 90–120 min), the one-sentence goal.
2. **Pre-flight** — exactly what the facilitator must have ready/open/running before the room arrives (keys, a seeded DB, a terminal, the deck). A facilitator who didn't build the system relies on this.
3. **Timed flow** — a table mapping wall-clock (`0:00`, `0:15`, …) → arc segment → slide range → what to do/say. This is the spine.
4. **Breakout prompts** — verbatim prompt(s) + what to listen for + the debrief answer key.
5. **Code-together** — the exact commands in order, what to narrate at each, the expected output, and the most likely thing to go wrong live (+ recovery).
6. **Break it / extend bank** — 2–4 experiments. Each: the sabotage (one concrete change), the **expected failure** (what they'll see), the **fix**, and an **extend** (push past the day file). Ground these in the block's real failure modes (e.g. empty-filter privacy bug, silent rerank fallback, hallucination bait).
7. **Misconceptions to preempt** — the 2–3 wrong mental models students bring to this block.
8. **Deliverable** (block-end weeks) — what a strong 2–3 min video shows; the one question to grade against.
9. **Materials** — the day files this draws from, links, anything to hand out.

## Block → week map

| Week | Block | Days | Block-end deliverable (🎥) |
|---|---|---|---|
| 1 | Foundations | 1–6 | why the system needs both engines |
| 2 | Chunking (the Bible lab) | 7–12 | chunk a document you've never seen (the Constitution) |
| 3 | Embeddings & vector search | 13–18 | a retrieval eval set |
| 4 | Query understanding & agents | 19–24 | eval your analyzer |
| 5 | MCP, observability, human-in-the-loop | 25–30 | a new tool, with an audit trail |
| 6 | Production gates & capstone | 31–36 | capstone + postmortem |

## Build a lesson — checklist

- [ ] Read the block's six `day-NN.md` files first — the deck/runbook are grounded in them, never invented.
- [ ] Read `week-1.html` + `week-1-runbook.md` and match style/structure.
- [ ] Deck: `<style>`/`<script>` copied verbatim from `week-1.html`; arc walked; ≥1 of each pill; slide text in student register; counter/footer say the right week.
- [ ] Runbook: every section present; timed flow sums to the session length; breakout prompts have answer keys; break-it bank has expected-failure + fix + extend for each entry.
- [ ] Diagrams inline (ASCII in `<pre>` or CSS cards) — no images/mermaid/excalidraw.
- [ ] No purple anywhere; palette matches.
- [ ] Open the deck in a browser (gstack `browse` → `goto file://…` → `screenshot`) and eyeball it before declaring done.
- [ ] Files land in `curriculum/slides/` on the **`instructor`** branch only — never sync slides/runbooks to `student` (same never-ship discipline as `curriculum/`).

## Where this lives

`curriculum/slides/` on the **`instructor`** branch. Like the rest of `curriculum/`, this is cold storage / source of truth — decks get presented from the file or copied into the delivery platform; they must never reach the `student` branch.
