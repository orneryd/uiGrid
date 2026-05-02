# Changelog

## v0.1.7-hotfix — 2026-05-02

### Fixed

- **Angular / web components / vanilla horizontal scroll layout** — `.grid-frame` was using `display: flex; flex-direction: column` with `.grid-table` as a `flex: 1 1 auto` child. When scrolled to the far right, the flex sizing model caused column tracks to misalign with their headers. Changed both selectors in `grid.core.styles.scss` to match the React wrapper's simpler approach: `.grid-frame` keeps only `overflow: hidden` and `.grid-table` uses `display: grid`. All three non-React host types (Angular, web components, vanilla) share this file, so all three are fixed by the single change.
- **React demo `mountUiGrid` import (TS2305)** — `src/types/ornery-ui-grid-react.d.ts` contained an ambient `declare module` block that overrode the tsconfig `paths` alias and resolved `@ornery/ui-grid-react` to the stale `dist/index.d.mts`, which did not export `mountUiGrid`. Deleted the ambient declaration file so the `paths` alias (`projects/ui-grid-react/src/index.ts`) resolves correctly. Added `"jsx": "react-jsx"` to `tsconfig.json` and included the React source in `tsconfig.app.json` includes so the React demo page compiles without errors.
- **GitHub Pages broken image** — The egui screenshot on the `/rust` page used an absolute path (`/docs/screenshots/pinning-100k.png`) which does not resolve under the Pages sub-path. Changed to a root-relative path (`docs/screenshots/pinning-100k.png`) and copied the asset to `public/docs/screenshots/` so it is bundled with the Angular build output.

### Added

- **`/rust` top-level page** — new hero page at `/rust` with a switchable tab layout: *Rust / WASM* (browser delivery) and *egui Native* (desktop/native delivery). Replaces the previous docs-embedded Rust landing and presents both delivery paths as first-class options.
- **egui pinned-grid screenshot** — `docs/screenshots/pinning-100k.png` added to the egui tab of the Rust page, showing fixed headers and pinned-column layout at 100 k rows.

## v0.1.7 — 2026-05-01

### Rust

- Brought eGui widget into feature partiy with angular, pinnable columns, save load state, CSV/overridable export, overridable controls, a11y, 118n, and more...
- Added a new top-level Rust landing page at `/rust` with a hero header and switchable Rust/WASM and egui tabs.
- Expanded the Rust / egui docs with install, minimal usage, feature recipes, pinning, save/restore state, CSV export, column extensions, and a native demo workflow.
- Added a pinned-grid screenshot at the top of the egui section to show the native desktop layout and fixed-header / pinned-column behavior.
- Refreshed the Rust docs to present Rust/WASM and egui as complementary delivery paths for browser and native hosts.

### Added

- **`@ornery/ui-grid-core` package** — shared logic (grid engine, state, filtering, sorting, grouping, pagination, pinning, infinite scroll, tree, WASM bridge) is now published as a standalone package with zero Angular and zero React peer dependencies. React, Angular, and the new Vanilla/Web Component builds all consume it.
- **Vanilla / Web Component build (`@ornery/ui-grid-vanilla`)** — full-featured grid delivered as native Custom Elements with no framework runtime requirement. Reaches feature parity with the Angular and React wrappers.
- **Drag-and-drop column reordering** — column headers in the React wrapper can now be dragged to reorder columns interactively.
- New CI workflows for Vanilla (`ci-vanilla.yml`) and Rust (`rust.yml`). The Rust workflow triggers only on changes to Rust source files.
- Single unified release workflow (`publish.yml`) triggered by a `v*` tag: publishes `ui-grid-core` first, then React, Vanilla, and Web in parallel once the core version is available on the npm registry.

### Changed

- **React install no longer pulls in Angular peer dependencies.** Angular-specific deps (`@angular/core`, `@angular/common`, `rxjs`) were runtime-polluting React installs; they now live only in the Angular (`@ornery/ui-grid`) package.
- Grid business logic extracted from `@ornery/ui-grid` (Angular) and `@ornery/ui-grid-react` into `@ornery/ui-grid-core`. All three framework packages are now thin wrappers over the shared core.
- Individual package publish workflows (`publish-core.yml`, `publish-react.yml`, `publish-vanilla.yml`) are manual-only fallbacks; the `v*` tag drives the full release suite automatically.

### Fixed

- Vanilla package manifest no longer ships with a `file:` dependency on `ui-grid-core`; uses a proper semver range so the published package resolves correctly.

## v0.1.6 (web) — 2026-04-30

### Added

- **Column pinning across Angular and React** — freeze columns left or right with CSS `position: sticky`, `enablePinning`, `pinnedLeft`/`pinnedRight`, save/restore support, and `gridApi.pinning.pinColumn()` for programmatic control.
- Angular/React header pin controls with explicit left/right actions, direct unpinning, and matching pinning labels in `GridLabels` and `en-US.json`.
- React wrapper docs page mounted inside the Angular docs app so wrapper behavior can be verified directly in the published documentation.
- Expanded `--ui-grid-*` CSS variable coverage for pinning, layout, controls, scrolling, and state styling.
- Release packaging now includes the Rust/WASM core artifacts and CI provisions the Rust toolchains needed to build them.

### Changed

- Framework wrappers now route more work through the Rust/WASM core where it improves performance without changing the public API.
- React docs/demo column widths and header layout were widened so header text and pin controls fit cleanly.
- Docs and Pages packaging were updated so the published site can bundle and serve the React wrapper consistently.

### Fixed

- Pin button behavior now matches between Angular and React, including left/right pin selection, pin-state icon behavior, and unpin flows.
- React pinned-column ordering, sticky offsets, and virtualized header/body alignment were corrected.
- GitHub Pages now mounts the React docs island correctly in production, including local alias/resolver fixes for `@ornery/ui-grid-react` and wrapper-owned mounting to avoid React runtime mismatches.
- React virtualization tests and docs build type resolution were updated for the current wrapper output and import surface.
- Pin button visibility uses the same opt-out behavior as the rest of the grid feature flags, and React cell focusing now escapes selector values safely.

## v0.1.2 (Rust crates) — 2026-04-30

### Added

- Rust packaging, screenshots, and documentation updates for the crate workspace and WASM distribution.
- CI/build pipeline support for Rust toolchains and packaging the WASM core alongside the web deliverables.

### Changed

- Framework wrappers now use as much of the Rust/WASM core as possible without regressing interactive performance.
- Bumped the Rust workspace crates from `0.1.1` to `0.1.2` via the workspace-level `Cargo.toml`.

### Fixed

- **egui: Row expansion click handling** — expand/collapse icons in `ui-grid-egui` no longer lose clicks to the full-cell overlay.
- Clicking the expand icon now selects the row without focusing the cell or entering edit mode.
- Double-clicking the expand icon no longer triggers cell editing.
- Expand icon hit target increased from `16x16` to `24x24` for easier interaction.

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
