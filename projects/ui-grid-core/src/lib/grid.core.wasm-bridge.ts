import type {
  BuildGridPipelineContext,
  DisplayItem,
  ExpandableItem,
  GridInfiniteScrollState,
  GridMoveDirection,
  GroupItem,
  PipelineResult,
  RowItem,
} from './grid.core.types';
import * as tsDisplay from './grid.core.display';
import * as tsEdit from './grid.core.edit';
import * as tsExport from './grid.core.export';
import * as tsFiltering from './grid.core.filtering';
import * as tsGrouping from './grid.core.grouping';
import * as tsIdentity from './grid.core.identity';
import * as tsInfiniteScroll from './grid.core.infinite-scroll';
import * as tsPagination from './grid.core.pagination';
import * as tsPinning from './grid.core.pinning';
import * as tsPipeline from './grid.core.pipeline';
import * as tsRowState from './grid.core.row-state';
import * as tsSorting from './grid.core.sorting';
import * as tsState from './grid.core.state';
import * as tsTree from './grid.core.tree';
import * as tsViewmodel from './grid.core.viewmodel';
import {
  GridRow,
  type GridCellPosition,
  type GridColumnDef,
  type GridOptions,
} from './grid.models';

export type {
  BuildGridPipelineContext,
  DisplayItem,
  ExpandableItem,
  GridInfiniteScrollState,
  GridMoveDirection,
  GroupItem,
  PipelineResult,
  RowItem,
} from './grid.core.types';

export type { PinDirection, PinnedColumnState } from './grid.core.pinning';

type CalculateVirtualWindowRequest = Parameters<typeof tsPagination.calculateVirtualWindow>[0];
type CalculateVirtualWindowResult = ReturnType<typeof tsPagination.calculateVirtualWindow>;
type SortGridRowsInput = {
  rows: Parameters<typeof tsSorting.sortGridRows>[0];
  columns: Parameters<typeof tsSorting.sortGridRows>[1];
  options: Parameters<typeof tsSorting.sortGridRows>[2];
  sortState: Parameters<typeof tsSorting.sortGridRows>[3];
};
type SortGridRowsResult = ReturnType<typeof tsSorting.sortGridRows>;
type BuildGridRowsInput = {
  options: Parameters<typeof tsTree.buildGridRows>[0];
  rowSize: Parameters<typeof tsTree.buildGridRows>[1];
  hiddenRowReasons: Parameters<typeof tsTree.buildGridRows>[2];
  expandedRows: Parameters<typeof tsTree.buildGridRows>[3];
};
type BuildGridRowsResult = ReturnType<typeof tsTree.buildGridRows>;
type IsTreeEnabledOptions = Parameters<typeof tsTree.isTreeEnabled>[0];
type FilterAndFlattenGridTreeRowsInput = {
  rows: Parameters<typeof tsTree.filterAndFlattenGridTreeRows>[0];
  columns: Parameters<typeof tsTree.filterAndFlattenGridTreeRows>[1];
  options: Parameters<typeof tsTree.filterAndFlattenGridTreeRows>[2];
  activeFilters: Parameters<typeof tsTree.filterAndFlattenGridTreeRows>[3];
  expandedTreeRows: Parameters<typeof tsTree.filterAndFlattenGridTreeRows>[4];
  sortState: Parameters<typeof tsTree.filterAndFlattenGridTreeRows>[5];
};
type FilterAndFlattenGridTreeRowsResult = ReturnType<typeof tsTree.filterAndFlattenGridTreeRows>;
type BuildGridDisplayItemsInput = {
  rows: Parameters<typeof tsGrouping.buildGridDisplayItems>[0];
  columns: Parameters<typeof tsGrouping.buildGridDisplayItems>[1];
  options: Parameters<typeof tsGrouping.buildGridDisplayItems>[2];
  groupBy: Parameters<typeof tsGrouping.buildGridDisplayItems>[3];
  collapsedGroups: Parameters<typeof tsGrouping.buildGridDisplayItems>[4];
};
type BuildGridDisplayItemsResult = ReturnType<typeof tsGrouping.buildGridDisplayItems>;
type ExportCsvRowsColumns = Parameters<typeof tsExport.exportCsvRows>[0];
type ExportCsvRowsRows = Parameters<typeof tsExport.exportCsvRows>[1];
type ExportCsvRowsResult = ReturnType<typeof tsExport.exportCsvRows>;
type UiGridWasmCoreModule = {
  calculate_virtual_window_js(request: CalculateVirtualWindowRequest): CalculateVirtualWindowResult;
  sort_grid_rows_js(input: SortGridRowsInput): SortGridRowsResult;
  build_grid_rows_js(input: BuildGridRowsInput): BuildGridRowsResult;
  is_tree_enabled_js(options: IsTreeEnabledOptions): ReturnType<typeof tsTree.isTreeEnabled>;
  filter_and_flatten_grid_tree_rows_js(
    input: FilterAndFlattenGridTreeRowsInput,
  ): FilterAndFlattenGridTreeRowsResult;
  build_grid_display_items_js(input: BuildGridDisplayItemsInput): BuildGridDisplayItemsResult;
  export_csv_rows_js(columns: ExportCsvRowsColumns, rows: ExportCsvRowsRows): ExportCsvRowsResult;
};
const uiGridWasmCoreModulePath = '../../../../dist/ui-grid-wasm/ui_grid_wasm.js';

let wasmCore: UiGridWasmCoreModule | null = null;
let wasmInitPromise: Promise<boolean> | null = null;

export async function initWasmCore(): Promise<boolean> {
  if (wasmCore) {
    return true;
  }

  if (!wasmInitPromise) {
    wasmInitPromise = import(/* @vite-ignore */ uiGridWasmCoreModulePath)
      .then((module) => {
        wasmCore = module;
        return true;
      })
      .catch(() => {
        wasmInitPromise = null;
        return false;
      });
  }

  return wasmInitPromise;
}

export function isWasmReady(): boolean {
  return wasmCore !== null;
}

function withWasm<T>(invoke: (module: UiGridWasmCoreModule) => T, fallback: () => T): T {
  if (!wasmCore) {
    return fallback();
  }

  try {
    return invoke(wasmCore);
  } catch {
    return fallback();
  }
}

function hasColumnCallbacks(column: GridColumnDef): boolean {
  return typeof column.valueGetter === 'function' || typeof column.sortingAlgorithm === 'function';
}

function requiresTemplateFallback(options: GridOptions): boolean {
  return options.enableExpandable === true && !options.expandableRowTemplate;
}

function normalizeColumnForWasm(column: GridColumnDef): GridColumnDef {
  return {
    ...column,
    sortingAlgorithm: undefined,
    valueGetter: undefined,
    formatter: undefined,
    cellTemplate: undefined,
    cellRenderer: undefined,
    cellEditableCondition: undefined,
  };
}

function normalizeOptionsForWasm(options: GridOptions): GridOptions {
  return {
    ...options,
    columnDefs: options.columnDefs.map((column) => normalizeColumnForWasm(column)),
    labels: tsViewmodel.resolveGridLabels(options.labels),
    onRegisterApi: undefined,
    rowIdentity: undefined,
    expandableRowTemplate: undefined,
    cellEditableCondition: undefined,
  };
}

function shouldFallbackPipeline(context: BuildGridPipelineContext): boolean {
  return context.columns.some(hasColumnCallbacks);
}

function shouldFallbackTree(options: GridOptions, columns: readonly GridColumnDef[]): boolean {
  return columns.some(hasColumnCallbacks);
}

function shouldFallbackSorting(columns: readonly GridColumnDef[]): boolean {
  return columns.some(
    (column) =>
      typeof column.valueGetter === 'function' || typeof column.sortingAlgorithm === 'function',
  );
}

function findRowAndColumn(
  rows: readonly GridRow[],
  columns: readonly GridColumnDef[],
  position: GridCellPosition | null,
): { row: GridRow; column: GridColumnDef } | null {
  if (!position) {
    return null;
  }

  const row = rows.find((candidate) => candidate.id === position.rowId);
  const column = columns.find((candidate) => candidate.name === position.columnName);
  return row && column ? { row, column } : null;
}

export const buildGridCellContext: typeof tsDisplay.buildGridCellContext = (...args) =>
  tsDisplay.buildGridCellContext(...args);

export const formatGridCellDisplayValue: typeof tsDisplay.formatGridCellDisplayValue = (...args) =>
  tsDisplay.formatGridCellDisplayValue(...args);

export const buildGridPipeline: typeof tsPipeline.buildGridPipeline = (context) =>
  tsPipeline.buildGridPipeline(context);

export const resolveGridLabels: typeof tsViewmodel.resolveGridLabels = (overrides) =>
  tsViewmodel.resolveGridLabels(overrides);
export const isGridTreeEnabled: typeof tsViewmodel.isGridTreeEnabled = (options) =>
  tsViewmodel.isGridTreeEnabled(options);
export const isGridGroupingEnabled: typeof tsViewmodel.isGridGroupingEnabled = (options) =>
  tsViewmodel.isGridGroupingEnabled(options);
export const canGridExpandRows: typeof tsViewmodel.canGridExpandRows = (options) =>
  tsViewmodel.canGridExpandRows(options);
export const isGridPaginationEnabled: typeof tsViewmodel.isGridPaginationEnabled = (options) =>
  tsViewmodel.isGridPaginationEnabled(options);
export const shouldShowGridPaginationControls: typeof tsViewmodel.shouldShowGridPaginationControls =
  (options) => tsViewmodel.shouldShowGridPaginationControls(options);
export const isGridInfiniteScrollEnabled: typeof tsViewmodel.isGridInfiniteScrollEnabled = (
  options,
) => tsViewmodel.isGridInfiniteScrollEnabled(options);
export const isGridSortingEnabled: typeof tsViewmodel.isGridSortingEnabled = (options) =>
  tsViewmodel.isGridSortingEnabled(options);
export const isGridFilteringEnabled: typeof tsViewmodel.isGridFilteringEnabled = (options) =>
  tsViewmodel.isGridFilteringEnabled(options);
export const canGridMoveColumns: typeof tsViewmodel.canGridMoveColumns = (options) =>
  tsViewmodel.canGridMoveColumns(options);
export const isGridPrimaryColumn: typeof tsViewmodel.isGridPrimaryColumn = (
  visibleColumns,
  column,
) => tsViewmodel.isGridPrimaryColumn(visibleColumns, column);
export const isGridColumnSortable: typeof tsViewmodel.isGridColumnSortable = (options, column) =>
  tsViewmodel.isGridColumnSortable(options, column);
export const isGridColumnFilterable: typeof tsViewmodel.isGridColumnFilterable = (
  options,
  column,
) => tsViewmodel.isGridColumnFilterable(options, column);
export const shouldShowGridTreeToggle: typeof tsViewmodel.shouldShowGridTreeToggle = (
  options,
  visibleColumns,
  row,
  column,
) => tsViewmodel.shouldShowGridTreeToggle(options, visibleColumns, row, column);
export const shouldShowGridExpandToggle: typeof tsViewmodel.shouldShowGridExpandToggle = (
  options,
  visibleColumns,
  column,
) => tsViewmodel.shouldShowGridExpandToggle(options, visibleColumns, column);
export const gridSortButtonLabel: typeof tsViewmodel.gridSortButtonLabel = (direction, labels) =>
  tsViewmodel.gridSortButtonLabel(direction, labels);
export const gridSortAriaSort: typeof tsViewmodel.gridSortAriaSort = (direction) =>
  tsViewmodel.gridSortAriaSort(direction);
export const gridGroupingButtonLabel: typeof tsViewmodel.gridGroupingButtonLabel = (
  isGrouped,
  labels,
) => tsViewmodel.gridGroupingButtonLabel(isGrouped, labels);
export const gridFilterPlaceholder: typeof tsViewmodel.gridFilterPlaceholder = (
  isFilterable,
  labels,
) => tsViewmodel.gridFilterPlaceholder(isFilterable, labels);
export const gridGroupDisclosureLabel: typeof tsViewmodel.gridGroupDisclosureLabel = (
  collapsed,
  labels,
) => tsViewmodel.gridGroupDisclosureLabel(collapsed, labels);
export const gridEditorInputType: typeof tsViewmodel.gridEditorInputType = (column) =>
  tsViewmodel.gridEditorInputType(column);
export const gridColumnWidth: typeof tsViewmodel.gridColumnWidth = (column) =>
  tsViewmodel.gridColumnWidth(column);
export const gridCellIndent: typeof tsViewmodel.gridCellIndent = (
  options,
  visibleColumns,
  row,
  column,
) => tsViewmodel.gridCellIndent(options, visibleColumns, row, column);
export const gridTreeToggleLabel: typeof tsViewmodel.gridTreeToggleLabel = (expanded, labels) =>
  tsViewmodel.gridTreeToggleLabel(expanded, labels);
export const gridExpandToggleLabel: typeof tsViewmodel.gridExpandToggleLabel = (expanded, labels) =>
  tsViewmodel.gridExpandToggleLabel(expanded, labels);
export const isGridColumnGrouped: typeof tsViewmodel.isGridColumnGrouped = (
  groupByColumns,
  column,
) => tsViewmodel.isGridColumnGrouped(groupByColumns, column);
export const isGridTreeRowExpanded: typeof tsViewmodel.isGridTreeRowExpanded = (
  expandedTreeRows,
  row,
) => tsViewmodel.isGridTreeRowExpanded(expandedTreeRows, row);
export const gridTreeToggleLabelForRow: typeof tsViewmodel.gridTreeToggleLabelForRow = (
  expandedTreeRows,
  row,
  labels,
) => tsViewmodel.gridTreeToggleLabelForRow(expandedTreeRows, row, labels);
export const gridExpandToggleLabelForRow: typeof tsViewmodel.gridExpandToggleLabelForRow = (
  row,
  labels,
) => tsViewmodel.gridExpandToggleLabelForRow(row, labels);

export const isPinningEnabled: typeof tsPinning.isPinningEnabled = (options) =>
  tsPinning.isPinningEnabled(options);
export const isColumnPinnable: typeof tsPinning.isColumnPinnable = (options, column) =>
  tsPinning.isColumnPinnable(options, column);
export const getColumnPinDirection: typeof tsPinning.getColumnPinDirection = (
  pinnedColumns,
  column,
) => tsPinning.getColumnPinDirection(pinnedColumns, column);
export const pinColumnState: typeof tsPinning.pinColumnState = (current, columnName, direction) =>
  tsPinning.pinColumnState(current, columnName, direction);
export const buildInitialPinnedState: typeof tsPinning.buildInitialPinnedState = (columns) =>
  tsPinning.buildInitialPinnedState(columns);
export const computePinnedOffset: typeof tsPinning.computePinnedOffset = (
  visibleColumns,
  pinnedColumns,
  column,
) => tsPinning.computePinnedOffset(visibleColumns, pinnedColumns, column);
export const pinningButtonLabel: typeof tsPinning.pinningButtonLabel = (
  pinnedColumns,
  column,
  labels,
) => tsPinning.pinningButtonLabel(pinnedColumns, column, labels);

export const isGridCellPosition: typeof tsEdit.isGridCellPosition = (position, rowId, columnName) =>
  tsEdit.isGridCellPosition(position, rowId, columnName);
export const beginGridEditSession: typeof tsEdit.beginGridEditSession = (
  rowId,
  columnName,
  editingValue,
) => tsEdit.beginGridEditSession(rowId, columnName, editingValue);
export const shouldGridEditOnFocus: typeof tsEdit.shouldGridEditOnFocus = (options, column) =>
  tsEdit.shouldGridEditOnFocus(options, column);
export const isPrintableGridKey: typeof tsEdit.isPrintableGridKey = (
  key,
  ctrlKey,
  metaKey,
  altKey,
) => tsEdit.isPrintableGridKey(key, ctrlKey, metaKey, altKey);
export const buildGridFocusCellResult: typeof tsEdit.buildGridFocusCellResult = (context) =>
  tsEdit.buildGridFocusCellResult(context);
export const clearGridEditSession: typeof tsEdit.clearGridEditSession = () =>
  tsEdit.clearGridEditSession();
export const findNextGridCell: typeof tsEdit.findNextGridCell = (context) =>
  tsEdit.findNextGridCell(context);
export const stringifyGridEditorValue: typeof tsEdit.stringifyGridEditorValue = (value) =>
  tsEdit.stringifyGridEditorValue(value);
export const parseGridEditedValue: typeof tsEdit.parseGridEditedValue = (column, value, oldValue) =>
  tsEdit.parseGridEditedValue(column, value, oldValue);

export const toggleGridRowExpanded: typeof tsRowState.toggleGridRowExpanded = (
  expandedRows,
  rowId,
) => tsRowState.toggleGridRowExpanded(expandedRows, rowId);
export const expandAllGridRows: typeof tsRowState.expandAllGridRows = (rows) =>
  tsRowState.expandAllGridRows(rows);
export const areAllGridRowsExpanded: typeof tsRowState.areAllGridRowsExpanded = (
  rows,
  expandedRows,
) => tsRowState.areAllGridRowsExpanded(rows, expandedRows);
export const setGridTreeRowExpanded: typeof tsRowState.setGridTreeRowExpanded = (
  expandedTreeRows,
  rowId,
  expanded,
) => tsRowState.setGridTreeRowExpanded(expandedTreeRows, rowId, expanded);
export const toggleGridTreeRowExpanded: typeof tsRowState.toggleGridTreeRowExpanded = (
  expandedTreeRows,
  rowId,
) => tsRowState.toggleGridTreeRowExpanded(expandedTreeRows, rowId);
export const expandAllGridTreeRows: typeof tsRowState.expandAllGridTreeRows = (rows) =>
  tsRowState.expandAllGridTreeRows(rows);
export const getGridTreeRowChildren: typeof tsRowState.getGridTreeRowChildren = (rows, rowId) =>
  tsRowState.getGridTreeRowChildren(rows, rowId);
export const addGridRowInvisibleReason: typeof tsRowState.addGridRowInvisibleReason = (
  hiddenRowReasons,
  rowId,
  reason,
) => tsRowState.addGridRowInvisibleReason(hiddenRowReasons, rowId, reason);
export const clearGridRowInvisibleReason: typeof tsRowState.clearGridRowInvisibleReason = (
  hiddenRowReasons,
  rowId,
  reason,
) => tsRowState.clearGridRowInvisibleReason(hiddenRowReasons, rowId, reason);

export const getEffectivePageSize: typeof tsPagination.getEffectivePageSize = (
  options,
  pageSize,
  totalItems,
) => tsPagination.getEffectivePageSize(options, pageSize, totalItems);
export const getTotalPagesValue: typeof tsPagination.getTotalPagesValue = (
  options,
  totalItems,
  pageSize,
) => tsPagination.getTotalPagesValue(options, totalItems, pageSize);
export const getCurrentPageValue: typeof tsPagination.getCurrentPageValue = (
  options,
  currentPage,
  totalItems,
  pageSize,
) => tsPagination.getCurrentPageValue(options, currentPage, totalItems, pageSize);
export const getFirstRowIndexValue: typeof tsPagination.getFirstRowIndexValue = (
  options,
  currentPage,
  totalItems,
  pageSize,
) => tsPagination.getFirstRowIndexValue(options, currentPage, totalItems, pageSize);
export const getLastRowIndexValue: typeof tsPagination.getLastRowIndexValue = (
  options,
  currentPage,
  totalItems,
  pageSize,
) => tsPagination.getLastRowIndexValue(options, currentPage, totalItems, pageSize);
export const paginateGridRows: typeof tsPagination.paginateGridRows = (
  rows,
  options,
  currentPage,
  pageSize,
  totalItems,
) => tsPagination.paginateGridRows(rows, options, currentPage, pageSize, totalItems);
export const isVirtualizationEnabled: typeof tsPagination.isVirtualizationEnabled = (
  options,
  itemCount,
) => tsPagination.isVirtualizationEnabled(options, itemCount);
export const calculateVirtualWindow: typeof tsPagination.calculateVirtualWindow = (request) =>
  withWasm(
    (wasm) => wasm.calculate_virtual_window_js(request),
    () => tsPagination.calculateVirtualWindow(request),
  );
export const seekGridPage: typeof tsPagination.seekGridPage = (page, totalPages) =>
  tsPagination.seekGridPage(page, totalPages);
export const resolveGridPageSize: typeof tsPagination.resolveGridPageSize = (pageSize) =>
  tsPagination.resolveGridPageSize(pageSize);

export const buildGridSavedState: typeof tsState.buildGridSavedState = (context) =>
  tsState.buildGridSavedState(context);
export const normalizeGridSavedState: typeof tsState.normalizeGridSavedState = (state) =>
  tsState.normalizeGridSavedState(state);
export const sanitizeDownloadFilename: typeof tsState.sanitizeDownloadFilename = (value) =>
  tsState.sanitizeDownloadFilename(value);
export const normalizeBooleanMap: typeof tsState.normalizeBooleanMap = (value) =>
  tsState.normalizeBooleanMap(value);
export const isSafeStateKey: typeof tsState.isSafeStateKey = (value) =>
  tsState.isSafeStateKey(value);

export const findGridRowById: typeof tsIdentity.findGridRowById = (rows, rowId) =>
  tsIdentity.findGridRowById(rows, rowId);
export const buildGridSortState: typeof tsIdentity.buildGridSortState = (columnName, direction) =>
  tsIdentity.buildGridSortState(columnName, direction);
export const resolveGridRowId: typeof tsIdentity.resolveGridRowId = (options, row) =>
  tsIdentity.resolveGridRowId(options, row);

export const maybeRequestInfiniteScrollData: typeof tsInfiniteScroll.maybeRequestInfiniteScrollData =
  (context) => tsInfiniteScroll.maybeRequestInfiniteScrollData(context);
export const completeInfiniteScrollDataLoad: typeof tsInfiniteScroll.completeInfiniteScrollDataLoad =
  (state, scrollUp, scrollDown) =>
    tsInfiniteScroll.completeInfiniteScrollDataLoad(state, scrollUp, scrollDown);
export const resetInfiniteScrollState: typeof tsInfiniteScroll.resetInfiniteScrollState = (
  scrollUp,
  scrollDown,
) => tsInfiniteScroll.resetInfiniteScrollState(scrollUp, scrollDown);
export const saveInfiniteScrollPercentage: typeof tsInfiniteScroll.saveInfiniteScrollPercentage = (
  state,
  visibleRows,
) => tsInfiniteScroll.saveInfiniteScrollPercentage(state, visibleRows);
export const setInfiniteScrollDirectionsState: typeof tsInfiniteScroll.setInfiniteScrollDirectionsState =
  (state, scrollUp, scrollDown) =>
    tsInfiniteScroll.setInfiniteScrollDirectionsState(state, scrollUp, scrollDown);

export const clearGridFilterReasons: typeof tsFiltering.clearGridFilterReasons = (row) =>
  tsFiltering.clearGridFilterReasons(row);
export const matchesGridRowFilters: typeof tsFiltering.matchesGridRowFilters = (
  row,
  columns,
  options,
  activeFilters,
) => tsFiltering.matchesGridRowFilters(row, columns, options, activeFilters);

export const sortGridRows: typeof tsSorting.sortGridRows = (rows, columns, options, sortState) =>
  shouldFallbackSorting(columns)
    ? tsSorting.sortGridRows(rows, columns, options, sortState)
    : withWasm(
        (wasm) =>
          wasm.sort_grid_rows_js({
            rows,
            columns,
            options: normalizeOptionsForWasm(options),
            sortState,
          }),
        () => tsSorting.sortGridRows(rows, columns, options, sortState),
      );

export const buildGridRows: typeof tsTree.buildGridRows = (
  options,
  rowSize,
  hiddenRowReasons,
  expandedRows,
) =>
  shouldFallbackTree(options, options.columnDefs)
    ? tsTree.buildGridRows(options, rowSize, hiddenRowReasons, expandedRows)
    : withWasm(
        (wasm) =>
          wasm.build_grid_rows_js({
            options: normalizeOptionsForWasm(options),
            rowSize,
            hiddenRowReasons,
            expandedRows,
          }),
        () => tsTree.buildGridRows(options, rowSize, hiddenRowReasons, expandedRows),
      );
export const isTreeEnabled: typeof tsTree.isTreeEnabled = (options) =>
  withWasm(
    (wasm) => wasm.is_tree_enabled_js(normalizeOptionsForWasm(options)),
    () => tsTree.isTreeEnabled(options),
  );
export const filterAndFlattenGridTreeRows: typeof tsTree.filterAndFlattenGridTreeRows = (
  rows,
  columns,
  options,
  activeFilters,
  expandedTreeRows,
  sortState,
) =>
  shouldFallbackTree(options, columns)
    ? tsTree.filterAndFlattenGridTreeRows(
        rows,
        columns,
        options,
        activeFilters,
        expandedTreeRows,
        sortState,
      )
    : withWasm(
        (wasm) =>
          wasm.filter_and_flatten_grid_tree_rows_js({
            rows,
            columns: columns.map((column) => normalizeColumnForWasm(column)),
            options: normalizeOptionsForWasm(options),
            activeFilters,
            expandedTreeRows,
            sortState,
          }),
        () =>
          tsTree.filterAndFlattenGridTreeRows(
            rows,
            columns,
            options,
            activeFilters,
            expandedTreeRows,
            sortState,
          ),
      );

export const buildGridDisplayItems: typeof tsGrouping.buildGridDisplayItems = (
  rows,
  columns,
  options,
  groupBy,
  collapsedGroups,
) =>
  requiresTemplateFallback(options)
    ? tsGrouping.buildGridDisplayItems(rows, columns, options, groupBy, collapsedGroups)
    : withWasm(
        (wasm) =>
          wasm.build_grid_display_items_js({
            rows,
            columns: columns.map((column) => normalizeColumnForWasm(column)),
            options: normalizeOptionsForWasm(options),
            groupBy,
            collapsedGroups,
          }),
        () => tsGrouping.buildGridDisplayItems(rows, columns, options, groupBy, collapsedGroups),
      );

export const headerLabel: typeof tsExport.headerLabel = (column) => tsExport.headerLabel(column);
export const exportCsvRows: typeof tsExport.exportCsvRows = (columns, rows, formatCell) => {
  if (
    formatCell ||
    columns.some(
      (column) =>
        typeof column.valueGetter === 'function' ||
        typeof column.formatter === 'function' ||
        typeof column.cellRenderer === 'function',
    )
  ) {
    return tsExport.exportCsvRows(columns, rows, formatCell);
  }

  return withWasm(
    (wasm) => wasm.export_csv_rows_js(columns, rows),
    () => tsExport.exportCsvRows(columns, rows, formatCell),
  );
};
