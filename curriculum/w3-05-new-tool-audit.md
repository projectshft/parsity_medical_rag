# Build: Add a New Tool

**Needs: the connected MCP server**

## Today you will

- Design and ship a new MCP tool, end to end: spec → implementation → obscuring → proof
- Make it inherit the front-office contract — non-PII shaped, always-obscured output
- Prove a foreign model (or the inspector) can discover and call it
- Record this block's deliverable video

This is a **build**. The training wheels from the earlier MCP lessons are off: you make every decision yourself — what the tool does, what it returns, how it stays non-identifying, and how you *prove* all three by calling it the way a real client would.

## Concept

Inventory of what this block assembled: your system is now **infrastructure** — tools other AIs call (MCP), served through a front-office channel that's safe to expose because its tools are non-identifying and every response is obscured, plus one human-gated write path (scheduling). Today's build forces the MCP half to work *for real*, because that's where the design either holds or leaks: a new tool is only as safe as the contract you remember to honor when you write it.

The contract from the securing lesson is the whole game here. This channel is safe **because** of two properties, and a new tool has to preserve both or it breaks the door for every tool:

- **Non-PII shaped.** The tool answers a front-office question — search, count, summarize-in-aggregate — not "hand me everything about this one named person." A tool whose *purpose* is to emit an identified chart doesn't belong on this channel no matter how you format it.
- **Obscured output.** Whatever names or identifiers do appear in the result get run through `obscureName` / the `obscureContent` scrub before the text leaves. No flag, no exception.

Get those right and the new tool is safe by construction, same as the two that shipped. Skip them and you've quietly turned the front-office door into a PII leak with no error to catch it.

## Implementation

### 1. Pick your tool

Use the extra-tool spec you wrote on the wiring lesson if you have one. Otherwise, candidates in rough order of ambition:

- `list_conditions` — distinct conditions with patient counts (pure aggregate; no names to obscure at all — the *easiest* fit for this channel)
- `compare_lab_across_patients` — one lab, several patients, values side by side (the brute-force gap many found on the wiring lesson; patient labels must be obscured pseudonyms, and it's *a real decision*: are lab values attached to pseudonymous ids still safe to emit here?)
- `summarize_patient` — narrative summary via your own LLM call *inside* the tool (front-office-legal *only* if the name is obscured and the summary carries no raw PII from the notes — and now the costliest tool on the server, relevant below)

### 2. Ship it like it's real

The checklist is the lesson — each item exists because skipping it bit someone:

1. **Spec first**: name, description-as-prompt (the colleague test applies — the description *is* the interface for a model you don't control), zod `inputSchema` with `.describe()` on every field.
2. **Register it with `registerTool`** (not the deprecated `server.tool`) — match the shape of the two existing tools exactly: `registerTool(name, { description, inputSchema }, handler)`.
3. **Implementation** thin, calling your existing `lib/` functions — the hard parts already live there. The MCP-specific requirement is the return shape: `{ content: [{ type: 'text', text: '...' }] }`, text for a model to read.
4. **Honor the contract**: any name or identifier in the output goes through `obscureName` / `obscureContent`. If your tool renders notes, scrub raw PII in the note body the same way `search_patients` scrubs its whole rendered result. This is the step that keeps the door safe.
5. **Know its cost path**: note every LLM, embedding, and database call your handler makes — you'll price it in the cost step below.

### 3. Prove it — the client can call it

Don't just show the code; show a client *discovering and calling* it. Run this sequence and capture the output of each step:

1. `tools/list` (raw pipe, or the inspector) shows the new tool, schema intact:
   ```bash
   echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | npx ts-node mcp-server/index.ts
   ```
2. A `tools/call` round-trip (inspector is painless, or a plain-language ask in Claude Desktop) invokes it successfully and returns well-shaped text.
3. **The obscuring check**: the returned text contains **pseudonyms, never a real name.** This is the proof that matters — a new tool that returns real names failed the build even if it "works."
4. A malformed call (bad param types) errors without crashing the server — the handler's `try/catch` returns `isError: true` text, not a dead process.

### 4. Close the loop on cost

One question: **what does one call to your new tool cost?** Count the LLM calls it makes — read the handler and everything it calls into; embedding calls count — estimate tokens in/out, and write the per-call figure in your notes. (Next week you'll wire tracing and get these numbers *measured* instead of estimated; the estimate is still worth writing down, because the gap between it and the measurement is its own lesson.) If you built `summarize_patient`, compare its cost to `list_conditions` — they can differ by 100×. A tool server where every tool looks free until the invoice arrives is the norm in this industry; yours now has per-tool price tags, which puts you ahead of most production teams.

### Common mistakes

- **A new tool that returns real names.** The single most important failure to catch. The two existing tools scrub every name they emit; your new one has to as well, or it breaks the front-office contract for the whole channel. Your proof sequence's step 3 exists to catch exactly this.
- **A tool whose *job* is a named chart.** `get_patient`-shaped tools don't belong on this door — obscuring the name while dumping the full identified record is theater. If the tool's purpose can't survive pseudonymization, it's a clinician-channel tool, not an MCP tool.
- **Using the deprecated `server.tool`.** The API here is `registerTool(name, { description, inputSchema }, handler)`. Copy the shape of the existing two; don't reintroduce the old signature.
- **A demo of the happy path only.** If your proof has no obscuring check and no malformed call, you proved the tool runs, not that it's *safe* and *robust*. The obscuring check is the deliverable.

## Your turn

This *is* the your-turn: the tool, the checklist, the four-step proof sequence with captured output, and the cost figure. Spend **no more than 30 minutes** on tool choice — the value is in steps 2–4, not in tool novelty.

## Check yourself

- You add a tool that returns clinical-note text. What's your obscuring responsibility, and where does it live in the code?
- Why is "a client can discover and call it" a stronger proof than "the function returns the right data when I call it directly"?

<details>
<summary>Solution / discussion</summary>

**The note-text tool:** your responsibility is that no PII leaves in the text — the patient label obscured to a pseudonym (`obscureName`), *and* raw identifiers inside the note body (names, SSNs, phones) handled the way the existing formatters do. It lives in the tool's return path, right before you build the `text` string — the same place `search_patients` runs its whole rendered result through `obscureContent` and the notes formatter runs each label through `obscureName`. Obscuring is a property of what you *emit*, so it belongs at the emission point, not scattered through the query.

**Discovery as proof:** calling your function directly tests *your* code in *your* process, with your assumptions. `tools/list` + `tools/call` tests the actual contract a foreign client consumes — that the schema is well-formed, the description is legible to a model you don't control, the return shape is `{ content: [...] }`, and the transport carries it cleanly. Plenty of tools "work" when you call the function and fail when a client discovers them (bad schema, wrong return shape, a stray stdout write). The client round-trip is the only test that exercises the thing that's actually shipped.

**On the cost figure:** typical findings — `list_conditions` ≈ one SQL query, effectively free; `query_notes` ≈ one embedding call, fractions of a cent; `summarize_patient` ≈ retrieval + a full LLM completion over a rendered chart, 10–100× the others. The habit being built: **a tool's price tag is part of its spec.** You'll formalize this instinct in the final block's gates.

</details>

## Deliverable 🎥

Record **2–3 minutes**, phone camera is fine. Pick one:

- **Defend the design:** Your new tool — why this tool, what it returns, how it stays non-identifying (which names it obscures and where), and what one call costs. The demo must show a client **discovering and calling it** (`tools/list` then a `tools/call`) and the returned text carrying **pseudonyms, never a real name** — not just the source code.
- **Teach back:** Explain to a non-engineer why the MCP server can safely answer "how many patients have diabetes?" for any assistant that connects, but the clinician's chat app can't be left open the same way — and how the front-office channel's design makes that difference structural.

**Grade against one question:** *does the demo show a client calling the tool and getting back obscured, non-PII text?* Source code that returns the right data proves the function works; it does not prove the tool honors the channel. The obscured client round-trip is the deliverable.

**Submit:** [Typeform — submission](https://form.typeform.com/to/PLACEHOLDER-W3) <!-- PLACEHOLDER: replace with real Typeform URL -->

## Further reading (optional)

- [modelcontextprotocol.io — security best practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices) — reread after building; note how much of "secure MCP" reduces to *be deliberate about what your tools can return*
