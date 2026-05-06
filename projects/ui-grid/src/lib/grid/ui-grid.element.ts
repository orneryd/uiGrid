import { createCustomElement } from '@angular/elements';
import { createApplication } from '@angular/platform-browser';

import type { GridColumnDef, GridOptions, GridRecord } from '@ornery/ui-grid-core';
import { enableUiGridWasmEngine } from '@ornery/ui-grid-core';
import { UiGridComponent } from './ui-grid.component';

const elementDefinitions = new Map<string, Promise<void>>();

type DeclarativeSurfaceKind = 'string' | 'number' | 'boolean' | 'json';

interface DeclarativeSurfaceEntry {
  readonly attribute: string;
  readonly property: string;
  readonly optionKey: keyof GridOptions;
  readonly kind: DeclarativeSurfaceKind;
  readonly defaultValue?: unknown;
}

type UiGridElementConstructor = {
  new (): HTMLElement;
  readonly observedAttributes?: string[];
};

type DeclarativeUiGridElement = HTMLElement & {
  options: GridOptions;
  connectedCallback?(): void;
  attributeChangedCallback?(name: string, oldValue: string | null, newValue: string | null): void;
  __uiGridAttributeSyncScheduled__?: boolean;
  __uiGridAttributeOptions__?: Partial<GridOptions>;
  __uiGridPropertyOptions__?: Partial<GridOptions>;
  setPropertyOption?(key: keyof GridOptions, value: unknown): void;
};

const declarativeSurface: readonly DeclarativeSurfaceEntry[] = [
  { attribute: 'grid-id', property: 'gridId', optionKey: 'id', kind: 'string' },
  { attribute: 'title', property: 'title', optionKey: 'title', kind: 'string' },
  { attribute: 'row-height', property: 'rowHeight', optionKey: 'rowHeight', kind: 'number' },
  {
    attribute: 'header-row-height',
    property: 'headerRowHeight',
    optionKey: 'headerRowHeight',
    kind: 'number',
  },
  {
    attribute: 'viewport-height',
    property: 'viewportHeight',
    optionKey: 'viewportHeight',
    kind: 'number',
  },
  {
    attribute: 'pagination-page-size',
    property: 'paginationPageSize',
    optionKey: 'paginationPageSize',
    kind: 'number',
  },
  {
    attribute: 'pagination-current-page',
    property: 'paginationCurrentPage',
    optionKey: 'paginationCurrentPage',
    kind: 'number',
  },
  { attribute: 'total-items', property: 'totalItems', optionKey: 'totalItems', kind: 'number' },
  {
    attribute: 'virtualization-threshold',
    property: 'virtualizationThreshold',
    optionKey: 'virtualizationThreshold',
    kind: 'number',
  },
  {
    attribute: 'tree-children-field',
    property: 'treeChildrenField',
    optionKey: 'treeChildrenField',
    kind: 'string',
  },
  { attribute: 'tree-indent', property: 'treeIndent', optionKey: 'treeIndent', kind: 'number' },
  {
    attribute: 'expandable-row-height',
    property: 'expandableRowHeight',
    optionKey: 'expandableRowHeight',
    kind: 'number',
  },
  {
    attribute: 'expandable-row-header-width',
    property: 'expandableRowHeaderWidth',
    optionKey: 'expandableRowHeaderWidth',
    kind: 'number',
  },
  {
    attribute: 'empty-message',
    property: 'emptyMessage',
    optionKey: 'emptyMessage',
    kind: 'string',
  },
  {
    attribute: 'infinite-scroll-rows-from-end',
    property: 'infiniteScrollRowsFromEnd',
    optionKey: 'infiniteScrollRowsFromEnd',
    kind: 'number',
  },
  { attribute: 'column-defs', property: 'columnDefs', optionKey: 'columnDefs', kind: 'json' },
  { attribute: 'data', property: 'data', optionKey: 'data', kind: 'json' },
  { attribute: 'grouping', property: 'grouping', optionKey: 'grouping', kind: 'json' },
  {
    attribute: 'pagination-page-sizes',
    property: 'paginationPageSizes',
    optionKey: 'paginationPageSizes',
    kind: 'json',
  },
  {
    attribute: 'enable-sorting',
    property: 'enableSorting',
    optionKey: 'enableSorting',
    kind: 'boolean',
    defaultValue: true,
  },
  {
    attribute: 'enable-filtering',
    property: 'enableFiltering',
    optionKey: 'enableFiltering',
    kind: 'boolean',
    defaultValue: true,
  },
  {
    attribute: 'enable-grouping',
    property: 'enableGrouping',
    optionKey: 'enableGrouping',
    kind: 'boolean',
    defaultValue: true,
  },
  {
    attribute: 'enable-pinning',
    property: 'enablePinning',
    optionKey: 'enablePinning',
    kind: 'boolean',
    defaultValue: true,
  },
  {
    attribute: 'enable-column-moving',
    property: 'enableColumnMoving',
    optionKey: 'enableColumnMoving',
    kind: 'boolean',
    defaultValue: true,
  },
  {
    attribute: 'enable-column-resizing',
    property: 'enableColumnResizing',
    optionKey: 'enableColumnResizing',
    kind: 'boolean',
    defaultValue: true,
  },
  {
    attribute: 'enable-cell-edit',
    property: 'enableCellEdit',
    optionKey: 'enableCellEdit',
    kind: 'boolean',
    defaultValue: false,
  },
  {
    attribute: 'enable-cell-edit-on-focus',
    property: 'enableCellEditOnFocus',
    optionKey: 'enableCellEditOnFocus',
    kind: 'boolean',
    defaultValue: false,
  },
  {
    attribute: 'enable-pagination',
    property: 'enablePagination',
    optionKey: 'enablePagination',
    kind: 'boolean',
    defaultValue: false,
  },
  {
    attribute: 'enable-pagination-controls',
    property: 'enablePaginationControls',
    optionKey: 'enablePaginationControls',
    kind: 'boolean',
    defaultValue: true,
  },
  {
    attribute: 'use-external-pagination',
    property: 'useExternalPagination',
    optionKey: 'useExternalPagination',
    kind: 'boolean',
    defaultValue: false,
  },
  {
    attribute: 'enable-expandable',
    property: 'enableExpandable',
    optionKey: 'enableExpandable',
    kind: 'boolean',
    defaultValue: false,
  },
  {
    attribute: 'enable-tree-view',
    property: 'enableTreeView',
    optionKey: 'enableTreeView',
    kind: 'boolean',
    defaultValue: false,
  },
  {
    attribute: 'show-tree-expand-no-children',
    property: 'showTreeExpandNoChildren',
    optionKey: 'showTreeExpandNoChildren',
    kind: 'boolean',
    defaultValue: false,
  },
  {
    attribute: 'tree-row-header-always-visible',
    property: 'treeRowHeaderAlwaysVisible',
    optionKey: 'treeRowHeaderAlwaysVisible',
    kind: 'boolean',
    defaultValue: false,
  },
  {
    attribute: 'enable-auto-resize',
    property: 'enableAutoResize',
    optionKey: 'enableAutoResize',
    kind: 'boolean',
    defaultValue: false,
  },
  {
    attribute: 'enable-virtualization',
    property: 'enableVirtualization',
    optionKey: 'enableVirtualization',
    kind: 'boolean',
    defaultValue: true,
  },
  {
    attribute: 'infinite-scroll-up',
    property: 'infiniteScrollUp',
    optionKey: 'infiniteScrollUp',
    kind: 'boolean',
    defaultValue: false,
  },
  {
    attribute: 'infinite-scroll-down',
    property: 'infiniteScrollDown',
    optionKey: 'infiniteScrollDown',
    kind: 'boolean',
    defaultValue: false,
  },
] as const;

const defaultRequiredOptions: Pick<GridOptions, 'id' | 'data' | 'columnDefs'> = {
  id: '__ui-grid-pending__',
  data: [],
  columnDefs: [],
};

const observedDeclarativeAttributes = declarativeSurface.map((entry) => entry.attribute);
const observedDeclarativeAttributeSet: ReadonlySet<string> = new Set(observedDeclarativeAttributes);

function parseDeclarativeAttribute(
  element: HTMLElement,
  entry: DeclarativeSurfaceEntry,
): unknown | undefined {
  if (entry.kind === 'boolean') {
    return element.hasAttribute(entry.attribute) ? true : undefined;
  }

  const raw = element.getAttribute(entry.attribute);
  if (raw === null) {
    return undefined;
  }

  if (entry.kind === 'number') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  if (entry.kind === 'json') {
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn(`<ui-grid-element>: invalid JSON in "${entry.attribute}" attribute`, error);
      return undefined;
    }
  }

  return raw;
}

function buildDeclarativeAttributeOptions(element: HTMLElement): Partial<GridOptions> {
  const options: Partial<GridOptions> = {};

  for (const entry of declarativeSurface) {
    const value = parseDeclarativeAttribute(element, entry);
    if (value !== undefined) {
      options[entry.optionKey] = value as never;
    }
  }

  return options;
}

/** @internal Exposed for unit testing the declarative attribute surface. */
export const __testables__ = {
  buildDeclarativeAttributeOptions,
  declarativeSurface,
  observedDeclarativeAttributes,
  createDeclarativeUiGridElement,
};

function createDeclarativeUiGridElement(baseElement: UiGridElementConstructor): UiGridElementConstructor {
  const element = class extends baseElement {};
  const baseOptionsDescriptor = Object.getOwnPropertyDescriptor(baseElement.prototype, 'options');
  const basePrototype = baseElement.prototype as Partial<DeclarativeUiGridElement>;
  const elementPrototype = element.prototype as Partial<DeclarativeUiGridElement>;
  const baseObservedAttributes = [...(baseElement.observedAttributes ?? [])];
  const baseObservedAttributeSet: ReadonlySet<string> = new Set(baseObservedAttributes);
  const originalConnectedCallback = basePrototype.connectedCallback;
  const originalAttributeChangedCallback = basePrototype.attributeChangedCallback;

  if (!baseOptionsDescriptor?.get || !baseOptionsDescriptor?.set) {
    throw new Error('Expected Angular custom element to expose an options property descriptor');
  }

  const baseSetter = baseOptionsDescriptor.set;

  Object.defineProperty(element, 'observedAttributes', {
    configurable: true,
    get() {
      return [...new Set([...baseObservedAttributes, ...observedDeclarativeAttributes])];
    },
  });

  const syncDeclarativeAttributesToOptions = function (this: DeclarativeUiGridElement): void {
    this.__uiGridAttributeOptions__ = buildDeclarativeAttributeOptions(this);
    baseSetter.call(this, {
      ...defaultRequiredOptions,
      ...(this.__uiGridAttributeOptions__ ?? {}),
      ...(this.__uiGridPropertyOptions__ ?? {}),
    } satisfies GridOptions);
  };

  elementPrototype.connectedCallback = function (this: DeclarativeUiGridElement): void {
    originalConnectedCallback?.call(this);
    syncDeclarativeAttributesToOptions.call(this);
  };

  elementPrototype.attributeChangedCallback = function (
    this: DeclarativeUiGridElement,
    name: string,
    oldValue: string | null,
    newValue: string | null,
  ): void {
    if (baseObservedAttributeSet.has(name)) {
      originalAttributeChangedCallback?.call(this, name, oldValue, newValue);
    }
    if (!observedDeclarativeAttributeSet.has(name)) {
      return;
    }

    if (!this.__uiGridAttributeSyncScheduled__) {
      this.__uiGridAttributeSyncScheduled__ = true;
      queueMicrotask(() => {
        this.__uiGridAttributeSyncScheduled__ = false;
        syncDeclarativeAttributesToOptions.call(this);
      });
    }
  };

  Object.defineProperty(element.prototype, 'options', {
    configurable: true,
    enumerable: false,
    get(this: DeclarativeUiGridElement): GridOptions {
      return {
        ...defaultRequiredOptions,
        ...(this.__uiGridAttributeOptions__ ?? {}),
        ...(this.__uiGridPropertyOptions__ ?? {}),
      };
    },
    set(this: DeclarativeUiGridElement, value: GridOptions) {
      this.__uiGridPropertyOptions__ = value ?? {};
      baseSetter.call(this, {
        ...defaultRequiredOptions,
        ...(this.__uiGridAttributeOptions__ ?? {}),
        ...(this.__uiGridPropertyOptions__ ?? {}),
      } satisfies GridOptions);
    },
  });

  elementPrototype.setPropertyOption = function (this: DeclarativeUiGridElement, key: keyof GridOptions, value: unknown): void {
    this.__uiGridPropertyOptions__ = {
      ...(this.__uiGridPropertyOptions__ ?? {}),
      [key]: value,
    };
    baseSetter.call(this, {
      ...defaultRequiredOptions,
      ...(this.__uiGridAttributeOptions__ ?? {}),
      ...(this.__uiGridPropertyOptions__ ?? {}),
    } satisfies GridOptions);
  };

  for (const entry of declarativeSurface) {
    Object.defineProperty(element.prototype, entry.property, {
      configurable: true,
      enumerable: false,
      get(this: DeclarativeUiGridElement) {
        const currentOptions = this.options;
        const currentValue = currentOptions[entry.optionKey];
        return currentValue ?? entry.defaultValue;
      },
      set(this: DeclarativeUiGridElement, value: unknown) {
        this.setPropertyOption?.(entry.optionKey, value);
      },
    });
  }

  return element;
}

export async function defineUiGridElement(tagName = 'ui-grid-element'): Promise<void> {
  if (customElements.get(tagName)) {
    return;
  }

  const pendingDefinition = elementDefinitions.get(tagName);
  if (pendingDefinition) {
    return pendingDefinition;
  }

  const definition = createApplication().then((application) => {
    const baseElement = createCustomElement(UiGridComponent, {
      injector: application.injector,
    });
    const element = createDeclarativeUiGridElement(baseElement as UiGridElementConstructor);

    if (!customElements.get(tagName)) {
      customElements.define(tagName, element);
    }
  });

  elementDefinitions.set(tagName, definition);

  try {
    await definition;
  } catch (error) {
    elementDefinitions.delete(tagName);
    throw error;
  }
}

export async function defineUiGridRustElement(tagName = 'ui-grid-element'): Promise<void> {
  await enableUiGridWasmEngine();
  await defineUiGridElement(tagName);
}
