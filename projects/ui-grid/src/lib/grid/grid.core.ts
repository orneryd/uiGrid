import { FILTER_CONDITIONS, SORT_DIRECTIONS, SortDirection } from './grid.constants';
import { GridBenchmarkResult, GridCellPosition, GridColumnDef, GridOptions, GridRecord, GridRow, GridSavedState, SortState } from './grid.models';
import { runColumnFilter, setupFilters } from './row-searcher';
import { getCellValue, getPathValue, stringifyCellValue, titleize, toCsvValue } from './grid.utils';
import { getSortFn } from './row-sorter';

export interface GroupItem {
  kind: 'group';
  id: string;
  depth: number;
  field: string;
  label: string;
  count: number;
  collapsed: boolean;
}

export interface RowItem {
  kind: 'row';
  id: string;
  row: GridRow;
  visibleIndex: number;
}

export interface ExpandableItem {
  kind: 'expandable';
  id: string;
  row: GridRow;
}

export type DisplayItem = GroupItem | RowItem | ExpandableItem;

export interface PipelineResult {
  visibleRows: GridRow[];
  displayItems: DisplayItem[];
  virtualizationEnabled: boolean;
  pipelineMs: number;
  totalItems: number;
}

export interface BuildGridPipelineContext {
  options: GridOptions;
  columns: readonly GridColumnDef[];
  activeFilters: Readonly<Record<string, string>>;
  sortState: SortState;
  groupByColumns: readonly string[];
  collapsedGroups: Readonly<Record<string, boolean>>;
  hiddenRowReasons: Readonly<Record<string, readonly string[]>>;
  expandedRows: Readonly<Record<string, boolean>>;
  expandedTreeRows: Readonly<Record<string, boolean>>;
  currentPage: number;
  pageSize: number;
  rowSize: number;
  now?: () => number;
}

export interface GridInfiniteScrollState {
  scrollUp: boolean;
  scrollDown: boolean;
  dataLoading: boolean;
  previousVisibleRows: number;
}

export type GridMoveDirection = 'left' | 'right' | 'up' | 'down';

function isFilteringEnabled(options: GridOptions): boolean {
  return options.enableFiltering !== false;
}

function isSortingEnabled(options: GridOptions): boolean {
  return options.enableSorting !== false;
}

function isGroupingEnabled(options: GridOptions): boolean {
  return options.enableGrouping === true && !isTreeEnabled(options);
}

function isTreeEnabled(options: GridOptions): boolean {
  return options.enableTreeView === true;
}

function canExpandRows(options: GridOptions): boolean {
  return options.enableExpandable === true && !!options.expandableRowTemplate;
}

function isPaginationEnabled(options: GridOptions): boolean {
  return options.enablePagination === true || (options.paginationPageSize ?? 0) > 0;
}

function initialPageSize(options: GridOptions): number {
  if (options.paginationPageSize) {
    return options.paginationPageSize;
  }

  if (options.paginationPageSizes && options.paginationPageSizes.length > 0) {
    return options.paginationPageSizes[0];
  }

  return options.data.length;
}

export function getEffectivePageSize(options: GridOptions, pageSize: number, totalItems: number): number {
  if (!isPaginationEnabled(options)) {
    return totalItems;
  }

  const resolvedPageSize = pageSize || initialPageSize(options);
  return resolvedPageSize > 0 ? resolvedPageSize : totalItems;
}

export function getTotalPagesValue(options: GridOptions, totalItems: number, pageSize: number): number {
  if (!isPaginationEnabled(options) || getEffectivePageSize(options, pageSize, totalItems) <= 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(totalItems / getEffectivePageSize(options, pageSize, totalItems)));
}

export function getCurrentPageValue(
  options: GridOptions,
  currentPage: number,
  totalItems: number,
  pageSize: number
): number {
  return Math.min(Math.max(currentPage, 1), getTotalPagesValue(options, totalItems, pageSize));
}

export function getFirstRowIndexValue(
  options: GridOptions,
  currentPage: number,
  totalItems: number,
  pageSize: number
): number {
  if (!isPaginationEnabled(options) || totalItems === 0 || options.useExternalPagination === true) {
    return 0;
  }

  return (getCurrentPageValue(options, currentPage, totalItems, pageSize) - 1) * getEffectivePageSize(options, pageSize, totalItems);
}

export function getLastRowIndexValue(
  options: GridOptions,
  currentPage: number,
  totalItems: number,
  pageSize: number
): number {
  if (totalItems === 0) {
    return 0;
  }

  if (!isPaginationEnabled(options) || options.useExternalPagination === true) {
    return totalItems - 1;
  }

  return Math.min(
    getFirstRowIndexValue(options, currentPage, totalItems, pageSize) + getEffectivePageSize(options, pageSize, totalItems),
    totalItems
  ) - 1;
}

export function paginateGridRows(
  rows: readonly GridRow[],
  options: GridOptions,
  currentPage: number,
  pageSize: number,
  totalItems: number
): GridRow[] {
  if (!isPaginationEnabled(options) || options.useExternalPagination === true) {
    return [...rows];
  }

  const resolvedPageSize = getEffectivePageSize(options, pageSize, totalItems);
  const firstRow = getFirstRowIndexValue(options, currentPage, totalItems, pageSize);
  return [...rows].slice(firstRow, firstRow + resolvedPageSize);
}

export function isVirtualizationEnabled(options: GridOptions, itemCount: number): boolean {
  return options.enableVirtualization !== false
    && itemCount >= (options.virtualizationThreshold ?? 40);
}

export function seekGridPage(page: number, totalPages: number): number {
  return Math.min(Math.max(page, 1), Math.max(totalPages, 1));
}

export function resolveGridPageSize(pageSize: number): number | null {
  return Number.isFinite(pageSize) && pageSize > 0 ? pageSize : null;
}

export function resolveGridRowId(options: GridOptions, row: GridRow | GridRecord | string): string {
  if (typeof row === 'string') {
    return row;
  }

  if (row instanceof GridRow) {
    return row.id;
  }

  const rowIndex = options.data.indexOf(row);
  return options.rowIdentity?.(row, rowIndex) ?? `${options.id}-${rowIndex}`;
}

export function findGridRowById(rows: readonly GridRow[], rowId: string): GridRow | null {
  return rows.find((row) => row.id === rowId) ?? null;
}

export function buildGridSortState(columnName: string, direction?: SortDirection): SortState {
  return {
    columnName,
    direction: direction ?? SORT_DIRECTIONS.asc
  };
}

export function isGridCellPosition(position: GridCellPosition | null, rowId: string, columnName: string): boolean {
  return position?.rowId === rowId && position.columnName === columnName;
}

export function beginGridEditSession(rowId: string, columnName: string, editingValue: string): {
  focusedCell: GridCellPosition;
  editingCell: GridCellPosition;
  editingValue: string;
} {
  const position = { rowId, columnName };
  return {
    focusedCell: position,
    editingCell: position,
    editingValue
  };
}

export function shouldGridEditOnFocus(options: GridOptions, column: GridColumnDef): boolean {
  return column.enableCellEditOnFocus ?? options.enableCellEditOnFocus ?? false;
}

export function isPrintableGridKey(key: string, ctrlKey: boolean, metaKey: boolean, altKey: boolean): boolean {
  return key.length === 1 && !ctrlKey && !metaKey && !altKey;
}

export function buildGridFocusCellResult(context: {
  currentFocusedCell: GridCellPosition | null;
  currentEditingCell: GridCellPosition | null;
  rowId: string;
  columnName: string;
  shouldEditOnFocus: boolean;
  isCellEditable: boolean;
}): { focusedCell: GridCellPosition; shouldBeginEdit: boolean } {
  const focusedCell = { rowId: context.rowId, columnName: context.columnName };
  return {
    focusedCell,
    shouldBeginEdit: context.shouldEditOnFocus
      && context.isCellEditable
      && !isGridCellPosition(context.currentFocusedCell, context.rowId, context.columnName)
      && !isGridCellPosition(context.currentEditingCell, context.rowId, context.columnName)
  };
}

export function clearGridEditSession(): {
  editingCell: null;
  editingValue: string;
} {
  return {
    editingCell: null,
    editingValue: ''
  };
}

export function findNextGridCell(context: {
  rows: readonly GridRow[];
  columns: readonly GridColumnDef[];
  rowId: string;
  columnName: string;
  direction: GridMoveDirection;
  isCellAllowed?: (row: GridRow, column: GridColumnDef) => boolean;
}): { row: GridRow; column: GridColumnDef } | null {
  const rowIndex = context.rows.findIndex((candidate) => candidate.id === context.rowId);
  const columnIndex = context.columns.findIndex((candidate) => candidate.name === context.columnName);
  if (rowIndex === -1 || columnIndex === -1) {
    return null;
  }

  let nextRowIndex = rowIndex;
  let nextColumnIndex = columnIndex;

  while (true) {
    switch (context.direction) {
      case 'left':
        nextColumnIndex -= 1;
        if (nextColumnIndex < 0) {
          nextRowIndex -= 1;
          nextColumnIndex = context.columns.length - 1;
        }
        break;
      case 'right':
        nextColumnIndex += 1;
        if (nextColumnIndex >= context.columns.length) {
          nextRowIndex += 1;
          nextColumnIndex = 0;
        }
        break;
      case 'up':
        nextRowIndex -= 1;
        break;
      case 'down':
        nextRowIndex += 1;
        break;
    }

    if (
      nextRowIndex < 0
      || nextRowIndex >= context.rows.length
      || nextColumnIndex < 0
      || nextColumnIndex >= context.columns.length
    ) {
      return null;
    }

    const nextRow = context.rows[nextRowIndex];
    const nextColumn = context.columns[nextColumnIndex];
    if (!nextRow || !nextColumn) {
      return null;
    }

    if (!context.isCellAllowed || context.isCellAllowed(nextRow, nextColumn)) {
      return { row: nextRow, column: nextColumn };
    }
  }
}

export function stringifyGridEditorValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value === null || value === undefined ? '' : String(value);
}

export function parseGridEditedValue(column: GridColumnDef, value: string, oldValue: unknown): unknown {
  switch (column.type) {
    case 'number': {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? oldValue : parsed;
    }
    case 'boolean':
      return value === 'true';
    case 'date':
      return value;
    default:
      return value;
  }
}

export function maybeRequestInfiniteScrollData(context: {
  state: GridInfiniteScrollState;
  startIndex: number;
  visibleRows: number;
  viewportRows: number;
  threshold: number;
}): { request: 'top' | 'bottom' | null; nextState: GridInfiniteScrollState } {
  if (context.state.dataLoading) {
    return { request: null, nextState: context.state };
  }

  if (context.state.scrollUp && context.startIndex <= context.threshold) {
    return {
      request: 'top',
      nextState: {
        ...context.state,
        dataLoading: true,
        previousVisibleRows: context.visibleRows
      }
    };
  }

  if (context.state.scrollDown && context.startIndex + context.viewportRows >= Math.max(context.visibleRows - context.threshold, 0)) {
    return {
      request: 'bottom',
      nextState: {
        ...context.state,
        dataLoading: true,
        previousVisibleRows: context.visibleRows
      }
    };
  }

  return { request: null, nextState: context.state };
}

export function completeInfiniteScrollDataLoad(
  state: GridInfiniteScrollState,
  scrollUp: boolean,
  scrollDown: boolean
): GridInfiniteScrollState {
  return {
    ...state,
    scrollUp,
    scrollDown,
    dataLoading: false
  };
}

export function resetInfiniteScrollState(scrollUp: boolean, scrollDown: boolean): GridInfiniteScrollState {
  return {
    scrollUp,
    scrollDown,
    dataLoading: false,
    previousVisibleRows: 0
  };
}

export function saveInfiniteScrollPercentage(
  state: GridInfiniteScrollState,
  visibleRows: number
): GridInfiniteScrollState {
  return {
    ...state,
    previousVisibleRows: visibleRows
  };
}

export function setInfiniteScrollDirectionsState(
  state: GridInfiniteScrollState,
  scrollUp: boolean,
  scrollDown: boolean
): GridInfiniteScrollState {
  return {
    ...state,
    scrollUp,
    scrollDown
  };
}

export function toggleGridRowExpanded(
  expandedRows: Readonly<Record<string, boolean>>,
  rowId: string
): { expanded: boolean; nextExpandedRows: Record<string, boolean> } {
  const expanded = !expandedRows[rowId];
  return {
    expanded,
    nextExpandedRows: {
      ...expandedRows,
      [rowId]: expanded
    }
  };
}

export function expandAllGridRows(rows: readonly GridRow[]): Record<string, boolean> {
  const nextExpandedRows: Record<string, boolean> = {};

  for (const row of rows) {
    nextExpandedRows[row.id] = true;
  }

  return nextExpandedRows;
}

export function areAllGridRowsExpanded(rows: readonly GridRow[], expandedRows: Readonly<Record<string, boolean>>): boolean {
  return rows.every((row) => expandedRows[row.id] === true);
}

export function setGridTreeRowExpanded(
  expandedTreeRows: Readonly<Record<string, boolean>>,
  rowId: string,
  expanded: boolean
): Record<string, boolean> {
  return {
    ...expandedTreeRows,
    [rowId]: expanded
  };
}

export function toggleGridTreeRowExpanded(
  expandedTreeRows: Readonly<Record<string, boolean>>,
  rowId: string
): { expanded: boolean; nextExpandedTreeRows: Record<string, boolean> } {
  const expanded = !expandedTreeRows[rowId];
  return {
    expanded,
    nextExpandedTreeRows: setGridTreeRowExpanded(expandedTreeRows, rowId, expanded)
  };
}

export function expandAllGridTreeRows(rows: readonly GridRow[]): Record<string, boolean> {
  const nextExpandedTreeRows: Record<string, boolean> = {};

  for (const row of rows) {
    if (row.hasChildren) {
      nextExpandedTreeRows[row.id] = true;
    }
  }

  return nextExpandedTreeRows;
}

export function getGridTreeRowChildren(rows: readonly GridRow[], rowId: string): GridRow[] {
  return rows.filter((candidate) => candidate.parentId === rowId);
}

export function addGridRowInvisibleReason(
  hiddenRowReasons: Readonly<Record<string, readonly string[]>>,
  rowId: string,
  reason: string
): Record<string, string[]> {
  const reasons = new Set(hiddenRowReasons[rowId] ?? []);
  reasons.add(reason);

  const nextHiddenRowReasons = Object.fromEntries(
    Object.entries(hiddenRowReasons).map(([key, value]) => [key, [...value]])
  ) as Record<string, string[]>;
  nextHiddenRowReasons[rowId] = [...reasons];

  return nextHiddenRowReasons;
}

export function clearGridRowInvisibleReason(
  hiddenRowReasons: Readonly<Record<string, readonly string[]>>,
  rowId: string,
  reason: string
): Record<string, string[]> {
  const reasons = new Set(hiddenRowReasons[rowId] ?? []);
  reasons.delete(reason);

  const nextHiddenRowReasons = Object.fromEntries(
    Object.entries(hiddenRowReasons).map(([key, value]) => [key, [...value]])
  ) as Record<string, string[]>;
  if (reasons.size === 0) {
    delete nextHiddenRowReasons[rowId];
  } else {
    nextHiddenRowReasons[rowId] = [...reasons];
  }

  return nextHiddenRowReasons;
}

export function buildGridSavedState(context: {
  columnOrder: readonly string[];
  activeFilters: Readonly<Record<string, string>>;
  sortState: SortState;
  groupByColumns: readonly string[];
  currentPage: number;
  pageSize: number;
  totalItems: number;
  expandedRows: Readonly<Record<string, boolean>>;
  expandedTreeRows: Readonly<Record<string, boolean>>;
}): GridSavedState {
  return {
    columnOrder: [...context.columnOrder],
    filters: { ...context.activeFilters },
    sort: { ...context.sortState },
    grouping: [...context.groupByColumns],
    pagination: {
      paginationCurrentPage: currentPageValue(context.currentPage),
      paginationPageSize: effectivePageSize(context.pageSize, context.totalItems)
    },
    expandable: { ...context.expandedRows },
    treeView: { ...context.expandedTreeRows }
  };
}

export function normalizeGridSavedState(state: GridSavedState): GridSavedState {
  const normalized: GridSavedState = {};

  if (Array.isArray(state.columnOrder)) {
    normalized.columnOrder = state.columnOrder.filter(
      (columnName): columnName is string => typeof columnName === 'string' && isSafeStateKey(columnName)
    );
  }

  if (state.filters && typeof state.filters === 'object') {
    normalized.filters = Object.entries(state.filters).reduce<Record<string, string>>((accumulator, [key, value]) => {
      if (typeof key === 'string' && isSafeStateKey(key) && typeof value === 'string') {
        accumulator[key] = value;
      }

      return accumulator;
    }, {});
  }

  if (state.sort && typeof state.sort === 'object') {
    normalized.sort = {
      columnName: typeof state.sort.columnName === 'string' && isSafeStateKey(state.sort.columnName)
        ? state.sort.columnName
        : null,
      direction: state.sort.direction === SORT_DIRECTIONS.asc || state.sort.direction === SORT_DIRECTIONS.desc
        ? state.sort.direction
        : SORT_DIRECTIONS.none
    };
  }

  if (Array.isArray(state.grouping)) {
    normalized.grouping = state.grouping.filter(
      (columnName): columnName is string => typeof columnName === 'string' && isSafeStateKey(columnName)
    );
  }

  if (state.pagination && typeof state.pagination === 'object') {
    const paginationCurrentPage = Number(state.pagination.paginationCurrentPage);
    const paginationPageSize = Number(state.pagination.paginationPageSize);

    normalized.pagination = {
      paginationCurrentPage: Number.isFinite(paginationCurrentPage) && paginationCurrentPage > 0
        ? Math.floor(paginationCurrentPage)
        : 1,
      paginationPageSize: Number.isFinite(paginationPageSize) && paginationPageSize >= 0
        ? Math.floor(paginationPageSize)
        : 0
    };
  }

  if (state.expandable && typeof state.expandable === 'object') {
    normalized.expandable = normalizeBooleanMap(state.expandable);
  }

  if (state.treeView && typeof state.treeView === 'object') {
    normalized.treeView = normalizeBooleanMap(state.treeView);
  }

  return normalized;
}

function currentPageValue(currentPage: number): number {
  return Math.max(1, Math.floor(currentPage));
}

function effectivePageSize(pageSize: number, totalItems: number): number {
  const resolvedPageSize = Math.floor(pageSize);
  return Number.isFinite(resolvedPageSize) && resolvedPageSize > 0 ? resolvedPageSize : totalItems;
}

export function sanitizeDownloadFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'ui-grid';
}

export function normalizeBooleanMap(value: Record<string, unknown>): Record<string, boolean> {
  return Object.entries(value).reduce<Record<string, boolean>>((accumulator, [key, entry]) => {
    if (typeof key === 'string' && isSafeStateKey(key) && typeof entry === 'boolean') {
      accumulator[key] = entry;
    }

    return accumulator;
  }, {});
}

export function isSafeStateKey(value: string): boolean {
  return value !== '__proto__' && value !== 'constructor' && value !== 'prototype';
}

function getTreeChildren(options: GridOptions, entity: GridRecord): GridRecord[] {
  if (!isTreeEnabled(options)) {
    return [];
  }

  const treeChildren = getPathValue(entity, options.treeChildrenField ?? 'children');
  return Array.isArray(treeChildren) ? treeChildren as GridRecord[] : [];
}

function createRow(
  options: GridOptions,
  entity: GridRecord,
  index: number,
  rowSize: number,
  hiddenRowReasons: Readonly<Record<string, readonly string[]>>,
  treeLevel = 0,
  parentId: string | null = null,
  childCount = 0,
  expanded = false
): GridRow {
  const rowIdentity = options.rowIdentity?.(entity, index) ?? `${options.id}-${index}`;
  const row = new GridRow(rowIdentity, entity, index, rowSize);
  const reasons = hiddenRowReasons[row.id] ?? [];

  row.treeLevel = treeLevel;
  row.parentId = parentId;
  row.childCount = childCount;
  row.hasChildren = childCount > 0;
  row.expanded = expanded;
  row.expandedRowHeight = options.expandableRowHeight ?? 150;

  for (const reason of reasons) {
    row.setThisRowInvisible(reason);
  }

  return row;
}

export function buildGridRows(
  options: GridOptions,
  rowSize: number,
  hiddenRowReasons: Readonly<Record<string, readonly string[]>>,
  expandedRows: Readonly<Record<string, boolean>>
): GridRow[] {
  const rows: GridRow[] = [];
  let nextIndex = 0;

  const visit = (entities: readonly GridRecord[], treeLevel: number, parentId: string | null): void => {
    for (const entity of entities) {
      const childEntities = getTreeChildren(options, entity);
      const row = createRow(
        options,
        entity,
        nextIndex,
        rowSize,
        hiddenRowReasons,
        treeLevel,
        parentId,
        childEntities.length,
        expandedRows[options.rowIdentity?.(entity, nextIndex) ?? `${options.id}-${nextIndex}`] === true
      );

      nextIndex += 1;
      rows.push(row);

      if (isTreeEnabled(options) && childEntities.length > 0) {
        visit(childEntities, treeLevel + 1, row.id);
      }
    }
  };

  visit(options.data, 0, null);
  return rows;
}

function clearFilterReasons(row: GridRow): void {
  for (const reason of [...row.invisibleReasons]) {
    if (reason.startsWith('filter:')) {
      row.clearThisRowInvisible(reason);
    }
  }
}

function matchesFilters(
  row: GridRow,
  columns: readonly GridColumnDef[],
  options: GridOptions,
  activeFilters: Readonly<Record<string, string>>
): boolean {
  if (!isFilteringEnabled(options)) {
    return row.visible;
  }

  for (const column of columns) {
    const term = activeFilters[column.name]?.trim();
    if (!term || column.filterable === false || column.enableFiltering === false) {
      row.clearThisRowInvisible(`filter:${column.name}`);
      continue;
    }

    const parsedFilters = setupFilters([
      {
        ...(column.filter ?? { condition: FILTER_CONDITIONS.contains }),
        term
      }
    ]);

    const matchesAll = parsedFilters.every((filter) => runColumnFilter(row.entity, column, filter));
    if (!matchesAll) {
      row.setThisRowInvisible(`filter:${column.name}`);
      return false;
    }

    row.clearThisRowInvisible(`filter:${column.name}`);
  }

  return row.visible;
}

function sortGridRows(
  rows: readonly GridRow[],
  columns: readonly GridColumnDef[],
  options: GridOptions,
  sortState: SortState
): GridRow[] {
  if (!sortState.columnName || sortState.direction === SORT_DIRECTIONS.none || !isSortingEnabled(options)) {
    return [...rows];
  }

  const sortColumn = columns.find((column) => column.name === sortState.columnName);
  if (!sortColumn || sortColumn.sortable === false || sortColumn.enableSorting === false) {
    return [...rows];
  }

  const sortFn = getSortFn(sortColumn, rows.map((row) => row.entity));
  const directionMultiplier = sortState.direction === SORT_DIRECTIONS.desc ? -1 : 1;

  return [...rows].sort((left, right) => {
    const leftValue = getCellValue(left.entity, sortColumn);
    const rightValue = getCellValue(right.entity, sortColumn);
    return sortFn(leftValue, rightValue) * directionMultiplier;
  });
}

function buildRowDisplayItems(rows: readonly GridRow[], options: GridOptions): DisplayItem[] {
  const items: DisplayItem[] = [];
  rows.forEach((row, visibleIndex) => {
    items.push({ kind: 'row', id: row.id, row, visibleIndex });
    if (row.expanded && canExpandRows(options)) {
      items.push({ kind: 'expandable', id: `${row.id}:expandable`, row });
    }
  });

  return items;
}

function buildGroupedItems(
  rows: readonly GridRow[],
  columns: readonly GridColumnDef[],
  options: GridOptions,
  groupBy: readonly string[],
  collapsedGroups: Readonly<Record<string, boolean>>,
  depth: number,
  path: string
): DisplayItem[] {
  if (groupBy.length === 0) {
    return buildRowDisplayItems(rows, options);
  }

  const [currentField, ...rest] = groupBy;
  const groups = new Map<string, GridRow[]>();

  for (const row of rows) {
    const value = stringifyCellValue(getPathValue(row.entity, currentField));
    const key = value || 'Unassigned';
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }

  const items: DisplayItem[] = [];
  for (const [label, groupedRows] of groups) {
    const groupId = `${path}${currentField}:${label}`;
    const collapsed = collapsedGroups[groupId] ?? options.grouping?.startCollapsed ?? false;
    items.push({
      kind: 'group',
      id: groupId,
      depth,
      field: currentField,
      label,
      count: groupedRows.length,
      collapsed
    });

    if (!collapsed) {
      items.push(...buildGroupedItems(groupedRows, columns, options, rest, collapsedGroups, depth + 1, `${groupId}|`));
    }
  }

  return items;
}

function buildDisplayItems(
  rows: readonly GridRow[],
  columns: readonly GridColumnDef[],
  options: GridOptions,
  groupBy: readonly string[],
  collapsedGroups: Readonly<Record<string, boolean>>
): DisplayItem[] {
  if (isTreeEnabled(options)) {
    return buildRowDisplayItems(rows, options);
  }

  if (!isGroupingEnabled(options) || groupBy.length === 0) {
    return buildRowDisplayItems(rows, options);
  }

  return buildGroupedItems(rows, columns, options, groupBy, collapsedGroups, 0, '');
}

export function buildGridPipeline(context: BuildGridPipelineContext): PipelineResult {
  const startedAt = (context.now ?? performance.now.bind(performance))();
  const rows = buildGridRows(context.options, context.rowSize, context.hiddenRowReasons, context.expandedRows);

  const visibleRows = isTreeEnabled(context.options)
    ? filterAndFlattenTreeRows(
        rows,
        context.columns,
        context.options,
        context.activeFilters,
        context.expandedTreeRows,
        context.sortState
      )
    : sortGridRows(
        rows.filter((row) => matchesFilters(row, context.columns, context.options, context.activeFilters)),
        context.columns,
        context.options,
        context.sortState
      );

  const totalItems = context.options.useExternalPagination === true
    ? context.options.totalItems ?? visibleRows.length
    : visibleRows.length;
  const pagedRows = paginateGridRows(visibleRows, context.options, context.currentPage, context.pageSize, totalItems);
  const displayItems = buildDisplayItems(pagedRows, context.columns, context.options, context.groupByColumns, context.collapsedGroups);
  const virtualizationEnabled = isVirtualizationEnabled(context.options, displayItems.length);

  return {
    visibleRows: pagedRows,
    displayItems,
    virtualizationEnabled,
    pipelineMs: ((context.now ?? performance.now.bind(performance))() - startedAt),
    totalItems
  };
}

function filterAndFlattenTreeRows(
  rows: readonly GridRow[],
  columns: readonly GridColumnDef[],
  options: GridOptions,
  activeFilters: Readonly<Record<string, string>>,
  expandedTreeRows: Readonly<Record<string, boolean>>,
  sortState: SortState
): GridRow[] {
  const rowsByParent = new Map<string | null, GridRow[]>();
  for (const row of rows) {
    const bucket = rowsByParent.get(row.parentId) ?? [];
    bucket.push(row);
    rowsByParent.set(row.parentId, bucket);
  }

  const included = new Set<string>();
  const visit = (row: GridRow): boolean => {
    const manuallyHidden = !row.visible && [...row.invisibleReasons].some((reason) => !reason.startsWith('filter:'));
    if (manuallyHidden) {
      return false;
    }

    const children = rowsByParent.get(row.id) ?? [];
    let childIncluded = false;
    for (const child of children) {
      childIncluded = visit(child) || childIncluded;
    }

    const selfIncluded = matchesFilters(row, columns, options, activeFilters);
    if (childIncluded) {
      clearFilterReasons(row);
    }

    const include = row.visible && (selfIncluded || childIncluded);
    if (include) {
      included.add(row.id);
    }

    return include;
  };

  for (const rootRow of rowsByParent.get(null) ?? []) {
    visit(rootRow);
  }

  const flattened: GridRow[] = [];
  const flatten = (parentId: string | null): void => {
    const siblings = sortGridRows(
      (rowsByParent.get(parentId) ?? []).filter((row) => included.has(row.id)),
      columns,
      options,
      sortState
    );
    for (const row of siblings) {
      flattened.push(row);
      if (row.hasChildren && expandedTreeRows[row.id]) {
        flatten(row.id);
      }
    }
  };

  flatten(null);
  return flattened;
}

export function headerLabel(column: GridColumnDef): string {
  return column.displayName ?? titleize(column.name);
}

export function exportCsvRows(columns: readonly GridColumnDef[], rows: readonly GridRow[]): string {
  const header = columns.map((column) => toCsvValue(headerLabel(column))).join(',');
  const body = rows.map((row) => columns.map((column) => toCsvValue(column.formatter ? column.formatter(getCellValue(row.entity, column), row.entity) : stringifyCellValue(getCellValue(row.entity, column)))).join(','));
  return [header, ...body].join('\n');
}