# Structured Outputs: Turning the LLM Into a Typed Function

**Needs: `OPENAI_API_KEY`; pennies of usage**

## Where we are

Coming out of the vector-store block you have two ways to find things. **Postgres** is the system of record — every patient, condition, observation, and the full text of every clinical note lives there. **Pinecone** is a *derived* index: the `vectorize` script read those notes out of Postgres, embedded them, and upserted them so you can search by meaning. Two engines, both loaded, both working.

What you don't have yet is a **driver**. A user doesn't know or care which engine answers their question — they type plain English and expect an answer. This week you build the thing in the middle: a small team of agents that reads the question, decides which engine (or both) to hit, runs them, and answers *only* from what came back.

That driver is going to make decisions in code — `if (this) hit Postgres, else search notes`. Which means, before anything else, we need the LLM to stop talking in paragraphs and start returning data your code can branch on. That's today.

## Today you will

- Make an LLM return a *typed object* your code can `if` on — reliably, every time
- Learn the schema-first pattern this repo uses for every LLM-as-component call
- Build your own extractor from scratch and break it on purpose

## Concept

So far the LLM has played one role: the *answerer* at the end of the pipeline, producing prose for a human to read. This week it takes a second, very different role — **a component in the middle of the pipeline**, whose output is consumed by *code*.

Code can't branch on prose. If the model replies:

> "This looks like a question about a specific patient's records, and they probably want a summary…"

…what does your `if` statement test? You need:

```json
{ "requiresSQL": true, "requiresVector": false, "semanticQuery": null }
```

The naive approach — adding *"please respond in JSON"* to the prompt — fails in every way that matters: sometimes you get markdown fences around the JSON, sometimes a chatty preamble, sometimes a field goes missing, sometimes `"intent": "kind of a lookup?"` appears even though you never offered that value. Works in the demo, breaks in production — the worst possible combination.

The reliable approach is **schema-enforced output**: you hand the API a formal schema and the model is *constrained* to produce output that conforms. Not asked nicely — constrained. This repo's pattern (it's in `CLAUDE.md`, and it's law for every structured call):

```
1. Define a Zod schema        — fields, types, enums, .describe() on everything
2. Infer the TypeScript type  — z.infer<typeof Schema>
3. Call responses.parse()     — with zodTextFormat(Schema, 'name')
4. Validate the result        — Schema.parse(response.output_parsed)
```

Two design notes worth absorbing:

- **`.describe()` is prompting.** Every field description is read by the model — `requiresSQL: z.boolean().describe('Structured data is needed — counts, filters, or a specific patient')` is simultaneously a type constraint *and* an instruction. Schema-first design moves half your prompt into the place where it can't drift out of sync with the types.
- **Step 4 looks redundant and isn't.** The API promises conformant output; `Schema.parse` *verifies* it at the boundary, so any violation surfaces as a loud error at the call site — not as `undefined` propagating three files downstream. Trust, but parse.

## Implementation

A warm-up extractor, no medicine involved — customer-support email triage. It's the exact shape of the selector agent you'll build next, on a domain with no learning curve. Scratch script:

```typescript
import 'dotenv/config';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { openai } from './lib/openai';

const TicketSchema = z.object({
  product: z.string().describe('Which product or service the customer is writing about'),
  urgency: z.enum(['low', 'medium', 'high']).describe('How urgent the issue is'),
  sentiment: z.enum(['angry', 'neutral', 'happy']).describe("The customer's tone"),
  requestedAction: z.string().describe('What the customer actually wants to happen'),
  accountNumber: z.string().nullable().describe('Account number if mentioned, else null'),
});

type Ticket = z.infer<typeof TicketSchema>;

async function main() {
  const email =
    "Hi, I've been charged twice for my premium subscription this month (acct 88341). " +
    "This is the second time this has happened and I'm honestly fed up. " +
    'Please refund the duplicate charge today or cancel my account entirely.';

  const response = await openai.responses.parse({
    model: 'gpt-4o-mini',
    input: [
      { role: 'system', content: 'Extract structured data from customer support emails.' },
      { role: 'user', content: email },
    ],
    temperature: 0,
    text: { format: zodTextFormat(TicketSchema, 'ticket') },
  });

  const ticket: Ticket = TicketSchema.parse(response.output_parsed);
  console.log(JSON.stringify(ticket, null, 2));
}
main();
```

Real output from this exact script:

```json
{
  "product": "premium subscription",
  "urgency": "high",
  "sentiment": "angry",
  "requestedAction": "refund the duplicate charge or cancel the account",
  "accountNumber": "88341"
}
```

Look at what you got for free: the enum held (`high`, not `very urgent!!`), the account number was found *and typed*, and `ticket` is a fully typed object — your editor autocompletes `ticket.urgency` and the compiler knows its three possible values. This is what "callable like a function" means: you can write `if (ticket.urgency === 'high')` and trust it.

Now break it on purpose — this is the instructive part:

1. Remove `temperature: 0`, run five times, watch borderline fields (is this `medium` or `high`?) wobble between runs. Determinism matters for a component you're going to build `if` statements on.
2. Change the email to one with **no** account number. Confirm you get `null` — not `"N/A"`, not a hallucinated number.
3. Make a field nonsensical for the input (add `flightNumber: z.string()`) and watch what the model does when the schema demands something the text can't supply. This failure mode — **a required field forces an invention** — is why `nullable()` / `optional()` semantics deserve real thought.

### Common mistakes

- **"Respond in JSON" prompting.** Without schema enforcement you're parsing prose that *resembles* JSON, and every edge case is your problem. If your code contains a regex stripping ```` ```json ```` fences, you're doing it the fragile way.
- **Required fields that can't always be answered.** `accountNumber: z.string()` (no `nullable`) on an email with no account number doesn't produce an error — it produces a *fabricated account number*. The schema is a demand; make impossible demands and the model satisfies them with fiction.
- **Undescribed fields.** `urgency: z.enum([...])` with no `.describe()` makes the model guess your definition of urgency. Descriptions are where you encode the judgment calls.
- **Old API surface.** This repo uses `responses.parse` + `zodTextFormat` + `output_parsed`. If an AI assistant suggests `chat.completions` + `response_format` + `choices[0].message.parsed` — that's the deprecated pattern `CLAUDE.md` explicitly bans. Trust the repo over the training data.

## Your turn

Spend **no more than 45 minutes** here.

1. Build an extractor for a domain you know: calendar events from freeform text ("lunch with Sam next Tuesday at noon"), expense lines from receipts, job postings → (title, seniority, remote?, salary range). Schema, descriptions, the four-step pattern.
2. Feed it five inputs, including one that's missing a field and one that's *ambiguous*. Record what the schema's type choices (enum vs string, nullable vs required) did to the output in each case.
3. Rewrite one field description to encode a judgment call, and find an input where the description changes the answer.

## Check yourself

- What does `Schema.parse(response.output_parsed)` protect against that `zodTextFormat` alone doesn't?
- Why is a required field on absent information *worse* than an error?

<details>
<summary>Solution / discussion</summary>

**The redundant-looking parse:** `zodTextFormat` constrains generation, but the boundary between "what the API returned" and "what your types claim" deserves a runtime check — SDK versions drift, models occasionally emit edge-case output, refusals and length-truncations can yield non-conformant results. `Schema.parse` converts all of that into one loud, located error. The pattern is general: **validate at every boundary where types are claimed but not proven.**

**Why fabrication beats error (in badness):** an error stops the pipeline and points at itself; a fabricated `accountNumber: "12345678"` flows into your billing system wearing a perfectly valid type. Silent plausible wrongness is the signature failure mode of LLM components, and schema design — nullable where reality is nullable, enums where the answer set is closed, descriptions where judgment lives — is your main defense.

**Where this is heading:** the next lesson points this exact pattern at a harder target. Instead of extracting urgency from an email, you'll extract *retrieval strategy* from a medical question — which engine should answer it. Same four steps, real stakes.

</details>

## Further reading (optional)

- [OpenAI: structured outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs) — the API mechanics under `zodTextFormat`
