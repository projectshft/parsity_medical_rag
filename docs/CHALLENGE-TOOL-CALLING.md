# Homework: Ship the agent, then argue for tool-calling

Last session you built the agent pipeline — selector → SQL / RAG → aggregator,
plus the scheduler. This week: get the whole thing **actually working end to
end**, start collecting the query/response pairs we'll live on going forward,
and make one short video about where this architecture goes next.

## 1. Get the app working (all of it)

- **Finish human-in-the-loop / the scheduler** if you didn't wrap it in class —
  "schedule him for Tuesday" should detect the intent, pull the patient from the
  conversation, and pop the confirm card.
- **Extend vector search to use metadata.** Right now search matches on meaning
  alone — add the metadata filter so a patient-scoped question only returns that
  patient's notes (and try filtering on the other fields you stored: age,
  gender, city…).
- **Polish the flow** — chase down the questions that route wrong or answer
  badly, and fix the prompts until the common cases feel solid.

By the end you should be able to open the app and get grounded answers to SQL
questions, note questions, hybrid questions, general questions, **and** book an
appointment.

## 2. Collect your query/response examples (do this AS you build)

This is the part that matters going forward — **keep a running log of what you
ask and what comes back.** At least **10** pairs. Any document is fine (Google
Doc, markdown, notepad) — it does **not** need to be fancy. You can also just
pull them straight out of LangSmith and dump them in.

Log **both** good and bad responses — the bad ones are just as useful:

```
Q: How many patients have hypertension?
A: 63
✅ good — exact number, and it's the RIGHT number

Q: Which patients have a history of heart disease?
A: [list of patients]
✅ good — mapped "heart disease" to the stored term and returned real people

Q: <something that came back wrong / vague / hallucinated>
A: <the bad answer>
❌ bad — <why: wrong count, missed the filter, made something up…>
```

The exact-number ones (like hypertension → 63) matter most — that's a case
where "close" is wrong, and we'll need to prove the system gets it right later.
Use the failures you hit to write a few **few-shot examples** for your prompts
(show the model 2–3 good Q→answer pairs and watch the weak cases improve).

Keep this list. We build on it in a couple weeks.

## 3. The video 🎥 — tool-calling (this is the only required deliverable)

Keep it **short and light** — a few minutes, phone or screen recording is fine.

- **What is tool-calling?** In plain terms.
- **Why does it matter?**
- **How would you refactor THIS project to use it?** (Right now the *code*
  decides what runs — the selector routes, the route calls the agents. With
  tool-calling, the *model* decides which tool to call. Sketch how ours would
  change.)
- **Draw a small diagram** — tool-calling vs workflow, with pros/cons. Excalidraw,
  a whiteboard, or a piece of paper you hold up to the camera all work. Walk
  through it briefly.

There's no right answer — we want your reasoning.

## Bonus (optional)

- Add **metadata to your LangSmith traces** so you can filter/inspect runs.
- **UI polish** — make the chat / scheduling card nicer.

Submit the video via the link pinned in Slack. Bring your query log — we'll use it.
