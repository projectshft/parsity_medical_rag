# The Chat Agent and the Grounding Contract

**Needs: the working pipeline; the app running (`npm run dev`)**

## Today you will

- Read the agent that turns retrieved records into a streamed answer
- Understand the **grounding contract** — the system-prompt rule that makes the answer trustworthy
- Have the first real conversation with the whole system, then probe it for cracks

## Concept

Everything until now produced *data*. Today the system starts producing *answers* — and that step is where a RAG system earns trust or destroys it.

Open `app/api/chat/route.ts` and read the `POST` handler top to bottom — the route *is* the orchestrator, and most of it you've already met: the **selector** decides which stores the question needs, the SQL and RAG agents run in parallel (`Promise.all`) and each hands back a block of text, and the **aggregator** (`lib/agents/aggregator.ts`) — the only agent that streams — synthesizes those blocks into one answer, sent to the chat UI via `stream.toTextStreamResponse()`. You'll also see scheduling wiring (`detectSchedulingIntent`, a card riding back in the `X-Scheduling-Action` response header) — that belongs to a later week on human-in-the-loop actions; leave it be and focus on one thing today: the `AGGREGATOR_PROMPT`.

Notice *how the messages are assembled* in `aggregate`. The retrieved context and the user's question arrive **together, in the user turn**:

```typescript
const userContent = context
  ? `Retrieved data:\n${context}\n\nUser question: ${input.query}`
  : input.query;
```

…while the `AGGREGATOR_PROMPT` sits above, in the static `system` slot. That layout is doing real work.

And notice the other branch of that ternary. When the selector decides a question needs *neither* store — a greeting, general medical knowledge with no tie to these records — the route skips both agents entirely, `context` is empty, and the **same streamer runs under different standing orders**: `GENERAL_PROMPT`, which answers from general knowledge but must say it would need to look things up rather than guess about any actual patient. The short-circuit is a *policy*, encoded a few lines from the contract it exempts; keep the two consistent.

### The grounding contract

The single idea to protect all week: **the model decides and writes, but it is never the source of facts.** Retrieval earns it the right to speak; no record means no claim. The system prompt is where that rule gets encoded — call it the **grounding contract**. Read the `AGGREGATOR_PROMPT` in `lib/agents/aggregator.ts` and find each of these four clauses in it (or where it should be sharper):

1. **Answer from the retrieved data — only.** The model has read a million medical textbooks. For *these patients*, those textbooks are noise: the only truth is what retrieval returned. The prompt must make "I'll answer from general knowledge" feel like a violation. (The repo's prompt says it plainly: *"Answer ONLY from the retrieved data below. If it isn't there, say so plainly — never invent or infer medical information."*)
2. **Say when the data doesn't answer.** You already know retrieval *always returns something* — the nearest neighbors of an unanswerable question are still in the context window, looking quotable. *"The retrieved records don't contain this"* must be an approved, encouraged answer shape.
3. **Attribute.** Which patient, which note, which date. You carried metadata through every layer for exactly this moment; the prompt should demand the answer use it.
4. **Refuse what the system is not.** A records assistant retrieves and summarizes. It does not diagnose, recommend treatment, or adjust doses — not because the model *can't* produce medical-sounding text, but because *producing it would be the failure*.

One more requirement, easy to forget: **tone.** The audience is clinic staff mid-task. Terse, factual, structured — not chatty, not hedging every sentence into mush. Tone is a spec, so it goes in the prompt.

> **Why is the context in the *user* message, not the system prompt?** Both can work; you'll see either in production. This repo puts per-query data in the user turn and keeps the system prompt static — which makes the system prompt cacheable and the structure conventional (system = standing orders, user turns = situations). What matters: the *contract* lives in the system prompt; the *data* flows through the turns. Don't scatter rules into the data or data into the rules.

## Implementation

### 1. Read the contract, then talk to your system

```bash
npm run dev        # localhost:3000 — chat UI
```

Open the chat and run real questions — the same ones you've been throwing at scratch scripts, now answered in streamed prose:

- "How many patients have diabetes?" → a real count, reported directly.
- "What do the notes say about sleep problems for patients with depression?" → both agents fire, and the aggregator has to weave two context blocks together.
- a follow-up that depends on the previous turn — watch the conversation history flowing through the route into `aggregate`.

This is the week's payoff: the whole system is now a thing you can talk to, and every box in it is code you wrote or read.

### 2. Probe the contract

Now act like you're trying to get the system in trouble (gently — the real adversarial session is next):

- Ask a general-medicine question with no patient anchor: *"what's a normal A1C?"* — the selector should short-circuit this to `GENERAL_PROMPT`. Does the answer read clearly *as* general knowledge, or is it indistinguishable from a records-grounded claim?
- Ask something the data genuinely can't answer for a real patient — *"what is this patient's blood type?"* (Synthea has no blood-type field) — and watch whether the nearest-neighbor context seduces the model into pretending.
- Ask a dosing question — *"should we increase this patient's insulin?"* — and check the refusal boundary holds.

After each probe, if the behavior is wrong, sharpen the `AGGREGATOR_PROMPT` and re-run. Prompt-writing *is* this loop; nobody writes the contract right on draft one.

### Common mistakes

- **A personality where a contract should be.** "You are a friendly, helpful medical assistant who loves helping!" specifies nothing testable. Every sentence of a component's system prompt should change behavior in a way you could probe.
- **Burying the grounding rule mid-paragraph.** Order and emphasis matter. The answer-only-from-retrieved-data rule is load-bearing; it goes early, bluntly, and once (repetition dilutes).
- **Refusals that over-trigger.** After adding a no-medical-advice rule, re-check the happy paths — an over-broad refusal will start declining to *summarize* medication lists because they sound treatment-adjacent. Every guardrail needs a probe on **both** sides.
- **Touching the scheduling wiring.** It belongs to the human-in-the-loop week. Leave `detectSchedulingIntent` and the `X-Scheduling-Action` header alone today.

## Your turn

Spend **no more than 60 minutes** here.

1. Get five honest conversations working end to end, including one multi-turn exchange.
2. Run the three probes; if any misbehaves, sharpen the prompt until it behaves — and re-check two happy paths after each change (the both-sides rule).
3. In your notes, save the final prompt plus a three-line changelog: probe that failed → sentence you added → result. That artifact — *a prompt change justified by observed behavior* — is the unit of work for the failure session next.

## Check yourself

- Recite the four clauses of the grounding contract from memory.
- Why does adding a refusal rule obligate you to re-test the *happy* paths?

<details>
<summary>Solution / discussion</summary>

A reference prompt (compress, don't copy — yours should be in your own words):

```
You are a medical records assistant for clinical staff. You answer questions
using ONLY the Retrieved Data provided with each question.

Rules:
- If the Retrieved Data does not contain the answer, say so directly
  ("The retrieved records don't show..."). Never fill gaps with general
  medical knowledge.
- Attribute claims: name the patient, note type, and date you're drawing from.
- You do not provide diagnoses, treatment recommendations, or dosing
  guidance. If asked, state that this requires clinical judgment and offer
  what the records DO show.
- Be concise and structured. Use lists for multi-patient answers. Do not
  speculate.
```

**Both-sides testing:** a guardrail is a classifier splitting requests into allowed/refused, and like any classifier it has two error modes. Probing only the refusal side lets false-positives (refusing legitimate summarization) grow unwatched — and those are the failures *staff* hit fifty times a day. Every contract sentence gets a probe on each side.

**On "what's a normal A1C?":** two defensible behaviors — refuse-and-redirect, or answer the general question *clearly labeled* as general knowledge, separate from patient data. What's indefensible is answering it in a way that's indistinguishable from a records-grounded claim. This system chose the second, structurally: the selector short-circuits and the aggregator streams under `GENERAL_PROMPT` instead of the contract. That's a *policy decision* — someone encoded it, and having read the code, you now co-own it. Production prompts are full of these; good systems make them on purpose.

</details>

## Further reading (optional)

- [Anthropic: prompt engineering overview](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/overview) — vendor-neutral lessons despite the host; note its opening demand: success criteria and empirical tests *before* prompt tuning
