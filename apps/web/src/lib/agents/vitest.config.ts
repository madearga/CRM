/**
 * The test configuration of the agent library.
 *
 * The root configuration of the repository only picks up the tests of
 * Convex, and the configuration of the web app only picks up the tests of
 * `src/__tests__`. This configuration runs the tests of this folder, so
 * they can be run with:
 *
 *     pnpm exec vitest run --config apps/web/src/lib/agents/vitest.config.ts
 *
 * It changes nothing else. The root test run stays as it is.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
  },
});
