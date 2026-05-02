import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: path.resolve(__dirname, 'demo'),
  resolve: {
    alias: {
      '@ornery/ui-grid-core': path.resolve(__dirname, '../ui-grid-core/src/index.ts'),
    },
  },
  optimizeDeps: {
    exclude: ['@ornery/ui-grid-core'],
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, '..'), path.resolve(__dirname, '../..')],
    },
  },
  test: {
    dir: path.resolve(__dirname, 'src'),
    environment: 'jsdom',
  },
});
