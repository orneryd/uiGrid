import { registerRustWasmGridEngine } from '@ornery/ui-grid-core';
import type { BuildGridPipelineContext, GridOptions, PipelineResult } from '@ornery/ui-grid-core';

import {
  defineStandaloneUiGridElement,
  type VanillaUiGridElement,
} from './ui-grid-standalone.element';
export {
  createVanillaGridController,
  type GridControllerSnapshot,
  type GridSaveState,
  type VanillaGridController,
} from './grid-controller';
export {
  defineStandaloneUiGridElement,
  UiGridStandaloneElement,
  type VanillaUiGridElement,
  type UiGridControlIconKey,
  type UiGridIconDefinition,
  type UiGridIconOverrides,
} from './ui-grid-standalone.element';

export { UIGridTemplate } from './components/grid-template';
export type { GridOptions, UiGridApi } from '@ornery/ui-grid-core';

export interface UiGridRustWebModule {
  default(input?: unknown): Promise<unknown>;
  build_pipeline_js(context: BuildGridPipelineContext): PipelineResult;
}

export { defineStandaloneUiGridElement as defineUiGridElement };

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

  await defineStandaloneUiGridElement(tagName);

  const grid = document.createElement(tagName) as VanillaUiGridElement;
  grid.options = options;
  target.replaceChildren(grid);
  return grid;
}
