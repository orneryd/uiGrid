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
| saveState | ✅ ported | `gridApi.saveState.save()` / `.restore()` covers sort, filters, grouping + collapsed groups, pinning, column order, column widths, pagination, selection, focused cell, tree/expandable expansion, and scroll position. Per-field opt-in flags: saveWidths, saveOrder, saveScroll, saveFocus, saveVisible, saveSort, saveFilter, saveSelection, saveGrouping, saveGroupingExpandedStates, savePinning, saveTreeView, savePagination. 9 integration tests. |
| exporter | ✅ ported | `gridApi.exporter.{csvExport, buildCsv, pdfExport, buildPdfDocDefinition, getMenuItems, getOptions, setOptions}`. CSV matrix: `exporterCsvColumnSeparator`, `exporterCsvFilename` (string or fn), `exporterHeaderFilterUseName`, `exporterHeaderFilter`, `exporterHeaderTemplate`, `exporterShowHeader`, `exporterFieldCallback`, `exporterFieldFormatCallback`, `exporterFieldApplyFilters`, `exporterSuppressColumns`, `exporterOlderExcelCompatibility` (BOM), `exporterAllDataFn`, `exporterCsvLinkElement`. PDF matrix: `exporterPdfFilename/Orientation/PageSize/MaxGridWidth/DefaultStyle/TableStyle/TableHeaderStyle/Layout/Header/Footer/CustomFormatter`. pdfMake auto-detected via `window.pdfMake`; when missing, `pdfExport()` returns the doc definition for the caller to render. Column-level `exporterSuppressExport` + `exporterPdfAlign`, row-level `exporterEnableExporting`, auto-suppression of `selectionRowHeaderCol`/`treeBaseRowHeaderCol`. `GRID_EXPORTER_CONSTANTS` mirrors `uiGridExporterConstants`. Menu items (`getMenuItems()`) respect `exporterMenuCsv/Pdf/AllData/VisibleData/SelectedData` flags + i18n labels (`labels.exporterAllAsCsv` etc. in the locale JSON). 29 core + 8 integration tests. Excel export deferred — stub-only. |
| infinite-scroll | ✅ ported | Scroll-driven `needLoadMoreData` / `needLoadMoreDataTop` events wired through the element's scroll handler; full public API (`dataLoaded`, `resetScroll`, `saveScrollPercentage`, `dataRemovedTop`, `dataRemovedBottom`, `setScrollDirections`) and all four options (`enableInfiniteScroll`, `infiniteScrollRowsFromEnd`, `infiniteScrollUp`, `infiniteScrollDown`). 5 core + 8 integration tests. |
| i18n | ⚠️ partial | English labels live in a `GridLabels` default. Pending: language packs (es/fr/de/ja/zh/...), `setCurrentLang` API, `i18nService.add/get/getSupportedLanguages`, fallback chain. |
| row-edit | ✅ ported | `gridApi.rowEdit.{saveRow event, setSavePromise, getDirtyRows, getErrorRows, flushDirtyRows, setRowsDirty, setRowsClean}`. Row flags `isDirty`/`isSaving`/`isError` surface as `.ui-grid-row-dirty`/`.ui-grid-row-saving`/`.ui-grid-row-error` on every cell. `rowEditWaitInterval` option (-1 disables timer, defaults to 2000 ms). Auto-marks dirty on `afterCellEdit`; resolves clean when consumer's save promise resolves, moves to error on rejection (row stays dirty so retry works). 9 core + 7 integration tests. |
| importer | ❌ not ported | ui-grid-importer-menu, file picker, `importerProcessHeaders`, `importerDataAddCallback`, `importerNewObject`, `importerErrorCallback`, CSV/JSON import. |
| validate | ❌ not ported | Column `validators` (required/minLength/maxLength/regex/custom), invalid-cell class + error badge, `gridApi.validate.getInvalidRows`, integration with `afterCellEdit`. |

## Active plan

Working through the remaining rows in order. Completed items below in
reverse chronological order; pending items at the top track directly with
the task list.

1. **importer** (next) — file picker + CSV/JSON parse + menu item.
2. validate — column validators + invalid-cell visuals.
3. i18n — language packs + `setCurrentLang`.
4. exporter (Excel) — pending pdfMake/ExcelBuilder integration is consumer-driven; Excel path is stubbed for now.
5. row-edit menu — add retry + flush actions.

## Completed this session

- **row-edit** (2026-05-07) — ported `ui.grid.rowEdit` in full: new core
  `grid.core.row-edit.ts` owns the pure state (dirty / error / saving sets
  + save-promise map). Controller subscribes to edit events so committing a
  cell flips the row dirty + starts a debounce timer (`rowEditWaitInterval`,
  -1 disables). `saveRow` event fires, consumers call
  `gridApi.rowEdit.setSavePromise(rowEntity, promise)`; success → clean,
  rejection → error (row stays dirty so retry works). `flushDirtyRows()`
  awaits every pending save. Row-level `isDirty` / `isSaving` / `isError`
  flags paint `ui-grid-row-dirty` / `ui-grid-row-saving` / `ui-grid-row-error`
  on every cell, matching the old uiGridViewport ng-class hook. Colors
  default to the old module's `rowSaving=#848484`, `rowError=#FF0000`,
  `rowDirty=#610B38` but are themeable via `--ui-grid-row-*-color/bg`.
  9 core + 7 integration tests.
- **exporter (PDF + menu)** (2026-05-07) — extended the exporter module
  to full parity: `buildGridPdfDocDefinition()` emits a pdfMake-ready
  `docDefinition` (table widths via `calculateGridPdfColumnWidths`,
  `formatGridPdfField` formatter, `exporterPdfCustomFormatter` hook, page
  orientation / size / default+table+header styles / layout / header /
  footer). `gridApi.exporter.pdfExport()` auto-detects `window.pdfMake`
  and calls `pdfMake.createPdf(doc).open()` (or `.download(filename)` when
  a filename is configured); when pdfMake is absent the method returns
  the doc for the consumer to render themselves. `buildGridExporterMenuItems()`
  produces the "Export all/visible/selected as CSV/PDF" menu entries;
  `gridApi.exporter.getMenuItems()` returns them wired to the current
  grid, with `shown()` respecting `exporterMenuCsv/Pdf/AllData/VisibleData/
  SelectedData` flags and the selection count. Menu titles + empty-state
  text are now locale-driven via `labels.exporterAllAsCsv`/…/`exporterSelectedAsPdf`
  (default strings live in `i18n/en-US.json`). 11 new core tests + 3 new
  integration tests (22 core + 8 integration total for the exporter).
- **exporter (CSV matrix)** (2026-05-07) — ported the full
  `ui.grid.exporter` CSV surface: `gridApi.exporter.csvExport(rowType, colType)`
  / `buildCsv()` / `getOptions()` / `setOptions()` plus legacy
  `gridApi.core.exportCsv()`. `buildGridCsv()` in core honors the full
  option matrix (`exporterCsvColumnSeparator`, `exporterCsvFilename`
  string-or-function, `exporterHeaderFilterUseName`, `exporterHeaderFilter`,
  `exporterHeaderTemplate`, `exporterShowHeader`, `exporterFieldCallback`,
  `exporterFieldFormatCallback`, `exporterFieldApplyFilters`,
  `exporterSuppressColumns`, `exporterOlderExcelCompatibility` BOM,
  `exporterAllDataFn`, `exporterCsvLinkElement`). Column-level
  `exporterSuppressExport` and row-level `exporterEnableExporting` respected.
  Auto-suppresses `selectionRowHeaderCol` / `treeBaseRowHeaderCol` like the
  old module. `GRID_EXPORTER_CONSTANTS` mirrors `uiGridExporterConstants`.
  18 core + 5 integration tests. Still pending: PDF, Excel, gridMenu items.
- **saveState** (2026-05-07) — expanded `GridSaveState` to parity with the
  old module (sort, filters, grouping+collapsed, pinning, column order,
  column widths, pagination, selection, focused cell, expandable+tree
  expansion, scroll). Each field is gated by a `save*` option matching
  the old grid's defaults, including the `saveScroll` implicit-disable
  of `saveFocus`. Controller registers scroll accessors with the element
  so save/restore can reach the DOM without coupling the controller.
  9 integration tests.
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
