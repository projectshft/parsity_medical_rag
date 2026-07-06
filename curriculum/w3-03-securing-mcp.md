# Securing MCP: The Front-Office Channel

**Needs: the connected MCP server from the wiring lesson**

## Today you will

- Confront what you shipped: a patient database exposed to whoever connects
- See why the answer here isn't a permission system — it's a *channel* built to be safe to expose
- Read the two things that make it safe: a deliberately narrow tool set, and always-on PII obscuring
- Prove it — connect, call every tool, and confirm no real name ever comes back

## Concept

End of the wiring lesson: *every conversation in that client can now reach your patient data.* That's the right thing to be uneasy about — an MCP server is a door, and you just propped it open for any assistant that launches it. The instinct from most security courses is to reach for a permission system: identities, roles, per-tool scopes, a login. Hold that instinct. There's a cheaper, sturdier answer when the data behind the door has two very different audiences.

Think about who actually asks these questions in a clinic. A **clinician** looking at their own patient needs the full chart — real name, real dates, everything. **Front-office staff** — scheduling, intake, "how many diabetics are due for a follow-up" — need to *do their job* without ever seeing protected health information. Same system, two audiences, two very different needs. This course serves them through **two separate channels**, and which channel you came through decides what you see:

| Channel | Who it's for | What it shows |
|---|---|---|
| **The chat / query app** (`app/`) | Clinicians | Full data — real names, real birth dates |
| **The MCP server** (`mcp-server/index.ts`) | Front-office staff & their AI assistants | **Non-PII only** — pseudonyms, no patient-detail lookups |

This is **channel-based access**, and it's a genuinely different idea from role-based access. There's no login on the MCP server, no session, no "what is this caller allowed to do?" check per tool. The MCP door is *the front-office door* — and it's safe to leave open to any assistant because **everything on the other side of it is already non-identifying**. You don't gate a room that has nothing sensitive in it; you make sure nothing sensitive is in it.

Two design decisions make that true, and both already live in `mcp-server/index.ts`:

1. **A deliberately narrow tool set.** The server exposes exactly three tools — `search_patients`, `query_notes`, `list_patients_by_condition` — all of which answer *front-office* questions. There is no `get_patient`, no `find_patient_by_name`, no patient-detail lookup at all. The tools that *could* return a full identified chart simply aren't on this door. (They were, in an earlier draft. Removing them was the security decision.)
2. **Always-on PII obscuring.** Every response is run through the obscuring layer before it leaves — real names become stable pseudonyms (`Patient-A7B3`), no exceptions, no flag to turn it off. Front-office channel, front-office data.

> **Why not just add scopes and a login?** Because a permission system is a *runtime promise* — it works only as long as every tool remembers to check, every key is scoped right, and nobody fat-fingers a config. A channel that *cannot* return PII in the first place makes no promise it can break. This is the security engineer's preferred move whenever it's available: don't guard the sensitive thing, *remove* the sensitive thing from this path. (Real identified data isn't gone — it lives on the clinician channel, which is a different problem, gated by *who the person is*. That's the final block.)

## Implementation

Nothing to build here — this lesson is about *reading the design and confirming it holds*. Open `mcp-server/index.ts` and trace the two guarantees.

### 1. Confirm the tool set

Count the `registerTool` calls. There are three, and only three:

```typescript
server.registerTool('search_patients', { /* ... */ }, async ({ query, limit }) => { /* ... */ });
server.registerTool('query_notes',     { /* ... */ }, async ({ query, patientId, topK }) => { /* ... */ });
server.registerTool('list_patients_by_condition', { /* ... */ }, async ({ condition, limit }) => { /* ... */ });
```

Each answers a front-office question — *find matching patients*, *search the notes semantically*, *count/list who has a condition*. None of them takes "give me everything about this one named person" as a job. That absence **is** the access-control decision: the most sensitive query shape isn't denied, it's *not offered*.

### 2. Confirm the obscuring

Every tool's return path obscures before it returns. Look at how `search_patients` renders results — the `true` is load-bearing:

```typescript
const result = await executeQuery(query, { sqlLimit: limit });
// Front-office channel — always obscure PII in the rendered results.
const formatted = formatResultsForLLM(result, true);
```

…and how the condition list and the notes formatter each run names through `obscureName` before building their text:

```typescript
const name = obscureName(fullName(patient));   // real name → Patient-A7B3
```

There's no parameter, env var, or code path that turns this off. Compare with the clinician channel, where `formatResultsForLLM(result, false)` returns the real thing. Same helper, opposite argument — the channel is the difference.

### 3. (Optional) A single shared key

If your deployment wants *any* gate at all on the door — not to protect PII (there is none to protect), but just to keep anonymous strangers off your compute — the right tool is **one shared key**, not a scope system. A caller either presents the string or it doesn't; that's the whole check. It's coarse on purpose: there's nothing behind this door that needs finer-grained authorization, so building a per-tool permission matrix would be effort spent guarding a room you already emptied.

For this course the door stays open — the point to internalize is *why that's acceptable here and wouldn't be on the clinician channel*.

### Common mistakes

- **Reaching for scopes because "medical data needs RBAC."** It does — on the channel that shows real data. On a channel that *can only emit pseudonyms*, a per-tool permission system is guarding an empty room. Match the control to what's actually behind the door.
- **Adding a tool that leaks the abstraction.** The narrow tool set is the wall. The day you add `get_patient` "just for convenience," this channel stops being non-PII and the whole design collapses — obscuring a name but returning an SSN in the note body is the same failure. New tools on this door inherit the contract: non-PII shaped, obscured output. (That's the next lesson.)
- **Turning obscuring off "just to test."** The `false` argument belongs to the clinician channel only. A single `formatResultsForLLM(result, false)` slipped into an MCP tool quietly turns the front-office door into a PII leak with no error to catch it.
- **Confusing "no login" with "no security."** No login is a *choice that follows from the design*: there's no PII to protect, so there's no one to authenticate against. Security here is structural (what the channel can emit), not procedural (who's allowed to ask).

## Your turn

Spend **no more than 30 minutes** here.

1. Connect the server (client or inspector) and call all three tools. For each, confirm the returned text contains **pseudonyms, never a real name** — `search_patients` on a common name, `list_patients_by_condition` on a household condition, `query_notes` on a symptom. If any real name slips through, you found a bug; write down which tool and which code path let it out.
2. In your notes: the wiring lesson ended with "every conversation in that client can now reach your patient data — write that sentence down." Revisit it. What was actually alarming about it, and which of the two design decisions above defuses it? (Be precise: it's not that access is *denied* — it's that what's reachable was made *non-identifying*.)
3. One sentence each: name a question a clinician needs answered that this MCP channel deliberately *can't* answer, and explain why that's the design working, not a gap.

## Check yourself

- Explain channel-based access vs role-based access to a teammate in two sentences. When is each the right tool?
- A teammate says "let's add `get_patient` to the MCP server, it's read-only so it's safe." Walk through why read-only isn't the property that matters here.

<details>
<summary>Solution / discussion</summary>

**Channel vs role, in two sentences:** role-based access asks *who are you, and what may you do?* — a runtime check on every request against an identity. Channel-based access puts different data behind different doors and lets *which door you used* decide what you see, so there's nothing to check per-request because the sensitive data was never on this path. Reach for channels when your audiences split cleanly (front-office vs clinician) and one of them needs *nothing* sensitive; reach for roles when the same door must serve people with genuinely different entitlements to the *same* data.

**"Read-only so it's safe":** read-only means it doesn't *write* — it says nothing about *what it reads out*. `get_patient` is read-only and would hand a foreign model a fully identified chart, real name and dates included. The property that keeps this channel safe isn't read-vs-write, it's identifying-vs-not. A read-only tool that returns PII breaks the front-office contract exactly as badly as a write would break something else. The wall is *the tool set plus obscuring*, and `get_patient` is on the wrong side of both.

**On the still-open problem:** the real identified data still exists — clinicians need it. It just lives on the *other* channel, the chat/query app, which returns `formatResultsForLLM(result, false)`. Protecting *that* door isn't a channel problem (you can't make a clinician's tool non-identifying — that's its whole job); it's an *identity* problem: is the person at the keyboard actually a clinician? That's access control for *people*, and it's the final block. Two channels, two kinds of control — and you've now built the easy one on purpose.

</details>

## Further reading (optional)

- `lib/pii.ts` — the obscuring layer every MCP response passes through; `obscureName` is the one to read first
- [modelcontextprotocol.io — security best practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices) — the protocol's own guidance; note how much of "secure an MCP server" is really "be deliberate about what your tools can return"
</content>
</invoke>
