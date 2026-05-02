import type { BuildGridPipelineContext, PipelineResult } from '@ornery/ui-grid-core';
import { registerRustWasmGridEngine } from '@ornery/ui-grid-core';

const uiGridWasmModulePath = '../../../dist/ui-grid-wasm-web/ui_grid_wasm.js';
const uiGridWasmBinaryPath = '/dist/ui-grid-wasm-web/ui_grid_wasm_bg.wasm';

type UiGridWasmModule = {
  build_pipeline_js(context: unknown): PipelineResult;
};

export function registerReactUiGridWasmEngineFromModule(module: UiGridWasmModule): void {
  registerRustWasmGridEngine({
    buildPipeline(context: BuildGridPipelineContext): PipelineResult {
      return module.build_pipeline_js(context);
    },
  });
}

export async function enableReactUiGridWasmEngine(): Promise<void> {
  const module = await import(/* @vite-ignore */ uiGridWasmModulePath);
  await module.default(uiGridWasmBinaryPath);
  registerReactUiGridWasmEngineFromModule(module);
}
