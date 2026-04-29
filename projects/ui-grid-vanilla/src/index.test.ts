import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@ornery/ui-grid', () => ({
  defineUiGridElement: vi.fn(),
  registerRustWasmGridEngine: vi.fn(),
}));

import { defineUiGridElement, registerRustWasmGridEngine } from '@ornery/ui-grid';
import { mountVanillaUiGrid } from './index';

describe('mountVanillaUiGrid', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    vi.clearAllMocks();
  });

  it('defines the Rust element and mounts it with the provided options', async () => {
    const target = document.getElementById('app');
    if (!target) {
      throw new Error('Expected test root element');
    }

    const options = {
      id: 'vanilla-demo-grid',
      data: [{ name: 'Alice' }],
      columnDefs: [{ name: 'name' }],
    };

    const module = {
      default: vi.fn(async () => undefined),
      build_pipeline_js: vi.fn(),
    };

    const grid = await mountVanillaUiGrid(target, options, module);

    expect(module.default).toHaveBeenCalledTimes(1);
    expect(registerRustWasmGridEngine).toHaveBeenCalledTimes(1);
    expect(defineUiGridElement).toHaveBeenCalledWith('ui-grid-element');
    expect(grid.tagName.toLowerCase()).toBe('ui-grid-element');
    expect(grid.options).toBe(options);
    expect(target.firstElementChild).toBe(grid);
  });
});