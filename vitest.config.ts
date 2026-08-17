import { defineConfig } from 'vitest/config';
import * as path from 'path';

// LLM-as-judge evals hit the real OpenAI API — excluded from the default
// unit run. Use `npm run test:evals` to run them (loads .env).
const runEvals = !!process.env.RUN_EVALS;
// e2e hits the real pipeline end to end (OpenAI + Pinecone + Postgres).
// `npm run test:e2e`; add E2E_LIVE_BOOKING=1 to also book + place a phone call.
const runE2e = !!process.env.RUN_E2E;

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
    exclude: [
      'node_modules',
      '.next',
      ...(runEvals ? [] : ['lib/evals/**']),
      ...(runE2e ? [] : ['e2e/**']),
    ],
    ...(runEvals || runE2e ? { setupFiles: ['dotenv/config'] } : {}),
  },
});
