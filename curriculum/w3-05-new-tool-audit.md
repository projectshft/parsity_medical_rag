# Build: A New Tool, with an Audit Trail

**Needs: the secured MCP server; the traced pipeline**

## Today you will

- Design and ship a new MCP tool, end to end: spec → scopes → implementation → audit → proof
- Make the audit trail answer real questions — the third security layer, now load-bearing
- Record this block's deliverable video

This is a **build**. The training wheels from the earlier MCP lessons are off: you make every decision yourself — what the tool does, what it requires, what it logs, and how you *prove* all three.

## Concept

Inventory of what this block assembled: your system is now **infrastructure** — tools other AIs call (MCP), with identity and least privilege (keys + scopes), a flight recorder (tracing), and one human-gated write path (scheduling). Today's build forces it all to work *together*, because that's where gaps hide: a new tool is only as secured as the wrapper you remember to apply, and only as accountable as the entries it writes.

The audit half deserves design thought before code. Logging *that* a tool ran is trivial; an audit trail is designed backwards from **questions someone will one day ask under pressure**:

- *Who accessed patient X's records last month?* → entries need key identity + which patients each call touched
- *What did the key we just revoked actually do while it was live?* → entries queryable by key, with timestamps
- *Is anyone hitting permission denials repeatedly?* → denials are entries too — failed access is the most interesting access
- *Did we serve PII, and to whom?* → entries record the scope under which results went out

The provided `mcp-server/audit.ts` has the machinery: structured entries, `redactSensitiveFields`, a `withAudit` wrapper, a `logSecurityEvent` for denials, even `withAuthAndAudit` composing the layers. Machinery isn't a trail — the design is choosing entry contents so those four questions have answers.

## Implementation

### 1. Pick your tool

Use the sixth-tool spec you wrote on the wiring lesson if you have one. Otherwise, candidates in rough order of ambition:

- `list_conditions` — distinct conditions with patient counts (analytics; `read` scope)
- `compare_lab_across_patients` — one lab, several patients, values side by side (the brute-force gap many found on the wiring lesson; `read` or `read_pii`? — *a real decision: are lab values attached to patient ids PII?*)
- `summarize_patient` — narrative summary via your own LLM call *inside* the tool (`read_pii`, and now the costliest tool on the server — relevant below)

### 2. Ship it like it's real

The checklist is the lesson — each item exists because skipping it bit someone:

1. **Spec first**: name, description-as-prompt (the colleague test applies), zod params with `.describe()` on everything
2. **Scope decision, written down**: which scopes and one sentence why — then added to `TOOL_SCOPES` in `auth.ts`
3. **Implementation** behind the same auth + audit pattern as the existing tools — if you built `withAuthAndAudit` during the challenge, this is one wrapper call; *feel* the payoff of structural security
4. **Audit entries** that can answer the four questions for this tool
5. **Tracing** if the tool makes LLM or retrieval calls — the flight recorder doesn't skip new aircraft

### 3. Prove it — the adversarial demo

Don't show it working; show it **refusing, recording, and recovering**. Run this sequence and capture the output of each step:

1. `tools/list` shows the new tool, schema intact
2. A correctly-scoped key (`MCP_ADMIN_KEY`, or whatever the tool requires) calls it successfully → an audit entry exists in `logs/mcp-audit-<date>.jsonl` with key identity, params (redacted where sensitive), and result summary
3. An *under*-scoped key (`MCP_API_KEY`, read + read_pii) is denied cleanly → the denial is readable by the calling model, **and the denial is in the log**
4. A malformed call (bad param types) errors without crashing the server
5. The log file answers question #1 ("who touched patient X today?") with a one-liner:
   ```bash
   jq -c 'select(.success==false)' logs/mcp-audit-$(date +%F).jsonl
   ```
   `grep`/`jq` is fine; the point is the entry *contains* the answer.

### 4. Close the loop on cost

One question, answered with the trace data you now have: **what does one call to your new tool cost?** Count the LLM calls in its trace (embedding calls count), estimate tokens in/out, and write the per-call figure in your notes. If you built `summarize_patient`, compare its cost to `list_conditions` — they can differ by 100×. A tool server where every tool looks free until the invoice arrives is the norm in this industry; yours now has per-tool price tags, which puts you ahead of most production teams.

### Common mistakes

- **Auth added, audit forgotten (or vice versa).** They're separate layers and it's easy to wire one. The adversarial demo catches this: step 3 requires *both* (a denial that's denied but not logged fails the demo).
- **Audit entries that summarize too aggressively.** `"called compare_lab"` can't answer "who touched patient X" — the patient ids belong in the entry. But the *lab values* might not (that's serving PII into a log file). Redaction is a per-field decision, and `redactSensitiveFields` is a starting point, not an exemption from thinking.
- **A demo of the happy path.** If your proof sequence has no denial and no malformed call, you proved the tool runs, not that it's secured. The refusals are the deliverable.
- **Scope inflation by convenience.** "I'll just require `read` so testing is easier" — and now lab values flow to analytics keys forever, because nobody revisits scope decisions. The one-sentence-why in writing is the antidote: future-you can re-litigate a decision that has a recorded rationale.

## Your turn

This *is* the your-turn: the tool, the checklist, the five-step adversarial demo with captured output, and the cost figure. Spend **no more than 30 minutes** on tool choice — the value is in steps 2–4, not in tool novelty.

## Check yourself

- Your audit log shows a burst of denials from one key at 2am. Walk through what you can determine from the entries alone, and what you'd do next.
- Why is "denials are logged" arguably more important than "successes are logged"?

<details>
<summary>Solution / discussion</summary>

**The 2am burst:** from entries alone you can read *which key* (identity → which client/team it was issued to), *which tools* it tried (denied scope reveals what it was reaching for), *the parameters* it attempted (redacted, but shapes — e.g., sequential patient ids — tell you if it's enumeration), and *the cadence* (human-paced or scripted). Next moves, in order: revoke or suspend the key (cheap, reversible — the HITL grid applies to incident response too), then contact the key's owner — a compromised client and a curious teammate look identical in logs, and only one of them is an incident.

**Denials over successes:** successes mostly tell you the system worked as designed; denials tell you someone wanted what they couldn't have — misconfiguration, confusion, or attack, but never noise. A trail that only records successes is a diary; one that records refusals is a tripwire. (Both matter: the *who touched patient X* question is answered by successes. The four questions need both halves.)

**On the cost figure:** typical findings — `list_conditions` ≈ one SQL query, effectively free; `query_notes` ≈ one embedding call, fractions of a cent; `summarize_patient` ≈ retrieval + a full LLM completion over a rendered chart, 10–100× the others. The habit being built: **a tool's price tag is part of its spec**, same as its scopes. You'll formalize this instinct in the final block's gates.

</details>

## Deliverable 🎥

Record **2–3 minutes**, phone camera is fine. Pick one:

- **Defend the design:** Your new tool — why this tool, why these scopes, what its audit entry contains and what it deliberately omits, and what one call costs. Name the alternative scope decision you rejected. The demo must show it **refusing, recording, and recovering** — an under-scoped key denied cleanly *and* that denial visible in `logs/mcp-audit-*.jsonl` — not just working.
- **Teach back:** Explain to a non-engineer why "the AI can book appointments" required a confirmation card, but "the AI can search records" didn't — and how the same reversibility/cost logic decides which future features need a human gate.

**Grade against one question:** *does the demo show a refusal that is both denied **and** logged?* A happy-path demo proves the tool runs; it does not prove the tool is secured. The denial is the deliverable.

**Submit:** [Typeform — submission](https://form.typeform.com/to/PLACEHOLDER-W3) <!-- PLACEHOLDER: replace with real Typeform URL -->

## Further reading (optional)

- [modelcontextprotocol.io — security best practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices) — reread after building; note which practices your server now actually implements
</content>
