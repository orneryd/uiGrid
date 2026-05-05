import { afterEach, describe, expect, it } from 'vitest';
import type { GridColumnDef, GridOptions, GridRecord } from '@ornery/ui-grid-core';

import { defineUiGridElement } from './ui-grid.element';

type UiGridElementHandle = HTMLElement & {
  options: GridOptions;
  columnDefs: readonly GridColumnDef[];
  data: readonly GridRecord[];
};

let elementCounter = 0;

async function waitFor<T>(predicate: () => T | null | undefined, timeoutMs = 3000): Promise<T> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const value = predicate();
    if (value) {
      return value;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  throw new Error('Timed out waiting for expected value');
}

function nextTagName(): string {
  elementCounter += 1;
  return `ui-grid-element-attr-spec-${elementCounter}`;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('defineUiGridElement', () => {
  it('renders from the declarative attribute surface', async () => {
    const tagName = nextTagName();
    await defineUiGridElement(tagName);

    const grid = document.createElement(tagName) as UiGridElementHandle;
    grid.setAttribute('grid-id', 'declarative-grid');
    grid.setAttribute('title', 'Team Roster');
    grid.setAttribute('enable-sorting', '');
    grid.setAttribute('enable-filtering', '');
    grid.setAttribute('viewport-height', '420');
    grid.setAttribute(
      'column-defs',
      JSON.stringify([{ name: 'name' }, { name: 'role' } satisfies GridColumnDef]),
    );
    grid.setAttribute(
      'data',
      JSON.stringify([{ name: 'Alice', role: 'Engineer' } satisfies GridRecord]),
    );

    document.body.appendChild(grid);

    const shadowRoot = await waitFor(() => grid.shadowRoot);
    await waitFor(() => shadowRoot.textContent?.includes('Alice') ? true : null);

    expect(grid.options.id).toBe('declarative-grid');
    expect(grid.options.enableSorting).toBe(true);
    expect(grid.options.enableFiltering).toBe(true);
    expect(grid.options.viewportHeight).toBe(420);
    expect(shadowRoot.textContent).toContain('Alice');
    expect(shadowRoot.textContent).toContain('Engineer');
  });

  it('lets mirrored JS properties override declarative attributes', async () => {
    const tagName = nextTagName();
    await defineUiGridElement(tagName);

    const grid = document.createElement(tagName) as UiGridElementHandle;
    grid.setAttribute('column-defs', JSON.stringify([{ name: 'name' } satisfies GridColumnDef]));
    grid.setAttribute('data', JSON.stringify([{ name: 'Alice' } satisfies GridRecord]));
    document.body.appendChild(grid);

    await waitFor(() => grid.shadowRoot?.querySelector('.ui-grid-header'));

    grid.data = [{ name: 'Bob' } satisfies GridRecord];

    await waitFor(() => grid.shadowRoot?.textContent?.includes('Bob') ? true : null);

    expect(grid.options.data).toEqual([{ name: 'Bob' }]);
    expect(grid.shadowRoot?.textContent).toContain('Bob');
    expect(grid.shadowRoot?.textContent).not.toContain('Alice');
  });
});