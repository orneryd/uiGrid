# Web Component

UI Grid ships **two distinct web component outputs**. Both register a `<ui-grid-element>` custom element and accept the same `GridOptions` API surface, but they differ in runtime dependencies and rendering strategy.

| | Angular-backed (`@ornery/ui-grid`) | Vanilla (`@ornery/ui-grid-vanilla`) |
|---|---|---|
| **Rendering** | Full Angular component via `@angular/elements` | Pure DOM with Shadow DOM, no framework |
| **Runtime deps** | Angular, RxJS, Angular CDK | `@ornery/ui-grid-core` only |
| **Build** | `npm run build:element` | `npm run build:vanilla` |
| **Best for** | Angular apps, full feature parity | Non-Angular apps, static sites, zero-framework setups |
| **Registration** | `defineUiGridElement()` | `defineStandaloneUiGridElement()` |

---

## Angular-backed Custom Element

Wraps the Angular `UiGridComponent` as a custom element using `@angular/elements`. The Angular runtime is bundled into the output.

### Build

```bash
npm run build:element
```

This produces `dist/ui-grid-element/main.js` — a self-contained ES module that includes the Angular runtime.

### Usage

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module" src="ui-grid-element/main.js"></script>
</head>
<body>
  <ui-grid-element id="my-grid"></ui-grid-element>

  <script type="module">
    const grid = document.querySelector('#my-grid');
    grid.options = {
      id: 'angular-element-demo',
      data: [
        { name: 'Alice', role: 'Engineer', salary: 120000 },
        { name: 'Bob', role: 'Designer', salary: 95000 },
      ],
      columnDefs: [
        { name: 'name' },
        { name: 'role' },
        { name: 'salary', type: 'number', align: 'end' },
      ],
    };
  </script>
</body>
</html>
```

### Programmatic Registration

```typescript
import { defineUiGridElement } from '@ornery/ui-grid';

await defineUiGridElement();           // registers <ui-grid-element>
await defineUiGridElement('my-grid');   // or register with a custom tag name
```

To also enable the Rust/WASM pipeline engine:

```typescript
import { defineUiGridRustElement } from '@ornery/ui-grid';

await defineUiGridRustElement(); // inits WASM, then registers <ui-grid-element>
```

---

## Vanilla Custom Element

A framework-free custom element built on `@ornery/ui-grid-core` with pure DOM rendering and Shadow DOM encapsulation. No Angular dependency at all.

### Install

```bash
npm install @ornery/ui-grid-vanilla @ornery/ui-grid-core
```

### Declarative HTML Usage

The vanilla element now supports a declarative attribute surface for the most common setup. Small and medium datasets can be configured directly in markup with zero grid setup JavaScript beyond registration:

```html
<ui-grid-element
  grid-id="vanilla-demo"
  title="Team Roster"
  enable-sorting
  enable-filtering
  viewport-height="420"
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

<script type="module">
  import { defineStandaloneUiGridElement } from '@ornery/ui-grid-vanilla';

  await defineStandaloneUiGridElement(); // registers <ui-grid-element>
</script>
```

Supported declarative inputs include:

- Boolean attributes such as `enable-sorting`, `enable-filtering`, `enable-grouping`, `enable-pinning`, `enable-pagination`, and `enable-virtualization`
- Scalar attributes such as `grid-id`, `title`, `row-height`, `viewport-height`, `pagination-page-size`, and `empty-message`
- JSON attributes such as `column-defs`, `data`, `grouping`, and `pagination-page-sizes`

Use the declarative surface for static pages, docs, CMS-rendered content, and simple embeds. For callbacks like `onRegisterApi` or function-based column logic, use the `options` property.

### JavaScript Property Usage

The vanilla element also exposes individual JS properties that mirror the declarative attributes. This is useful when a framework or host app wants property binding without constructing a full `options` object:

```html
<ui-grid-element id="my-grid"></ui-grid-element>

<script type="module">
  import { defineStandaloneUiGridElement } from '@ornery/ui-grid-vanilla';

  await defineStandaloneUiGridElement();

  const grid = document.querySelector('#my-grid');
  grid.gridId = 'vanilla-props';
  grid.title = 'Team Roster';
  grid.enableSorting = true;
  grid.enableFiltering = true;
  grid.viewportHeight = 420;
  grid.columnDefs = [
    { name: 'name' },
    { name: 'role' },
    { name: 'salary', type: 'number', align: 'end' },
  ];
  grid.data = [
    { name: 'Alice', role: 'Engineer', salary: 120000 },
    { name: 'Bob', role: 'Designer', salary: 95000 },
  ];
  grid.paginationPageSizes = [10, 25, 50];
</script>
```

### Full `options` Usage

```html
<ui-grid-element id="my-grid"></ui-grid-element>

<script type="module">
  import { defineStandaloneUiGridElement } from '@ornery/ui-grid-vanilla';

  await defineStandaloneUiGridElement(); // registers <ui-grid-element>

  document.querySelector('#my-grid').options = {
    id: 'vanilla-demo',
    data: [
      { name: 'Alice', role: 'Engineer', salary: 120000 },
      { name: 'Bob', role: 'Designer', salary: 95000 },
    ],
    columnDefs: [
      { name: 'name' },
      { name: 'role' },
      { name: 'salary', type: 'number', align: 'end' },
    ],
  };
</script>
```

### Mount Helper

The `mountVanillaUiGrid` helper registers the element, creates it, sets options, and appends it to a target element in one call:

```typescript
import { mountVanillaUiGrid } from '@ornery/ui-grid-vanilla';

const grid = await mountVanillaUiGrid(document.getElementById('app'), {
  id: 'mounted-grid',
  data: myData,
  columnDefs: myColumns,
});
```

To use the Rust/WASM engine with the vanilla element, pass the WASM module:

```typescript
import { mountVanillaUiGrid } from '@ornery/ui-grid-vanilla';
import * as wasmModule from '@ornery/ui-grid-wasm';

const grid = await mountVanillaUiGrid(
  document.getElementById('app'),
  { id: 'wasm-grid', data: myData, columnDefs: myColumns },
  wasmModule,
);
```

### Slot Templates

The vanilla element supports `<template>` elements with `slot` attributes for custom cell and expandable row content. Templates use `{{ expression }}` interpolation:

```html
<ui-grid-element id="my-grid">
  <template slot="cell-name">
    <strong>{{ value }}</strong>
  </template>
  <template slot="expandable-row">
    <p>Details for {{ row.name }}</p>
  </template>
</ui-grid-element>
```

### State API

The vanilla element exposes `getState()` and `setState()` methods for save/restore:

```javascript
const state = grid.getState();  // returns GridSaveState | null
grid.setState(state);           // applies a previously saved state
```

---

## Shared: Setting Options

Both web component variants accept the same `GridOptions` object as the Angular component. The Angular-backed element is configured through JavaScript property assignment. The vanilla element supports that same `options` object plus the declarative attributes and individual property mirrors shown above:

For the vanilla element specifically, this is now the advanced escape hatch rather than the only configuration path. Prefer attributes or individual properties when they are sufficient; use `options` when you need callbacks, function-valued column definitions, or one-shot bulk assignment.

```javascript
const grid = document.querySelector('ui-grid-element');
grid.options = {
  id: 'my-grid',
  data: myData,
  columnDefs: myColumns,
  enableSorting: true,
  enableFiltering: true,
  onRegisterApi: (api) => {
    window.gridApi = api;
  },
};
```

## Shared: Styling

Both variants use Shadow DOM. Style them via CSS custom properties on an ancestor:

```css
.my-container {
  --ui-grid-surface: #1a1a2e;
  --ui-grid-cell-color: #e0e0e0;
  --ui-grid-accent: #00d4aa;
  --ui-grid-border-color: rgba(0, 212, 170, 0.2);
  --ui-grid-header-background: #242440;
}
```

## Shared: Events

Use `onRegisterApi` in the options to receive the grid API, then subscribe to events:

```javascript
grid.options = {
  // ...
  onRegisterApi: (api) => {
    api.core.on.sortChanged((column, direction) => {
      console.log('Sort:', column, direction);
    });

    api.edit.on.afterCellEdit((row, col, newVal, oldVal) => {
      console.log('Edited:', col, oldVal, '->', newVal);
    });
  },
};
```

See [Rust / WASM](./rust.md) for the full local build and run steps for the browser-native Rust-backed demo.
