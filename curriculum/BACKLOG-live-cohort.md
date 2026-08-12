# Backlog: reconciling the curriculum with the live cohort

**Status: in progress. Started 2026-08-11.** Update the table every time you finish an item.

## What this is

Brian ran the 5-week course live and the full transcript of four sessions
(vectorize/Pinecone → retrieval+reranking → agent pipeline+scheduling → MCP +
capstone kickoff) was analysed against the written curriculum on this branch.

The written curriculum is content-complete, so this is **not** a "write the
missing lessons" backlog. It's a list of the places where **what Brian actually
taught diverges from what's written down** — things he covered live that no
lesson carries, and things the live session revealed are wrong or missing.

Every item below is traceable to something that happened in a real session.

## Ground rules for anyone picking this up

1. **Read `AUTHORING.md` first.** Its authoring rules (voice, no time estimates,
   no week numbers in day files, real commands only, solutions in `<details>`,
   verified links only) are binding. `w1-01-what-rag-is.md` is the voice exemplar.
2. **Work on the `instructor` branch.** `curriculum/` lives here and here only —
   never sync it to `main` or `student`.
3. **Code changes are different from content changes.** Anything touching
   `package.json`, `lib/`, or `mcp-server/` has to land on all three branches
   (`main`, `student`, `instructor`) per the branch model in `AUTHORING.md`.
   Content stays on `instructor`.
4. **Commit locally; Brian reviews before push.**

## Items

| # | Item | Type | Files | Status |
|---|---|---|---|---|
| 1 | Own-project capstone + data sourcing | content (new) | `homework-capstone-project.md` | ✅ drafted — needs review |
| 2 | Teach few-shot routing in the selector lesson | content (edit) | `w2-04-selector.md` | ⬜ |
| 3 | MCP break-fix: the three failures that ate the live session | content (edit) + code | `w4-02-wiring-mcp.md`, `package.json` ×3 branches | ⬜ |
| 4 | Wire the new homework into the README index | content (edit) | `README.md` | ⬜ blocked on #1 review |
| 5 | Link registry + status table upkeep | content (edit) | `AUTHORING.md` | ⬜ |

---

### 1. Own-project capstone + data sourcing ✅ drafted

**The divergence.** `w5-04-wrap-up.md` defines the capstone as *"ship one
extension to the medical system you already have."* Live, Brian ran a completely
different capstone: **build your own RAG system, on your own data, plan doc
first.** He spent the last half of the final session on it — data sourcing tools,
a five-section plan-doc spec, scope discipline, and the non-negotiables
(observability + evals). None of that was written down anywhere.

**Done:** `curriculum/homework-capstone-project.md` — framed as the *second
capstone track* alongside `w5-04`, not a replacement. Covers: find data before
choosing the idea; the four sourcing routes (own data / scraping / transcripts /
published datasets); Firecrawl, Crawl4AI, yt-dlp; scope discipline ("minimally
usable product"); the five-section plan doc; the paste-into-Claude test;
observability + evals as the floor; auth last and hosted; the written artifacts
delegating to `w5-04`.

**Still needs:**
- Brian's review — particularly whether the two-track framing is right, or whether
  the own-project capstone should *replace* the extend-this-system one.
- The three external links are WebFetch-verified (2026-08-11) but not yet in
  `AUTHORING.md`'s link registry → that's item #5.
- No `## Deliverable 🎥` Typeform placeholder was added, because homework docs use
  a plain `## The video` section (matching `homework-bible-chunking.md`). Confirm
  that's right — if the capstone needs a submission link, it needs the
  `PLACEHOLDER-DAYNN` treatment.

---

### 2. Teach few-shot routing in the selector lesson ⬜

**The divergence.** Live, the single change that most improved Brian's selector
was a **few-shot examples array** — question + expected structured output, ~2 per
routing category — injected into the system prompt. He called it out explicitly
as cheaper than fine-tuning and the right home for edge cases ("just add another
example of something you got wrong").

`lib/agents/selector.ts` **already ships this as a commented-out scaffold**: a
`FEW_SHOT` array typed to `PlanOutput`, with 11 worked examples across five
categories (`sql | rag | hybrid | calendar | clarify`). The code is there. The
lesson never mentions it.

`w2-04-selector.md` currently says only *"If a route is wrong, the fix is a
sentence in the system prompt, not code"* — which is the weaker half of the
technique and contradicts the scaffold sitting in the file students open.

**To do.** Add a section to `w2-04-selector.md` (after the existing routing/fix
guidance, before "Your turn"):
- What few-shot prompting is, contrasted with zero-shot — one short paragraph.
- Why examples beat more prose in the system prompt for *routing* specifically:
  the failure is a classification error, and a labelled example is a
  classification correction.
- Point at the real `FEW_SHOT` array in `lib/agents/selector.ts` by path. Note the
  typing trick — `output` is typed to `PlanOutput`, so a malformed example fails
  to compile rather than silently teaching the model a bad shape.
- The discipline: ~2 per category; when the array gets big, that's a signal the
  categories are wrong, not that you need more examples.
- Fold into "Your turn": uncomment the array, add one example from a misroute you
  personally hit, re-run `npm run test:selector`, report the before/after. That
  makes it a **no-metric-no-decision** exercise instead of a vibes edit.

**Acceptance:** a student who reads the lesson knows why the commented block is
there and has a measured before/after from editing it.

**Also mention (briefly):** the same technique appears in the RAG path — Brian
used few-shot examples to teach a small model to extract metadata filters
(`"black patients"` → `race: "Black or African American"`) before the vector
search. One sentence and a forward-vague reference is enough; don't build a
second lesson.

---

### 3. MCP break-fix: the three failures that ate the live session ⬜

**The divergence.** `w4-02-wiring-mcp.md` has a good debugging section — absolute
paths, stdout pollution, restart-to-reload, missing env. Live, **none of those
were the problem.** Roughly 45 minutes of class time went to three failures the
lesson doesn't name, and most students never got the server running:

1. **`Unknown file extension ".ts"`** — Node 22/24 handles TypeScript differently
   than Node 20. Students on 24 were dead in the water until they `nvm use 20`.
2. **The `.js` extension on SDK imports.** `@modelcontextprotocol/sdk/server/mcp.js`
   — dropping `.js` because "it's a TypeScript file" breaks module resolution.
   Several students did exactly this. (The repo's `mcp-server/index.ts` now carries
   a header comment explaining it; the lesson doesn't.)
3. **MCP Inspector transport.** The inspector defaults to a transport that doesn't
   match a stdio server; students sat on a connect screen that never connected
   until they picked **STDIO**. Compounded by needing every env var re-entered in
   the inspector UI.

Two smaller ones worth a line: the dotenv startup banner writing to **stdout**
(which *is* the JSON-RPC stream — already fixed in-repo with `quiet: true`, worth
naming as the canonical example of the stdout rule the lesson already teaches),
and a **hardcoded Pinecone index name** that 404'd for anyone whose index was
named differently.

**The lazy fix comes first — it deletes most of the documentation.** Add two npm
scripts so nobody types the invocation:

```json
"mcp": "npx ts-node mcp-server/index.ts",
"mcp:inspect": "npx @modelcontextprotocol/inspector npx ts-node mcp-server/index.ts"
```

No new dependency — `ts-node` is already a dep and the inspector runs via `npx`.
`tsconfig.json` already carries the `ts-node` CommonJS + `transpileOnly` block
(commit `1da2fde`), so this invocation is the one that works.

**Must land on all three branches** (`main`, `student`, `instructor`) — it's
`package.json`, not content.

**Then** update `w4-02-wiring-mcp.md`:
- Replace the raw `npx @modelcontextprotocol/inspector ...` invocation with
  `npm run mcp:inspect`.
- Add a **"Node version"** line: this needs Node 20; check with `node -v`.
- Add the `.js`-on-SDK-imports gotcha to Common mistakes with the one-line reason
  (the SDK's package exports resolve `./*` verbatim — nothing appends the
  extension).
- Add "pick **STDIO** in the inspector" — it's the first screen and the first
  place people stall.
- Point the stdout-pollution warning at the real example: dotenv's banner, and
  why `config({ quiet: true })` is in `mcp-server/index.ts`.

**Acceptance:** a student on a fresh machine gets from clone to a connected
inspector using only commands printed in the lesson, without a Node downgrade
surprise.

**Instructor note to add to `INSTRUCTOR-NOTES.md`:** budget real time for this
segment, verify Node versions *before* the session, and have the
`npm run mcp:inspect` fallback ready for anyone without Claude Desktop (it's a
paid-desktop-app dependency, and several students didn't have it).

---

### 4. Wire the new homework into the README index ⬜

Blocked on #1's review outcome (two tracks vs. replacement).

`README.md`'s Week 5 block currently ends at `w5-04-wrap-up.md`. Add the capstone
homework with the `📝` marker, matching how `homework-bible-chunking.md` and
`homework-poisoned-docs.md` are listed. If Brian wants the own-project version to
be the *default* capstone, `w5-04`'s framing needs a corresponding edit — don't
leave two docs both claiming to be "the capstone."

---

### 5. Link registry + status table upkeep ⬜

Add to `AUTHORING.md`'s verified link registry (all three WebFetch-verified
2026-08-11):

| Link | Use on |
|---|---|
| https://www.firecrawl.dev/ — scrape-to-markdown, 1k pages/mo free | capstone homework |
| https://github.com/unclecode/crawl4ai — open-source (Apache 2.0) equivalent | capstone homework |
| https://github.com/yt-dlp/yt-dlp — transcripts via `--write-auto-subs` | capstone homework |

Add a decisions-log entry recording the live-cohort reconciliation and the
two-capstone-tracks decision (once Brian rules on it).

---

## Explicitly considered and rejected

Keeping these written down so nobody re-derives them:

- **A separate "data sourcing" lesson.** Folded into the capstone homework
  instead. It exists only to serve the capstone; a standalone lesson would be a
  file students read once and never act on.
- **Documenting the live MCP debugging blow-by-blow.** Two npm scripts delete
  most of the failure surface. Document what the scripts can't fix (Node version,
  `.js` imports, inspector transport), not the full transcript of the incident.
- **A voice-AI (Retell) lesson.** Brian ran it as an explicitly optional bonus
  session outside the core five weeks, and `scripts/retell/` + the
  `retell:deploy` npm script already exist. Not core curriculum; leave it.
- **Re-teaching temperature / model selection.** Already covered across
  `w2-03`, `w2-04`, `w3-01`, `w5-03`. The live session's coverage added nothing new.
- **A lesson on the GPT-4 8K context failure.** Brian hit it live (large patient
  note sets silently failing until he switched to `gpt-4o`) and it's a good war
  story, but it's a one-line instructor note, not content.
