# UI Grid Modernized

A modern Angular data grid with a familiar ui-grid style API.

This project is a lift-and-shift of the original ui-grid ideas onto the latest Angular stack as of April 2026. The goal is to keep usage familiar while replacing AngularJS-era infrastructure with current Angular, TypeScript, Angular CDK, browser-native APIs, and a secondary web-component output.

# Help

This repository is the modern Angular continuation of the original ui-grid concept. It keeps the same basic mental model:

- a `gridOptions` object
- `columnDefs`
- `data`
- `onRegisterApi`
- a programmable `gridApi`

The implementation is modernized, but the intended usage should still feel familiar if you used the original grid.

# Installing

## NPM

Install dependencies for local development:

```bash
npm install
```

## Local Angular App

Run the Angular application locally:

```bash
npm start
```

This starts the Angular dev server. By default, open:

```text
http://localhost:4200/
```

## Web Component Bundle

Build the custom element bundle:

```bash
npm run build:element
```

This outputs a standalone custom-element build to:

```text
dist/ui-grid-element/
```

The bundle registers the `ui-grid-element` custom element.

# Usage

## Angular

Use the standalone Angular component with a `gridOptions` object:

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
      { name: 'Bob', company: 'Northwind', status: 'Active' },
      { name: 'Alice', company: 'Blue Harbor', status: 'Pilot' }
    ],
    columnDefs: [
      { name: 'name' },
      { name: 'company' },
      { name: 'status' }
    ],
    onRegisterApi: (gridApi: unknown) => {
      console.log('grid ready', gridApi);
    }
  };
}
```

## Web Component

After building the element bundle, use it in any app that can load an ES module:

```html
<ui-grid-element></ui-grid-element>
<script type="module" src="./dist/ui-grid-element/main.js"></script>
<script>
  const grid = document.querySelector('ui-grid-element');
  grid.options = {
    id: 'customers',
    data: [
      { name: 'Bob', company: 'Northwind', status: 'Active' },
      { name: 'Alice', company: 'Blue Harbor', status: 'Pilot' }
    ],
    columnDefs: [
      { name: 'name' },
      { name: 'company' },
      { name: 'status' }
    ]
  };
</script>
```

# Angular Compatibility

This project is built for the current Angular toolchain as of April 2026.

- Angular 21.2
- Angular CLI 21.2.8
- Angular Build 21.2.8
- TypeScript 5.9
- RxJS 7.8
- Node 22.20.0
- npm 11.11.1

# Feature Coverage

The modernized grid currently includes the core behavior expected from the original project:

Feature | Status
-------- | --------- |
sorting | available
filtering | available
grouping | available
column moving | available
templating | available
virtualization | available
csv export | available
benchmark hook | available
shadow dom encapsulation | available
web component output | available

The feature surface is designed to stay familiar, but the implementation is based on Angular 21 and Angular CDK primitives instead of AngularJS directives and watchers.

# API Shape

The public API stays close to the classic ui-grid usage model.

## Grid Options

Common options include:

- `id`
- `data`
- `columnDefs`
- `onRegisterApi`
- `enableSorting`
- `enableFiltering`
- `enableGrouping`
- `enableColumnMoving`
- `enableVirtualization`
- `rowIdentity`
- `grouping`
- `benchmark`

## Column Definitions

Common column definition properties include:

- `name`
- `displayName`
- `field`
- `visible`
- `width`
- `align`
- `filter`
- `sort`
- `sortingAlgorithm`
- `formatter`
- `cellTemplate`

## Grid API

The grid exposes a `gridApi.core` surface through `onRegisterApi`.

Examples:

- `gridApi.core.refresh()`
- `gridApi.core.getVisibleRows()`
- `gridApi.core.setFilter(columnName, value)`
- `gridApi.core.clearAllFilters()`
- `gridApi.core.sortColumn(columnName, direction)`
- `gridApi.core.groupByColumn(columnName)`
- `gridApi.core.clearGrouping()`
- `gridApi.core.moveColumn(fromIndex, toIndex)`
- `gridApi.core.setRowInvisible(row)`
- `gridApi.core.clearRowInvisible(row)`
- `gridApi.core.exportCsv()`
- `gridApi.core.benchmark()`

# Styling

The new grid keeps the original neutral ui-grid feel by default, with a small amount of polish.

Important styling design points:

- defaults stay close to classic ui-grid: bordered grid, neutral header, zebra rows, subtle hover states
- the component renders inside Shadow DOM to keep defaults isolated
- structural legacy-oriented class names remain in the rendered DOM
- user overrides are surfaced through CSS variables and `part` selectors

## CSS Variable Overrides

Themeable properties include:

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

## Shadow DOM Parts

Web-component consumers can target exposed parts such as:

- `shell`
- `hero`
- `grid-frame`
- `grid-toolbar`
- `header`
- `header-cell`
- `filter-cell`
- `body-cell`
- `group-row`
- `empty-state`

# Building

Install dependencies first:

```bash
npm install
```

Build the Angular application:

```bash
npm run build
```

Build the web-component bundle:

```bash
npm run build:element
```

The application build output is written to:

```text
dist/uiGrid/
```

The custom-element build output is written to:

```text
dist/ui-grid-element/
```

# Developing

Development watch server:

```bash
npm start
```

Development build watch:

```bash
npm run watch
```

Run the test suite:

```bash
npm test
```

Run tests once without watch mode:

```bash
./node_modules/.bin/ng test --watch=false
```

# Performance

The modern grid is built with performance-sensitive defaults:

- virtualization uses Angular CDK fixed-size virtual scrolling
- sorting and filtering are kept in pure TypeScript utilities
- grouping is flattened into display items for efficient rendering
- the grid includes a benchmark hook through `gridApi.core.benchmark()`

# What Changed From The Original Project

This project intentionally replaces legacy infrastructure:

- AngularJS modules and directives were replaced by standalone Angular components
- Bower and Grunt were removed
- AngularJS `$scope`, `$compile`, `$parse`, and `$timeout` were removed
- old polyfill-driven browser support assumptions were dropped
- native browser download APIs are used for CSV export

What did not change is the general mental model: define `gridOptions`, define `columnDefs`, pass `data`, and interact with the grid through a registered API.
