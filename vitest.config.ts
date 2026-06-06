import { defineConfig } from 'vitest/config';
import * as path from 'path';

// LLM-as-judge evals hit the real OpenAI API — excluded from the default
// unit run. Use `npm run test:evals` to run them (loads .env).
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
