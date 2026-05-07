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
| cellnav | ✅ ported | Arrow/Tab/Home/End, wrap/clamp, focus persistence across re-renders. Keyboard focus `on` events API to firm up in a follow-up. |
| selection | ✅ ported | Full parity with `packages/selection`: 13 options, 18 API methods, 3 events, mouse (click/shift/ctrl/drag-paint), keyboard (Space/Ctrl+A), row-header checkbox column, select-all header, `isRowSelectable` hook. 33 integration tests + 24 core tests. |
| auto-resize | ✅ wired | ResizeObserver on the grid host. |
| saveState | ⚠️ partial | `getState()` / `setState()` exist but don't cover every old-grid field. Pending: saveFocus/saveScroll/saveGroupingExpandedStates/saveSelection/saveWidths/saveOrder/saveVisible/savePinning/saveSort/saveFilter/savePagination/saveTreeView/saveFocusVisible. |
| exporter | ⚠️ partial | `exportCsv()` works. Pending: CSV option matrix (exporterCsvColumnSeparator, exporterHeaderFilterUseName, exporterFieldCallback, exporterFieldFormatCallback, exporterSuppressColumns, exporterAllDataFn, exporterOlderExcelCompatibility, exporterExcelFilename, exporterExcelSheetName, exporterCsvLinkElement, exporterHeaderTemplate, exporterFieldApplyFilters), PDF export, menu items ("Export all/visible/selected as CSV/PDF"). |
| infinite-scroll | ⚠️ partial | Options declared on `GridOptions`; scroll-driven fetch / dataLoaded / saveScrollPercentPosition / needLoadMoreData events not yet wired. |
| i18n | ⚠️ partial | English labels live in a `GridLabels` default. Pending: language packs (es/fr/de/ja/zh/...), `setCurrentLang` API, `i18nService.add/get/getSupportedLanguages`, fallback chain. |
| row-edit | ❌ not ported | Per-row dirty/clean tracking, `setRowsDirty`/`setRowsClean`/`getDirtyRows`/`getErrorRows`, `onSaveRow` batching, `rowEditWaitInterval`, isDirty/isError classes, flush/cancel helpers, saving spinner. |
| importer | ❌ not ported | ui-grid-importer-menu, file picker, `importerProcessHeaders`, `importerDataAddCallback`, `importerNewObject`, `importerErrorCallback`, CSV/JSON import. |
| validate | ❌ not ported | Column `validators` (required/minLength/maxLength/regex/custom), invalid-cell class + error badge, `gridApi.validate.getInvalidRows`, integration with `afterCellEdit`. |

## Active plan

Working through the remaining rows in order. Completed items below in
reverse chronological order; pending items at the top track directly with
the task list.

1. **cellnav parity** (in progress) — fill in the missing `on.navigate` /
   `on.viewPortKeyDown` events and the public `cellNav.focusCell` /
   `scrollToFocus` / `getFocusedCell` methods so consumers can migrate from
   the old `gridApi.cellNav` surface unchanged.
2. infinite-scroll — wire scroll-driven loading + the declared options.
3. saveState — expand getState/setState to full old-grid parity.
4. exporter — CSV options + PDF + menu.
5. row-edit — dirty tracking + save batching.
6. importer — file picker + CSV/JSON parse + menu item.
7. validate — column validators + invalid-cell visuals.
8. i18n — language packs + `setCurrentLang`.

## Completed this session

- **selection** (2025-05-07) — 13 options, 18 API methods, 3 events,
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
