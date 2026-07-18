# Homework: The Write Path — add a note to the index

Your vector store only knows the notes that existed the day you ran `vectorize`. Real clinics write new notes every hour. This week you build the write path: an endpoint that takes a new note about a patient, builds its metadata **from the database**, and lands it in Pinecone — searchable seconds later.

## The endpoint

`POST /api/notes` accepting:

```json
{ "patientId": "<a real patient id>", "content": "<the clinical note text>" }
```

Requirements:

1. **Validate the body** with a Zod schema (`.parse()`, let the catch map `ZodError` → 400 — same pattern as every route in this repo).
2. **Look up the patient** in Postgres (`prisma.patient.findUnique`, include their **active** medications — `where: { status: 'active' }`). If the patient doesn't exist → **404**. This lookup is the point of the exercise: **the metadata comes from the system of record, not from the request.** A caller who could supply their own metadata could tag a note onto anyone.
3. **Build the chunk** exactly the shape `vectorize` writes (`MedicalChunk` in `lib/pinecone.ts`): a fresh id (`uuid` is already installed), the note text as `content`, and metadata — `patientId`, `firstName`, `lastName`, `age` (derive it), `gender`, `race`, `city`, `state`, `currentMedications`, and `source: 'api'` so you can tell hand-written notes from the bulk ingest later.
4. **Store it**: `upsertChunks([chunk])` — embedding + upsert in one call.
5. **Respond** with the new note's id and the metadata you stored.

## Prove the metadata works (don't skip this)

A write path you haven't read back from is a rumor. Verify all three:

1. POST a **distinctive** note for a real patient — something no other note says, e.g. *"Patient reports seeing green auras before headaches begin."*
2. Search **with that patient's `patientId` filter** for *"unusual visual symptoms before migraines"* → your note comes back (semantic match + filter working together).
3. Search with a **different** patient's filter → your note does **not** come back. Then fetch your vector by id in the Pinecone console and check every metadata field landed.

If all three hold, your metadata works — the filter boundary you learned this weekend now applies to notes *you* wrote.

## The wrinkle worth thinking about

You just created a note that exists **only in Pinecone**. Your database connection is read-only — Postgres, the system of record, has never heard of this note. You've made the derived index *ahead of* its source of truth. What did you just break? How would a production system order these writes? Bring an answer to class — there is a right one, and it's two sentences.

## Research: agents and patterns

Read Anthropic's **"Building Effective Agents"**: https://www.anthropic.com/research/building-effective-agents

Pay attention to the distinction it draws between **workflows** (LLM calls orchestrated through fixed code paths) and **agents** (the LLM directs its own tool use in a loop), and to the five workflow patterns: prompt chaining, **routing**, **parallelization**, orchestrator-workers, evaluator-optimizer.

You have been building one of these without knowing its name.

**Bring a position to class:** is our pipeline (selector → SQL ‖ RAG in parallel → aggregator) a *workflow* or an *agent* by the paper's definitions? Which named pattern(s) is it, exactly? Should it stay a fixed workflow or become a true agent (the LLM choosing tools in a loop) — and what happens to the `patientId` privacy boundary if the model decides when to search? We'll argue it live next session. There's no correct side — there is correct *reasoning*.

## The video 🎥 (2–3 min)

This week's video is the one from the reranking lesson: **search + rerank your own `bible-kjv` index.**

1. Run at least one query that shares zero keywords with the passage it finds.
2. Show one query where reranking **changed the ordering** (cosine order vs reranked order, side by side).
3. Explain **why you over-fetch** before reranking — in your own words.

Submit via the link pinned in Slack.
