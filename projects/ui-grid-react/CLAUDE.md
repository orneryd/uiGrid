# @ornery/ui-grid-react — React Wrapper

## What to build

A React wrapper for the `@ornery/ui-grid` Angular library's pure-TypeScript core. This package publishes as `@ornery/ui-grid-react` and reuses 100% of the core logic — no code duplication. The React wrapper is a thin rendering layer.

## Critical: Core reuse

The entire core is pure TypeScript with ZERO Angular dependencies. Import everything from the sibling library path. In this monorepo, the path alias `@ornery/ui-grid` maps to `projects/ui-grid/src/public-api.ts`.

**Core files to reuse (all pure TS, no Angular):**

- `grid.core.pipeline.ts` → `buildGridPipeline()` — the entire data pipeline
- `grid.api.ts` → `createGridApi()`, `UiGridApi` — the API object
- `grid.models.ts` → `GridOptions`, `GridColumnDef`, `GridRow`, `GridLabels`, `DEFAULT_GRID_LABELS`, etc.
- `grid.features.ts` → `FEATURE_SORTING`, `FEATURE_FILTERING`, etc. — build-time feature flags
- `grid.core.viewmodel.ts` → `resolveGridLabels()`, `gridSortButtonLabel()`, `gridSortAriaSort()`, all label functions
- `grid.core.display.ts` → `buildGridCellContext()`, `formatGridCellDisplayValue()`
- `grid.core.edit.ts` → `findNextGridCell()`, `isPrintableGridKey()`, `buildGridFocusCellResult()`, etc.
- `grid.core.export.ts` → `exportCsvRows()`, `headerLabel()`
- `grid.core.types.ts` → `DisplayItem`, `GroupItem`, `RowItem`, `ExpandableItem`, `PipelineResult`, `BuildGridPipelineContext`
- `grid.constants.ts` → `SORT_DIRECTIONS`, `FILTER_CONDITIONS`
- `grid.utils.ts` → `getCellValue`, `getPathValue`, `setPathValue`, `titleize`, etc.
- `row-searcher.ts` → `runColumnFilter`, `setupFilters`
- `row-sorter.ts` → `getSortFn`
- `ui-grid.commands.ts` → All command functions (pure TS, depends only on grid.api + grid.core)
- `ui-grid.events.ts` → All event raisers (pure TS, depends only on grid.api)
- `ui-grid.host.ts` → `downloadGridCsvFile()` (pure TS), `observeGridHostSize()` (pure TS)
- `i18n/en-US.json` → Default labels

**Do NOT copy any core files. Import them.**

## File structure to create

```
projects/ui-grid-react/
  package.json
  tsconfig.json
  CLAUDE.md              ← this file
  src/
    index.ts             ← public API exports
    UiGrid.tsx           ← main React component
    useGridState.ts      ← state management hook (replaces Angular signals)
    useVirtualScroll.ts  ← fixed-size row virtualization hook
    ui-grid.css          ← styles adapted from grid.core.styles.scss
    UiGrid.test.tsx      ← tests with vitest + @testing-library/react
```

## package.json

```json
{
  "name": "@ornery/ui-grid-react",
  "version": "0.1.0",
  "description": "React wrapper for @ornery/ui-grid",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./styles": "./dist/ui-grid.css"
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0",
    "@ornery/ui-grid": "^0.1.0"
  },
  "devDependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "~5.8.0",
    "vitest": "^4.1.0",
    "jsdom": "^26.0.0",
    "tsup": "^8.0.0"
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts --external react --external react-dom --external @ornery/ui-grid",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

## tsconfig.json

Extend the root tsconfig. Add path alias for `@ornery/ui-grid`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true,
    "paths": {
      "@ornery/ui-grid": ["../ui-grid/src/public-api.ts"]
    }
  },
  "include": ["src"]
}
```

## useVirtualScroll hook

A lightweight fixed-size virtualizer (~50 lines). No external dependency.

**Interface:**
```ts
interface UseVirtualScrollOptions {
  itemCount: number;
  itemSize: number;       // row height in px
  viewportHeight: number; // container height in px
  overscan?: number;      // extra items above/below (default: 3)
}

interface UseVirtualScrollResult {
  visibleRange: { start: number; end: number };
  totalHeight: number;
  offsetY: number;
  onScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  viewportRef: React.RefObject<HTMLDivElement>;
  scrollTop: number;
}
```

**Implementation:**
- Track `scrollTop` via `useState`
- Calculate `start = Math.floor(scrollTop / itemSize) - overscan`
- Calculate `end = start + Math.ceil(viewportHeight / itemSize) + 2 * overscan`
- Clamp to `[0, itemCount)`
- `totalHeight = itemCount * itemSize`
- `offsetY = start * itemSize`
- Return a div ref and onScroll handler

## useGridState hook

Replaces Angular signals with React state. This is the core bridge.

**Maps the Angular component's state 1:1:**

| Angular signal | React state |
|----------------|-------------|
| `activeFilters` | `useState<Record<string, string>>({})` |
| `groupByColumns` | `useState<string[]>([])` |
| `collapsedGroups` | `useState<Record<string, boolean>>({})` |
| `columnOrder` | `useState<string[]>([])` |
| `hiddenRowReasons` | `useState<Record<string, string[]>>({})` |
| `sortState` | `useState<SortState>(...)` |
| `focusedCell` | `useState<GridCellPosition \| null>(null)` |
| `editingCell` | `useState<GridCellPosition \| null>(null)` |
| `editingValue` | `useState('')` |
| `expandedRows` | `useState<Record<string, boolean>>({})` |
| `expandedTreeRows` | `useState<Record<string, boolean>>({})` |
| `currentPage` | `useState(1)` |
| `pageSize` | `useState(0)` |
| `benchmarkResult` | `useState<GridBenchmarkResult \| null>(null)` |
| `infiniteScrollState` | `useState<GridInfiniteScrollState>(...)` |

**Key behaviors:**
- Call `createGridApi()` once in a `useRef` with bindings that dispatch state updates
- Memoize `buildGridPipeline()` via `useMemo` dependent on all state inputs
- Memoize `visibleColumns` via `useMemo`
- Resolve `labels` via `useMemo(() => resolveGridLabels(options.labels), [options.labels])`
- Reset state when `options.id` changes (same as the Angular effect)
- Call `options.onRegisterApi?.(gridApi)` once

**Returns:**
- All computed values: `pipeline`, `visibleColumns`, `labels`, `gridTemplateColumns`, etc.
- All action dispatchers: `toggleSort()`, `updateFilter()`, `toggleGrouping()`, etc.
- `gridApi` ref

## UiGrid.tsx component

**Props:**
```tsx
interface UiGridProps {
  options: GridOptions;
  onRegisterApi?: (api: UiGridApi) => void;
  /** Render prop for custom cell content. Return null to use default text. */
  cellRenderer?: (context: GridCellTemplateContext) => React.ReactNode;
  /** Render prop for expandable row content. */
  expandableRenderer?: (context: GridExpandableTemplateContext) => React.ReactNode;
  className?: string;
}
```

**Rendering structure:** Match the Angular template exactly — same CSS classes, same `data-*` attributes, same ARIA roles/attributes, same part attributes. Reference the Angular template at `projects/ui-grid/src/lib/grid/ui-grid.component.html`.

**Key sections:**
1. Hero header with title, benchmark button, export button, stats
2. Metrics strip
3. Grid frame (`role="grid"`) with:
   - Header row (`role="row"`) with column headers (`role="columnheader"`, `aria-sort`)
   - Sort buttons with SVG icons
   - Group toggle buttons with SVG icons
   - Filter row
   - Display items via `ng-template` equivalent (just inline JSX):
     - Group rows with disclosure chevron SVGs
     - Expandable rows
     - Data rows with cells (`role="gridcell"`, `tabindex="0"`)
       - Tree toggle buttons with chevron SVGs
       - Expand toggle buttons with chevron SVGs
       - Cell editor input (when editing)
       - Cell template / display value
   - Virtual scroll viewport OR plain list
   - Empty state
   - Pagination footer with arrow SVG icons

**Feature flag guards:** Same pattern as Angular template — wrap sections in `{FEATURE_SORTING && ...}` etc.

**Focus management:** For cell focus/editor focus, use `useRef` + `useEffect` instead of the Angular `focusGridRenderedCell`/`focusGridEditor` (those use shadowRoot which React won't have). Query the grid container ref directly.

**Keyboard handling:** Port `handleCellKeyDown` and `handleEditorKeyDown` logic directly — it's all pure key checking + command dispatch.

## Styles (ui-grid.css)

Adapt from `projects/ui-grid/src/lib/grid/grid.core.styles.scss`:
- Replace `:host` selectors with `.ui-grid-host`
- Replace `:host *` with `.ui-grid-host *`
- Keep ALL CSS custom properties identical (same `--ui-grid-*` variables)
- Keep all class names identical
- Add `.ui-grid-host { display: block; color: var(--ui-grid-cell-color); }`
- Ship as plain CSS (no modules needed — class names are scoped by convention)

## Tests

Use vitest + @testing-library/react + jsdom.

**Port these key scenarios from the Angular spec:**
1. Registers the API and renders headers and rows
2. Filters rows and renders empty state
3. Sorts rows and cycles sort state from header button
4. Groups rows and collapses groups
5. Exports visible rows as CSV
6. Virtualizes rows when count crosses threshold
7. Paginates rows
8. Keyboard cell editing (commit, navigate, cancel)
9. Resolves custom i18n label overrides
10. Feature flags disable unused template sections

## Public API (index.ts)

```ts
export { UiGrid } from './UiGrid';
export type { UiGridProps } from './UiGrid';
export { useGridState } from './useGridState';
export { useVirtualScroll } from './useVirtualScroll';

// Re-export core types consumers need
export type {
  GridOptions,
  GridColumnDef,
  GridRow,
  GridRecord,
  GridLabels,
  GridCellTemplateContext,
  GridExpandableTemplateContext,
  GridCellEditableContext,
  GridBenchmarkResult,
  GridSavedState,
  SortState,
} from '@ornery/ui-grid';

export type { UiGridApi } from '@ornery/ui-grid';
export { DEFAULT_GRID_LABELS } from '@ornery/ui-grid';
```

## Important notes

- Do NOT use Shadow DOM — React doesn't support it well. Use a regular div with `className="ui-grid-host"`.
- Do NOT add any Angular dependencies.
- The `GridOptions.cellTemplate` field is `TemplateRef` (Angular-specific). The React wrapper ignores it and uses the `cellRenderer` prop instead.
- Same for `expandableRowTemplate` → use `expandableRenderer` prop.
- The `GridOptions.onRegisterApi` still works — it's called with the same `UiGridApi` object.
- Keep the `GridColumnDef.cellRenderer` function (returns string) — it's already framework-agnostic.
