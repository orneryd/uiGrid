# ui-grid parity

Tracks the port of each original `angular-ui/ui-grid` module onto this repo's
framework-neutral core + vanilla / Angular / React wrappers.

## Module status

| Module | Status | Notes |
| --- | --- | --- |
| core | ✅ ported | Pipeline, row model, event bus, options, CSS tokens. |
| sorting | ✅ ported | |
| filtering | ✅ ported | Per-column disabled state renders empty cell chrome (matches old grid). |
| pagination | ✅ ported | |
| pinning | ✅ ported | Left/right pin, sticky offset math, pin menu. |
| grouping | ✅ ported | `displayItems` interleaves group headers + rows; nav skips headers. |
| tree-view | ✅ ported | |
| expandable | ✅ ported | |
| move-columns | ✅ ported | Drag/drop header reorder. |
| resize-columns | ✅ ported | |
| edit | ✅ ported | Edit-on-focus, Enter/Tab commit+move, edit follows nav across editable columns. |
| cellnav | ✅ ported | Arrow/Tab/Home/End, wrap/clamp, focus persistence across re-renders. Full `gridApi.cellNav` surface: `scrollToFocus` / `getFocusedCell` / `getCurrentSelection` / `rowColSelectIndex` + events (`navigate`, `viewPortKeyDown`, `viewPortKeyPress`), plus `keyDownOverrides` gridOption. 10 integration tests. |
| selection | ✅ ported | Full parity with `packages/selection`: 13 options, 18 API methods, 3 events, mouse (click/shift/ctrl/drag-paint), keyboard (Space/Ctrl+A), row-header checkbox column, select-all header, `isRowSelectable` hook. 33 integration tests + 24 core tests. |
| auto-resize | ✅ wired | ResizeObserver on the grid host. |
| saveState | ⚠️ partial | `getState()` / `setState()` exist but don't cover every old-grid field. Pending: saveFocus/saveScroll/saveGroupingExpandedStates/saveSelection/saveWidths/saveOrder/saveVisible/savePinning/saveSort/saveFilter/savePagination/saveTreeView/saveFocusVisible. |
| exporter | ⚠️ partial | `exportCsv()` works. Pending: CSV option matrix (exporterCsvColumnSeparator, exporterHeaderFilterUseName, exporterFieldCallback, exporterFieldFormatCallback, exporterSuppressColumns, exporterAllDataFn, exporterOlderExcelCompatibility, exporterExcelFilename, exporterExcelSheetName, exporterCsvLinkElement, exporterHeaderTemplate, exporterFieldApplyFilters), PDF export, menu items ("Export all/visible/selected as CSV/PDF"). |
| infinite-scroll | ✅ ported | Scroll-driven `needLoadMoreData` / `needLoadMoreDataTop` events wired through the element's scroll handler; full public API (`dataLoaded`, `resetScroll`, `saveScrollPercentage`, `dataRemovedTop`, `dataRemovedBottom`, `setScrollDirections`) and all four options (`enableInfiniteScroll`, `infiniteScrollRowsFromEnd`, `infiniteScrollUp`, `infiniteScrollDown`). 5 core + 8 integration tests. |
| i18n | ⚠️ partial | English labels live in a `GridLabels` default. Pending: language packs (es/fr/de/ja/zh/...), `setCurrentLang` API, `i18nService.add/get/getSupportedLanguages`, fallback chain. |
| row-edit | ❌ not ported | Per-row dirty/clean tracking, `setRowsDirty`/`setRowsClean`/`getDirtyRows`/`getErrorRows`, `onSaveRow` batching, `rowEditWaitInterval`, isDirty/isError classes, flush/cancel helpers, saving spinner. |
| importer | ❌ not ported | ui-grid-importer-menu, file picker, `importerProcessHeaders`, `importerDataAddCallback`, `importerNewObject`, `importerErrorCallback`, CSV/JSON import. |
| validate | ❌ not ported | Column `validators` (required/minLength/maxLength/regex/custom), invalid-cell class + error badge, `gridApi.validate.getInvalidRows`, integration with `afterCellEdit`. |

## Active plan

Working through the remaining rows in order. Completed items below in
reverse chronological order; pending items at the top track directly with
the task list.

1. **saveState** (next) — expand `getState()` / `setState()` to cover every
   old-grid flag (saveFocus/saveScroll/saveGroupingExpandedStates/
   saveSelection/saveWidths/saveOrder/saveVisible/savePinning/saveSort/
   saveFilter/savePagination/saveTreeView/saveFocusVisible).
2. exporter — CSV options + PDF + menu.
3. row-edit — dirty tracking + save batching.
4. importer — file picker + CSV/JSON parse + menu item.
5. validate — column validators + invalid-cell visuals.
6. i18n — language packs + `setCurrentLang`.

## Completed this session

- **infinite-scroll** (2026-05-07) — controller wires core's pure state
  helpers (`maybeRequestInfiniteScrollData` / `completeInfiniteScrollDataLoad`
  / `resetInfiniteScrollState` / `saveInfiniteScrollPercentage` /
  `setInfiniteScrollDirectionsState`). Element's scroll rAF calls
  `evaluateInfiniteScroll` each frame — works in both virtualized and
  non-virtualized modes. `resetScroll` delegates via a registered handler
  so the controller stays DOM-free. Suppression flags (`enableInfiniteScroll`,
  direction flags, `dataLoading`) honored throughout. 5 core + 8
  integration tests.
- **cellnav** (2026-05-07) — added `gridApi.cellNav` namespace with
  `scrollToFocus` / `getFocusedCell` / `getCurrentSelection` /
  `rowColSelectIndex`, events `navigate` / `viewPortKeyDown` /
  `viewPortKeyPress`, and `keyDownOverrides` gridOption so consumers can
  suppress built-in key handling per-key. Element raises `navigate` on
  click + arrow nav; scrollToFocus delegates via a registered handler so
  controller stays DOM-free. 10 integration tests.
- **selection** (2026-05-07) — 13 options, 18 API methods, 3 events,
  mouse (click/shift/ctrl/drag-paint with no-flicker single click),
  keyboard (Space, Ctrl+A), row-header checkbox column with proper dark/
  light theme contrast, filter row spacer that matches old grid (no input,
  no chrome), select-all header button, `isRowSelectable` hook, reconcile
  across pipeline rebuilds. Regression tests: 33 integration + 24 core.
- Edit-follows-navigation (Tab/Enter across editable cells).
- Keyboard navigation parity: arrow/Tab/Home/End with proper scroll
  handling and focus persistence across virtualization window changes.
- Fast-path render: changed `<ui-grid-body-cell>` / `<ui-grid-header-cell>`
  so className/style/tabindex/data-* are baked into the emitted markup
  (no per-cell `attributeChangedCallback` storm).
