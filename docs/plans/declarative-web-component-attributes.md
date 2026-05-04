# Declarative Web Component Attributes

Goal: let `<ui-grid-element>` accept configuration through standard HTML
attributes so simple grids require zero JavaScript. The existing `options`
property remains the full-power escape hatch for dynamic data and callbacks.

## Motivation

Today, every web component usage requires imperative JavaScript:

```html
<ui-grid-element id="my-grid"></ui-grid-element>

<script type="module">
  import { defineStandaloneUiGridElement } from '@ornery/ui-grid-vanilla';

  await defineStandaloneUiGridElement();

  document.querySelector('#my-grid').options = {
    id: 'demo',
    data: [{ name: 'Alice', role: 'Engineer' }],
    columnDefs: [{ name: 'name' }, { name: 'role' }],
    enableSorting: true,
    enableFiltering: true,
  };
</script>
```

This is fine for app-framework contexts, but web components exist so that HTML
authors can use complex widgets declaratively — the same way `<video controls
autoplay>` works without writing `videoEl.controls = true`. For static sites,
CMS pages, documentation, and low-JS environments, the current API requires
more ceremony than necessary.

The web component specification provides `observedAttributes` and
`attributeChangedCallback` for exactly this purpose.

---

## Desired API Surface

### Tier 1: Boolean feature flags (presence = true, absence = false)

These follow the standard HTML boolean attribute convention. The attribute name
is present to enable, absent to disable — no value needed.

```html
<ui-grid-element
  grid-id="accounts"
  enable-sorting
  enable-filtering
  enable-grouping
  enable-pinning
  enable-column-moving
  enable-cell-edit
  enable-cell-edit-on-focus
  enable-pagination
  enable-pagination-controls
  enable-expandable
  enable-tree-view
  enable-auto-resize
  enable-virtualization>
</ui-grid-element>
```

HTML attribute naming convention: kebab-case, matching the existing CSS custom
property naming (`--ui-grid-*`). The element maps these to the camelCase
`GridOptions` fields internally.

Boolean attribute mapping:

| HTML Attribute               | GridOptions Field           |
|------------------------------|-----------------------------|
| `enable-sorting`             | `enableSorting`             |
| `enable-filtering`           | `enableFiltering`           |
| `enable-grouping`            | `enableGrouping`            |
| `enable-pinning`             | `enablePinning`             |
| `enable-column-moving`       | `enableColumnMoving`        |
| `enable-cell-edit`           | `enableCellEdit`            |
| `enable-cell-edit-on-focus`  | `enableCellEditOnFocus`     |
| `enable-pagination`          | `enablePagination`          |
| `enable-pagination-controls` | `enablePaginationControls`  |
| `enable-expandable`          | `enableExpandable`          |
| `enable-tree-view`           | `enableTreeView`            |
| `enable-auto-resize`         | `enableAutoResize`          |
| `enable-virtualization`      | `enableVirtualization`      |
| `use-external-pagination`    | `useExternalPagination`     |
| `infinite-scroll-up`         | `infiniteScrollUp`          |
| `infinite-scroll-down`       | `infiniteScrollDown`        |
| `show-tree-expand-no-children` | `showTreeExpandNoChildren` |
| `tree-row-header-always-visible` | `treeRowHeaderAlwaysVisible` |

### Tier 2: Scalar attributes (string and number values)

```html
<ui-grid-element
  grid-id="accounts"
  title="Team Roster"
  row-height="48"
  viewport-height="620"
  pagination-page-size="25"
  pagination-current-page="1"
  virtualization-threshold="40"
  tree-children-field="children"
  tree-indent="10"
  expandable-row-height="150"
  expandable-row-header-width="40"
  empty-message="No results found."
  enable-sorting
  enable-filtering>
</ui-grid-element>
```

Scalar attribute mapping:

| HTML Attribute                  | GridOptions Field          | Type     |
|---------------------------------|----------------------------|----------|
| `grid-id`                       | `id`                       | `string` |
| `title`                         | `title`                    | `string` |
| `row-height`                    | `rowHeight`                | `number` |
| `header-row-height`             | `headerRowHeight`          | `number` |
| `viewport-height`               | `viewportHeight`           | `number` |
| `pagination-page-size`          | `paginationPageSize`       | `number` |
| `pagination-current-page`       | `paginationCurrentPage`    | `number` |
| `total-items`                   | `totalItems`               | `number` |
| `virtualization-threshold`      | `virtualizationThreshold`  | `number` |
| `tree-children-field`           | `treeChildrenField`        | `string` |
| `tree-indent`                   | `treeIndent`               | `number` |
| `expandable-row-height`         | `expandableRowHeight`      | `number` |
| `expandable-row-header-width`   | `expandableRowHeaderWidth` | `number` |
| `empty-message`                 | `emptyMessage`             | `string` |
| `infinite-scroll-rows-from-end` | `infiniteScrollRowsFromEnd`| `number` |

### Tier 3: JSON attributes for structured data

`column-defs` and `data` accept inline JSON. This is the established pattern
used by charting libraries, map components, and other data-driven custom
elements.

```html
<ui-grid-element
  grid-id="team-roster"
  enable-sorting
  enable-filtering
  column-defs='[
    { "name": "name" },
    { "name": "role" },
    { "name": "salary", "type": "number", "align": "end" }
  ]'
  data='[
    { "name": "Alice", "role": "Engineer", "salary": 120000 },
    { "name": "Bob", "role": "Designer", "salary": 95000 }
  ]'>
</ui-grid-element>
```

JSON attribute mapping:

| HTML Attribute            | GridOptions Field      | Parsed Type               |
|---------------------------|------------------------|---------------------------|
| `column-defs`             | `columnDefs`           | `GridColumnDef[]`         |
| `data`                    | `data`                 | `GridRecord[]`            |
| `grouping`                | `grouping`             | `GridGroupingOptions`     |
| `pagination-page-sizes`   | `paginationPageSizes`  | `number[] \| null`        |

For `data`, inline JSON is practical for small/medium datasets. For large
datasets (1K+ rows), the JS property path remains the correct approach. This
is the same tradeoff every data-driven custom element makes — `<canvas>` doesn't
accept pixel data as an attribute either.

### Tier 4: Not attribute-compatible (JS property only)

Some `GridOptions` fields cannot be expressed as HTML attributes because they
are functions or complex objects with no JSON representation:

- `onRegisterApi` — callback function
- `rowIdentity` — function
- `cellEditableCondition` — function or boolean
- `expandableRowTemplate` — Angular `TemplateRef`
- `expandableRowScope` — arbitrary object
- `sortingAlgorithm` — function (on `GridColumnDef`)
- `cellRenderer` — function (on `GridColumnDef`)
- `valueGetter` — function (on `GridColumnDef`)
- `cellTemplate` — Angular `TemplateRef` (on `GridColumnDef`)
- `benchmark` — config object with optional iteration count

These remain JS-property-only. Users who need them use the `options` property
or set them individually:

```html
<ui-grid-element
  grid-id="my-grid"
  enable-sorting
  enable-filtering
  column-defs='[{"name":"name"},{"name":"role"}]'>
</ui-grid-element>

<script type="module">
  const grid = document.querySelector('ui-grid-element');
  grid.data = fetchedData;
  grid.onRegisterApi = (api) => { /* ... */ };
</script>
```

---

## Implementation

### `observedAttributes` and `attributeChangedCallback`

The `UiGridStandaloneElement` class adds the standard custom element hooks:

```typescript
export class UiGridStandaloneElement extends HTMLElement {

  static get observedAttributes(): string[] {
    return [
      'grid-id', 'title', 'data', 'column-defs',
      'row-height', 'header-row-height', 'viewport-height',
      'empty-message', 'pagination-page-size', 'pagination-current-page',
      'pagination-page-sizes', 'total-items',
      'virtualization-threshold', 'tree-children-field', 'tree-indent',
      'expandable-row-height', 'expandable-row-header-width',
      'infinite-scroll-rows-from-end', 'grouping',
      // boolean flags
      'enable-sorting', 'enable-filtering', 'enable-grouping',
      'enable-pinning', 'enable-column-moving',
      'enable-cell-edit', 'enable-cell-edit-on-focus',
      'enable-pagination', 'enable-pagination-controls',
      'use-external-pagination',
      'enable-expandable', 'enable-tree-view',
      'show-tree-expand-no-children', 'tree-row-header-always-visible',
      'enable-auto-resize', 'enable-virtualization',
      'infinite-scroll-up', 'infinite-scroll-down',
    ];
  }

  attributeChangedCallback(
    name: string,
    _oldValue: string | null,
    _newValue: string | null,
  ): void {
    this.syncAttributesToOptions();
  }
}
```

### Attribute-to-options merge strategy

A private `syncAttributesToOptions()` method reads all current attributes and
produces a partial `GridOptions` object. This is merged under (not over) any
options set via the JS `options` property — the JS property always wins.

```
effective options = { ...attributeOptions, ...jsPropertyOptions }
```

This means:
- Setting `enable-sorting` on the element and later calling
  `grid.options = { enableSorting: false }` turns sorting off (JS wins).
- Setting `grid.options = { id: 'x', data: [], columnDefs: [] }` and then
  adding `enable-filtering` to the markup enables filtering (attribute fills
  the gap because the JS object didn't set `enableFiltering`).

### Boolean attribute parsing

Follow the HTML spec: a boolean attribute is `true` when present (any value,
including empty string), `false` when absent.

```typescript
private parseBooleanAttribute(name: string): boolean | undefined {
  return this.hasAttribute(name) ? true : undefined;
}
```

Returning `undefined` (not `false`) when absent lets the JS property or
`GridOptions` defaults take precedence. Only explicit presence overrides.

### Number attribute parsing

```typescript
private parseNumberAttribute(name: string): number | undefined {
  const raw = this.getAttribute(name);
  if (raw === null) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}
```

Invalid numbers are silently ignored — the default applies.

### JSON attribute parsing

```typescript
private parseJsonAttribute<T>(name: string): T | undefined {
  const raw = this.getAttribute(name);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    console.warn(`<ui-grid-element>: invalid JSON in "${name}" attribute`);
    return undefined;
  }
}
```

Invalid JSON logs a warning and falls through to defaults. This is consistent
with how other data-driven custom elements handle parse errors.

### Debounced re-render

Multiple attributes changing in rapid succession (e.g. framework binding
multiple attributes on mount) should not trigger multiple re-renders.
`attributeChangedCallback` schedules a microtask-debounced sync:

```typescript
private attributeSyncScheduled = false;

attributeChangedCallback(): void {
  if (!this.attributeSyncScheduled) {
    this.attributeSyncScheduled = true;
    queueMicrotask(() => {
      this.attributeSyncScheduled = false;
      this.syncAttributesToOptions();
    });
  }
}
```

---

## Individual JS Properties

In addition to the bulk `options` property, add individual JS properties that
mirror the attribute names. This gives framework-binding authors the choice of
property binding without constructing a full options object:

```typescript
get gridId(): string { return this.options.id; }
set gridId(value: string) { /* merge into options, re-render */ }

get enableSorting(): boolean { return this.options.enableSorting ?? true; }
set enableSorting(value: boolean) { /* merge into options, re-render */ }

get data(): readonly GridRecord[] { return this.options.data; }
set data(value: readonly GridRecord[]) { /* merge into options, re-render */ }

get columnDefs(): readonly GridColumnDef[] { return this.options.columnDefs; }
set columnDefs(value: readonly GridColumnDef[]) { /* merge, re-render */ }
```

This means all three of these are equivalent:

```javascript
// 1. Bulk options object (existing)
grid.options = { id: 'x', data, columnDefs, enableSorting: true };

// 2. HTML attributes (new)
// <ui-grid-element grid-id="x" enable-sorting column-defs="[...]" />

// 3. Individual JS properties (new)
grid.gridId = 'x';
grid.data = myData;
grid.columnDefs = myColumns;
grid.enableSorting = true;
```

---

## Usage Examples

### Zero-JS static grid

```html
<script type="module" src="ui-grid-vanilla/index.js"></script>

<ui-grid-element
  grid-id="static-demo"
  enable-sorting
  enable-filtering
  column-defs='[{"name":"name"}, {"name":"role"}, {"name":"salary","type":"number","align":"end"}]'
  data='[
    {"name":"Alice","role":"Engineer","salary":120000},
    {"name":"Bob","role":"Designer","salary":95000},
    {"name":"Carol","role":"Manager","salary":130000}
  ]'>
</ui-grid-element>
```

### Hybrid: attributes for config, JS for data

```html
<ui-grid-element
  id="big-grid"
  grid-id="accounts"
  enable-sorting
  enable-filtering
  enable-grouping
  enable-pinning
  row-height="48"
  viewport-height="620"
  column-defs='[
    {"name":"name","displayName":"Customer"},
    {"name":"revenue","type":"number","align":"end"},
    {"name":"status"},
    {"name":"owner","field":"account.owner"}
  ]'>
</ui-grid-element>

<script type="module">
  const grid = document.querySelector('#big-grid');
  grid.data = await fetch('/api/accounts').then(r => r.json());
</script>
```

### With slot templates (existing feature, unchanged)

```html
<ui-grid-element
  grid-id="templated"
  enable-sorting
  enable-expandable
  column-defs='[{"name":"name"},{"name":"status"}]'
  data='[{"name":"Alice","status":"Active"}]'>
  <template slot="cell-status">
    <span class="badge">{{ value }}</span>
  </template>
  <template slot="expandable-row">
    <p>Details for {{ row.name }}</p>
  </template>
</ui-grid-element>
```

### Server-rendered / CMS

```html
<!-- Rendered by a CMS or static site generator -->
<ui-grid-element
  grid-id="pricing-table"
  enable-sorting
  column-defs='${JSON.stringify(columns)}'
  data='${JSON.stringify(rows)}'>
</ui-grid-element>
```

---

## Migration and Compatibility

- **No breaking changes.** The `options` property continues to work exactly as
  it does today. Attributes are purely additive.
- **Attribute priority.** If both the `options` property and attributes are set,
  the `options` property wins for any field it explicitly defines. Attributes
  fill in fields that the property object did not set.
- **Existing slot templates.** Unchanged. `<template slot="cell-*">` and
  `<template slot="expandable-row">` continue to work alongside attributes.
- **Angular-backed element.** The `@ornery/ui-grid` Angular Elements output is
  unaffected. This plan targets `@ornery/ui-grid-vanilla` only. The Angular
  element could adopt the same attribute surface later if desired, but its
  primary consumers use Angular bindings.

---

## Implementation Order

1. **Boolean flags** — highest value, lowest effort. Covers the most common
   request ("I just want to toggle features from markup").
2. **Scalar attributes** — `grid-id`, `row-height`, `viewport-height`, etc.
3. **JSON attributes** — `column-defs`, `data`, `grouping`,
   `pagination-page-sizes`.
4. **Individual JS properties** — mirrors of each attribute as a JS property
   setter for framework interop.
5. **Documentation** — update `docs/web-component.md` and
   `docs/getting-started.md` with declarative usage examples.

---

## Open Questions

1. **`id` vs `grid-id`:** HTML `id` is a global attribute with DOM semantics
   (unique in document, used by `getElementById`). The grid's `id` field is
   used for CSV filenames and state keys. Using `grid-id` avoids collision.
   Confirm this naming.

2. **Attribute removal:** If an attribute is removed after initial render (e.g.
   `grid.removeAttribute('enable-sorting')`), should sorting be disabled? The
   current plan says yes — `syncAttributesToOptions` re-reads all attributes on
   every change. This matches standard HTML behavior (`input.removeAttribute('disabled')`
   re-enables the input).

3. **Reflected properties:** Should setting `grid.enableSorting = true` in JS
   also set the `enable-sorting` attribute on the DOM element? Native elements
   like `<input>` reflect some properties to attributes and not others. For
   simplicity, start with no reflection (JS properties don't set attributes),
   and add reflection later if users request it.

4. **`data` attribute size limit:** Browsers technically support very large
   attribute values, but HTML parsers and developer tools degrade with multi-MB
   attribute strings. Document a practical recommendation (e.g. "use the `data`
   attribute for datasets under 500 rows; use the JS property for larger
   datasets").
