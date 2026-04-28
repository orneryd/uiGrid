import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      '@ornery/ui-grid': path.resolve(__dirname, '../../ui-grid/src/public-api.react.ts'),
    },
  },
});
