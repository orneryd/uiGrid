# Getting Started

Get up and running with `@ornery/ui-grid` in under five minutes.

## Install

```bash
npm install @ornery/ui-grid
```

**Peer dependencies:** `@angular/core`, `@angular/common`, `@angular/cdk`, `@angular/elements`, `rxjs`, `tslib`.

## Minimal Angular Setup

The grid ships as a standalone component — no module imports required:

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
  };
}
```

## Required GridOptions Fields

| Field        | Type                       | Description                                                 |
| ------------ | -------------------------- | ----------------------------------------------------------- |
| `id`         | `string`                   | Unique grid identifier (used for CSV filenames and row IDs) |
| `data`       | `readonly GridRecord[]`    | Array of row objects                                        |
| `columnDefs` | `readonly GridColumnDef[]` | Column definitions — each needs at minimum a `name`         |

## Custom Element (Web Component)

Build the grid as a Web Component with `npm run build:element`, then use it in any HTML page:

```html
<script type="module" src="ui-grid-element/main.js"></script>

<ui-grid-element id="my-grid"></ui-grid-element>

<script type="module">
  const grid = document.querySelector('#my-grid');
  grid.options = {
    id: 'element-demo',
    data: [{ name: 'Alice', role: 'Engineer' }],
    columnDefs: [{ name: 'name' }, { name: 'role' }],
  };
</script>
```

## Run the Demo Locally

```bash
git clone https://github.com/orneryd/uiGrid.git
cd uiGrid
npm ci
npm start
```

Open `http://localhost:4200` to see the full demo with 100,000 rows, theming, and all features active.

## Run the Rust-backed Demo Locally

If you want to exercise the Rust/WASM engine directly in the browser:

```bash
npm run start:vanilla
```

Open `http://127.0.0.1:4174/` to see the framework-agnostic vanilla demo that mounts the grid through the Rust-backed browser pipeline.

## Next Steps

- [Features](./features.md) — see everything the grid can do
- [Theming](./theming.md) — customize colors and layout via CSS custom properties
- [API Reference](./api-reference.md) — full GridOptions, GridColumnDef, and UiGridApi documentation
- [Rust / WASM](./rust.md) — build and run the Rust-backed browser demo locally
