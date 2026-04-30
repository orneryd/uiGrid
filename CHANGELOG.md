# Changelog

## v0.1.5 (web) — 2026-04-30

### Added

- **Column Pinning** — freeze columns left/right via CSS `position: sticky`. New `enablePinning` option on `GridOptions` and `GridColumnDef`, `pinnedLeft`/`pinnedRight` column def properties, and `gridApi.pinning.pinColumn()` programmatic API. Pinning state is included in save/restore. Implemented for both Angular and React.
- Header pin control for choosing left or right pinning, with direct unpin on already-pinned columns.
- `FEATURE_PINNING` compile-time feature flag for tree-shaking.
- Pinning labels (`pinColumn`, `pinLeft`, `pinRight`, `unpin`) added to `GridLabels` and `en-US.json`.
- Pinned column styles with opaque backgrounds and edge shadow indicators.
- Expanded public `--ui-grid-*` CSS variable coverage for layout, controls, scrolling, pinning, and state styling. See [Theming](./docs/theming.md).

### Fixed

- Pin button visibility now uses opt-out pattern (`enablePinning !== false`) consistent with other features.
- Reduced redundant `pinnedOffset()` calls per cell in Angular and React renders.
- Removed unnecessary `as any` casts in `buildInitialPinnedState`.
- Added `CSS.escape()` to selector-based cell focusing in React to prevent selector injection from special characters in row IDs.

## v0.1.1 (Rust crates) — 2026-04-30

### Fixed

- **egui: Row expansion click handling** — Expand/collapse icons in `ui-grid-egui` were not responding to clicks because the full-cell click overlay was stealing interaction from the icon button. Replaced the interactive icon button with a passive visual icon and moved click handling into the cell overlay with hit-testing against the icon rect.
- Clicking the expand icon now selects the row without focusing the cell or entering edit mode.
- Double-clicking the expand icon no longer triggers cell editing.
- Expand icon hit target increased from 16×16 to 24×24 for easier clicking.

### Changed

- Bumped all Rust crate versions from 0.1.0 to 0.1.1 (workspace-level `Cargo.toml`).

## v0.1.3 - 2026-04-28

### Added

- React wrapper package (`@ornery/ui-grid-react`) with `useGridState` hook, `useVirtualScroll` hook, render-prop templating, and full CSS theming parity. Ships ESM + CJS + `.d.ts` via tsup. Peer-depends on `@ornery/ui-grid` for 100% core reuse.
- Build-time feature flags (`grid.features.ts`): 12 const boolean flags enabling bundler dead-code elimination. Custom build script (`scripts/build-grid.mjs`) with `--features` and `--locale` flags.
- Internationalization: `GridLabels` interface (26 keys) backed by `i18n/en-US.json`, overridable at runtime via `GridOptions.labels` and at build time via `--locale`.
- Accessibility: ARIA grid pattern roles, SVG icons replacing text symbols, `aria-label` and `sr-only` screen reader text on all interactive controls. Remediation plan at `docs/plans/a11y-remediation.md`.
- Pure-TS core extraction: `grid.core.pipeline.ts`, `grid.core.viewmodel.ts`, `grid.core.edit.ts`, `grid.core.display.ts`, `grid.core.sorting.ts`, `grid.core.filtering.ts`, `grid.core.grouping.ts`, `grid.core.pagination.ts`, `grid.core.tree.ts`, `grid.core.state.ts`, `grid.core.export.ts`, `grid.core.identity.ts`, `grid.core.row-state.ts`, `grid.core.infinite-scroll.ts`, and `grid.core.types.ts` with zero Angular dependencies.
- Command and event layer: `ui-grid.commands.ts`, `ui-grid.events.ts`, `ui-grid.host.ts`, and `ui-grid.state.ts` separating Angular orchestration from pure logic.
- SSR harness component (`grid-ssr-harness.component.ts`) and server-side rendering guards.
- Documentation site with routed pages for Getting Started, Features, API Reference, Cell Editing, Expandable Rows, Tree View, Theming, i18n, Custom Builds, Web Component, Accessibility, and React.
- React CI workflow (`.github/workflows/ci-react.yml`).
- Library presets via `scripts/build-library-preset.mjs` with separate public API entry points (`public-api.core.ts`, `public-api.full.ts`, `public-api.minimal.ts`, `public-api.react.ts`).
- Combined `npm test` script that runs both Angular and React test suites.

### Changed

- Slimmed `ui-grid.component.ts` from monolithic class to thin rendering layer delegating to core modules and command functions.
- Moved grid styles from `ui-grid.component.scss` into shared `grid.core.styles.scss` with new `.toggle-icon`, `.pagination-icon`, and `.group-disclosure-icon` styles.
- Refactored demo app with routed layout, cleaner theme controls, and browser harness integration.
- Updated `README.md` for new project structure and feature set.

### Fixed

- jsdom cross-realm `dispatchEvent` error in CI: replaced `new KeyboardEvent()` with `document.createEvent()` + `initEvent()` + property descriptors to work around realm-checking validation.
- Keyboard event handling for cell editing in test environment (`bubbles: false` to prevent double-handling).

## v0.1.1 - 2026-04-27

### Added

- Demo theming for default and wireframe modes with light and dark variants.
- A 100,000-row demo dataset to showcase virtualization and performance.
- GitHub Pages deployment and packaging automation for the demo and library builds.
- CI coverage upload to Coveralls and expanded library coverage around the grid, filters, and API wrappers.

### Changed

- Updated the demo shell styling, removed the shark logo study, and improved header contrast.
- Raised the production style budget to accommodate the expanded demo UI.
- Narrowed CI and Pages triggers to project-relevant paths.
- Improved the demo harness and styles so theme variables pass cleanly through the shadow DOM layers.

### Security

- Hardened CSV export against spreadsheet formula injection.
- Blocked prototype-polluting dotted paths in nested property access and writes.
- Escaped filter text before regex construction, capped wildcard expansion, and sanitized restored state keys and filenames.

## v0.1.0 - 2026-04-27

Initial public release of `@ornery/ui-grid`.

### Features

- Angular 21 standalone grid component
- Shadow DOM encapsulation with CSS custom properties and `part` hooks
- Sorting, filtering, grouping, and column moving
- Virtualized rendering with Angular CDK
- Inline cell editing with spreadsheet-style keyboard navigation
- Pagination controls and programmatic pagination API
- Infinite scroll hooks
- Auto-resize hooks
- CSV export
- Benchmark hook
- Transient save/restore state support
- Tree view and expandable-row support
- Web component build output
- Browser demo app for GitHub Pages

### Usage Examples

#### Basic Angular usage

```ts
import { Component } from '@angular/core';
import { UiGridComponent } from '@ornery/ui-grid';

@Component({
  selector: 'app-customers',
  imports: [UiGridComponent],
  template: `<app-ui-grid [options]="gridOptions" />`,
})
export class CustomersComponent {
  gridOptions = {
    id: 'customers',
    title: 'Customers',
    data: [
      { id: '1', name: 'Bob', status: 'Active', revenue: 1200 },
      { id: '2', name: 'Alice', status: 'Pilot', revenue: 900 },
    ],
    columnDefs: [
      { name: 'name', displayName: 'Customer' },
      { name: 'status' },
      { name: 'revenue', align: 'end' },
    ],
    enableSorting: true,
    enableFiltering: true,
    enableGrouping: true,
    enableColumnMoving: true,
  };
}
```

#### Cell templating

```ts
import { Component, TemplateRef, viewChild } from '@angular/core';
import { GridCellTemplateContext, UiGridComponent } from '@ornery/ui-grid';

@Component({
  selector: 'app-templated-grid',
  imports: [UiGridComponent],
  template: `
    <ng-template #statusTemplate let-value>
      <span class="status-pill">{{ value }}</span>
    </ng-template>

    <app-ui-grid [options]="gridOptions" />
  `,
})
export class TemplatedGridComponent {
  private readonly statusTemplate =
    viewChild.required<TemplateRef<GridCellTemplateContext>>('statusTemplate');

  readonly gridOptions = {
    id: 'templated-customers',
    data: [
      { id: '1', name: 'Bob', status: 'Active', revenue: 1200 },
      { id: '2', name: 'Alice', status: 'Pilot', revenue: 900 },
    ],
    columnDefs: [
      { name: 'name', displayName: 'Customer' },
      { name: 'status', cellTemplate: this.statusTemplate() },
      { name: 'revenue', align: 'end' },
    ],
  };
}
```

#### Expandable-row templating

```ts
import { Component, TemplateRef, viewChild } from '@angular/core';
import { GridExpandableTemplateContext, UiGridComponent } from '@ornery/ui-grid';

@Component({
  selector: 'app-expandable-grid',
  imports: [UiGridComponent],
  template: `
    <ng-template #detailTemplate let-row>
      <div class="detail-card">
        <strong>{{ row.name }}</strong>
        <p>Status: {{ row.status }}</p>
      </div>
    </ng-template>

    <app-ui-grid [options]="gridOptions" />
  `,
})
export class ExpandableGridComponent {
  private readonly detailTemplate =
    viewChild.required<TemplateRef<GridExpandableTemplateContext>>('detailTemplate');

  readonly gridOptions = {
    id: 'expandable-customers',
    data: [
      { id: '1', name: 'Bob', status: 'Active', revenue: 1200 },
      { id: '2', name: 'Alice', status: 'Pilot', revenue: 900 },
    ],
    columnDefs: [
      { name: 'name', displayName: 'Customer' },
      { name: 'status' },
      { name: 'revenue', align: 'end' },
    ],
    enableExpandable: true,
    expandableRowHeight: 120,
    expandableRowTemplate: this.detailTemplate(),
  };
}
```

#### Web component usage

```html
<ui-grid-element></ui-grid-element>
<script type="module" src="./dist/ui-grid-element/main.js"></script>
<script>
  const grid = document.querySelector('ui-grid-element');
  grid.options = {
    id: 'customers',
    data: [
      { id: '1', name: 'Bob', status: 'Active', revenue: 1200 },
      { id: '2', name: 'Alice', status: 'Pilot', revenue: 900 },
    ],
    columnDefs: [{ name: 'name' }, { name: 'status' }, { name: 'revenue' }],
  };
</script>
```
