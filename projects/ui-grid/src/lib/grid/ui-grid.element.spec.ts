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

/**
 * Creates the registered element via the HTML parser instead of
 * `document.createElement`. jsdom's `Document.createElement` takes the
 * synchronous custom-element path, which trips on subclassed Angular
 * Elements constructors with `Cannot read properties of undefined
 * (reading '_ceState')`. The parser path goes through the async upgrade
 * reaction and behaves correctly.
 */
function createRegisteredElement(tagName: string, attributes: Record<string, string> = {}): HTMLElement {
  const host = document.createElement('div');
  const attrMarkup = Object.entries(attributes)
    .map(([name, value]) => `${name}="${String(value).replace(/"/g, '&quot;')}"`)
    .join(' ');
  host.innerHTML = `<${tagName}${attrMarkup ? ' ' + attrMarkup : ''}></${tagName}>`;
  const element = host.firstElementChild as HTMLElement | null;
  if (!element) {
    throw new Error(`Failed to create element <${tagName}>`);
  }
  return element;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('defineUiGridElement', () => {
  it('renders from the declarative attribute surface', async () => {
    const tagName = nextTagName();
    await defineUiGridElement(tagName);

    const grid = createRegisteredElement(tagName, {
      'grid-id': 'declarative-grid',
      title: 'Team Roster',
      'enable-sorting': '',
      'enable-filtering': '',
      'viewport-height': '420',
      'column-defs': JSON.stringify([
        { name: 'name' },
        { name: 'role' } satisfies GridColumnDef,
      ]),
      data: JSON.stringify([{ name: 'Alice', role: 'Engineer' } satisfies GridRecord]),
    }) as UiGridElementHandle;

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

    const grid = createRegisteredElement(tagName, {
      'column-defs': JSON.stringify([{ name: 'name' } satisfies GridColumnDef]),
      data: JSON.stringify([{ name: 'Alice' } satisfies GridRecord]),
    }) as UiGridElementHandle;
    document.body.appendChild(grid);

    await waitFor(() => grid.shadowRoot?.querySelector('.ui-grid-header'));

    grid.data = [{ name: 'Bob' } satisfies GridRecord];

    await waitFor(() => grid.shadowRoot?.textContent?.includes('Bob') ? true : null);

    expect(grid.options.data).toEqual([{ name: 'Bob' }]);
    expect(grid.shadowRoot?.textContent).toContain('Bob');
    expect(grid.shadowRoot?.textContent).not.toContain('Alice');
  });
});