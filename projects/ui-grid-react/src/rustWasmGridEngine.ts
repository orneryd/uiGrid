import type { BuildGridPipelineContext, PipelineResult } from '@ornery/ui-grid';
import { registerRustWasmGridEngine } from '@ornery/ui-grid';

const uiGridWasmModulePath = '../../../dist/ui-grid-wasm/ui_grid_wasm.js';

type UiGridWasmModule = {
  build_pipeline_js(context: unknown): PipelineResult;
};

export function registerReactUiGridWasmEngineFromModule(module: UiGridWasmModule): void {
  registerRustWasmGridEngine({
    buildPipeline(context: BuildGridPipelineContext): PipelineResult {
      return module.build_pipeline_js(context);
    }
  });
}

export async function enableReactUiGridWasmEngine(): Promise<void> {
  const module = await import(/* @vite-ignore */ uiGridWasmModulePath);
  registerReactUiGridWasmEngineFromModule(module);
}