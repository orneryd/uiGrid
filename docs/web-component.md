# Web Component

UI Grid ships **two separate web component outputs** that happen to share the same default tag name, `<ui-grid-element>`.

- **Angular Elements output**: published from `@ornery/ui-grid`, rendered through Angular via `@angular/elements`
- **Vanilla output**: published from `@ornery/ui-grid-vanilla`, rendered with the framework-free DOM implementation

Do not load both outputs on the same page with the same tag name. Pick the package that matches your host environment and runtime requirements.

## Angular Elements Output (`@ornery/ui-grid`)

Wraps the Angular `UiGridComponent` as a custom element using `@angular/elements`. The Angular runtime is bundled into the output.

### Build

```bash
npm run build:element
```

This produces `dist/ui-grid-element/main.js` — a self-contained ES module that includes the Angular runtime.

### Declarative HTML Usage

This is the Angular-powered custom element build. Use it when you want to embed the Angular renderer itself as a web component.

The Angular Elements output supports the same declarative attribute surface as the vanilla build for common markup-first setup:

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module" src="ui-grid-element/main.js"></script>
</head>
<body>
  <ui-grid-element
    grid-id="angular-element-demo"
    title="Team Roster"
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
</body>
</html>
```

Supported declarative inputs include:

- Boolean attributes such as `enable-sorting`, `enable-filtering`, `enable-grouping`, `enable-pinning`, `enable-pagination`, and `enable-virtualization`
- JSON attributes such as `column-defs`, `data`, `grouping`, and `pagination-page-sizes`

Use the declarative surface for static pages, docs, CMS-rendered content, and simple embeds. For callbacks like `onRegisterApi` or function-based column logic, use the `options` property.

### Performance Guidance

- **Best use for declarative attributes**: initial render, static embeds, server-rendered HTML, CMS content, and occasional UI reconfiguration.
- **Cost of declarative updates**: changing JSON attributes such as `data`, `column-defs`, or `grouping` requires parsing the new string payload and re-running the element's configuration/update path.
- **Best use for imperative updates**: callbacks, function-valued configuration, programmatic integration, and batched reconfiguration from application code.
- **High-frequency updates**: avoid pushing a new `data` attribute every frame. For the Angular Elements output, batch `options` changes and prefer the Angular component directly for truly live data feeds.

### JavaScript Property Usage

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

## Vanilla Output (`@ornery/ui-grid-vanilla`)

A framework-free custom element built on `@ornery/ui-grid-core` with pure DOM rendering and Shadow DOM encapsulation. No Angular dependency at all.

### Install

```bash
npm install @ornery/ui-grid-vanilla @ornery/ui-grid-core
```

### Declarative HTML Usage

This is the non-Angular custom element build. Use it in static sites, plain JavaScript apps, or any host that should not carry Angular runtime code.

The vanilla element supports the same declarative attribute surface. Small and medium datasets can be configured directly in markup with zero grid setup JavaScript beyond registration:

```html
<ui-grid-element
  grid-id="vanilla-demo"
  title="Team Roster"
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

<script type="module">
  import { defineStandaloneUiGridElement } from '@ornery/ui-grid-vanilla';

  await defineStandaloneUiGridElement(); // registers <ui-grid-element>
</script>
```

Supported declarative inputs include:

- Boolean attributes such as `enable-sorting`, `enable-filtering`, `enable-grouping`, `enable-pinning`, `enable-pagination`, and `enable-virtualization`
- JSON attributes such as `column-defs`, `data`, `grouping`, and `pagination-page-sizes`

Use the declarative surface for static pages, docs, CMS-rendered content, and simple embeds. For callbacks like `onRegisterApi` or function-based column logic, use the `options` property.

### Performance Guidance

- **Best use for declarative attributes**: initial mount, static markup-first pages, and infrequent option changes.
- **Cost of declarative updates**: changing JSON attributes such as `data` or `column-defs` forces the element to parse the new payload, merge options again, and may trigger more DOM work than necessary for live feeds.
- **Best use for imperative updates**: callbacks, one-shot bulk configuration, host-framework integration, and any case where application code already owns the current row set.
- **High-frequency updates**: for streaming or trading-style feeds, mount declaratively if you want, but switch live row updates to `grid.setData(rows)` instead of replacing the `data` attribute. `setData(rows)` is the vanilla element's cheapest update path because it patches the existing grid surface instead of re-running the full declarative sync flow.

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

## Shared Grid Configuration Surface

Both outputs accept the same `GridOptions` object as the Angular component, plus the same declarative attributes for common markup-first setup:

For both elements, the `options` property is the advanced escape hatch rather than the only configuration path. Prefer attributes when they are sufficient; use `options` when you need callbacks, function-valued column definitions, or one-shot bulk assignment.

In performance terms, think of the surfaces like this:

- **Declarative attributes** optimize for authoring convenience and HTML-first setup.
- **`options` assignment** optimizes for programmatic control and coarse reconfiguration.
- **Vanilla `setData(rows)`** optimizes for repeated row-data refreshes and is the preferred path for high-frequency updates.

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
