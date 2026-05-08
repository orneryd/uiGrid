import { defineConfig } from 'tsup';
import { scssInlineEsbuild } from './scss-plugin';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  tsconfig: './tsconfig.json',
  esbuildPlugins: [scssInlineEsbuild()],
});
