import { defineConfig } from 'vitest/config';
import * as path from 'path';

// LLM-as-judge evals hit a real provider (Jev/TypeSafe, via the proxy) —
// excluded from the default unit run because they cost money. Use
// `npm run test:evals` to run them (loads .env). The judge's pure mapping logic
// is tested for free in `lib/judge-contract.test.ts`, outside this folder.
const runEvals = !!process.env.RUN_EVALS;

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', '.next', ...(runEvals ? [] : ['lib/evals/**'])],
    ...(runEvals ? { setupFiles: ['dotenv/config'] } : {}),
  },
});
