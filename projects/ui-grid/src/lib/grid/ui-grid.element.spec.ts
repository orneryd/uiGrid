import { afterEach, describe, expect, it } from 'vitest';
import type { GridColumnDef, GridOptions, GridRecord } from '@ornery/ui-grid-core';

import { __testables__ } from './ui-grid.element';

const { buildDeclarativeAttributeOptions, createDeclarativeUiGridElement } = __testables__;

/**
 * Behavioral coverage of the declarative attribute surface.
 *
 * We deliberately do not exercise the full Angular custom-element pipeline
 * here. jsdom's synchronous custom-element creation/upgrade reactions are
 * incompatible with Angular Elements' `NgElementImpl` constructor flow on
 * GitHub Actions runners (we have observed both `_ceState` and "Invalid
 * custom element constructor return value" exceptions in CI even though the
 * same code paths succeed in real browsers and locally). The grid-rendering
 * behavior is already covered end-to-end by the Playwright browser harness
 * tests; here we only need to verify the declarative-surface logic itself
 * against a synthetic stub that mimics Angular's expected shape.
 */

interface StubElement extends HTMLElement {
  options: GridOptions;
  optionsHistory: GridOptions[];
  baseConnectedCalls: number;
  baseAttributeChangedCalls: Array<[string, string | null, string | null]>;
  data: readonly GridRecord[];
  columnDefs: readonly GridColumnDef[];
}

let elementCounter = 0;

function nextTagName(prefix = 'ui-grid-stub'): string {
  elementCounter += 1;
  return `${prefix}-${elementCounter}`;
}

/**
 * Builds a stub element constructor that mimics the parts of Angular's
 * NgElementImpl shape that `createDeclarativeUiGridElement` depends on:
 * an `options` getter/setter pair on the prototype, a static
 * `observedAttributes` array, and `connectedCallback` /
 * `attributeChangedCallback` hooks. No Angular involvement.
 */
function buildStubBase(): CustomElementConstructor {
  class StubBase extends HTMLElement {
    static get observedAttributes(): string[] {
      return ['base-attr'];
    }

    private _options: GridOptions = { id: 'stub', data: [], columnDefs: [] };

    constructor() {
      super();
      Object.defineProperty(this, 'optionsHistory', { value: [], writable: true });
      Object.defineProperty(this, 'baseConnectedCalls', { value: 0, writable: true });
      Object.defineProperty(this, 'baseAttributeChangedCalls', { value: [], writable: true });
    }

    get options(): GridOptions {
      return this._options;
    }

    set options(value: GridOptions) {
      this._options = value;
      (this as unknown as StubElement).optionsHistory.push(value);
    }

    connectedCallback(): void {
      const self = this as unknown as StubElement;
      self.baseConnectedCalls += 1;
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
      const self = this as unknown as StubElement;
      self.baseAttributeChangedCalls.push([name, oldValue, newValue]);
    }
  }

  return StubBase as unknown as CustomElementConstructor;
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('buildDeclarativeAttributeOptions', () => {
  it('parses string, number, boolean, and json declarative attributes from an element', () => {
    const element = document.createElement('div');
    element.setAttribute('grid-id', 'declarative-grid');
    element.setAttribute('title', 'Team Roster');
    element.setAttribute('row-height', '420');
    element.setAttribute('enable-sorting', '');
    element.setAttribute(
      'column-defs',
      JSON.stringify([{ name: 'name' }, { name: 'role' }]),
    );
    element.setAttribute(
      'data',
      JSON.stringify([{ name: 'Alice', role: 'Engineer' }]),
    );

    const options = buildDeclarativeAttributeOptions(element);

    expect(options.id).toBe('declarative-grid');
    expect(options.title).toBe('Team Roster');
    expect(options.rowHeight).toBe(420);
    expect(options.enableSorting).toBe(true);
    expect(options.columnDefs).toEqual([
      { name: 'name' } satisfies GridColumnDef,
      { name: 'role' } satisfies GridColumnDef,
    ]);
    expect(options.data).toEqual([{ name: 'Alice', role: 'Engineer' } satisfies GridRecord]);
  });

  it('omits attributes that are absent or unparsable', () => {
    const element = document.createElement('div');
    element.setAttribute('row-height', 'not-a-number');
    element.setAttribute('column-defs', '{not json');

    const options = buildDeclarativeAttributeOptions(element);

    expect(options.rowHeight).toBeUndefined();
    expect(options.columnDefs).toBeUndefined();
    expect(options.id).toBeUndefined();
  });
});

describe('createDeclarativeUiGridElement', () => {
  it('rebuilds options from declarative attributes when the element connects', async () => {
    const tagName = nextTagName();
    const Base = buildStubBase();
    const Wrapped = createDeclarativeUiGridElement(
      Base as unknown as Parameters<typeof createDeclarativeUiGridElement>[0],
    );

    customElements.define(tagName, Wrapped as unknown as CustomElementConstructor);

    const grid = document.createElement(tagName) as StubElement;
    grid.setAttribute('grid-id', 'declarative-grid');
    grid.setAttribute('title', 'Team Roster');
    grid.setAttribute('enable-sorting', '');
    grid.setAttribute('row-height', '420');
    grid.setAttribute(
      'column-defs',
      JSON.stringify([{ name: 'name' } satisfies GridColumnDef]),
    );
    grid.setAttribute('data', JSON.stringify([{ name: 'Alice' } satisfies GridRecord]));

    document.body.appendChild(grid);
    await flushMicrotasks();

    expect(grid.options.id).toBe('declarative-grid');
    expect(grid.options.title).toBe('Team Roster');
    expect(grid.options.enableSorting).toBe(true);
    expect(grid.options.rowHeight).toBe(420);
    expect(grid.options.data).toEqual([{ name: 'Alice' }]);
    expect(grid.optionsHistory.length).toBeGreaterThan(0);
    expect(grid.baseConnectedCalls).toBe(1);
  });

  it('lets mirrored JS properties override declarative attributes', async () => {
    const tagName = nextTagName();
    const Base = buildStubBase();
    const Wrapped = createDeclarativeUiGridElement(
      Base as unknown as Parameters<typeof createDeclarativeUiGridElement>[0],
    );

    customElements.define(tagName, Wrapped as unknown as CustomElementConstructor);

    const grid = document.createElement(tagName) as StubElement;
    grid.setAttribute(
      'column-defs',
      JSON.stringify([{ name: 'name' } satisfies GridColumnDef]),
    );
    grid.setAttribute('data', JSON.stringify([{ name: 'Alice' } satisfies GridRecord]));

    document.body.appendChild(grid);
    await flushMicrotasks();

    grid.data = [{ name: 'Bob' } satisfies GridRecord];

    expect(grid.options.data).toEqual([{ name: 'Bob' }]);
    expect(grid.data).toEqual([{ name: 'Bob' }]);
    expect(grid.options.columnDefs).toEqual([{ name: 'name' }]);
  });

  it('forwards observed base attributes to the underlying attributeChangedCallback', async () => {
    const tagName = nextTagName();
    const Base = buildStubBase();
    const Wrapped = createDeclarativeUiGridElement(
      Base as unknown as Parameters<typeof createDeclarativeUiGridElement>[0],
    );

    customElements.define(tagName, Wrapped as unknown as CustomElementConstructor);

    const grid = document.createElement(tagName) as StubElement;
    document.body.appendChild(grid);
    grid.setAttribute('base-attr', 'forwarded');

    expect(grid.baseAttributeChangedCalls.some(([name]) => name === 'base-attr')).toBe(true);
  });
});
