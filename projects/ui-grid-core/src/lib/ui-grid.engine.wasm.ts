import type { BuildGridPipelineContext, PipelineResult } from './grid.core';
import { registerRustWasmGridEngine } from './ui-grid.engine';

type UiGridWasmModule = {
  build_pipeline_js(context: BuildGridPipelineContext): PipelineResult;
};
const uiGridWasmModulePath = '../../../../dist/ui-grid-wasm/ui_grid_wasm.js';

export function registerUiGridWasmEngineFromModule(module: UiGridWasmModule): void {
  registerRustWasmGridEngine({
    buildPipeline(context: BuildGridPipelineContext): PipelineResult {
      return module.build_pipeline_js(context);
    },
  });
}

export async function enableUiGridWasmEngine(): Promise<void> {
  const module = await import(/* @vite-ignore */ uiGridWasmModulePath);
  registerUiGridWasmEngineFromModule(module);
}
