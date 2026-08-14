# Week 4 — MCP: your RAG as a tool other AIs can call

**Session:** Saturday · [recording posted in Slack]
**Needs:** a working app; optionally Claude Desktop (paid) or Cursor

> Straight from the Slack post afterwards: *"MCP!!! Holy moly that was tougher
> than anticipated."* Budget patience. The concept is small; the setup is fiddly.
> The "When it breaks" section below is longer than usual for a reason.

## What we built

Everything so far has been *your* app with *your* chat UI. This session it becomes
**infrastructure other AI tools can call.**

### The premise

The front-office staff already live in Claude Desktop all day. They don't want
another app. So instead of building them one, we expose the retrieval system as
**tools** their existing assistant can call.

**Scope matters here.** This is a **front-office channel**. Front-desk staff never
see PII. So every response is de-identified, and we expose only non-identifying
tools — search, notes, condition lists — and no raw patient-detail lookups. The
channel *is* the permission; there's no login, no roles. Where you enter from
decides what you can see.

### What MCP actually is

Model Context Protocol — an API for agents. Under the hood it's RPC: a client
launches your server as a subprocess, asks *"what tools do you have?"*, and your
server answers with a registry. The model reads that registry and decides, on its
own, which tool to call and with what arguments.

You've been on the consuming side of this already if you've used the Figma, Slack,
or GitHub MCP servers in an editor. Now you're on the producing side.

### The anatomy of a tool

```ts
server.registerTool(
  'query_clinical_notes',
  {
    description:
      'Search clinical notes using semantic search. Use this for finding relevant ' +
      'medical notes, symptoms, treatments, or clinical observations.',
    inputSchema: {
      query: z.string().describe('Semantic search query (e.g., "chest pain")'),
      patientName: z.string().optional().describe('Optional: limit to a patient'),
      topK: z.number().optional().default(10).describe('Number of results'),
    },
  },
  async ({ query, patientName, topK }) => {
    const results = await searchClinicalNotes(query, { topK, firstName: patientName?.split(' ')[0] }, true);
    return { content: [{ type: 'text', text: /* ...obscured... */ }] };
  },
);
```

Four parts: **name**, **description**, **input schema**, **handler that returns
`{ content: [{ type: 'text', text }] }`**.

**The description is the interface.** You don't own the client's prompt. A model
you have never prompted picks between your tools using nothing but the names,
descriptions, and `.describe()` strings. Write them like few-shot examples: what
it's for, what it's *not* for, an example argument. "Gets patient data" tells a
model nothing about when to choose it over the other tool.

The client doesn't load every tool's full definition up front — it reads the
registry of descriptions and pulls in what it needs. Same idea as skills.

### Running it

```bash
npx @modelcontextprotocol/inspector npx ts-node mcp-server/index.ts
```

The Inspector is a local web UI — think Swagger for MCP. Connect, list tools, call
one with real arguments, see the response. **Do your debugging here, not through
a desktop app's restart cycle.**

To wire it into **Claude Desktop**: Settings → Developer → Edit config, then

```json
{
  "mcpServers": {
    "medical-rag": {
      "command": "npx",
      "args": ["ts-node", "/absolute/path/to/parsity_medical_rag/mcp-server/index.ts"],
      "env": {
        "DATABASE_URL": "…", "OPENAI_API_KEY": "…", "OPENAI_BASE_URL": "…",
        "PINECONE_API_KEY": "…", "PINECONE_INDEX": "…"
      }
    }
  }
}
```

Three things carry the whole config: the path must be **absolute** (the subprocess
inherits the client's working directory, not your repo); the `env` block is
**required** (your `.env` does not travel into a subprocess launched by a desktop
app); and the config is read **at launch**, so every edit needs a full quit and
restart.

Then ask it, in plain language, *"what patients have dementia and what are the
trends?"* — and watch a model you never prompted pick your tool, call it, and
format the result into a table you didn't write. That moment is the point of the
session.

### PII, in passing

Because this is the front-office channel, responses run through de-identification
before they leave. `lib/pii.ts` has the helpers; `obscureContent` scrubs a whole
rendered blob with regex.

It is **imperfect by design** — regex misses novel formats — and that's the
lesson. The defense that matters isn't the regex, it's that the obscuring is
**not something the caller can switch off**. A control the client can disable is
decoration.

## Homework — the capstone plan doc

**Only homework this week. No code.**

Make a copy of the [capstone plan template](https://docs.google.com/document/d/1CoJvxoJkfzFb_V3hXYE-YC08wH8a_N8QU1fMDlq4Td0/edit?usp=sharing)
and fill it in. Post it in the channel.

You have two tracks; pick one:

**Track A — extend this system.** Ship one real addition to the medical app,
measured. A new front-office tool. Reranking, wired in and justified with a
number. An obscured-view toggle. Hardening `obscureContent` against a format it
currently misses.

**Track B — build your own.** A RAG system on data you choose. Most people pick
this, and it makes the better portfolio piece.

If you're going Track B, the thing that decides your project is **the data, not
the idea.** Find data you can actually get, in volume, and let it tell you what
it's good for. A semantic index over 40 documents is a demo — you can't tell good
retrieval from bad. See [the capstone guide](week-5-capstone-build.md) for where
to find data and how to scope it.

The doc is short. Five sections: data source, user flow, vector store + chunking +
metadata, how the data stays fresh, agent architecture.

**The test for whether it's done:** paste it into Claude or Cursor and say "build
this." If the model needs four clarifying questions before it can start, the doc
isn't finished — and neither is your thinking.

## When it breaks

The failure surface here is specific and it ate most of a session. In rough order
of how often it hit people:

- **`Unknown file extension ".ts"`.** You're on Node 22 or 24, which handle
  TypeScript differently. `nvm use 20`. This blocked the most people.
- **You dropped `.js` from the SDK imports.** It must be
  `@modelcontextprotocol/sdk/server/mcp.js`, even though it's a TypeScript file.
  The SDK's package exports resolve `./*` verbatim — nothing appends the
  extension. Removing it because "it's a .ts file" breaks resolution.
- **The Inspector connects to nothing.** Pick **STDIO** as the transport. It
  doesn't default to it, and the connect screen just sits there.
- **Missing env in the Inspector.** It doesn't read your `.env` either — add each
  variable in its env panel, or run it from a shell that has them exported.
- **404 on the Pinecone index.** `lib/vector-search.ts` has a hardcoded
  `INDEX_NAME` that isn't yours. Same bug as week 2, new blast radius.
- **The tool hangs in Claude Desktop but works in the Inspector.** Something wrote
  to **stdout** — which *is* the JSON-RPC stream on a stdio transport. One stray
  byte and the client drops the server. This is why `mcp-server/index.ts` calls
  `config({ quiet: true })` (dotenv's startup banner goes to stdout) and logs with
  `console.error`, not `console.log`.
- **Server never appears in Claude Desktop.** Invalid JSON in the config, or a
  relative path. Check `~/Library/Logs/Claude/mcp-server-medical-rag.log`.
- **You edited the config and nothing changed.** Full quit (Cmd-Q) and reopen.

> **No Claude Desktop?** It's a paid app and not everyone has it. You lose the
> "a foreign model picks your tool" reveal, but the Inspector gives you tool
> discovery and every call. Don't skip the session over it.

## Check yourself

- The Inspector lists your tools and you can call one with real arguments and get
  a sensible response.
- You added at least one tool of your own beyond the provided example.
- You can explain why a caller-supplied "hide PII" flag would be worthless.
- Your capstone plan doc is posted.
