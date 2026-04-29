import '@angular/compiler';

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  activeGridEngineBackend,
  clearRustWasmGridEngine,
} from '../../../dist/ui-grid/fesm2022/ornery-ui-grid.mjs';
import {
  mountVanillaUiGrid,
  registerVanillaUiGridRustModule,
  type GridOptions,
  type UiGridApi,
} from './index';
import * as uiGridRustWebModule from '../../../dist/ui-grid-wasm-web/ui_grid_wasm.js';

function keyDown(el: HTMLElement, init: KeyboardEventInit): KeyboardEvent {
  const evt = el.ownerDocument.createEvent('KeyboardEvent');
  evt.initEvent('keydown', init.bubbles ?? false, init.cancelable ?? false);
  Object.defineProperties(evt, {
    key: { get: () => init.key ?? '' },
    shiftKey: { get: () => init.shiftKey ?? false },
    ctrlKey: { get: () => init.ctrlKey ?? false },
    altKey: { get: () => init.altKey ?? false },
    metaKey: { get: () => init.metaKey ?? false },
  });
  return evt as KeyboardEvent;
}

function inputEvent(el: HTMLElement): Event {
  const evt = el.ownerDocument.createEvent('Event');
  evt.initEvent('input', false, false);
  return evt;
}

async function waitFor<T>(resolve: () => T | null | undefined, timeoutMs = 10000): Promise<T> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = resolve();
    if (value) {
      return value;
    }

    await new Promise((resolveNext) => window.setTimeout(resolveNext, 20));
  }

  throw new Error('Timed out waiting for expected element state');
}

describe('mountVanillaUiGrid integration', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  afterEach(() => {
    clearRustWasmGridEngine();
    document.body.innerHTML = '';
  });

  it('runs keyboard edit flow through the registered Rust/WASM engine', async () => {
    let gridApi: UiGridApi | undefined;
    const target = document.getElementById('app');
    if (!target) {
      throw new Error('Expected test root element');
    }

    const options: GridOptions = {
      id: 'vanilla-rust-keyboard-grid',
      enableGrouping: false,
      enableCellEdit: true,
      enableCellEditOnFocus: true,
      virtualizationThreshold: 99,
      data: [
        {
          id: 'row-1',
          name: 'Gamma',
          status: 'Pilot',
          account: { owner: 'Mina Patel' },
        },
        {
          id: 'row-2',
          name: 'Beta',
          status: 'Active',
          account: { owner: 'Jordan Silva' },
        },
      ],
      columnDefs: [
        { name: 'name', displayName: 'Customer', enableCellEdit: true },
        { name: 'status' },
        { name: 'owner', field: 'account.owner', enableCellEdit: true },
      ],
      onRegisterApi: (api) => {
        gridApi = api as UiGridApi;
      },
    };

    const beginCellEdit = vi.fn();
    const afterCellEdit = vi.fn();
    const cancelCellEdit = vi.fn();

    const wasmPath = resolve(process.cwd(), '../../dist/ui-grid-wasm-web/ui_grid_wasm_bg.wasm');
    const wasmBytes = await readFile(wasmPath);
    await registerVanillaUiGridRustModule(uiGridRustWebModule, { module_or_path: wasmBytes });

    expect(activeGridEngineBackend()).toBe('rust-wasm');

    const grid = await mountVanillaUiGrid(
      target,
      options,
      undefined,
      'ui-grid-element-vanilla-rust-test',
    );

    await waitFor(() => gridApi);
    gridApi!.edit.on.beginCellEdit(beginCellEdit);
    gridApi!.edit.on.afterCellEdit(afterCellEdit);
    gridApi!.edit.on.cancelCellEdit(cancelCellEdit);

    const firstRenderedRowId = await waitFor(() => gridApi!.core.getVisibleRows()[0]?.id);

    const shadowRoot = await waitFor(() => grid.shadowRoot);
    const firstNameCell = await waitFor(() =>
      shadowRoot.querySelector(`.body-cell[data-row-id="${firstRenderedRowId}"][data-col-name="name"]`) as HTMLElement | null,
    );

    firstNameCell.focus();
    firstNameCell.dispatchEvent(keyDown(firstNameCell, { key: 'Z' }));

    let editor = await waitFor(() =>
      shadowRoot.querySelector(`.cell-editor[data-row-id="${firstRenderedRowId}"][data-col-name="name"]`) as HTMLInputElement | null,
    );
    expect(editor.value).toBe('Z');
    expect(beginCellEdit).toHaveBeenCalled();

    editor.dispatchEvent(keyDown(editor, { key: 'Tab' }));

    expect(options.data[0]?.name).toBe('Z');
    expect(afterCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'row-1', name: 'Z' }),
      expect.objectContaining({ name: 'name' }),
      'Z',
      'Gamma',
    );

    const statusCell = await waitFor(() =>
      shadowRoot.querySelector(`.body-cell[data-row-id="${firstRenderedRowId}"][data-col-name="status"]`) as HTMLElement | null,
    );
    expect(shadowRoot.activeElement).toBe(statusCell);

    statusCell.dispatchEvent(keyDown(statusCell, { key: 'Tab' }));

    editor = await waitFor(() =>
      shadowRoot.querySelector(`.cell-editor[data-row-id="${firstRenderedRowId}"][data-col-name="owner"]`) as HTMLInputElement | null,
    );
    expect(editor.value).toBe('Mina Patel');

    editor.value = 'Taylor Morgan';
    editor.dispatchEvent(inputEvent(editor));
    editor.dispatchEvent(keyDown(editor, { key: 'Escape' }));

    expect(options.data[0]?.account).toEqual({ owner: 'Mina Patel' });
    expect(cancelCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'row-1', name: 'Z' }),
      expect.objectContaining({ name: 'owner' }),
    );
  }, 15000);
});