# Bonus — MCP: your RAG as a tool other AIs can call

> 🗄️ **ARCHIVED — MCP is no longer part of this course.** It was week 4 in
> cohort 3; cohort 4 replaced it with tool calling and then removed the MCP code
> from the repo entirely (`mcp-server/` and `@modelcontextprotocol/sdk` are
> gone). Nothing here runs against the current repo without restoring them.
>
> Kept for the failure catalogue, which is still accurate about MCP itself and
> is the reason the session was cut.

**Not a session. Optional, do it whenever.**
**Needs:** a working app; optionally Claude Desktop (paid) or Cursor

> ⭐ **This was week 4 in cohort 3. It is bonus material now** — cohort 4 spends
> that session on [tool-calling with LangGraph](../student/week-4-tool-calling.md) instead.
>
> Same underlying idea, different owner of the loop. In week 4 *your* graph holds
> the tool list and decides. With MCP you publish the tool list over a protocol
> and somebody else's model — Claude Desktop, Cursor — does the deciding. Do
> week 4 first; this reads much better afterwards.
>
> Straight from the cohort-3 Slack post: *"MCP!!! Holy moly that was tougher than
> anticipated."* Budget patience. The concept is small; the setup is fiddly, and
> most of the room never got a server connected inside the session. That's why it
> isn't a session any more. The "When it breaks" section below is longer than
> usual for a reason, and it's the reason to keep this file.

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
  async ({ query, patientId, topK }) => {
    const { rerankedDocuments } = await searchClinicalNotes(query, {
      topK,
      patientIds: patientId ? [patientId] : undefined,
    });
    return { content: [{ type: 'text', text: formatVectorResults(rerankedDocuments) }] };
  },
);
```

Four parts: **name**, **description**, **input schema**, **handler that returns
`{ content: [{ type: 'text', text }] }`**.

> Watch the signature: `searchClinicalNotes(query, options)` takes **two**
> arguments, and its options are `{ topK, topN, patientIds, dateFrom, dateTo }`.
> There is no `firstName` option and no third "obscure" argument — obscuring
> happens in the formatter, on the way out. It returns
> `{ docs, rerankedDocuments }`, **not an array**, so `results.length` is
> `undefined`. That exact mistake is why `mcp-server/index.ts` didn't compile for
> most of cohort 3.

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

`obscureContent` is a **TODO you have to write** (`docs/CHALLENGE-PII.md`), and
until you do, this server throws on its first result. That ordering is on purpose:
the obscuring is the door, not a decoration you add later.

It is **imperfect by design** — regex misses novel formats — and that's the
lesson. The defense that matters isn't the regex, it's that the obscuring is
**not something the caller can switch off**. A control the client can disable is
decoration.

## No homework

The capstone plan doc moved to [week 4](../student/week-4-tool-calling.md), which is where
that session lives now.

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
- **404 on the Pinecone index.** `PINECONE_INDEX` isn't reaching the subprocess.
  (In cohort 3 this was a hardcoded `INDEX_NAME` in `lib/vector-search.ts`; that's
  fixed — it reads `process.env.PINECONE_INDEX` now. So if you get a 404 here,
  it's the env block in your client config, not the code.)
- **The tool hangs in Claude Desktop but works in the Inspector.** Something wrote
  to **stdout** — which *is* the JSON-RPC stream on a stdio transport. One stray
  byte and the client drops the server, silently. `mcp-server/index.ts` logs with
  `console.error` for exactly this reason. If you add dotenv yourself, load it as
  `config({ quiet: true })` — its startup banner goes to stdout and will break the
  transport. (The server does **not** load dotenv today; env comes from the client
  config's `env` block.)
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
- You can say what MCP gives you that your week-4 graph doesn't, in one sentence.
  (Hint: it isn't capability. It's who owns the client.)
