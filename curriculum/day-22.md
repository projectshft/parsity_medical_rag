# Day 22 — The Chat Agent: Streaming, Prompts, and Tone

**Needs: the working pipeline from yesterday; the app running (`npm run dev`)**

## Today you will

- Write the system prompt that turns retrieved data into trustworthy answers
- Connect the last wire: pipeline → LLM → streamed response → the chat UI
- Have the first real conversation with the system you've been building since Day 1

## Concept

Everything until now produced *data*. Today the system starts producing *answers* — and that step is where RAG systems earn trust or destroy it.

Open `lib/agent.ts` and read `runAgent`. Most of it already works: it analyzes the query (your analyzer), retrieves (your executor), renders context (your formatter), and streams an LLM response to the UI. You'll see TODOs about *scheduling* — **leave those commented out**; they belong to a later block. Today's work is one thing: the `SYSTEM_PROMPT`, currently a stub.

### The grounding contract

Look at how the messages are assembled: the retrieved context and the user's question arrive together, and the system prompt sits above both. Its job is to impose what's worth calling a **grounding contract**:

1. **Answer from the retrieved data — only.** The model has read a million medical textbooks. For *these patients*, those textbooks are noise: the only truth is what retrieval returned. The prompt must make "I can answer from general knowledge" feel like a violation.
2. **Say when the data doesn't answer.** Remember the lesson from the index days: retrieval *always returns something*. The nearest neighbors of an unanswerable question are still in the context window, looking quotable. "The retrieved records don't contain this" must be an approved — encouraged — answer shape.
3. **Attribute.** Which patient, which note, which date. You carried metadata through every layer for exactly this moment; the prompt should demand the answer use it.
4. **Refuse what the system is not.** A records assistant retrieves and summarizes. It does not diagnose, recommend treatment, or adjust doses — not because the model can't produce medical-sounding text, but because *producing it would be the failure*. On Day 1 you wrote down a question this system should refuse. Today you build the refusal.

One more requirement, easy to forget: **tone**. The audience is clinic staff mid-task. Terse, factual, structured — not chatty, not hedging every sentence into mush. Tone is a spec, so it goes in the prompt.

> **Why is the context in the *user* message and not the system prompt?** Both can work, and you'll see either in production code. This repo puts per-query data in the user turn and keeps the system prompt static — which makes the system prompt cacheable and the conversation structure conventional (system = standing orders, user turns = situations). What matters: the *contract* lives in the system prompt; the *data* flows through the turns. Don't scatter rules into the data or data into the rules.

## Implementation

### 1. Write the system prompt

Replace the stub in `lib/agent.ts`. A structure that works — yours should be your own words:

- One sentence: identity and audience (records assistant for clinical staff)
- The grounding contract, as imperatives (answer only from Retrieved Data; if it doesn't contain the answer, say so plainly; name patients and dates when making claims)
- The refusal boundary (no diagnosis, no treatment advice, no dosing — and what to *say* instead: a referral to clinical judgment, not a lecture)
- Tone (concise, structured, no speculation)

### 2. Talk to your system

```bash
npm run dev
```

Open the chat UI and run a real conversation — the same questions you've been throwing at scratch scripts, now answered in streamed prose:

- "How many patients have high blood pressure?"
- "What do the notes say about sleep problems for patients with depression?"
- a follow-up that depends on the previous turn — note the conversation history flowing through `runAgent`

This moment is the course's midpoint payoff. Day 1's diagram is now a thing you can talk to, and every box in it is code you wrote or read.

### 3. Probe the contract

Now act like you're trying to get the system in trouble (gently — the serious adversarial session is tomorrow):

- Ask a general-medicine question with no patient anchor: "what's a normal A1c?" — does it answer from the void, or note that this isn't in the records?
- Ask your Day 1 refusal question. Read the refusal: is it *useful* (redirects appropriately) or just a wall?
- Ask something the data genuinely can't answer and watch whether the nearest-neighbor context seduces the model into pretending.

Iterate on the prompt after each probe. Prompt-writing is this loop; nobody writes the contract right on draft one.

### Common mistakes

- **A personality where a contract should be.** "You are a friendly, helpful medical assistant who loves helping!" specifies nothing testable. Every sentence of a component's system prompt should change behavior in a way you could probe.
- **Burying the grounding rule mid-paragraph.** Order and emphasis matter in prompts. The answer-only-from-retrieved-data rule is the load-bearing sentence; it goes early, bluntly, and once (repetition dilutes).
- **Refusals that over-trigger.** After adding the no-medical-advice rule, check the happy paths again — an over-broad refusal will start declining to *summarize* medication lists because they sound treatment-adjacent. Every guardrail needs a probe on both sides.
- **Touching the scheduling TODOs.** They reference functions that are still skeletons; uncommenting them breaks the agent. Later block, on purpose.

## Your turn

Spend **no more than 60 minutes** here (including the prompt work above).

1. Get five honest conversations working end to end, including one multi-turn exchange.
2. Run the three probes; iterate the prompt until all three behave; re-check two happy paths after each change (the both-sides rule).
3. In your notes, save the final prompt plus a three-line changelog: probe that failed → sentence you added → result. That artifact — *prompt change justified by observed behavior* — is the unit of work for tomorrow.

## Check yourself

- Recite the four clauses of the grounding contract from memory.
- Why does adding a refusal rule obligate you to re-test the *happy* paths?

<details>
<summary>Solution / discussion</summary>

A reference prompt (compress, don't copy):

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

**Both-sides testing:** a guardrail is a classifier splitting requests into allowed/refused, and like any classifier it has two error modes. Probing only the refusal side optimizes false-negatives while false-positives (refusing legitimate summarization) grow unwatched — and those are the failures *staff* hit fifty times a day. Every contract sentence gets a probe on each side. If that sounds like it deserves a systematic harness rather than manual vibes: correct, and that's tomorrow and the build day.

**On "what's a normal A1c?":** there are two defensible behaviors — refuse-and-redirect, or answer the general question *clearly labeled* as general knowledge, separate from patient data. What's indefensible is answering it in a way that's indistinguishable from a records-grounded claim. Whichever you chose, your prompt now encodes a *policy decision* — notice that you, the engineer, just made one. Production prompts are full of them; the difference between good and bad systems is whether they're made on purpose.

</details>

## Further reading (optional)

- [Anthropic: prompt engineering overview](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/overview) — vendor-neutral lessons despite the host; note its opening demand: success criteria and empirical tests *before* prompt tuning. Sound familiar?
