import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@ornery/ui-grid': path.resolve(__dirname, '../ui-grid/src/public-api.react.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
