import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@ornery/ui-grid-core': path.resolve(__dirname, '../ui-grid-core/src/index.ts'),
      '@ornery/ui-grid-vanilla': path.resolve(__dirname, '../ui-grid-vanilla/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
