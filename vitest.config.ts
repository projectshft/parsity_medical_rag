import { defineConfig } from 'vitest/config';
import * as path from 'path';

// `yarn test` runs everything, including the evals (real model calls, they cost
// money). The evals talk to a server: vitest.global-setup.ts starts one if needed.
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
    exclude: ['node_modules', '.next'],
    fileParallelism: false, // parallel files + shared server/DB made the evals time out
    reporters: ['verbose'], // every test + its time, and console output
    setupFiles: ['dotenv/config'],
    globalSetup: ['./vitest.global-setup.ts'],
  },
});
