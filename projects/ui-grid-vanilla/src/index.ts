import { defineUiGridElement, registerRustWasmGridEngine } from '@ornery/ui-grid';
import type { BuildGridPipelineContext, GridOptions, PipelineResult } from '@ornery/ui-grid';

export type { GridOptions, UiGridApi } from '@ornery/ui-grid';
export { defineUiGridElement } from '@ornery/ui-grid';

export interface UiGridRustWebModule {
  default(input?: unknown): Promise<unknown>;
  build_pipeline_js(context: BuildGridPipelineContext): PipelineResult;
}

export type VanillaUiGridElement = HTMLElement & {
  options: GridOptions;
};

export async function registerVanillaUiGridRustModule(
  module: UiGridRustWebModule,
  input?: unknown,
): Promise<void> {
  await module.default(input);
  registerRustWasmGridEngine({
    buildPipeline(context: BuildGridPipelineContext): PipelineResult {
      return module.build_pipeline_js(context);
    },
  });
}

export async function mountVanillaUiGrid(
  target: Element,
  options: GridOptions,
  rustModule?: UiGridRustWebModule,
  tagName = 'ui-grid-element',
): Promise<VanillaUiGridElement> {
  if (rustModule) {
    await registerVanillaUiGridRustModule(rustModule);
  }

  await defineUiGridElement(tagName);

  const grid = document.createElement(tagName) as VanillaUiGridElement;
  grid.options = options;
  target.replaceChildren(grid);
  return grid;
}