# Day 26 — Wiring MCP into Claude Desktop and Cursor

**Needs: yesterday's working MCP server; Claude Desktop and/or Cursor installed**

## Today you will

- Connect a real AI assistant to your server and watch it choose your tools unprompted
- Learn the configuration, lifecycle, and debugging story of a deployed MCP server
- Run the first conversations where someone else's model uses your retrieval system

## Concept

Yesterday you tested the server with pipes. Today a production AI application launches it, discovers your tools, and decides — mid-conversation, on its own judgment — to call them.

The mechanics are almost anticlimactic: MCP clients read a config file listing servers to launch. For Claude Desktop:

```json
{
  "mcpServers": {
    "medical-rag": {
      "command": "npx",
      "args": ["ts-node", "/absolute/path/to/medical-rag/mcp-server/index.ts"],
      "env": {
        "DATABASE_URL": "your-neon-url",
        "PINECONE_API_KEY": "your-pinecone-key",
        "OPENAI_API_KEY": "your-openai-key"
      }
    }
  }
}
```

Three details in that blob carry the whole day:

1. **The client launches your server as a subprocess.** Not a URL — a command. Every time Claude Desktop starts, it runs that command and holds the stdio pipe open. Server crash = tools vanish from the conversation.
2. **The path must be absolute.** The subprocess inherits the *client's* working directory, not your repo. Relative paths are the #1 setup failure.
3. **The `env` block exists because your `.env` doesn't travel.** The subprocess doesn't source your shell profile or read your repo's `.env` — every secret the server needs must be passed explicitly. (Stop and notice what you're doing: pasting production database credentials into a desktop app's config file. It works. Whether it's *wise* is tomorrow's entire subject.)

## Implementation

### 1. Configure the client

**Claude Desktop:** edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) with the block above — your absolute path, your real keys. Restart Claude Desktop fully (Cmd-Q, reopen; the config is read at launch).

**Cursor:** same shape, in `.cursor/mcp.json` at your project root — and since Cursor launches from the repo, you can drop the `env` block and let `ts-node` + `dotenv` find `.env` normally.

![Screenshot: Claude Desktop showing the medical-rag server's tools available in a conversation](assets/day26-claude-desktop-tools.png)
<!-- TODO(brian): capture Claude Desktop with the medical-rag MCP server connected (tools icon visible) -->

### 2. Watch a foreign model use your system

Open a fresh conversation and ask — in plain language, no tool names:

- "How many patients in the medical-rag system have high blood pressure?"
- "Search the clinical notes for anyone describing chest pain at night."
- "Pull up everything on one of the diabetic patients."

Watch what happens before each answer: the assistant announces a tool call, shows the arguments it chose, and waits for approval (the client's human-in-the-loop default — you'll build your own version of that pattern in a few days). Approve, and your code runs. The answer that comes back is *their* model reading *your* `formatResultsForLLM`-shaped text.

Two observations to make deliberately:

- **Did it pick the right tool?** That's your description quality, scored live by a model you've never prompted.
- **Did it pick good arguments?** Watch `query_notes` — does the assistant pass the user's words verbatim, or rephrase? Compare with what your own analyzer's `semanticQuery` would have done. You built that rephrasing on purpose; the foreign model may or may not be as thoughtful.

### 3. Learn the debugging story now, not during a demo

Things break at this seam constantly, and the failure surface is specific:

```bash
# macOS: Claude Desktop's MCP logs, one file per server
tail -f ~/Library/Logs/Claude/mcp-server-medical-rag.log
```

- **Server never appears** → config JSON is invalid, or the path isn't absolute. Check the log's first lines.
- **Server appears, tools error** → usually missing `env` keys; your code throws on `process.env.X!` being undefined. The log shows your stderr.
- **Tools hang** → something wrote to stdout (yesterday's warning, now live-fire). Find the stray `console.log`.

### Common mistakes

- **Editing the config while the app runs.** Both clients read config at startup. Edit → fully restart → test. "I changed it and nothing happened" is almost always this.
- **`npx ts-node` resolution.** The subprocess needs `npx` on its PATH and the repo's `node_modules` reachable — if Claude Desktop can't resolve `ts-node`, give it the absolute path to your repo's binary: `/path/to/repo/node_modules/.bin/ts-node`.
- **Testing only through the client.** When a tool misbehaves, drop back to yesterday's pipe/inspector first. "Is it my server or the integration?" is one `tools/call` away, and debugging through a desktop app's restart cycle is misery.
- **Leaving the server connected with real keys and forgetting it exists.** Every conversation you have in that client can now read your patient database. Today that's a feature. Write the sentence down; you'll reread it tomorrow.

## Your turn

Spend **no more than 45 minutes** here.

1. Get connected; run the three conversations; deliberately break one thing (rename a tool, remove an env var), watch the log, fix it. The break-fix loop is the actual skill.
2. Ask a question your tools *can't* answer well ("compare all patients' kidney function trends"). Watch how the assistant copes — multiple calls? wrong tool? honest limits? In your notes: is the gap a missing tool, or a tool description that overpromises?
3. From your observations in step 2: write the spec (name, description, parameters — no implementation) for the *fourth* tool this server should have. Keep it; the build day will want it.

## Check yourself

- Why does the `env` block exist, and what's the uncomfortable implication of where those values now live?
- A tool call hangs forever in Claude Desktop but works in the inspector. What's your first suspect, and where do you look?

<details>
<summary>Solution / discussion</summary>

**The env block** exists because subprocesses inherit nothing from your dev shell — and the implication is that production credentials now sit in a plaintext desktop-app config file, *and* flow through an AI client you don't operate. For a learning project with synthetic data: fine. For real patient data: an audit finding. The general principle — **every integration seam is a place credentials pool** — and the better answer (the server holding its own scoped credentials, clients holding none) is exactly where the course goes next.

**Hangs-in-client, works-in-inspector:** first suspect is stdout pollution — some code path that only triggers under the client's call pattern (a cache miss, a first-time index check) logging to stdout and corrupting the stream. Look in the client's MCP log for the malformed line; the fix is `console.error`. Second suspect: the client passed an argument shape your zod schema rejects and your error path itself writes to stdout.

**On the fourth-tool spec:** the common gap students find is aggregation — the assistant answers "compare trends" by calling `get_patient` five times and synthesizing, slowly and lossily. A purpose-built `compare_lab_across_patients` tool with a tight description is usually the right call — and noticing "the client is brute-forcing what should be one tool" is precisely how production MCP servers grow.

</details>

## Further reading (optional)

- [modelcontextprotocol.io — connect to local servers](https://modelcontextprotocol.io/docs/develop/connect-local-servers) — the official client-wiring guide, incl. Windows paths
