import type { BuildGridPipelineContext, PipelineResult } from './grid.core';
import { registerRustWasmGridEngine } from './ui-grid.engine';

const uiGridWasmModulePath = '../../../../../dist/ui-grid-wasm-web/ui_grid_wasm.js';
const uiGridWasmBinaryPath = '/dist/ui-grid-wasm-web/ui_grid_wasm_bg.wasm';

type UiGridWasmModule = {
  build_pipeline_js(context: unknown): PipelineResult;
};

export function registerUiGridWasmEngineFromModule(module: UiGridWasmModule): void {
  registerRustWasmGridEngine({
    buildPipeline(context: BuildGridPipelineContext): PipelineResult {
      return module.build_pipeline_js(context);
    }
  });
}

export async function enableUiGridWasmEngine(): Promise<void> {
  const module = await import(/* @vite-ignore */ uiGridWasmModulePath);
  await module.default(uiGridWasmBinaryPath);
  registerUiGridWasmEngineFromModule(module);
}