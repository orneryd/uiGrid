# UiGrid

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.8.

## Development server

To start a local development server, run:

# UI Grid Modernized

This workspace is a fresh Angular 21 lift-and-shift target for the legacy AngularJS ui-grid codebase. The goal is not to recreate Grunt, Bower, or AngularJS packaging. The goal is to preserve the grid's portable behavior with current April 2026 tooling and browser-native replacements where that makes the code simpler.

## Baseline

- Angular 21.2
- Angular CLI 21.2.8
- Angular build 21.2.8
- TypeScript 5.9
- RxJS 7.8
- npm 11.11.1
- Node 22.20.0

## What was lifted

- Core row and column concepts in strict TypeScript
- Legacy-style sort behavior ported into pure TypeScript utilities
- Legacy-style filter parsing and wildcard matching ported into pure TypeScript utilities
- Inline CSV export implemented with `Blob` and `URL.createObjectURL`

## What was dropped or replaced

- AngularJS modules, directives, `$scope`, `$compile`, `$parse`, `$timeout`
- Bower and Grunt
- Less build tooling
- Legacy browser polyfills no longer needed on current evergreen browsers
- Exporter dependencies where native browser download APIs are sufficient

## Project shape

- `src/app/grid/` contains the modern grid primitives and standalone component
- `src/app/app.ts` wires a demo dataset into the new grid shell
- `src/styles.scss` defines the global visual system for the lift-and-shift workspace

## Development

Install dependencies if needed:

```bash
npm install
```

Run the app locally:

```bash
npm start
```

Build the app:

```bash
npm run build
```

Run tests:

```bash
npm test
```

## Migration note

This first pass establishes the modern Angular foundation and ports the portable core behaviors. Feature packages from the legacy repo such as selection, pagination, grouping, tree, and editing should be added back as focused standalone features rather than as a monolithic AngularJS compatibility layer.

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
