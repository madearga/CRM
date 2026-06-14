import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'convex/__tests__/**/*.test.ts',
      'apps/mobile/src/**/*.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@crm/domain': path.resolve(__dirname, 'packages/domain/src/index.ts'),
      '@crm/auth': path.resolve(__dirname, 'packages/auth/src/index.ts'),
      '@crm/config': path.resolve(__dirname, 'packages/config/src/index.ts'),
    },
  },
});
