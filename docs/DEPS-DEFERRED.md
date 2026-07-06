# Deferred dependency majors

Snapshot: after the safe update (uuid 11→14, dotenv 16→17, lockfile/security
refresh), these **major** upgrades were held back because they need code
changes and/or real verification and the live class is the priority. Do them
between cohorts, not the week of a session. Each is `current → latest`.

| Package | Current | Latest | Risk | What it needs |
|---|---|---|---|---|
| `zod` | 3.25 | 4.x | High | Breaking API; the Responses-API pattern in CLAUDE.md + every schema is zod 3. Migrate with the zod v4 codemod, re-test structured outputs. |
| `ai` | 4.3 | 6.x | High | `streamText`/multi-agent pipeline (`lib/agent.ts`) changed across v5/v6. Pairs with `@ai-sdk/openai`. |
| `@ai-sdk/openai` | 1.3 | 3.x | High | Must move in lockstep with `ai`. |
| `openai` | 4.10 | 6.x | High | CLAUDE.md mandates `responses.parse()` + `zodTextFormat`; verify those still hold on v6. |
| `next` | 15.1 | 16.x | High | App Router majors; check middleware, route handlers, `app/page.tsx`. |
| `tailwindcss` | 3.4 | 4.x | High | Config format fully rewritten (CSS-first). Migrate `tailwind.config.ts` + globals. |
| `prisma` + `@prisma/client` | 6.19 | 7.x | Med-High | Move both together; regenerate client; re-run against Neon. |
| `vitest` | 2.1 | 4.x | Med | Config/API changes; the 120-test suite is the gate. |
| `typescript` | 5.9 | 6.x | Med | New strictness may surface type errors across the repo. |
| `cohere-ai` | 7.21 | 8.x | Med | **Breaks `lib/reranker.ts`**: `CohereClient` → `CohereClientV2`, `.rerank(...)` shape changed. Rewrite the reranker call. |
| `react-markdown` | 9.1 | 10.x | Low-Med | Used in `app/page.tsx` (currently WIP). Verify component props after Brian's page work lands. |
| `@neondatabase/serverless` | 0.10 | 1.1 | Low | No direct imports (transitive). Bump when touching the DB driver path. |
| `@types/node` | 20 | 26 | Skip | Keep matched to the Node runtime (currently v20). Do **not** jump to 26 while running Node 20. |

## Recommended order when you do tackle them
1. `typescript` 6 + `vitest` 4 (tooling; surfaces everything else).
2. `prisma` 7 (regenerate, verify reads against the read-only Neon).
3. `cohere-ai` 8 (isolated, one-file fix in `lib/reranker.ts`).
4. `zod` 4 (codemod, then re-verify structured outputs).
5. `openai` 6 + `ai` 6 + `@ai-sdk/openai` 3 (the LLM stack, together).
6. `next` 16 + `tailwind` 4 (the app shell; do after `app/page.tsx` WIP lands).

Gate after each step: `npx tsc --noEmit` and `npm run test:run` (120 tests).
