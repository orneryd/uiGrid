[![CI](https://github.com/orneryd/uiGrid/actions/workflows/ci.yml/badge.svg)](https://github.com/orneryd/uiGrid/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/orneryd/uiGrid/badge.svg?branch=main)](https://coveralls.io/github/orneryd/uiGrid?branch=main)
[![npm](https://img.shields.io/npm/v/@ornery/ui-grid)](https://www.npmjs.com/package/@ornery/ui-grid)
[![crates.io](https://img.shields.io/crates/v/ui-grid-egui)](https://crates.io/crates/ui-grid-egui)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE.md)

#### [Discord Community](https://discord.gg/Baz4w8ZWN)

# UI Grid — Remastered

**The modern multi-platform data grid. Every feature free and open source. Built for Angular, Web-Components, React, native Rust/egui, and native C/LVGL.**

A from-scratch rewrite of the original [AngularJS ui-grid](https://github.com/angular-ui/ui-grid) — by the original author. Same `gridOptions` / `columnDefs` / `onRegisterApi` api surface, modern Angular signals internals, and zero legacy baggage. 

Just like the original grid, it will **NEVER** be monetized. This is purely my contribution to the greater community. 

It proves that the datagrid cabal wants you to think it's hard to write a data grid. Well, it's not, and nobody should be paying to group data.

**[Live Demo & Docs](https://orneryd.github.io/uiGrid/)** | **[npm](https://www.npmjs.com/package/@ornery/ui-grid)** | **[crates.io](https://crates.io/crates/ui-grid-egui)**

---

## Why Remastered?

- **Original authorship** — built by the same engineer who created AngularJS ui-grid, with a decade of hindsight on what worked and what didn't
- **Familiar API** — if you used the original ui-grid, you already know this one: `gridOptions`, `columnDefs`, `onRegisterApi`, `gridApi.core.*`
- **Modern internals** — pure Angular signals architecture, `ChangeDetectionStrategy.OnPush`, Shadow DOM encapsulation, CDK virtual scrolling, standalone components
- **No legacy** — no `$scope`, no Bower, no Grunt, no jQuery, no module system from 2013

---

## Feature Comparison

Everything below ships free and MIT-licensed. No enterprise tier, no license keys, no per-developer fees.

| Feature                  | UI Grid  | ag-Grid Community | ag-Grid Enterprise |   Vaadin Grid   |  Kendo UI  |   Syncfusion    |
| ------------------------ | :------: | :---------------: | :----------------: | :-------------: | :--------: | :-------------: |
| Sorting                  | **Free** |       Free        |         —          |      Free       |    Paid    |   Community\*   |
| Filtering                | **Free** |       Free        |         —          |      Free       |    Paid    |   Community\*   |
| **Row Grouping**         | **Free** |         —         |    ~$999/dev/yr    |        —        |    Paid    |   Community\*   |
| **Tree Data**            | **Free** |         —         |    ~$999/dev/yr    |        —        |    Paid    |   Community\*   |
| **Master/Detail Rows**   | **Free** |         —         |    ~$999/dev/yr    |        —        |    Paid    |   Community\*   |
| **Inline Cell Editing**  | **Free** |       Free        |         —          | Pro ~$99/dev/mo |    Paid    |   Community\*   |
| CSV Export               | **Free** |       Free        |         —          |        —        |    Paid    |   Community\*   |
| Virtual Scrolling        | **Free** |       Free        |         —          |      Free       |    Paid    |   Community\*   |
| Pagination               | **Free** |       Free        |         —          |      Free       |    Paid    |   Community\*   |
| **Column Pinning**       | **Free** |         —         |    ~$999/dev/yr    |        —        |    Paid    |   Community\*   |
| Column Reordering        | **Free** |       Free        |         —          |      Free       |    Paid    |   Community\*   |
| **Save/Restore State**   | **Free** |         —         |    ~$999/dev/yr    |        —        |    Paid    |        —        |
| **Infinite Scroll**      | **Free** |       Free        |         —          |        —        |    Paid    |   Community\*   |
| **Shadow DOM**           | **Free** |         —         |         —          |        —        |     —      |        —        |
| **Web Component Build**  | **Free** |         —         |         —          |     Native      |     —      |        —        |
| **Feature Tree-Shaking** | **Free** |         —         |         —          |        —        |     —      |        —        |
| **SSR Support**          | **Free** |         —         |    ~$999/dev/yr    |        —        |     —      |        —        |
| i18n                     | **Free** |         —         |    ~$999/dev/yr    |      Free       |    Paid    |   Community\*   |
| React Native             | **Yes**  |      Wrapper      |      Wrapper       |       No        |  Wrapper   |     Wrapper     |
| Rust/egui Native         | **Yes**  |      No      |      No       |       No        |  No   |     No     |
| C/LVGL Native            | **Yes**  |      No      |      No       |       No        |  No   |     No     |
| Angular Native           | **Yes**  |      Wrapper      |      Wrapper       |       No        |  Wrapper   |     Wrapper     |
| **License**              | **MIT**  |        MIT        |     Commercial     |  Apache/Comm.   | Commercial | Comm./Community |

> **Bold** = features where UI Grid gives you for free what competitors charge for.
>
> _Syncfusion Community license is free for companies with <$1M annual revenue. Prices are approximate and subject to change._

---

## Quick Start

```bash
npm install @ornery/ui-grid
```

### Angular Component

```typescript
import { Component } from '@angular/core';
import { GridOptions, UiGridComponent } from '@ornery/ui-grid';

@Component({
  selector: 'app-my-grid',
  imports: [UiGridComponent],
  template: `<app-ui-grid [options]="gridOptions" />`,
})
export class MyGridComponent {
  gridOptions: GridOptions = {
    id: 'my-grid',
    data: [
      { name: 'Alice', role: 'Engineer', salary: 120000 },
      { name: 'Bob', role: 'Designer', salary: 95000 },
    ],
    columnDefs: [
      { name: 'name' },
      { name: 'role' },
      { name: 'salary', type: 'number', align: 'end' },
    ],
    onRegisterApi: (api) => {
      this.gridApi = api;
    },
  };
}
```

### React

```bash
npm install @ornery/ui-grid-react @ornery/ui-grid-core
```

```tsx
import { UiGrid } from '@ornery/ui-grid-react';
import type { GridOptions } from '@ornery/ui-grid-core';

function MyGrid() {
  const options: GridOptions = {
    id: 'my-grid',
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

  return <UiGrid options={options} />;
}
```

### Web Components

The grid ships **two separate web component outputs** that share the same default tag name, `<ui-grid-element>`.

- **Angular Elements output**: `@ornery/ui-grid`, rendered through Angular via `@angular/elements`
- **Vanilla output**: `@ornery/ui-grid-vanilla`, rendered by the framework-free DOM implementation

Pick one output per page. They expose the same common declarative surface, but they are different packages with different runtime requirements.

#### Angular Elements Output (`@ornery/ui-grid`)

Built with `@angular/elements`, this wraps the full Angular component as a custom element. It requires the Angular runtime and is produced by the `build:element` script. Use this when you already have Angular in your stack or want the full Angular rendering pipeline.

```bash
npm run build:element
```

Declarative HTML usage is available for the same common setup surface as the vanilla build:

```html
<script type="module" src="ui-grid-element/main.js"></script>

<ui-grid-element
  grid-id="element-demo"
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
```

Supported declarative inputs include boolean flags such as `enable-sorting` and `enable-filtering`, scalar attributes such as `grid-id`, `title`, and `viewport-height`, plus JSON attributes such as `column-defs` and `data`.

Declarative attributes are the lowest-friction setup path, but they are not the cheapest update path. Changing JSON attributes such as `data` or `column-defs` means reparsing the payload and re-running the custom element's configuration flow. That is fine for initial render, docs examples, SSR/CMS content, and occasional state changes, but it is not ideal for high-frequency feeds.

For callbacks, function-valued column definitions, or one-shot bulk assignment, use the `options` property:

```html
<script type="module" src="ui-grid-element/main.js"></script>

<ui-grid-element id="my-grid"></ui-grid-element>

<script type="module">
  document.querySelector('#my-grid').options = {
    id: 'element-demo',
    data: [{ name: 'Alice', role: 'Engineer' }],
    columnDefs: [{ name: 'name' }, { name: 'role' }],
  };
</script>
```

You can also register the element programmatically:

```typescript
import { defineUiGridElement } from '@ornery/ui-grid';

await defineUiGridElement(); // registers <ui-grid-element>
```

For performance-sensitive updates on the Angular-backed custom element, prefer declarative attributes for first render and infrequent changes, then batch any imperative `options` updates so you do not replace large `data` payloads every frame. If you need very high-frequency streaming behavior, use the Angular component directly instead of the custom-element wrapper.

#### Vanilla Output (`@ornery/ui-grid-vanilla`)

A framework-free custom element built on `@ornery/ui-grid-core` with pure DOM rendering and Shadow DOM encapsulation. No Angular dependency. Use this in non-Angular apps, static sites, or anywhere you want a zero-framework grid.

```bash
npm install @ornery/ui-grid-vanilla @ornery/ui-grid-core
```

Declarative HTML usage is available out of the box for the same common setup surface:

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

Supported declarative inputs include boolean flags such as `enable-sorting` and `enable-filtering`, scalar attributes such as `grid-id`, `title`, and `viewport-height`, plus JSON attributes such as `column-defs` and `data`.

Declarative attributes are best for initial mount and occasional reconfiguration. Updating a large `data` JSON attribute repeatedly is more expensive than imperative row updates because the element must parse the new attribute value, merge options again, and potentially rebuild more of the grid state.

When you need callbacks, function-valued column definitions, or one-shot bulk assignment, use the `options` property or the `mountVanillaUiGrid` helper instead:

```typescript
import { mountVanillaUiGrid } from '@ornery/ui-grid-vanilla';

await mountVanillaUiGrid(document.getElementById('app'), {
  id: 'mounted-grid',
  data: [{ name: 'Alice', role: 'Engineer' }],
  columnDefs: [{ name: 'name' }, { name: 'role' }],
});
```

For live or high-frequency data, use the declarative surface only for the initial mount and then switch to imperative updates. In the vanilla element, `grid.setData(rows)` is the most efficient path for streaming row changes because it updates the pipeline and patches rendered cells in place instead of re-running the full declarative attribute sync path.

### Native Rust / egui

```toml
[dependencies]
ui-grid-egui = "0.1"
ui-grid-core = "0.1"
```

```rust
use ui_grid_egui::{EguiColumnExt, EguiGrid, GridThemePreset};
use ui_grid_core::models::{GridColumnDef, GridOptions};

let mut grid = EguiGrid::new();
let theme = GridThemePreset::DefaultDark.build();
let mut column_ext: Vec<EguiColumnExt> = vec![];

// Each frame, inside your egui UI:
grid.show(ui, &mut options, &columns, &mut column_ext, &theme);
```

To run the interactive demo app locally:

```bash
git clone https://github.com/orneryd/uiGrid.git
cd uiGrid
cargo run -p ui-grid-egui --example demo --release
```

See [docs/rust-egui.md](./docs/rust-egui.md) for pinning, CSV export, save/restore state, and custom column extensions.

### Native C / LVGL

The C adapter sits on top of the same Rust core and C ABI contract used by the other foreign bindings. The current demo uses LVGL with the SDL desktop backend.

Prerequisites:

- Rust 1.95+
- CMake 3.20+
- SDL2

```bash
brew install sdl2
cargo build -p ui-grid-c-abi
cmake -S crates/ui-grid-lvgl -B target/ui-grid-lvgl
cmake --build target/ui-grid-lvgl -j4
./target/ui-grid-lvgl/ui-grid-lvgl-demo
```

The LVGL demo currently exercises the native C grid shell with sorting, grouping, pinning, state save/restore, theme presets, live trading-row updates, and the shared projection/command contract.

---

## Features

- **Sorting** — click column headers to cycle asc/desc/none, custom comparators, programmatic API
- **Filtering** — per-column inputs with conditions: contains, exact, startsWith, endsWith, greaterThan, regex, custom predicates
- **Row Grouping** — nested multi-column grouping with collapsible group headers
- **Tree View** — hierarchical data with expand/collapse per node, arbitrary nesting depth
- **Expandable Rows** — master/detail pattern with custom templates (Angular `ng-template`, React render prop, or vanilla `<template>` slot)
- **Cell Editing** — inline spreadsheet-style editing with full keyboard navigation (Tab, Enter, Escape)
- **Pagination** — client-side or external pagination with configurable page sizes
- **Infinite Scroll** — bi-directional infinite scrolling with loading state management
- **Column Pinning** — freeze columns left or right with CSS `position: sticky`, programmatic API, save/restore state
- **Column Moving** — drag-and-drop column reordering (Angular CDK, native HTML drag in React and vanilla)
- **CSV Export** — download visible rows with formula-injection protection
- **Virtual Scrolling** — CDK virtual scroll viewport, auto-enabled at 40+ rows
- **Save/Restore State** — serialize and restore sort, filter, grouping, pagination, and expansion state
- **Native Rust and C Grids** — shared Rust core with native Rust/egui and native C/LVGL adapters driven by the same projection and command contract
- **Auto Resize** — ResizeObserver-driven viewport height recalculation
- **Custom Cell Templates** — Angular `ng-template`, React `cellRenderer` render prop, vanilla `<template>` slots, or `cellRenderer` function for fully custom cells
- **Shadow DOM** — encapsulated styles with CSS custom property and `::part()` hooks
- **Web Component** — ship as `<ui-grid-element>` in two flavors: Angular-backed (`@ornery/ui-grid`) or framework-free vanilla (`@ornery/ui-grid-vanilla`)
- **Feature-Flag Builds** — compile-time tree-shaking of unused features
- **i18n** — override any UI string at runtime or bake in a locale at build time
- **SSR Support** — server-side rendering with platform-safe guards

---

## Theming

The grid renders inside Shadow DOM. Customize it via the public `--ui-grid-*` CSS custom properties:

```css
.my-app {
  --ui-grid-surface: #1e1b2e;
  --ui-grid-accent: #8b5cf6;
  --ui-grid-header-background: #2d2640;
  --ui-grid-cell-color: #e2e0f0;
  --ui-grid-border-color: rgba(139, 92, 246, 0.2);
  --ui-grid-row-hover: #322e4a;
}
```

Legacy `--app-ui-grid-*` aliases remain supported as a fallback for older app themes, but new consumer theming should target only `--ui-grid-*`.

Target structural elements with `::part()`:

```css
app-ui-grid::part(header) {
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

See [docs/theming.md](./docs/theming.md) for the full CSS variable reference grouped by grid section, `::part()` hooks, and the demo app's 4-mode theme system.

---

## Custom Builds

Ship only the features you use:

```bash
# Only sorting and filtering — everything else is tree-shaken
node scripts/build-grid.mjs --features sorting,filtering

# Bake in a locale at build time
node scripts/build-grid.mjs --features sorting,filtering,pagination --locale i18n/fr-FR.json

# See all available flags
node scripts/build-grid.mjs --list
```

See [docs/custom-builds.md](./docs/custom-builds.md) for the full feature flag table and build presets.

---

## Documentation

| Guide                                        | Description                                            |
| -------------------------------------------- | ------------------------------------------------------ |
| [Getting Started](./docs/getting-started.md) | Install, minimal setup, run the demo                   |
| [Features](./docs/features.md)               | Overview of all features with code examples            |
| [Theming](./docs/theming.md)                 | CSS custom properties, `::part()` hooks, sample themes |
| [API Reference](./docs/api-reference.md)     | GridOptions, GridColumnDef, UiGridApi                  |
| [Cell Editing](./docs/cell-editing.md)       | Keyboard navigation, conditional editing, API          |
| [Tree View](./docs/tree-view.md)             | Hierarchical data, options, API                        |
| [Expandable Rows](./docs/expandable-rows.md) | Master/detail, template context, API                   |
| [Custom Builds](./docs/custom-builds.md)     | Feature flags, build presets, locale baking            |
| [Web Component](./docs/web-component.md)     | Angular-backed and vanilla web component outputs       |
| [Internationalization](./docs/i18n.md)       | Runtime overrides, build-time locales                  |
| [Accessibility](./docs/accessibility.md)     | ARIA roles, keyboard navigation, screen reader support |
| [Rust / WASM](./docs/rust.md)                | Rust pipeline in Angular, React, and vanilla hosts     |
| [Rust / egui](./docs/rust-egui.md)           | Native egui adapter with pinning, export, save/restore |
| `README native C / LVGL section`             | Native C/LVGL build and demo run instructions          |

Interactive versions of all documentation are also available in the [live demo](https://orneryd.github.io/uiGrid/).

---

## Development

```bash
npm start          # Dev server at localhost:4200
npm test           # Run tests (Vitest)
npm run build      # Production build
npm run build:library   # Build the library (ng-packagr)
npm run build:element   # Build the web component
npm run build:rust:web  # Build the browser-native Rust/WASM artifact
npm run start:vanilla   # Run the Rust-backed browser demo at 127.0.0.1:4174
```

### Rust / egui

Requires [Rust 1.95+](https://rustup.rs/).

```bash
cargo test --workspace                                    # Run all Rust tests
cargo clippy --workspace --all-targets -- -D warnings     # Lint
cargo run -p ui-grid-egui --example demo --release        # Run the native egui demo app
```

### C / LVGL

Requires SDL2 plus the Rust/C ABI build.

```bash
brew install sdl2
cargo build -p ui-grid-c-abi
cmake -S crates/ui-grid-lvgl -B target/ui-grid-lvgl
cmake --build target/ui-grid-lvgl -j4
./target/ui-grid-lvgl/ui-grid-lvgl-demo                  # Run the native C/LVGL demo app
```

---

## Compatibility

| Dependency  | Version |
| ----------- | ------- |
| Angular     | 21.2    |
| Angular CDK | 21.2    |
| TypeScript  | 5.9     |
| RxJS        | 7.8     |
| Node        | 22.20   |
| npm         | 11.11   |
| Rust        | 1.95+   |
| egui        | 0.34    |

---

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Run `npm test` to ensure all tests pass
4. Submit a pull request

---

## License

[MIT](./LICENSE.md)
