import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: path.resolve(__dirname, 'demo'),
  resolve: {
    alias: {
      '@ornery/ui-grid': path.resolve(__dirname, '../../dist/ui-grid/fesm2022/ornery-ui-grid.mjs'),
    },
  },
  optimizeDeps: {
    exclude: ['@ornery/ui-grid'],
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