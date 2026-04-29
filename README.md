[![CI](https://github.com/orneryd/uiGrid/actions/workflows/ci.yml/badge.svg)](https://github.com/orneryd/uiGrid/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/orneryd/uiGrid/badge.svg?branch=main)](https://coveralls.io/github/orneryd/uiGrid?branch=main)
[![npm](https://img.shields.io/npm/v/@ornery/ui-grid)](https://www.npmjs.com/package/@ornery/ui-grid)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE.md)

# UI Grid — Remastered

**The modern multi-platform data grid. Every feature free and open source. Built for Angular, Web-Components, and React**

A from-scratch rewrite of the original [AngularJS ui-grid](https://github.com/angular-ui/ui-grid) — by the original author. Same `gridOptions` / `columnDefs` / `onRegisterApi` mental model, modern Angular signals internals, and zero legacy baggage.

**[Live Demo & Docs](https://orneryd.github.io/uiGrid/)** | **[npm](https://www.npmjs.com/package/@ornery/ui-grid)**

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
| Column Reordering        | **Free** |       Free        |         —          |      Free       |    Paid    |   Community\*   |
| **Save/Restore State**   | **Free** |         —         |    ~$999/dev/yr    |        —        |    Paid    |        —        |
| **Infinite Scroll**      | **Free** |       Free        |         —          |        —        |    Paid    |   Community\*   |
| **Shadow DOM**           | **Free** |         —         |         —          |        —        |     —      |        —        |
| **Web Component Build**  | **Free** |         —         |         —          |     Native      |     —      |        —        |
| **Feature Tree-Shaking** | **Free** |         —         |         —          |        —        |     —      |        —        |
| **SSR Support**          | **Free** |         —         |    ~$999/dev/yr    |        —        |     —      |        —        |
| i18n                     | **Free** |         —         |    ~$999/dev/yr    |      Free       |    Paid    |   Community\*   |
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

### Custom Element (Web Component)

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

---

## Features

- **Sorting** — click column headers to cycle asc/desc/none, custom comparators, programmatic API
- **Filtering** — per-column inputs with conditions: contains, exact, startsWith, endsWith, greaterThan, regex, custom predicates
- **Row Grouping** — nested multi-column grouping with collapsible group headers
- **Tree View** — hierarchical data with expand/collapse per node, arbitrary nesting depth
- **Expandable Rows** — master/detail pattern with custom Angular templates
- **Cell Editing** — inline spreadsheet-style editing with full keyboard navigation (Tab, Enter, Escape)
- **Pagination** — client-side or external pagination with configurable page sizes
- **Infinite Scroll** — bi-directional infinite scrolling with loading state management
- **Column Moving** — drag-and-drop column reordering via Angular CDK
- **CSV Export** — download visible rows with formula-injection protection
- **Virtual Scrolling** — CDK virtual scroll viewport, auto-enabled at 40+ rows
- **Save/Restore State** — serialize and restore sort, filter, grouping, pagination, and expansion state
- **Auto Resize** — ResizeObserver-driven viewport height recalculation
- **Custom Cell Templates** — Angular `ng-template` or `cellRenderer` function for fully custom cells
- **Shadow DOM** — encapsulated styles with CSS custom property and `::part()` hooks
- **Web Component** — ship as `<ui-grid-element>` for non-Angular apps
- **Feature-Flag Builds** — compile-time tree-shaking of unused features
- **i18n** — override any UI string at runtime or bake in a locale at build time
- **SSR Support** — server-side rendering with platform-safe guards

---

## Theming

The grid renders inside Shadow DOM. Customize it via CSS custom properties:

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

Target structural elements with `::part()`:

```css
app-ui-grid::part(header) {
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

See [docs/theming.md](./docs/theming.md) for the full variable reference, `::part()` hooks, and the demo app's 4-mode theme system.

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
| [Web Component](./docs/web-component.md)     | Build, usage, styling the custom element               |
| [Internationalization](./docs/i18n.md)       | Runtime overrides, build-time locales                  |
| [Accessibility](./docs/accessibility.md)     | ARIA roles, keyboard navigation, screen reader support |
| [Rust / WASM](./docs/rust.md)                | Build and run the Rust-backed browser demo locally     |

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
