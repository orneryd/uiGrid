import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@ornery/ui-grid-core': path.resolve(__dirname, 'src/index.ts'),
    },
  },
  test: {
    dir: path.resolve(__dirname, 'src'),
    environment: 'node',
    globals: true,
  },
});
