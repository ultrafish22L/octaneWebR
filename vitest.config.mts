import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Tests live alongside source in client/src/ and mcp/src/__tests__/
    include: ['client/src/**/*.test.ts', 'mcp/src/__tests__/**/*.test.ts'],
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      // Match the vite root: client/src imports use bare paths
    },
  },
});
