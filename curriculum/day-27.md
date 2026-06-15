# Day 27 — Securing MCP: API Keys and Scopes

**Needs: the connected MCP server from yesterday**

## Today you will

- Confront what you shipped yesterday: a patient database with no front door
- Integrate the provided auth module: API keys, permission scopes, least privilege
- Work through the full challenge in `docs/CHALLENGE-MCP-AUTH.md` — this day is its narrative wrapper

## Concept

End of yesterday's notes: *every conversation in that client can now read your patient database.* Generalize it: **anyone who can launch your MCP server has unrestricted access to every tool.** No identity, no permissions, no record of who asked what. For a demo, fine. For medical data, that's not a missing feature — it's the absence of the *load-bearing wall*.

What "secured" means for a tool server, in three layers:

| Layer | Question it answers | Mechanism |
|---|---|---|
| **Authentication** | Who is calling? | API keys — the caller presents one; the server validates it |
| **Authorization** | What may *this* caller do? | **Scopes** — permissions attached to the key, checked per tool |
| **Audit** | Who did what, when? | A log entry for every tool invocation, allowed or denied |

The interesting design work is in the middle layer. Not every caller deserves every tool. The provided module defines three scopes:

- `read` — basic search; results have PII obscured
- `read_pii` — full patient details, real names and dates
- `admin` — broader access

…and a `TOOL_SCOPES` map declaring what each tool requires. A key with `['read']` can call `search_patients` but gets denied `get_patient`'s full detail. This is **least privilege**: a key for an analytics dashboard shouldn't be able to pull a named chart, and when that key leaks (keys leak), the blast radius is the scope, not the database.

> **Why API keys and not user logins?** Because the caller isn't a person at a keyboard — it's a *process* (Claude Desktop, a script, another service). Machine-to-machine auth uses credentials issued per client, revocable individually. The deeper layers (key hashing — the server stores hashes, never keys, so its own storage can't leak them; constant-time comparison) are already implemented in the module. Today you *integrate*; read the implementation for the ideas, not to retype it.

## Implementation

This day's full spec is **`docs/CHALLENGE-MCP-AUTH.md`** — open it now and work it end to end. The module is provided (`mcp-server/auth.ts`, with a thorough test suite proving its behavior); the integration is yours. The shape of the work:

### 1. Read the module's API

`validateApiKey`, `canAccessTool`, `extractApiKey`, `TOOL_SCOPES` — and run its tests to see the contract in action:

```bash
npx vitest run mcp-server/auth.test.ts
```

Green tests are documentation that can't lie: read the test names top to bottom and you have the module's spec.

### 2. Wire auth into every tool

Each tool body gets a preamble: extract the key (the challenge doc covers where a key travels in an MCP world — an env var the *client's* config provides), validate it, check the tool's required scopes, and refuse cleanly when denied. A denial is a *response*, not a crash — the calling model should receive "this key lacks the read_pii scope," which it can relay to its human.

### 3. Issue keys with different scopes and prove the boundary

Create one key with `['read']` and one with `['read', 'read_pii']`. Connect with each (the `env` block from yesterday — now it carries *your* key instead of raw infrastructure credentials, which is itself the security upgrade). Ask the same question through both. Same system, two callers, two different worlds: that's scopes working.

### 4. Don't skip the audit half

The challenge's audit logging section is where the third layer lands — every invocation recorded with who/what/when, sensitive parameters redacted. You'll go deeper on the audit trail on the build day; today, get entries flowing.

### Common mistakes

- **Auth checks in some tools but not all.** Security added tool-by-tool drifts: the fourth tool you add next month ships without a check. The challenge pushes you toward a wrapper (`withAuth`) so protection is structural — one pattern every tool passes through, impossible to forget.
- **Returning denial as a thrown error.** A throw crashes the call and the client shows a generic failure; the model can't explain it and the human can't fix it. Denials are information: return them as readable text content.
- **Logging the API key.** The audit log records *who* — that's the key's name/hash, never the key itself. A log file with raw keys in it converts your audit trail into a credential dump. (The provided module's redaction list exists for exactly this class of mistake.)
- **Testing only the denied path.** Both-sides discipline, security edition: after wiring auth, verify the *allowed* paths still work with a valid key. An auth layer that denies everyone passes the security review and fails the product.

## Your turn

The challenge doc *is* the your-turn — its Parts are your checklist. Additionally, in your notes:

1. The two-keys experiment from step 3, with the actual responses each key received for the same query.
2. The threat-model question from the challenge, answered in your own words: which of its four scenarios does today's work fully solve, which only partially, and what's still open?
3. One sentence: where did the Postgres/Pinecone credentials live yesterday, where do they live now, and why is that the quiet win of the day?

## Check yourself

- Recite the three layers and what question each answers — without looking.
- A teammate proposes one shared API key "to keep it simple," stored in the team wiki. Walk through what each layer loses.

<details>
<summary>Solution / discussion</summary>

**The shared-key proposal, layer by layer:** Authentication still technically works (the server knows *a* valid key called) — but identity collapses to "someone on the team," so the audit layer now records *who: everyone*, which is *who: no one* the day an incident needs investigating. Authorization collapses too: one key means one scope set, so it's everyone-gets-`read_pii` or nobody does — least privilege is structurally impossible. And revocation becomes a team-wide outage instead of a one-client fix. One key per client isn't ceremony; it's what makes all three layers mean anything. (The wiki part answers itself.)

**The quiet win:** yesterday, every client config held raw `DATABASE_URL` — infrastructure credentials, full access, unrevocable without rotating the database. Today clients hold a scoped, individually-revocable application key, and infrastructure credentials live only where the server runs. The seam still exists — seams always exist — but what pools there is now *designed*: scoped, hashed at rest, auditable, and disposable.

**On the still-open scenario:** the challenge's threat model includes an attacker *enumerating patients through legitimate calls* — auth doesn't stop a valid `read` key from walking the database politely, one query at a time. Rate limiting and anomaly detection live above today's layers. Security work is never "done"; it's "the next cheapest attack now costs more." Write down what the next cheapest attack against your server is — you'll meet one candidate in the final block, arriving through a door nobody guards.

</details>

## Further reading (optional)

- `docs/CHALLENGE-MCP-AUTH.md` — today's actual spec; if you skimmed it, go back
- [modelcontextprotocol.io — security best practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices) — the protocol's own evolving guidance; note how much of it you just implemented
