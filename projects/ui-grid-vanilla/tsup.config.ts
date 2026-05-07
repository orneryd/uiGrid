import { defineConfig } from 'tsup';
import webComponents from '@ornery/web-components/esbuild';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  tsconfig: './tsconfig.json',
  esbuildPlugins: [webComponents()],
});
