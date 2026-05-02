import { beforeEach, describe, expect, it } from 'vitest';
import {
  activeGridEngineBackend,
  clearRustWasmGridEngine,
  defaultGridEngine,
} from '@ornery/ui-grid-core';
import { registerReactUiGridWasmEngineFromModule } from './rustWasmGridEngine';
import { SORT_DIRECTIONS } from '@ornery/ui-grid-core';
import type { BuildGridPipelineContext, PipelineResult } from '@ornery/ui-grid-core';

function createContext(): BuildGridPipelineContext {
  return {
    options: {
      id: 'react-engine-spec',
      data: [
        { id: 'row-1', owner: 'Alice' },
        { id: 'row-2', owner: 'Bob' },
      ],
      columnDefs: [{ name: 'owner' }],
    },
    columns: [{ name: 'owner' }],
    activeFilters: {},
    sortState: { columnName: null, direction: SORT_DIRECTIONS.none },
    groupByColumns: [],
    collapsedGroups: {},
    hiddenRowReasons: {},
    expandedRows: {},
    expandedTreeRows: {},
    currentPage: 1,
    pageSize: 0,
    rowSize: 44,
  };
}

describe('rustWasmGridEngine', () => {
  beforeEach(() => {
    clearRustWasmGridEngine();
  });

  it('registers the real module shape into the shared engine seam', () => {
    const sentinel: PipelineResult = {
      visibleRows: [],
      displayItems: [],
      virtualizationEnabled: true,
      pipelineMs: 0,
      totalItems: 77,
    };

    registerReactUiGridWasmEngineFromModule({
      build_pipeline_js: () => sentinel,
    });

    expect(defaultGridEngine.buildPipeline(createContext())).toBe(sentinel);
    expect(activeGridEngineBackend()).toBe('rust-wasm');
  });
});
