# API Reference

Complete reference for `GridOptions`, `GridColumnDef`, and the `UiGridApi` runtime surface.

## GridOptions

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | `string` | required | Unique grid identifier |
| `data` | `GridRecord[]` | required | Row data array |
| `columnDefs` | `GridColumnDef[]` | required | Column definitions |
| `title` | `string` | — | Grid heading text |
| `rowHeight` | `number` | 44 | Row height in pixels |
| `headerRowHeight` | `number` | — | Header row height override |
| `viewportHeight` | `number` | 560 | Grid viewport height |
| `emptyMessage` | `string` | — | Message when no rows match |
| `labels` | `Partial<GridLabels>` | en-US | i18n string overrides |
| `enableSorting` | `boolean` | true | Enable column sorting |
| `enableFiltering` | `boolean` | true | Enable filter row |
| `enableGrouping` | `boolean` | false | Enable row grouping |
| `grouping` | `{ groupBy?: string[]; startCollapsed?: boolean }` | — | Grouping configuration |
| `enableColumnMoving` | `boolean` | false | Enable drag-and-drop column reorder |
| `enableVirtualization` | `boolean` | auto | CDK virtual scroll (auto at 40+ rows) |
| `virtualizationThreshold` | `number` | 40 | Row count that triggers virtualization |
| `enablePagination` | `boolean` | false | Enable pagination |
| `enablePaginationControls` | `boolean` | true | Show pagination UI |
| `useExternalPagination` | `boolean` | false | Grid skips local slicing |
| `paginationPageSize` | `number` | — | Rows per page |
| `paginationPageSizes` | `number[]` | — | Page size selector options |
| `paginationCurrentPage` | `number` | — | Initial page |
| `totalItems` | `number` | — | Total for external pagination |
| `enableExpandable` | `boolean` | false | Enable expandable detail rows |
| `expandableRowHeight` | `number` | 150 | Detail row height |
| `expandableRowTemplate` | `TemplateRef` | — | Angular template for detail content |
| `expandableRowScope` | `Record<string, unknown>` | — | Extra template context variables |
| `enableTreeView` | `boolean` | false | Enable hierarchical tree display |
| `treeChildrenField` | `string` | 'children' | Property name for child rows |
| `treeIndent` | `number` | 10 | Pixels per indent level |
| `showTreeExpandNoChildren` | `boolean` | true | Show toggle for childless rows |
| `treeRowHeaderAlwaysVisible` | `boolean` | false | Always show expand column |
| `enableCellEdit` | `boolean` | false | Enable inline cell editing |
| `enableCellEditOnFocus` | `boolean` | false | Enter edit mode on cell focus |
| `cellEditableCondition` | `boolean \| (ctx) => boolean` | — | Grid-level edit guard |
| `enableAutoResize` | `boolean` | false | ResizeObserver-driven viewport height |
| `infiniteScrollRowsFromEnd` | `number` | — | Threshold rows from end to trigger load |
| `infiniteScrollUp` | `boolean` | — | Enable upward infinite scroll |
| `infiniteScrollDown` | `boolean` | — | Enable downward infinite scroll |
| `rowIdentity` | `(row, i) => string` | — | Custom row ID function |
| `benchmark` | `{ iterations?: number }` | — | Pipeline benchmark configuration |
| `onRegisterApi` | `(api) => void` | — | Callback to receive the UiGridApi instance |

## GridColumnDef

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Column identifier (also the default data key) |
| `displayName` | `string` | Header label (auto-titleized from name if absent) |
| `field` | `string` | Dot-path into data record (e.g. `'address.city'`) |
| `type` | `'string' \| 'number' \| 'boolean' \| 'date' \| 'object'` | Data type hint for sorting and editing |
| `width` | `string` | CSS grid track value (e.g. `'200px'`, `'minmax(10rem, 1fr)'`) |
| `align` | `'start' \| 'center' \| 'end'` | Cell text alignment |
| `visible` | `boolean` | Hide column when false |
| `sortable` | `boolean` | Column-level sort override |
| `enableSorting` | `boolean` | Alias for sortable |
| `filterable` | `boolean` | Column-level filter override |
| `enableFiltering` | `boolean` | Alias for filterable |
| `enableGrouping` | `boolean` | Allow grouping by this column |
| `enableCellEdit` | `boolean` | Column-level edit override |
| `enableCellEditOnFocus` | `boolean` | Edit starts on focus for this column |
| `cellEditableCondition` | `boolean \| (ctx) => boolean` | Column-level edit guard |
| `editModelField` | `string` | Dot-path for writing edited values |
| `sort` | `{ direction?: SortDirection; priority?: number; ignoreSort?: boolean }` | Initial sort configuration |
| `filter` | `{ term?: unknown; condition?: FilterCondition \| RegExp \| Function; flags?: { caseSensitive?: boolean; date?: boolean } }` | Filter configuration |
| `sortingAlgorithm` | `(a, b) => number` | Custom sort comparator |
| `formatter` | `(value, row) => string` | Display value formatter |
| `valueGetter` | `(row) => unknown` | Custom value extractor |
| `cellTemplate` | `TemplateRef` | Angular template for cell content |
| `cellRenderer` | `(ctx) => string` | HTML string cell renderer |

## UiGridApi

Access the API via `onRegisterApi`. The API is organized into namespaces.

### core

| Method | Description |
|--------|-------------|
| `refresh()` | Force a full pipeline re-run |
| `getVisibleRows()` | Get currently visible GridRow objects |
| `sortColumn(name, direction?)` | Programmatic sort |
| `setFilter(name, value)` | Set a column filter |
| `clearAllFilters()` | Clear all active filters |
| `groupByColumn(name)` | Add a column to grouping |
| `clearGrouping()` | Remove all grouping |
| `moveColumn(from, to)` | Reorder columns by index |
| `exportCsv()` | Download visible rows as CSV |
| `benchmark(iterations?)` | Run pipeline benchmark |
| `setRowInvisible(row, reason?)` | Hide a row programmatically |
| `clearRowInvisible(row, reason?)` | Un-hide a row |

### core.on (Events)

| Event | Callback Signature |
|-------|-------------------|
| `renderingComplete` | `(api) => void` |
| `sortChanged` | `(columnName, direction) => void` |
| `filterChanged` | `(filters) => void` |
| `groupingChanged` | `(groupBy) => void` |
| `columnOrderChanged` | `(order) => void` |
| `rowsVisibleChanged` | `(rows) => void` |
| `rowsRendered` | `(rows) => void` |
| `scrollBegin` / `scrollEnd` | `() => void` |
| `canvasHeightChanged` | `(oldHeight, newHeight) => void` |
| `gridDimensionChanged` | `(oldH, oldW, newH, newW) => void` |
| `benchmarkComplete` | `(result) => void` |

### pagination

| Method | Description |
|--------|-------------|
| `nextPage()` / `previousPage()` | Navigate pages |
| `seek(page)` | Jump to a specific page |
| `setPageSize(n)` | Change rows per page |
| `getPage()` / `getTotalPages()` | Current page info |
| `getFirstRowIndex()` / `getLastRowIndex()` | Row index range |
| `on.paginationChanged` | `(page, pageSize) => void` |

### expandable

| Method | Description |
|--------|-------------|
| `toggleRowExpansion(row)` | Toggle a single row |
| `expandAllRows()` / `collapseAllRows()` | Bulk expand/collapse |
| `toggleAllRows()` | Toggle all rows |
| `on.rowExpandedStateChanged` | `(row, expanded) => void` |

### treeBase

| Method | Description |
|--------|-------------|
| `toggleRowTreeState(row)` | Toggle tree node expansion |
| `expandRow(row)` / `collapseRow(row)` | Explicit expand/collapse |
| `expandAllRows()` / `collapseAllRows()` | Bulk operations |
| `getRowChildren(row)` | Get child GridRow objects |
| `on.rowExpanded` / `on.rowCollapsed` | `(row) => void` |

### treeView

| Method | Description |
|--------|-------------|
| `getTreeView()` | Get current tree expansion state |
| `setTreeView(state)` | Bulk set expansion state |

### infiniteScroll

| Method | Description |
|--------|-------------|
| `dataLoaded(scrollUp?, scrollDown?)` | Signal that new data is loaded |
| `resetScroll(scrollUp?, scrollDown?)` | Reset to fresh state |
| `saveScrollPercentage()` | Persist scroll position ratio |
| `setScrollDirections(up, down)` | Toggle scroll directions |
| `on.needLoadMoreData` | `() => void` |
| `on.needLoadMoreDataTop` | `() => void` |

### edit

| Method / Event | Description |
|----------------|-------------|
| `beginCellEdit(row, col, event?)` | Start editing a cell |
| `endCellEdit()` | Commit the current edit |
| `cancelCellEdit()` | Cancel without committing |
| `getEditingCell()` | Returns current editing position or null |
| `on.beginCellEdit` | `(row, col, event) => void` |
| `on.afterCellEdit` | `(row, col, newVal, oldVal) => void` |
| `on.cancelCellEdit` | `(row, col) => void` |

### saveState

| Method | Description |
|--------|-------------|
| `save()` | Returns a serializable `GridSavedState` |
| `restore(state)` | Applies a previously saved state |
