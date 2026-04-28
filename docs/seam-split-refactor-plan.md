# ui-grid Seam Split Refactor Plan

## Goal

Refactor the current Angular-first library into a framework-agnostic grid core with thin framework adapters, while preserving the existing Angular API and behavior during the transition.

This plan is about supporting more than the current Angular implementation path. It does not attempt to revive AngularJS-era internals, and it does not treat the custom element build as a sufficient portability layer. The target is a true headless core that can back Angular, web components, and future adapters.

## Implementation Status

Current progress as of the latest refactor pass:

- `projects/ui-grid/src/lib/grid/grid.core.ts` is now a barrel over smaller core feature files instead of a single large implementation unit
- the shared core is now split into feature-level modules for pagination, identity, edit-state, infinite-scroll, row-state, saved-state, and pipeline/export logic
- the old pipeline implementation file is now further decomposed so filtering, sorting, grouping, and tree traversal each live in their own core modules with `buildGridPipeline(...)` reduced to orchestration
- CSV header and row serialization now live in a dedicated core export module while the Angular adapter keeps only renderer-aware value selection and browser download transport
- renderer-agnostic cell context and display formatting now live in a dedicated core display module, and the Angular adapter delegates resize observation, CSV download transport, and shadow-DOM focus behavior through smaller host helpers
- option-derived UI predicates for grouping, filtering, pagination, column movement, and tree/expand toggles now live in a shared view-model helper module instead of inside the Angular component
- remaining pure view-model calculations such as button labels, input types, column widths, and tree indentation now also live in the shared view-model helper module, leaving the component with mostly thin template-facing wrappers
- grouped-state and expanded-state view helpers now also live in the shared view-model module, and adapter event-raising has started moving behind a dedicated `ui-grid.events.ts` helper instead of being inlined throughout the component
- render lifecycle, visible-row, canvas-height, resize, and scroll event dispatch now also route through `ui-grid.events.ts`, so the Angular component no longer calls `gridApi.*.raise(...)` directly in its main effect and lifecycle paths
- grouping toggles, column-order mutations, visible-column reorder logic, and restore-state planning now have a dedicated `ui-grid.state.ts` helper, leaving the component with mostly signal updates plus API/event delegation in those flows
- adapter-side mutation orchestration now also has a dedicated `ui-grid.commands.ts` helper for filter, sort, grouping, column-order, pagination, restore-state, row/tree expansion, infinite-scroll, and edit-session commands, so those non-DOM state transitions no longer sit inline beside the component's host integration code
- pagination math and header label handling are now shared helpers instead of component-only logic
- the Angular adapter currently delegates its core pipeline and virtualization checks to the shared core while keeping browser-only behavior in the component
- pure sanitization and safe-state helpers now live in the shared core and the adapter calls them directly
- save-state snapshot assembly now lives in the shared core while restore-state normalization and mutation planning are split across the shared core and adapter-side helper modules
- row-id resolution and row lookup now live in the shared core and the adapter delegates to them
- the main grid SCSS now lives in a shared core stylesheet module that the Angular stylesheet wrapper consumes
- restore-state normalization now lives in the shared core while the adapter keeps signal mutation and event raising
- row invisibility, expandable-row state, and tree expansion state transitions now live in the shared core while adapter-side command orchestration and event emission are split into dedicated helper modules
- sort-state construction, pagination command helpers, restore-state follow-through, and infinite-scroll state/request coordination now live behind shared core plus adapter command helpers while the component keeps viewport integration and remaining browser-only behavior
- edit-session state transitions and their event dispatch now live behind adapter command helpers while the component keeps DOM focus transport, edit parsing, row mutation, and next-cell navigation
- editor value conversion, printable-key detection, and focus-to-edit decisions now live in the shared core while the adapter keeps keyboard event wiring and DOM focus transport
- Angular still owns CSV export because it must preserve cell-renderer-aware output and browser download behavior
- the component remains the adapter surface for Angular-specific state, focus, keyboard, and DOM behavior
- the next extraction step is to keep shrinking the Angular adapter around browser-only and DOM-only behaviors, especially the initialization/reset path, row invisibility commands, and any remaining non-focus edit wrappers, rather than growing the core barrel again
- the focused `UiGridComponent` test slice passed again after restoring the missing adapter wrappers

## Why This Refactor Is Needed

Today, `UiGridComponent` in `projects/ui-grid/src/lib/grid/ui-grid.component.ts` owns too many responsibilities at once:

- framework reactivity through Angular signals and effects
- rendering decisions and template state
- browser integration such as DOM measurement, downloads, focus, and scroll handling
- feature orchestration for sorting, filtering, grouping, pagination, expansion, tree view, editing, infinite scroll, save-state, and SSR slicing
- the main `buildPipeline()` data transformation path

The repo already has partial seams we can build on:

- `grid.models.ts` defines most of the public data contracts
- `grid.api.ts` provides a compatibility-friendly command and event surface
- `row-searcher.ts`, `row-sorter.ts`, and parts of `grid.utils.ts` are already largely framework-agnostic

The problem is that the feature logic is still hosted by the Angular component rather than by a reusable core.

## Refactor Goals

1. Preserve the current Angular public API during the refactor.
2. Make the pure data pipeline and state transitions framework-agnostic.
3. Keep rendering, DOM access, and browser-specific behavior in adapters.
4. Make SSR behavior part of the portable core contract where possible.
5. Create boundaries that later allow a Rust engine without forcing a rewrite first.

## Non-Goals

1. Rewriting the templates or visual design system first.
2. Replacing Angular CDK virtualization immediately.
3. Breaking `gridOptions`, `columnDefs`, `onRegisterApi`, or `gridApi` for existing users.
4. Shipping multiple new framework adapters in the same refactor phase.

## Target Architecture

The end state should separate the system into three layers.

### 1. Grid Core

Pure, framework-agnostic logic. This layer owns:

- normalized options and column metadata
- row identity and normalized row models
- filtering, sorting, grouping, pagination, expansion, tree, and selection state
- edit-state transitions and keyboard-navigation intent state
- visible-row pipeline computation
- SSR visible-window calculation
- save-state serialization and restore-state validation
- CSV serialization rules that do not depend on browser download APIs

### 2. Adapter Layer

Framework-specific orchestration. For Angular this layer owns:

- Angular signals and effects
- translation between Angular inputs and core snapshots
- event wiring between the core and `grid.api.ts`
- template-facing computed values
- CDK virtualization integration
- drag and drop integration

Future React, Vue, Svelte, Dioxus, or Yew adapters would implement equivalent bindings without owning the grid rules themselves.

### 3. Host Integration Layer

Environment and platform concerns. This layer owns:

- DOM measurement and `ResizeObserver`
- file download initiation for CSV export
- focus and selection operations against real elements
- browser scroll restoration
- clipboard access
- accessibility hooks tied to actual rendered elements

## Recommended Initial Module Split

The first refactor should stay inside the existing library package and extract modules before any package-level reshuffle.

Recommended module targets:

- `grid/contracts/`
  - move or split types from `grid.models.ts` into stable framework-neutral contracts
- `grid/core/normalize/`
  - option normalization, column normalization, row identity helpers
- `grid/core/pipeline/`
  - extract `buildPipeline()` and supporting display-item generation
- `grid/core/features/filtering/`
  - build on `row-searcher.ts`
- `grid/core/features/sorting/`
  - build on `row-sorter.ts`
- `grid/core/features/grouping/`
  - group tree flattening and collapse state
- `grid/core/features/pagination/`
  - page size, page bounds, external pagination behavior
- `grid/core/features/editing/`
  - editing state, transitions, and patch application semantics
- `grid/core/features/tree/`
  - tree expansion and flattening
- `grid/core/features/expandable/`
  - expandable-row state and display items
- `grid/core/features/save-state/`
  - serialization, validation, and restore transforms
- `grid/core/features/export/`
  - CSV row generation and filename sanitization policy inputs
- `grid/core/features/viewport/`
  - virtualization heuristics and SSR visible-row math
- `grid/angular-adapter/`
  - Angular signals, effects, CDK bindings, and component-specific event handlers

## Explicit Ownership Split

### Move Into Core

- `buildPipeline()` and its supporting transforms
- column ordering and grouping state transitions
- sort and filter state transitions
- pagination math
- tree and expandable flattening
- save-state shape validation
- CSV row and cell generation rules
- SSR visible slice calculation
- benchmark timing hooks at the logical pipeline level

### Keep In Angular Adapter

- `Component`, template, and style files
- `input.required<GridOptions>()`
- Angular `signal`, `computed`, and `effect` wiring
- `CdkVirtualScrollViewport`, `CdkDropList`, `CdkDrag`
- direct `ElementRef` access
- `ResizeObserver` usage
- browser event objects and DOM focus handoff
- download triggering through `Blob`, `URL`, and anchors

### Keep In Host Integration Utilities

- element queries
- scroll position reading and restoration
- file download transport
- browser-only measurement APIs

## API Strategy

`grid.api.ts` should remain the compatibility facade during the refactor.

Instead of exposing the new core directly to Angular consumers, the Angular adapter should continue to implement `UiGridApi` and delegate to the extracted core.

This reduces migration risk because:

- tests can keep asserting the existing API surface
- Angular users do not need to change application code
- future adapters can choose either the compatibility API or a slimmer native wrapper

## Phased Plan

## Phase 0: Baseline and Characterization

Deliverables:

- freeze current behavior with focused tests around sorting, filtering, grouping, pagination, editing, save-state, CSV export, infinite scroll, and SSR visible-row behavior
- document which current behaviors are intentionally Angular-specific

Exit criteria:

- the current Angular component is covered well enough that extraction work can be validated by behavior rather than by inspection

## Phase 1: Extract Pure Contracts and Pipeline Inputs

Deliverables:

- define normalized core inputs and outputs
- separate template types from portable contracts where needed
- remove direct Angular types from contracts that should become adapter-neutral

Exit criteria:

- the pipeline can be described entirely in plain TypeScript objects without Angular imports

## Phase 2: Extract the Pipeline Engine

Deliverables:

- move `buildPipeline()` and display-item generation into `grid/core/pipeline`
- keep Angular calling into the new engine
- make the engine return a render model instead of directly depending on component state

Exit criteria:

- the Angular component no longer computes the pipeline inline

## Phase 3: Extract Feature State Machines

Deliverables:

- isolate state transitions for filtering, sorting, grouping, pagination, expansion, tree view, and editing
- define command-oriented functions that consume prior state and return next state

Exit criteria:

- most command handlers currently bound in `createGridApi(...)` delegate to extracted feature modules

## Phase 4: Introduce Adapter Interfaces

Deliverables:

- define adapter-side interfaces for viewport metrics, focus handoff, file download, and scheduler hooks
- move DOM-only behavior out of the core path

Exit criteria:

- the extracted core is executable in non-Angular tests without browser globals

## Phase 5: Shrink `UiGridComponent`

Deliverables:

- reduce `UiGridComponent` to input normalization, Angular signal wiring, template bindings, and host integration
- keep SSR and browser harness tests green

Exit criteria:

- the component is clearly an adapter, not the engine

## Phase 6: Package and Adapter Follow-On Work

Deliverables:

- decide whether to keep the core inside the existing Angular library package or publish it as a sibling package
- define the first non-Angular adapter target

Exit criteria:

- the project can add a second adapter without copying grid logic

## Recommended File Evolution

Short term, keep the work under `projects/ui-grid/src/lib/grid/` to avoid a packaging detour.

Mid term, aim for a structure closer to:

```text
projects/ui-grid/src/lib/
  core/
    contracts/
    pipeline/
    features/
    host/
  angular/
    ui-grid.component.ts
    ui-grid.component.html
    ui-grid.component.scss
    angular-grid.adapter.ts
  public-api.ts
```

The key rule is that `core/` must not import Angular or CDK.

## Risks

### Risk: False portability

If the refactor only wraps the current Angular component more cleanly, the grid will still be Angular-first under the hood.

Mitigation:

- enforce a no-Angular-imports rule for the core folder
- keep focused tests that run against pure core modules

### Risk: Adapter leakage

Features like editing and virtualization can accidentally encode DOM assumptions into the core.

Mitigation:

- represent user intent in the core, not DOM instructions
- keep actual element focus and scroll behavior in host integration utilities

### Risk: Public API churn

Changing `gridOptions` or `gridApi` too early will slow the refactor and create migration noise.

Mitigation:

- preserve the current compatibility surface until the core is stable

## Success Criteria

This seam split is successful when all of the following are true:

- Angular still ships with the same public usage model
- the main pipeline and state logic can run without Angular imports
- SSR visible-row behavior is computed in the portable layer
- a second adapter can be started without copying feature logic from `UiGridComponent`
- the future Rust effort can target the core instead of the component

## Recommended Next Step

Start with Phase 1 and Phase 2 together:

- define normalized core contracts
- extract the pipeline engine behind the current component

That is the highest-value seam because it removes the biggest concentration of mixed responsibilities without forcing a public API break.