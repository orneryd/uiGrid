# Wrapper Refactor: Plan

**Status:** draft, pre-implementation
**Author:** Claude (pair)
**Date:** 2026-05-07

## Goal

Collapse the three rendering engines (vanilla `<ui-grid-element>`, Angular
`UiGridComponent`, React `useGridState`) down to **one** — the vanilla web
component. Angular and React become thin wrappers that project native
templates into the vanilla element's slots. Every feature ships once,
every bug is fixed once.

The wrappers must offer the **same declarative surface as the vanilla web
component** (attributes, slots, event names) so that a consumer who reads
the vanilla docs can write idiomatic Angular / React without learning a
new mental model.

## Non-Goals

- **Not** a re-architecture of the core pipeline / WASM bridge / event bus.
  Those are already shared.
- **Not** changing the public `GridOptions` / `UiGridApi` shape. The
  wrappers map framework-native props onto the existing types.
- **Not** deleting any existing test. Every test that currently passes on
  Angular / React must pass after the refactor.

## Current Scale (LoC)

| Module                                         | Lines   |
| ---------------------------------------------- | ------- |
| `ui-grid-vanilla/ui-grid-standalone.element.ts`| ~3,700  |
| `ui-grid-vanilla/grid-controller.ts`           | ~2,300  |
| `ui-grid/ui-grid.component.ts` (Angular)       | ~1,900  |
| `ui-grid-react/useGridState.ts`                | ~1,900  |

After the refactor, we expect:

| Module                             | Lines   | Notes                                 |
| ---------------------------------- | ------- | ------------------------------------- |
| Vanilla element + controller       | unchanged | Source of truth. Grows as features ship. |
| Angular wrapper                    | 400–600 | See "LoC budget" below.               |
| React wrapper                      | 400–600 | Same.                                 |

**These are realistic estimates, not the optimistic 200 from the first
sketch.** The cell-template bridge, lifecycle management under
virtualization, and change detection plumbing are where the code lives.

## Architecture

```
Consumer code
    ↓  framework-native props + templates
Thin wrapper  (Angular component / React component)
    ↓  options + slot projection
<ui-grid-element>   (vanilla web component, shadow DOM)
    ↓
@ornery/ui-grid-core   (pipeline + state + WASM bridge)
```

The wrapper is responsible for **four** things and nothing else:

1. **Props → attributes / imperative `options` setter.** Every declarative
   attribute the web component accepts (see `observedAttributes`) maps to
   an input in the wrapper with the same semantic.
2. **Framework templates → slotted `<template>` blocks.** An
   `ng-template` / JSX render prop becomes a real DOM `<template
   slot="cell-{columnName}">` inside the light DOM of the custom element.
3. **Event forwarding.** Every `CustomEvent` the element dispatches is
   re-emitted as a framework-native output / callback prop with the same
   name.
4. **API passthrough.** `onRegisterApi` is forwarded verbatim; consumers
   get the same `UiGridApi` object as the vanilla grid.

Everything else — virtualization, pinning, column moving, row-edit
state, selection, validation, export, import, save-state, cellNav — lives
in the vanilla element and the core package. The wrapper does not
duplicate any of it.

## Declarative Surface Parity

The vanilla element exposes its API three ways:

1. **HTML attributes** (listed in `observedAttributes`) — scalars,
   booleans, and JSON-encoded structures like `data` / `columnDefs` /
   `grouping`.
2. **`<template slot="…">` blocks in the light DOM** — for cell
   templates, expandable row content, header / filter overrides.
3. **`element.options = …` + DOM events** — the imperative path for
   anything attributes can't carry (callbacks, class instances, live data).

The wrappers mirror this surface one-to-one:

### Angular DX

```html
<app-ui-grid
  grid-id="customers"
  [data]="rows"
  [column-defs]="columns"
  [enable-sorting]="true"
  [enable-filtering]="true"
  [enable-pinning]="true"
  [row-height]="48"
  [viewport-height]="400"
  (rowSelectionChanged)="onRowSelected($event)"
  (saveRow)="onSaveRow($event)">

  <!-- Cell templates — one per column, projected as <template slot="cell-…"> -->
  <ng-template uiGridCell="price" let-value let-row="row">
    <span [style.color]="row.changeColor">{{ value | currency }}</span>
  </ng-template>

  <ng-template uiGridCell="status" let-value>
    <span class="pill pill-{{ value }}">{{ value }}</span>
  </ng-template>

  <!-- Expandable detail row -->
  <ng-template uiGridExpandable let-row>
    <app-customer-detail [customer]="row" />
  </ng-template>
</app-ui-grid>
```

Matching idioms:

- Kebab-case attribute inputs (`grid-id`, `enable-sorting`, …) mirror the
  web component's `observedAttributes` exactly.
- Event names (`rowSelectionChanged`, `saveRow`, `needLoadMoreData`, …)
  match the custom event names the element dispatches.
- Structural directives (`uiGridCell`, `uiGridExpandable`) replace the
  vanilla `<template slot="cell-name">` but produce the same rendered
  slots at runtime.

### React DX

```tsx
<UiGrid
  gridId="customers"
  data={rows}
  columnDefs={columns}
  enableSorting
  enableFiltering
  enablePinning
  rowHeight={48}
  viewportHeight={400}
  onRowSelectionChanged={handleRowSelected}
  onSaveRow={handleSaveRow}
  cellRenderers={{
    price: (ctx) => (
      <span style={{ color: ctx.row.changeColor }}>
        {formatPrice(ctx.value)}
      </span>
    ),
    status: (ctx) => <StatusPill value={ctx.value} />,
  }}
  expandableRenderer={(ctx) => <CustomerDetail customer={ctx.row} />}
/>
```

Matching idioms:

- camelCase prop aliases (`gridId`, `enableSorting`) map to the same
  attributes the vanilla element observes.
- Event names mirror the element's `CustomEvent` names with an `on`
  prefix (`onRowSelectionChanged` → `rowSelectionChanged`).
- `cellRenderers` object keyed by column name mirrors the slot naming
  convention (`cell-price`, `cell-status`). An individual render prop
  (`cellRenderer={(ctx) => …}`) is also accepted and routed to every
  column that doesn't have a specific entry.

## Template Bridge Design

This is the load-bearing part. Every cell, every group row, every
expandable row rendered by the vanilla element currently runs a string
interpolation pipeline (`{{expression}}` / `${expression}` in
`getTemplateMarkup` + `interpolateTemplate`). We keep that for the
vanilla path and add a second path: **framework-rendered slot
projection**.

### Rendering modes

Each cell can render in one of three modes, decided at wrapper mount:

1. **Default.** No template provided. The element renders
   `formatGridCellDisplayValue(context)` directly. No wrapper work.
2. **Vanilla template.** Consumer passes a string template. The element
   interpolates it. No wrapper work.
3. **Framework-rendered.** Wrapper owns cell rendering. The element emits
   an empty `<slot name="cell-columnName-row-rowId">` per rendered cell;
   the wrapper creates a framework-native view and inserts it into the
   light DOM with a matching `slot` attribute.

Mode 3 is new and requires a small element extension: **per-row slot
names** (currently the element only emits `cell-<columnName>`, which
means one template for every row in that column). The extension:

- When the wrapper calls `element.setFrameworkRenderedColumns(["price",
  "status"])`, the element re-renders those columns with per-cell slot
  names: `cell-<columnName>-<rowId>`.
- The element dispatches a new event
  `cellSlotsChanged ({ added: Slot[], removed: Slot[] })` whenever the
  virtual window or column set changes. Each `Slot` carries `{ columnName,
  rowId, context }`.
- The wrapper subscribes: on `added` it creates a framework view; on
  `removed` it destroys it.

This keeps the element authoritative about which slots exist (driven by
virtualization + pinning + grouping) and keeps the wrapper focused on a
single concern: lifecycle of framework views.

### Angular bridge

```ts
@Directive({ selector: 'ng-template[uiGridCell]' })
export class UiGridCellTemplateDirective {
  @Input('uiGridCell') columnName!: string;
  constructor(public readonly template: TemplateRef<GridCellTemplateContext>) {}
}

@Component({
  selector: 'app-ui-grid',
  template: `<ui-grid-element #host></ui-grid-element>`,
  encapsulation: ViewEncapsulation.None,   // let the element own the shadow DOM
})
export class UiGridComponent implements AfterContentInit, OnDestroy {
  @ContentChildren(UiGridCellTemplateDirective)
  cellTemplates!: QueryList<UiGridCellTemplateDirective>;

  @ViewChild('host', { static: true })
  host!: ElementRef<UiGridElement>;

  private viewRefs = new Map<string, EmbeddedViewRef<unknown>>();

  ngAfterContentInit(): void {
    const columns = this.cellTemplates.map((t) => t.columnName);
    this.host.nativeElement.setFrameworkRenderedColumns(columns);
    this.host.nativeElement.addEventListener('cellSlotsChanged', this.handleSlotsChanged);
  }

  private handleSlotsChanged = (event: CustomEvent<CellSlotsChangedDetail>) => {
    for (const slot of event.detail.removed) {
      const key = `${slot.columnName}:${slot.rowId}`;
      this.viewRefs.get(key)?.destroy();
      this.viewRefs.delete(key);
    }
    for (const slot of event.detail.added) {
      const template = this.cellTemplates.find((t) => t.columnName === slot.columnName);
      if (!template) continue;
      const viewRef = this.vcr.createEmbeddedView(template.template, slot.context);
      const wrapper = document.createElement('div');
      wrapper.setAttribute('slot', `cell-${slot.columnName}-${slot.rowId}`);
      viewRef.rootNodes.forEach((node) => wrapper.appendChild(node));
      this.host.nativeElement.appendChild(wrapper);   // light DOM, not shadow
      this.viewRefs.set(`${slot.columnName}:${slot.rowId}`, viewRef);
    }
    this.appRef.tick();   // change detection for new views
  };
}
```

**Angular-specific risks:**

- `ViewEncapsulation.ShadowDom` on the wrapper is incompatible — it would
  create a second shadow boundary around the element. Use `None` (or
  `Emulated`) on the wrapper and let the vanilla element own its own
  shadow.
- Global Angular styles can leak into the slotted content but NOT into
  the element's internal shadow DOM. That's a good boundary — confirm
  it's what we want for the public API.
- Change detection: each `EmbeddedViewRef` created via
  `vcr.createEmbeddedView` runs inside Angular's zone by default. If the
  user has `provideZonelessChangeDetection` we'll need to call `markForCheck`
  manually.
- `ChangeDetectionStrategy.OnPush`: slotted views must be explicitly
  ticked when the cell context changes. The `cellSlotsChanged` event
  gives us that hook.

### React bridge

```tsx
interface UiGridProps {
  /* ...options props */
  cellRenderers?: Record<string, (ctx: GridCellTemplateContext) => ReactNode>;
  cellRenderer?: (ctx: GridCellTemplateContext) => ReactNode;   // fallback
  expandableRenderer?: (ctx: GridExpandableTemplateContext) => ReactNode;
}

export function UiGrid(props: UiGridProps) {
  const hostRef = useRef<UiGridElement | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    host.setFrameworkRenderedColumns(Object.keys(props.cellRenderers ?? {}));

    const onChanged = (event: CustomEvent<CellSlotsChangedDetail>) => {
      setSlots((current) => applySlotDelta(current, event.detail));
    };
    host.addEventListener('cellSlotsChanged', onChanged);
    return () => host.removeEventListener('cellSlotsChanged', onChanged);
  }, [props.cellRenderers]);

  return (
    <ui-grid-element ref={hostRef} {...domProps}>
      {slots.map((slot) => {
        const renderer = props.cellRenderers?.[slot.columnName] ?? props.cellRenderer;
        if (!renderer) return null;
        return createPortal(
          <div slot={`cell-${slot.columnName}-${slot.rowId}`}>
            {renderer(slot.context)}
          </div>,
          hostRef.current!,   // light DOM of the element
          `${slot.columnName}:${slot.rowId}`,
        );
      })}
    </ui-grid-element>
  );
}
```

**React-specific risks:**

- `createPortal` into the element's light DOM gives us React-native
  rendering with hook support, but the consumer's React context DOES
  reach the portal children (React portals are transparent to context).
  That's the behavior we want.
- Rendering order: the element dispatches `cellSlotsChanged` inside its
  own render cycle. React's setState from an event handler is fine (it
  schedules a re-render for the next commit), but we need a stable way
  for the element to wait until the framework views are in place before
  the next paint. **Solution:** the element defers its "ready" class /
  scroll restoration / viewport raise events to a microtask, giving the
  wrapper a React tick to portal in the new slots.
- React 18+ concurrent mode: `useLayoutEffect` runs after DOM commit, so
  the initial `setFrameworkRenderedColumns` call is guaranteed to happen
  before the element first renders its body.

## Element-Side Extensions

Minimal changes to the vanilla element to support the bridge:

1. **`setFrameworkRenderedColumns(columns: string[])`** — public method.
   Flags the listed columns as "slot is rendered by a consumer"; the
   element emits `<slot name="cell-<col>-<rowId>">` for each visible
   cell instead of running its own template interpolation.
2. **`cellSlotsChanged` event.** Dispatched whenever the set of visible
   slots changes (virtual window shift, pagination change, column
   visibility change, filter / sort rebuild). Payload is `{ added: Slot[],
   removed: Slot[] }`.
3. **`expandableSlotsChanged`** — same shape for expandable-row slots.
4. **Group-row and footer slots** — deferred to phase 2 (see below).

The string-template path and the `{{expression}}` interpolation **stay**
— they're how the vanilla web component works for non-framework consumers
and we don't want to regress that surface.

## Migration Strategy

**Phase 0 — Spike (1–2 days).** Build a throwaway React wrapper against a
single demo (home page). Measure:

- FPS at 10,000 rows with virtual scroll.
- Time to first paint vs. the current React implementation.
- Memory footprint per mounted cell (Chrome heap snapshot).

**Gate:** if the spike is <10% slower on any metric, proceed. If >25%
slower, the architecture needs rethinking (coarser integration point,
e.g. one framework view per column instead of per cell).

**Phase 1 — Element extensions.** Add
`setFrameworkRenderedColumns` / `cellSlotsChanged` /
`expandableSlotsChanged` to the vanilla element. Cover with vanilla-side
unit tests. **No wrapper changes yet.** This phase ships on its own.

**Phase 2 — React wrapper (new, side-by-side).**

- New file: `projects/ui-grid-react/src/UiGrid.tsx`.
- Public package keeps exporting the legacy `useGridState` hook behind a
  `/legacy` subpath for one release.
- Migrate the React docs + the demo app one page at a time.
- Port every `ui-grid-react` test to the new component, leaving the
  legacy tests in place.
- Ship as `@ornery/ui-grid-react@next`.

**Phase 3 — Angular wrapper (new, side-by-side).**

- New file: `projects/ui-grid/src/lib/grid/ui-grid-wrapper.component.ts`.
- Old component stays, exported as `UiGridLegacyComponent`.
- Migrate demo app + tests.
- One release of overlap so consumers can switch incrementally.

**Phase 4 — Deprecate the legacy components.** After a full release cycle
with both exports, mark the legacy components `@deprecated` and delete
them in the next major.

## LoC Budget (Realistic)

**Angular wrapper** — ~500 lines:

| Part                                      | Lines |
| ----------------------------------------- | ----- |
| Prop → attribute / options mapping        | ~80   |
| `@Input()` declarations (every attribute) | ~100  |
| `@Output()` event forwarding              | ~60   |
| `UiGridCellTemplateDirective`             | ~20   |
| `UiGridExpandableDirective`               | ~20   |
| Slot lifecycle management                 | ~120  |
| Zone / OnPush change detection plumbing   | ~50   |
| API forwarding (`UiGridApi` exposure)     | ~50   |

**React wrapper** — ~500 lines, same distribution with `useLayoutEffect`
+ `createPortal` instead of `ViewContainerRef` + directives.

**Test suites** — expect ~1,000 lines per wrapper. Every feature test
that currently passes in Angular / React must pass on the new wrapper.

## Performance Validation

Before committing to the refactor, run this benchmark matrix in the
spike:

| Scenario                               | Current Angular / React | Wrapper target |
| -------------------------------------- | ----------------------- | -------------- |
| 10k rows, scroll 60fps                 | baseline                | ≤10% regression |
| Mount time (10k rows, filtered to 100) | baseline                | ≤5% regression  |
| Re-filter (100ms target)               | baseline                | ≤10% regression |
| Cell-template heavy (complex JSX)      | baseline                | ≤20% regression |
| Memory per mounted cell                | baseline                | ≤1.5× increase  |

If the complex-JSX regression is severe, mitigate by:
1. Debouncing `cellSlotsChanged` to rAF.
2. Offering a per-column opt-out — pass a string template for simple
   cells, a framework renderer only for the ones that need it.

## Declarative Surface: Exact Mapping

For every attribute, event, and slot in the vanilla element, here's the
wrapper-side name. This table becomes the source-of-truth doc once the
refactor ships.

### Attributes / Inputs

| Vanilla attribute                     | Angular input                        | React prop                        |
| ------------------------------------- | ------------------------------------ | --------------------------------- |
| `grid-id`                             | `[grid-id]` / `[gridId]`             | `gridId`                          |
| `row-height`                          | `[row-height]` / `[rowHeight]`       | `rowHeight`                       |
| `viewport-height`                     | `[viewport-height]`                  | `viewportHeight`                  |
| `data` (JSON)                         | `[data]` (array)                     | `data` (array)                    |
| `column-defs` (JSON)                  | `[column-defs]` / `[columnDefs]`     | `columnDefs`                      |
| `grouping` (JSON)                     | `[grouping]`                         | `grouping`                        |
| `enable-sorting`                      | `[enable-sorting]`                   | `enableSorting`                   |
| `enable-filtering`                    | `[enable-filtering]`                 | `enableFiltering`                 |
| `enable-grouping`                     | `[enable-grouping]`                  | `enableGrouping`                  |
| `enable-pinning`                      | `[enable-pinning]`                   | `enablePinning`                   |
| `enable-column-moving`                | `[enable-column-moving]`             | `enableColumnMoving`              |
| `enable-cell-edit`                    | `[enable-cell-edit]`                 | `enableCellEdit`                  |
| `enable-pagination`                   | `[enable-pagination]`                | `enablePagination`                |
| `pagination-page-size`                | `[pagination-page-size]`             | `paginationPageSize`              |
| `pagination-page-sizes` (JSON)        | `[pagination-page-sizes]`            | `paginationPageSizes`             |
| `use-external-pagination`             | `[use-external-pagination]`          | `useExternalPagination`           |
| `total-items`                         | `[total-items]`                      | `totalItems`                      |
| `enable-expandable`                   | `[enable-expandable]`                | `enableExpandable`                |
| `enable-tree-view`                    | `[enable-tree-view]`                 | `enableTreeView`                  |
| `tree-children-field`                 | `[tree-children-field]`              | `treeChildrenField`               |
| `enable-auto-resize`                  | `[enable-auto-resize]`               | `enableAutoResize`                |
| `enable-virtualization`               | `[enable-virtualization]`            | `enableVirtualization`            |
| `virtualization-threshold`            | `[virtualization-threshold]`         | `virtualizationThreshold`         |
| `enable-infinite-scroll`              | `[enable-infinite-scroll]`           | `enableInfiniteScroll`            |
| `infiniteScroll-rows-from-end`        | `[infinite-scroll-rows-from-end]`    | `infiniteScrollRowsFromEnd`       |
| `infinite-scroll-up` / `-down`        | `[infinite-scroll-up/down]`          | `infiniteScrollUp/Down`           |
| `enable-row-selection`                | `[enable-row-selection]`             | `enableRowSelection`              |
| `multi-select`                        | `[multi-select]`                     | `multiSelect`                     |
| `enable-row-header-selection`         | `[enable-row-header-selection]`      | `enableRowHeaderSelection`        |
| `enable-full-row-selection`           | `[enable-full-row-selection]`        | `enableFullRowSelection`          |
| `enable-select-all`                   | `[enable-select-all]`                | `enableSelectAll`                 |
| `selection-row-header-width`          | `[selection-row-header-width]`       | `selectionRowHeaderWidth`         |
| `empty-message`                       | `[empty-message]`                    | `emptyMessage`                    |

### Events / Outputs

| Vanilla `CustomEvent`         | Angular `@Output()`              | React prop                       |
| ----------------------------- | -------------------------------- | -------------------------------- |
| `rowsVisibleChanged`          | `(rowsVisibleChanged)`           | `onRowsVisibleChanged`           |
| `rowsRendered`                | `(rowsRendered)`                 | `onRowsRendered`                 |
| `scrollBegin` / `scrollEnd`   | `(scrollBegin)` / `(scrollEnd)`  | `onScrollBegin` / `onScrollEnd`  |
| `sortChanged`                 | `(sortChanged)`                  | `onSortChanged`                  |
| `filterChanged`               | `(filterChanged)`                | `onFilterChanged`                |
| `groupingChanged`             | `(groupingChanged)`              | `onGroupingChanged`              |
| `columnOrderChanged`          | `(columnOrderChanged)`           | `onColumnOrderChanged`           |
| `columnPinned`                | `(columnPinned)`                 | `onColumnPinned`                 |
| `rowSelectionChanged`         | `(rowSelectionChanged)`          | `onRowSelectionChanged`          |
| `rowSelectionChangedBatch`    | `(rowSelectionChangedBatch)`     | `onRowSelectionChangedBatch`     |
| `rowFocusChanged`             | `(rowFocusChanged)`              | `onRowFocusChanged`              |
| `beginCellEdit`               | `(beginCellEdit)`                | `onBeginCellEdit`                |
| `afterCellEdit`               | `(afterCellEdit)`                | `onAfterCellEdit`                |
| `cancelCellEdit`              | `(cancelCellEdit)`               | `onCancelCellEdit`               |
| `paginationChanged`           | `(paginationChanged)`            | `onPaginationChanged`            |
| `needLoadMoreData[Top]`       | `(needLoadMoreData[Top])`        | `onNeedLoadMoreData[Top]`        |
| `saveRow`                     | `(saveRow)`                      | `onSaveRow`                      |
| `validationFailed`            | `(validationFailed)`             | `onValidationFailed`             |
| `languageChanged`             | `(languageChanged)`              | `onLanguageChanged`              |
| `renderingComplete`           | `(renderingComplete)`            | `onRenderingComplete`            |

### Slots / Templates

| Vanilla slot name             | Angular directive                | React prop                       |
| ----------------------------- | -------------------------------- | -------------------------------- |
| `cell-<columnName>`           | `*uiGridCell="'columnName'"`     | `cellRenderers={{ columnName }}` |
| `expandable-row`              | `*uiGridExpandable`              | `expandableRenderer`             |
| `header-<columnName>`         | `*uiGridHeader="'columnName'"`   | `headerRenderers={{ }}`          |
| `filter-<columnName>`         | `*uiGridFilter="'columnName'"`   | `filterRenderers={{ }}`          |
| `empty`                       | `*uiGridEmpty`                   | `emptyRenderer`                  |

### API (imperative)

Both wrappers expose `onRegisterApi` verbatim — consumers get the same
`UiGridApi` the vanilla element creates. No proxying, no wrapping, no
framework-flavored subclass.

## Open Questions

1. **Reactive inputs vs. imperative sets.** Angular's `@Input()` binding
   is cheap for primitives but expensive for large arrays (`data` can
   be 100k rows). Options: debounce `data` updates to rAF, or
   accept a signal and only forward the latest value. React has the
   same issue with `data` prop identity; `useMemo` in consumer code is
   the standard answer.
2. **Global styles inside framework-rendered cells.** Because the cells
   live in the element's light DOM, application stylesheets DO reach
   them. Is that what we want? (Probably yes — it matches the vanilla
   element's behavior.)
3. **SSR.** The vanilla element already has SSR guards; the wrappers
   need to not crash during server render. React should be fine
   (`useLayoutEffect` is a no-op on server). Angular needs
   `isPlatformServer` checks around the `setFrameworkRenderedColumns`
   call.
4. **Testing strategy.** Do we run the framework wrapper tests against a
   real vanilla element (integration-style) or mock it? Integration is
   slower but catches real lifecycle bugs. Recommend integration —
   that's how we'll catch the kind of issue that bit us on pinning.

## Success Criteria

- Every feature the vanilla element ships works identically in the
  Angular and React wrappers within one release of landing in vanilla.
- A consumer can move between Angular, React, and vanilla docs and read
  the same attribute / event / slot names, only the syntax changes.
- Wrapper package sizes each drop by >60%.
- The next feature (row-edit menu UI, importer menu UI, etc.) ships with
  zero wrapper-side code.
