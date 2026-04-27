# UI Grid - Next-gen

A modern Angular data grid with a familiar ui-grid-style API, rebuilt on Angular 21, TypeScript, Angular CDK, and browser-native primitives.

Live demo: [https://orneryd.github.io/uiGrid/](https://orneryd.github.io/uiGrid/)

This project keeps the classic ui-grid mental model:

- a `gridOptions` object
- `columnDefs`
- `data`
- `onRegisterApi`
- a programmable `gridApi`

The implementation is not a direct AngularJS port. It is a modern Angular rewrite that preserves the usage model while replacing legacy directives, watchers, and build tooling.

## What Ships

The current implementation includes:

- sorting
- filtering
- grouping
- column moving
- row virtualization with Angular CDK
- cell templates
- expandable rows
- tree view / tree base behaviors
- inline cell editing with spreadsheet-style keyboard navigation
- icon-based sort and grouping controls in the grid header
- pagination controls and API
- infinite scroll hooks
- auto-resize hooks
- CSV export
- benchmark hook
- transient save-state support
- Shadow DOM encapsulation with CSS variables and `part` hooks
- standalone Angular component usage
- custom-element build output
- an in-app browser harness for virtual-scroll branches that jsdom does not reliably materialize

## Compatibility

This repository targets the current toolchain as of April 2026.

- Angular 21.2
- Angular CLI 21.2.8
- Angular Build 21.2.8
- Angular CDK 21.2.8
- Angular Elements 21.2.10
- TypeScript 5.9
- RxJS 7.8
- Node 22.20.0
- npm 11.11.1

## Install

```bash
npm install
```

## Run Locally

Start the Angular app:

```bash
npm start
```

Default local URL:

```text
http://localhost:4200/
```

The app includes:

- the main demo grid
- the browser harness section for real-browser virtual-scroll scenarios

## Build

Build the Angular app:

```bash
npm run build
```

Build the custom element bundle:

```bash
npm run build:element
```

Outputs:

- app build: `dist/uiGrid/`
- custom element build: `dist/ui-grid-element/`

The custom element registers `ui-grid-element`.

## Usage

### Angular Component

```ts
import { Component } from '@angular/core';
import { UiGridComponent } from './grid/ui-grid.component';

@Component({
  selector: 'app-root',
  imports: [UiGridComponent],
  template: `<app-ui-grid [options]="gridOptions" />`
})
export class AppComponent {
  gridOptions = {
    id: 'customers',
    data: [
      { id: '1', name: 'Bob', company: 'Northwind', status: 'Active', revenue: 1200 },
      { id: '2', name: 'Alice', company: 'Blue Harbor', status: 'Pilot', revenue: 900 }
    ],
    enableSorting: true,
    enableFiltering: true,
    enableGrouping: true,
    enableColumnMoving: true,
    columnDefs: [
      { name: 'name' },
      { name: 'company' },
      { name: 'status' },
      { name: 'revenue', align: 'end' }
    ],
    onRegisterApi: (gridApi) => {
      console.log('grid ready', gridApi);
    }
  };
}
```

### Custom Element

After building the element bundle:

```html
<ui-grid-element></ui-grid-element>
<script type="module" src="./dist/ui-grid-element/main.js"></script>
<script>
  const grid = document.querySelector('ui-grid-element');
  grid.options = {
    id: 'customers',
    data: [
      { id: '1', name: 'Bob', status: 'Active', revenue: 1200 },
      { id: '2', name: 'Alice', status: 'Pilot', revenue: 900 }
    ],
    columnDefs: [
      { name: 'name' },
      { name: 'status' },
      { name: 'revenue' }
    ]
  };
</script>
```

## Grid Options

Common `gridOptions` fields include:

- `id`
- `title`
- `data`
- `columnDefs`
- `emptyMessage`
- `rowIdentity`
- `onRegisterApi`
- `rowHeight`
- `viewportHeight`
- `enableSorting`
- `enableFiltering`
- `enableGrouping`
- `enableColumnMoving`
- `enableVirtualization`
- `virtualizationThreshold`
- `grouping`
- `benchmark`

Advanced options currently supported:

- `enablePagination`
- `enablePaginationControls`
- `paginationPageSizes`
- `paginationPageSize`
- `paginationCurrentPage`
- `useExternalPagination`
- `totalItems`
- `enableExpandable`
- `expandableRowHeight`
- `expandableRowTemplate`
- `expandableRowScope`
- `enableTreeView`
- `treeChildrenField`
- `treeIndent`
- `showTreeExpandNoChildren`
- `enableAutoResize`
- `infiniteScrollRowsFromEnd`
- `infiniteScrollUp`
- `infiniteScrollDown`

## Column Definitions

Common column definition fields include:

- `name`
- `displayName`
- `field`
- `visible`
- `width`
- `align`
- `filter`
- `sort`
- `sortable`
- `filterable`
- `enableSorting`
- `enableFiltering`
- `enableGrouping`
- `sortingAlgorithm`
- `formatter`
- `cellRenderer`
- `cellTemplate`

## API Surface

The runtime API is registered through `onRegisterApi`.

### `gridApi.core`

- `refresh()`
- `getVisibleRows()`
- `setFilter(columnName, value)`
- `clearAllFilters()`
- `sortColumn(columnName, direction)`
- `groupByColumn(columnName)`
- `clearGrouping()`
- `moveColumn(fromIndex, toIndex)`
- `setRowInvisible(row, reason)`
- `clearRowInvisible(row, reason)`
- `benchmark(iterations?)`
- `exportCsv()`

### `gridApi.pagination`

- `getPage()`
- `getTotalPages()`
- `getFirstRowIndex()`
- `getLastRowIndex()`
- `nextPage()`
- `previousPage()`
- `seek(page)`
- `setPageSize(pageSize)`

### `gridApi.expandable`

- `toggleRowExpansion(row)`
- `expandAllRows()`
- `collapseAllRows()`
- `toggleAllRows()`

### `gridApi.treeBase`

- `expandAllRows()`
- `collapseAllRows()`
- `toggleRowTreeState(row)`
- `expandRow(row)`
- `collapseRow(row)`
- `getRowChildren(row)`

### `gridApi.treeView`

- `getTreeView()`
- `setTreeView(state)`

### `gridApi.infiniteScroll`

- `dataLoaded(scrollUp?, scrollDown?)`
- `resetScroll(scrollUp?, scrollDown?)`
- `saveScrollPercentage()`
- `dataRemovedTop(scrollUp?, scrollDown?)`
- `dataRemovedBottom(scrollUp?, scrollDown?)`
- `setScrollDirections(scrollUp, scrollDown)`

### `gridApi.saveState`

- `save()`
- `restore(state)`

### `gridApi.edit`

- `beginCellEdit(row, columnName, triggerEvent?)`
- `endCellEdit()`
- `cancelCellEdit()`
- `getEditingCell()`

## Browser Harness

The demo app now includes a browser harness dedicated to virtual-scroll rendering paths that are difficult to assert in jsdom.

Scenarios included:

- `Expandable`
- `Tree`
- `Templated`

Use it by running the app locally and scrolling to the harness section:

```bash
npm start
```

This is intended for manual real-browser validation of:

- expandable-row rendering inside the virtual viewport
- tree toggle behavior inside the virtual viewport
- templated cell rendering inside the virtual viewport

## Styling

The component renders inside Shadow DOM but keeps a familiar neutral ui-grid look.

Styling hooks include:

- CSS custom properties
- exposed `part` attributes
- legacy-oriented structural class names in the rendered markup

Common CSS variables include:

- `--ui-grid-border-color`
- `--ui-grid-header-background`
- `--ui-grid-row-odd`
- `--ui-grid-row-even`
- `--ui-grid-row-hover`
- `--ui-grid-cell-color`
- `--ui-grid-muted-color`
- `--ui-grid-surface`
- `--ui-grid-radius`
- `--ui-grid-shadow`
- `--ui-grid-accent`

Useful exposed parts include:

- `shell`
- `hero`
- `grid-frame`
- `grid-toolbar`
- `header`
- `header-cell`
- `filter-cell`
- `body-cell`
- `group-row`
- `expandable-row`
- `pagination`
- `empty-state`

## Testing And Validation

Watch mode:

```bash
npm test
```

Run tests once:

```bash
./node_modules/.bin/ng test --watch=false
```

Run tests with coverage:

```bash
./node_modules/.bin/ng test --watch=false --coverage
```

Current deterministic unit coverage is above 90 for statements, lines, and functions. Branch coverage is close to 90 and is mainly limited by remaining Angular template and virtual-scroll control-path branches.

## Performance Notes

Performance-sensitive defaults in the current implementation:

- Angular CDK fixed-size virtual scroll for large row sets
- pure TypeScript sorting and filtering helpers
- flattened display-item pipeline for grouped, tree, and expandable rendering
- benchmark timings exposed through `gridApi.core.benchmark()`

## What Changed From Legacy ui-grid

This modernization intentionally replaces the legacy infrastructure:

- AngularJS modules and directives were replaced with standalone Angular components
- Bower and Grunt were removed
- `$scope`, `$compile`, `$parse`, and digest-driven rendering were removed
- old browser and polyfill assumptions were dropped
- CDK virtualization and modern Angular control flow replaced AngularJS-era rendering patterns
- Shadow DOM and CSS variables replaced global stylesheet assumptions
- native browser download APIs are used for CSV export

What did not change is the general mental model: define `gridOptions`, define `columnDefs`, pass `data`, and interact with the grid through a registered API.

## Roadmap

Next in line:

- accessibility compatibility work, including a11y-focused polish and validation
- i18n integration
