# MCP, in ten minutes

We are not building an MCP server this cohort. Here's what it is, so the acronym
isn't a hole in your knowledge, and here's why we skipped it.

## What it is

**Model Context Protocol** is a standard way for an LLM client — Claude Desktop,
Cursor, ChatGPT — to discover and call tools that live somewhere else.

The mental model that makes it click: **MCP is RPC for LLMs.** You expose
functions; a model on someone else's machine calls them. Same idea as a REST
API, except the consumer is a language model, so the interface is designed for
one.

A tool declaration is three things — and you already know all three, because
it's the same shape as the Zod schemas you've been writing since week 3:

```ts
server.registerTool('query_clinical_notes', {
  description: 'Search clinical notes by meaning. Use for symptoms, history, trends.',
  inputSchema: { query: z.string(), patientName: z.string().optional(), topK: z.number().default(10) },
}, async ({ query, patientName, topK }) => {
  // do the work, return text
});
```

- **name** — the identifier.
- **description** — how the model decides whether to call it. This carries the
  weight. A vague description is a routing bug, exactly like a vague
  `.describe()` on a Zod field.
- **input schema** — the arguments and their types.

When a client connects, it reads the *descriptions* of every available tool —
not the implementations — and picks from there. That's why the registry stays
cheap even with a hundred tools, and it's the same trick Claude uses for skills.

## Why you'd want one

The pitch is good, and it's about not building another app.

Suppose the clinic's front-office staff already live in Claude Desktop all day.
You could build them a chat interface — or you could expose `query_clinical_notes`
over MCP, and they keep using the tool they already have. No new UI, no change in
behaviour, no training. The model on their side takes your raw results and
formats them however that person asked.

That's a real advantage, and it's why MCP servers are worth understanding even
if you never write one.

## Why we're not building one

1. **You'll consume far more MCP servers than you write.** GitHub, Figma, Linear,
   Slack and Stripe all ship one. Knowing the shape is enough to use them well.
2. **The interesting concept is tool calling, and you already built it.** Week 3
   was tools, descriptions and a dispatch loop. MCP is a transport for that. The
   idea transfers; the boilerplate doesn't.
3. **Cohort 3 spent ninety minutes on it and most people never got it running.**
   Node version mismatches, `ts-node` ESM resolution, `.js` extensions in
   imports, and a config file that needs a full app restart per edit. Ninety
   minutes of `nvm use 20` is not ninety minutes of learning.
4. **Security is genuinely unsettled.** No native auth headers, so keys end up
   as tool parameters or environment variables in a desktop config file. Fine
   for a local server; not a story you'd want to defend for patient data.

## If you want it anyway

Good instinct — it's a fun afternoon, and it demos well.

- [Model Context Protocol spec](https://modelcontextprotocol.io/)
- [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) — `npm i @modelcontextprotocol/sdk`
- `npx @modelcontextprotocol/inspector` — a Swagger-like UI for poking at your
  server before wiring it into a client

Two things that will save you the evening Cohort 3 lost:

- **Run it with `tsx`, not `ts-node`.** Nearly every failure in that session was
  ESM/CJS resolution, and `tsx` doesn't have the problem. (It's why this repo's
  scripts moved to `tsx`.)
- **Claude Desktop caches its config.** Fully quit and reopen after every edit —
  reloading isn't enough.

An idea worth stealing if you do build one: expose a *deliberately reduced*
version of your tools. The clinician chat gets full patient data; the
front-office MCP channel gets the same search with PII stripped. Same retrieval,
different blast radius, and the channel — not a role flag the caller could
forge — is what decides.
