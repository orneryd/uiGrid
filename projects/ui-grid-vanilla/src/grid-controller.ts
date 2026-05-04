import {
  SORT_DIRECTIONS,
  beginGridCellEditCommand,
  buildGridRows,
  buildGridCellContext,
  cancelGridCellEditCommand,
  canGridExpandRows,
  canGridMoveColumns,
  clearGridFiltersCommand,
  clearGridGroupingCommand,
  commitGridCellEditCommand,
  computePinnedOffset,
  createGridApi,
  defaultGridEngine,
  expandAllGridRowsCommand,
  expandAllGridTreeRowsCommand,
  findGridRowById as coreFindGridRowById,
  formatGridCellDisplayValue,
  getCellValue,
  getCurrentPageValue,
  getEffectivePageSize,
  getFirstRowIndexValue,
  getLastRowIndexValue,
  getTotalPagesValue,
  gridCellIndent,
  gridColumnWidth,
  gridEditorInputType,
  gridExpandToggleLabelForRow,
  gridFilterPlaceholder,
  gridGroupingButtonLabel,
  gridSortButtonLabel,
  gridTreeToggleLabelForRow,
  headerLabel,
  isGridColumnFilterable,
  isGridColumnGrouped,
  isGridColumnSortable,
  isGridFilteringEnabled,
  isGridGroupingEnabled,
  isGridPaginationEnabled,
  isGridSortingEnabled,
  isGridTreeEnabled,
  isGridTreeRowExpanded,
  isPinningEnabled,
  isColumnPinnable,
  gridGroupDisclosureLabel,
  moveGridVisibleColumnCommand,
  parseGridEditedValue,
  pinGridColumnCommand,
  resolveGridLabels,
  resolveGridRowId as coreResolveGridRowId,
  seekGridPaginationCommand,
  setGridPaginationPageSizeCommand,
  setPathValue,
  shouldShowGridExpandToggle,
  shouldShowGridPaginationControls,
  shouldShowGridTreeToggle,
  sortGridColumnCommand,
  toggleGridGroupingCommand,
  toggleGridRowExpansionCommand,
  toggleGridTreeRowCommand,
  updateGridFilterCommand,
  type DisplayItem,
  type GridCellPosition,
  type GridColumnDef,
  type GridLabels,
  type GridOptions,
  type GridRecord,
  type GridRow,
  type PipelineResult,
  type PinDirection,
  type PinnedColumnState,
  type SortDirection,
  type GroupItem,
  type SortState,
  type UiGridApi,
} from '@ornery/ui-grid-core';

export interface GridSaveState {
  sortState: SortState;
  activeFilters: Record<string, string>;
  groupByColumns: string[];
  pinnedColumns: PinnedColumnState;
  columnOrder: string[];
  currentPage: number;
  pageSize: number;
}

export interface GridControllerSnapshot {
  options: GridOptions;
  labels: GridLabels;
  rowSize: number;
  visibleColumns: GridColumnDef[];
  gridTemplateColumns: string;
  pipeline: PipelineResult;
  activeFilters: Record<string, string>;
  sortState: SortState;
  groupByColumns: string[];
  pinnedColumns: PinnedColumnState;
  currentPage: number;
  totalPages: number;
  firstRowIndex: number;
  lastRowIndex: number;
  pageSize: number;
  editingCell: GridCellPosition | null;
  editingValue: string;
}

export type GridControllerSubscriber = (snapshot: GridControllerSnapshot) => void;

function orderVisibleColumns(
  columns: readonly GridColumnDef[],
  order: readonly string[],
): GridColumnDef[] {
  return [...columns]
    .filter((column) => column.visible !== false)
    .sort((left, right) => order.indexOf(left.name) - order.indexOf(right.name));
}

function buildGridTemplateColumns(columns: readonly GridColumnDef[]): string {
  return columns.map((column) => gridColumnWidth(column)).join(' ');
}

export class VanillaGridController {
  private options: GridOptions;
  private activeFilters: Record<string, string> = {};
  private sortState: SortState = {
    columnName: null,
    direction: SORT_DIRECTIONS.none,
  };
  private groupByColumns: string[] = [];
  private collapsedGroups: Record<string, boolean> = {};
  private hiddenRowReasons: Record<string, string[]> = {};
  private expandedRows: Record<string, boolean> = {};
  private expandedTreeRows: Record<string, boolean> = {};
  private pinnedColumns: PinnedColumnState = {};
  private columnOrder: string[] = [];
  private currentPage = 1;
  private pageSize = 0;
  private editingCell: GridCellPosition | null = null;
  private editingValue = '';
  private pipeline: PipelineResult;
  private labels: GridLabels;
  private visibleColumns: GridColumnDef[] = [];
  private apiRegistered = false;

  private readonly subscribers = new Set<GridControllerSubscriber>();

  readonly gridApi: UiGridApi;

  constructor(options: GridOptions) {
    this.options = options;
    this.labels = resolveGridLabels(options.labels);
    this.columnOrder = options.columnDefs.map((column) => column.name);

    this.pipeline = {
      visibleRows: [],
      displayItems: [],
      virtualizationEnabled: false,
      pipelineMs: 0,
      totalItems: 0,
    };

    this.gridApi = createGridApi({
      refresh: () => this.refresh(),
      getVisibleRows: () => this.pipeline.visibleRows,
      setRowInvisible: (row, reason) => this.setRowInvisible(row, reason),
      clearRowInvisible: (row, reason) => this.clearRowInvisible(row, reason),
      setFilter: (columnName, value) => this.setFilter(columnName, value),
      clearAllFilters: () => this.clearAllFilters(),
      sortColumn: (columnName, direction) => this.sortColumn(columnName, direction),
      moveColumn: (fromIndex, toIndex) => {
        const visibleNames = this.visibleColumns.map((column) => column.name);
        const source = visibleNames[fromIndex];
        const target = visibleNames[toIndex];
        if (source && target) {
          this.moveVisibleColumn(source, target);
        }
      },
      pinColumn: (columnName, direction) => this.pinColumn(columnName, direction),
      toggleGrouping: (columnName) => this.toggleGrouping(columnName),
      clearGrouping: () => this.clearGrouping(),
      benchmark: (iterations) => this.benchmark(iterations),
      exportCsv: () => {
        // Export remains hosted by framework wrappers for now.
      },
      paginationGetPage: () => this.getCurrentPage(),
      paginationGetTotalPages: () => this.getTotalPages(),
      paginationGetFirstRowIndex: () => this.getFirstRowIndex(),
      paginationGetLastRowIndex: () => this.getLastRowIndex(),
      paginationNextPage: () => this.seekPage(this.currentPage + 1),
      paginationPreviousPage: () => this.seekPage(this.currentPage - 1),
      paginationSeek: (page) => this.seekPage(page),
      paginationSetPageSize: (pageSize) => this.setPageSize(pageSize),
      toggleRowExpansion: (row) => this.toggleRowExpansion(row),
      expandAllRows: () => this.expandAllRows(),
      collapseAllRows: () => this.collapseAllRows(),
      toggleAllRows: () => {
        if (Object.keys(this.expandedRows).length > 0) {
          this.collapseAllRows();
          return;
        }
        this.expandAllRows();
      },
      treeToggleRow: (row) => this.toggleTreeRow(row),
      treeExpandAllRows: () => this.expandAllTreeRows(),
      treeCollapseAllRows: () => this.collapseAllTreeRows(),
      treeExpandRow: (row) => this.setTreeRowExpanded(row, true),
      treeCollapseRow: (row) => this.setTreeRowExpanded(row, false),
      treeGetRowChildren: (row) => {
        const rowId = this.resolveRowId(row);
        return this.pipeline.visibleRows.filter((candidate) => candidate.parentId === rowId);
      },
      treeGetState: () => ({ ...this.expandedTreeRows }),
      treeSetState: (state) => {
        this.expandedTreeRows = { ...state };
        this.refresh();
      },
      beginCellEdit: (row, columnName, triggerEvent) =>
        this.beginCellEdit(row, columnName, triggerEvent),
      endCellEdit: () => {
        this.commitCellEdit();
      },
      cancelCellEdit: () => {
        this.cancelCellEdit();
      },
      getEditingCell: () => this.editingCell,
    });

    this.refresh();
  }

  setOptions(options: GridOptions): void {
    this.options = options;
    this.labels = resolveGridLabels(options.labels);
    if (this.columnOrder.length === 0) {
      this.columnOrder = options.columnDefs.map((column) => column.name);
    } else {
      const names = new Set(options.columnDefs.map((column) => column.name));
      this.columnOrder = this.columnOrder.filter((name) => names.has(name));
      for (const column of options.columnDefs) {
        if (!this.columnOrder.includes(column.name)) {
          this.columnOrder.push(column.name);
        }
      }
    }

    this.apiRegistered = false;
    this.refresh();
  }

  /**
   * Fast-path: swap only the row data and rebuild the pipeline without
   * touching column state. Emits the new snapshot. The element uses this to
   * patch cell content in-place without rebuilding the full shadow DOM.
   */
  refreshData(data: readonly GridRecord[]): void {
    this.options = { ...this.options, data };
    this.pipeline = defaultGridEngine.buildPipeline({
      options: this.options,
      columns: this.visibleColumns,
      activeFilters: this.activeFilters,
      sortState: this.sortState,
      groupByColumns: this.groupByColumns,
      collapsedGroups: this.collapsedGroups,
      hiddenRowReasons: this.hiddenRowReasons,
      expandedRows: this.expandedRows,
      expandedTreeRows: this.expandedTreeRows,
      currentPage: this.currentPage,
      pageSize: this.pageSize,
      rowSize: this.getRowSize(),
    });
    this.emit();
  }

  subscribe(subscriber: GridControllerSubscriber): () => void {
    this.subscribers.add(subscriber);
    subscriber(this.getSnapshot());
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  getSnapshot(): GridControllerSnapshot {
    const totalPages = this.getTotalPages();
    return {
      options: this.options,
      labels: this.labels,
      rowSize: this.getRowSize(),
      visibleColumns: this.visibleColumns,
      gridTemplateColumns: buildGridTemplateColumns(this.visibleColumns),
      pipeline: this.pipeline,
      activeFilters: this.activeFilters,
      sortState: this.sortState,
      groupByColumns: this.groupByColumns,
      pinnedColumns: this.pinnedColumns,
      currentPage: this.getCurrentPage(),
      totalPages,
      firstRowIndex: this.getFirstRowIndex(),
      lastRowIndex: this.getLastRowIndex(),
      pageSize: this.getEffectivePageSize(),
      editingCell: this.editingCell,
      editingValue: this.editingValue,
    };
  }

  getDisplayItems(): DisplayItem[] {
    return this.pipeline.displayItems;
  }

  setCollapsedGroup(groupId: string, collapsed: boolean): void {
    this.collapsedGroups = {
      ...this.collapsedGroups,
      [groupId]: collapsed,
    };
    this.refresh();
  }

  toggleSort(columnName: string): void {
    const current =
      this.sortState.columnName === columnName ? this.sortState.direction : SORT_DIRECTIONS.none;
    if (current === SORT_DIRECTIONS.none) {
      this.sortColumn(columnName, SORT_DIRECTIONS.asc);
      return;
    }
    if (current === SORT_DIRECTIONS.asc) {
      this.sortColumn(columnName, SORT_DIRECTIONS.desc);
      return;
    }
    this.sortColumn(columnName, SORT_DIRECTIONS.none);
  }

  sortColumn(columnName: string, direction: SortDirection = SORT_DIRECTIONS.none): void {
    sortGridColumnCommand(
      this.gridApi,
      (next) => {
        this.sortState = next;
      },
      columnName,
      direction,
    );
    this.refresh();
  }

  setFilter(columnName: string, value: string): void {
    updateGridFilterCommand(
      this.gridApi,
      (updater) => {
        this.activeFilters = updater(this.activeFilters);
      },
      () => this.activeFilters,
      columnName,
      value,
    );
    this.currentPage = 1;
    this.refresh();
  }

  clearAllFilters(): void {
    clearGridFiltersCommand(this.gridApi, (next) => {
      this.activeFilters = next;
    });
    this.currentPage = 1;
    this.refresh();
  }

  toggleGrouping(columnName: string): void {
    toggleGridGroupingCommand(
      this.gridApi,
      isGridGroupingEnabled(this.options),
      (updater) => {
        this.groupByColumns = updater(this.groupByColumns);
      },
      () => this.groupByColumns,
      columnName,
    );
    this.refresh();
  }

  clearGrouping(): void {
    clearGridGroupingCommand(this.gridApi, (next) => {
      this.groupByColumns = next;
    });
    this.refresh();
  }

  seekPage(page: number): void {
    seekGridPaginationCommand(
      this.gridApi,
      (next) => {
        this.currentPage = next;
      },
      () => this.getTotalPages(),
      () => this.getEffectivePageSize(),
      page,
    );
    this.refresh();
  }

  setPageSize(pageSize: number): void {
    setGridPaginationPageSizeCommand(
      this.gridApi,
      (next) => {
        this.pageSize = next;
      },
      (next) => {
        this.currentPage = next;
      },
      pageSize,
    );
    this.refresh();
  }

  pinColumn(columnName: string, direction: PinDirection): void {
    pinGridColumnCommand(
      this.gridApi,
      isPinningEnabled(this.options),
      (next) => {
        this.pinnedColumns = next;
      },
      () => this.pinnedColumns,
      columnName,
      direction,
    );
    this.refresh();
  }

  moveVisibleColumn(columnName: string, targetColumnName: string): void {
    moveGridVisibleColumnCommand(
      this.gridApi,
      canGridMoveColumns(this.options),
      this.columnOrder,
      this.visibleColumns.map((column) => column.name),
      columnName,
      targetColumnName,
      (next) => {
        this.columnOrder = next;
      },
    );
    this.refresh();
  }

  toggleRowExpansion(row: GridRow | GridRecord | string): void {
    const rowId = this.resolveRowId(row);
    toggleGridRowExpansionCommand(
      this.gridApi,
      canGridExpandRows(this.options),
      this.expandedRows,
      rowId,
      (next) => {
        this.expandedRows = next;
      },
      (candidateRowId) => this.findRowById(candidateRowId),
    );
    this.refresh();
  }

  expandAllRows(): void {
    expandAllGridRowsCommand(
      (data) => this.buildRowsFromData(data),
      this.options.data,
      (next) => {
        this.expandedRows = next;
      },
    );
    this.refresh();
  }

  collapseAllRows(): void {
    this.expandedRows = {};
    this.refresh();
  }

  toggleTreeRow(row: GridRow | GridRecord | string): void {
    const rowId = this.resolveRowId(row);
    toggleGridTreeRowCommand(
      this.gridApi,
      this.expandedTreeRows,
      rowId,
      (next) => {
        this.expandedTreeRows = next;
      },
      (candidateRowId) => this.findRowById(candidateRowId),
    );
    this.refresh();
  }

  expandAllTreeRows(): void {
    expandAllGridTreeRowsCommand(
      (data) => this.buildRowsFromData(data),
      this.options.data,
      (next) => {
        this.expandedTreeRows = next;
      },
    );
    this.refresh();
  }

  collapseAllTreeRows(): void {
    this.expandedTreeRows = {};
    this.refresh();
  }

  setTreeRowExpanded(row: GridRow | GridRecord | string, expanded: boolean): void {
    const rowId = this.resolveRowId(row);
    if (expanded) {
      this.expandedTreeRows = {
        ...this.expandedTreeRows,
        [rowId]: true,
      };
    } else {
      const nextState = { ...this.expandedTreeRows };
      delete nextState[rowId];
      this.expandedTreeRows = nextState;
    }
    this.refresh();
  }

  beginCellEdit(
    row: GridRow | GridRecord | string,
    columnName: string,
    triggerEvent?: Event | KeyboardEvent | null,
  ): void {
    const rowId = this.resolveRowId(row);
    const gridRow = this.findRowById(rowId);
    const column = this.findColumnByName(columnName);
    if (!gridRow || !column) {
      return;
    }

    beginGridCellEditCommand(
      this.gridApi,
      {
        setFocusedCell: () => {
          // Focus state is intentionally owned by wrappers.
        },
        setEditingCell: (next) => {
          this.editingCell = next;
        },
        setEditingValue: (next) => {
          this.editingValue = next;
        },
      },
      gridRow,
      column,
      getCellValue(gridRow.entity, column),
      triggerEvent,
    );

    this.refresh();
  }

  updateEditingValue(value: string): void {
    this.editingValue = value;
    this.emit();
  }

  commitCellEdit(): void {
    commitGridCellEditCommand(this.gridApi, {
      getEditingCell: () => this.editingCell,
      getEditingValue: () => this.editingValue,
      setEditingCell: (next) => {
        this.editingCell = next;
      },
      setEditingValue: (next) => {
        this.editingValue = next;
      },
      findRowById: (rowId) => this.findRowById(rowId),
      findColumnByName: (columnName) => this.findColumnByName(columnName),
      parseEditedValue: (column, value, oldValue) => parseGridEditedValue(column, value, oldValue),
      setCellValue: (rowEntity, column, value) =>
        setPathValue(rowEntity, column.field ?? column.name, value),
    });

    this.refresh();
  }

  cancelCellEdit(): void {
    cancelGridCellEditCommand(this.gridApi, {
      getEditingCell: () => this.editingCell,
      setEditingCell: (next) => {
        this.editingCell = next;
      },
      setEditingValue: (next) => {
        this.editingValue = next;
      },
      findRowById: (rowId) => this.findRowById(rowId),
      findColumnByName: (columnName) => this.findColumnByName(columnName),
    });

    this.refresh();
  }

  isGroupingEnabled(): boolean {
    return isGridGroupingEnabled(this.options);
  }

  isSortingEnabled(): boolean {
    return isGridSortingEnabled(this.options);
  }

  isFilteringEnabled(): boolean {
    return isGridFilteringEnabled(this.options);
  }

  isPaginationEnabled(): boolean {
    return isGridPaginationEnabled(this.options);
  }

  shouldShowPaginationControls(): boolean {
    return shouldShowGridPaginationControls(this.options);
  }

  isTreeEnabled(): boolean {
    return isGridTreeEnabled(this.options);
  }

  isExpandableEnabled(): boolean {
    return canGridExpandRows(this.options);
  }

  isColumnSortable(column: GridColumnDef): boolean {
    return isGridColumnSortable(this.options, column);
  }

  isColumnFilterable(column: GridColumnDef): boolean {
    return isGridColumnFilterable(this.options, column);
  }

  isColumnGrouped(column: GridColumnDef): boolean {
    return isGridColumnGrouped(this.groupByColumns, column);
  }

  sortButtonLabel(column: GridColumnDef): string {
    return gridSortButtonLabel(this.getSortDirection(column), this.labels);
  }

  groupingButtonLabel(column: GridColumnDef): string {
    return gridGroupingButtonLabel(this.isColumnGrouped(column), this.labels);
  }

  filterPlaceholder(column: GridColumnDef): string {
    return gridFilterPlaceholder(this.isColumnFilterable(column), this.labels);
  }

  getSortDirection(column: GridColumnDef): SortDirection {
    return this.sortState.columnName === column.name
      ? this.sortState.direction
      : SORT_DIRECTIONS.none;
  }

  isPinningEnabled(): boolean {
    return isPinningEnabled(this.options);
  }

  isColumnPinnable(column: GridColumnDef): boolean {
    return isColumnPinnable(this.options, column);
  }

  isPinned(column: GridColumnDef): boolean {
    return this.pinnedColumns[column.name] !== undefined;
  }

  isPinnedLeftLast(column: GridColumnDef): boolean {
    const leftPinned = this.visibleColumns.filter((c) => this.pinnedColumns[c.name] === 'left');
    return leftPinned.length > 0 && leftPinned[leftPinned.length - 1].name === column.name;
  }

  isPinnedRightFirst(column: GridColumnDef): boolean {
    const rightPinned = this.visibleColumns.filter((c) => this.pinnedColumns[c.name] === 'right');
    return rightPinned.length > 0 && rightPinned[0].name === column.name;
  }

  groupDisclosureLabel(group: GroupItem): string {
    return gridGroupDisclosureLabel(group.collapsed, this.labels);
  }

  pinnedOffset(column: GridColumnDef): { side: 'left' | 'right'; offset: string } | null {
    return computePinnedOffset(this.visibleColumns, this.pinnedColumns, column);
  }

  displayValue(row: GridRow, column: GridColumnDef): unknown {
    return formatGridCellDisplayValue(buildGridCellContext(row, column));
  }

  headerLabel(column: GridColumnDef): string {
    return headerLabel(column);
  }

  cellIndent(row: GridRow, column: GridColumnDef): string {
    return gridCellIndent(this.options, this.visibleColumns, row, column);
  }

  showTreeToggle(row: GridRow, column: GridColumnDef): boolean {
    return shouldShowGridTreeToggle(this.options, this.visibleColumns, row, column);
  }

  showExpandToggle(_row: GridRow, column: GridColumnDef): boolean {
    return shouldShowGridExpandToggle(this.options, this.visibleColumns, column);
  }

  isTreeRowExpanded(row: GridRow): boolean {
    return isGridTreeRowExpanded(this.expandedTreeRows, row);
  }

  treeToggleLabel(row: GridRow): string {
    return gridTreeToggleLabelForRow(this.expandedTreeRows, row, this.labels);
  }

  expandToggleLabel(row: GridRow): string {
    return gridExpandToggleLabelForRow(row, this.labels);
  }

  editorInputType(column: GridColumnDef): string {
    return gridEditorInputType(column);
  }

  isEditingCell(rowId: string, columnName: string): boolean {
    return this.editingCell?.rowId === rowId && this.editingCell?.columnName === columnName;
  }

  getState(): GridSaveState {
    return {
      sortState: { ...this.sortState },
      activeFilters: { ...this.activeFilters },
      groupByColumns: [...this.groupByColumns],
      pinnedColumns: { ...this.pinnedColumns },
      columnOrder: [...this.columnOrder],
      currentPage: this.currentPage,
      pageSize: this.pageSize,
    };
  }

  setState(state: Partial<GridSaveState>): void {
    if (state.sortState !== undefined) this.sortState = { ...state.sortState };
    if (state.activeFilters !== undefined) this.activeFilters = { ...state.activeFilters };
    if (state.groupByColumns !== undefined) this.groupByColumns = [...state.groupByColumns];
    if (state.pinnedColumns !== undefined) this.pinnedColumns = { ...state.pinnedColumns };
    if (state.columnOrder !== undefined) this.columnOrder = [...state.columnOrder];
    if (state.currentPage !== undefined) this.currentPage = state.currentPage;
    if (state.pageSize !== undefined) this.pageSize = state.pageSize;
    this.refresh();
  }

  private refresh(): void {
    const orderedColumns = orderVisibleColumns(this.options.columnDefs, this.columnOrder);
    const pinnedEntries = Object.entries(this.pinnedColumns);

    if (pinnedEntries.length === 0) {
      this.visibleColumns = orderedColumns;
    } else {
      const byName = new Map(orderedColumns.map((column) => [column.name, column]));
      const pinnedLeft = pinnedEntries
        .filter((entry) => entry[1] === 'left')
        .map((entry) => byName.get(entry[0]))
        .filter((column): column is GridColumnDef => column !== undefined);
      const pinnedRight = pinnedEntries
        .filter((entry) => entry[1] === 'right')
        .map((entry) => byName.get(entry[0]))
        .filter((column): column is GridColumnDef => column !== undefined);
      const middleColumns = orderedColumns.filter(
        (column) => this.pinnedColumns[column.name] === undefined,
      );
      this.visibleColumns = [...pinnedLeft, ...middleColumns, ...pinnedRight];
    }

    this.pipeline = defaultGridEngine.buildPipeline({
      options: this.options,
      columns: this.visibleColumns,
      activeFilters: this.activeFilters,
      sortState: this.sortState,
      groupByColumns: this.groupByColumns,
      collapsedGroups: this.collapsedGroups,
      hiddenRowReasons: this.hiddenRowReasons,
      expandedRows: this.expandedRows,
      expandedTreeRows: this.expandedTreeRows,
      currentPage: this.currentPage,
      pageSize: this.pageSize,
      rowSize: this.getRowSize(),
    });

    if (!this.apiRegistered) {
      this.options.onRegisterApi?.(this.gridApi);
      this.apiRegistered = true;
    }

    this.emit();
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const subscriber of this.subscribers) {
      subscriber(snapshot);
    }
  }

  private findRowById(rowId: string): GridRow | null {
    return coreFindGridRowById(this.buildRowsFromData(this.options.data), rowId);
  }

  private buildRowsFromData(data: readonly GridRecord[]): GridRow[] {
    return buildGridRows(
      { ...this.options, data },
      this.getRowSize(),
      this.hiddenRowReasons,
      this.expandedRows,
    );
  }

  private findColumnByName(columnName: string): GridColumnDef | undefined {
    return this.visibleColumns.find((column) => column.name === columnName);
  }

  private resolveRowId(row: GridRow | GridRecord | string): string {
    return coreResolveGridRowId(this.options, row);
  }

  private getRowSize(): number {
    return this.options.rowHeight ?? 44;
  }

  private getTotalPages(): number {
    return getTotalPagesValue(this.options, this.pipeline.totalItems, this.pageSize);
  }

  private getEffectivePageSize(): number {
    return getEffectivePageSize(this.options, this.pageSize, this.pipeline.totalItems);
  }

  private getCurrentPage(): number {
    return getCurrentPageValue(
      this.options,
      this.currentPage,
      this.pipeline.totalItems,
      this.pageSize,
    );
  }

  private getFirstRowIndex(): number {
    return getFirstRowIndexValue(
      this.options,
      this.currentPage,
      this.pipeline.totalItems,
      this.pageSize,
    );
  }

  private getLastRowIndex(): number {
    return getLastRowIndexValue(
      this.options,
      this.currentPage,
      this.pipeline.totalItems,
      this.pageSize,
    );
  }

  private setRowInvisible(row: GridRow | GridRecord | string, reason?: string): void {
    const rowId = this.resolveRowId(row);
    const next = { ...this.hiddenRowReasons };
    const reasonValue = reason ?? 'api';
    next[rowId] = [...(next[rowId] ?? []), reasonValue];
    this.hiddenRowReasons = next;
    this.refresh();
  }

  private clearRowInvisible(row: GridRow | GridRecord | string, reason?: string): void {
    const rowId = this.resolveRowId(row);
    const existing = this.hiddenRowReasons[rowId] ?? [];
    if (existing.length === 0) {
      return;
    }

    if (!reason) {
      const next = { ...this.hiddenRowReasons };
      delete next[rowId];
      this.hiddenRowReasons = next;
      this.refresh();
      return;
    }

    const filtered = existing.filter((entry) => entry !== reason);
    const next = { ...this.hiddenRowReasons };
    if (filtered.length > 0) {
      next[rowId] = filtered;
    } else {
      delete next[rowId];
    }
    this.hiddenRowReasons = next;
    this.refresh();
  }

  private benchmark(iterations?: number) {
    const now = () => (typeof performance === 'undefined' ? Date.now() : performance.now());
    const loops = Math.max(1, iterations ?? this.options.benchmark?.iterations ?? 25);
    const started = now();
    let lastResult = this.pipeline;

    for (let index = 0; index < loops; index += 1) {
      lastResult = defaultGridEngine.buildPipeline({
        options: this.options,
        columns: this.visibleColumns,
        activeFilters: this.activeFilters,
        sortState: this.sortState,
        groupByColumns: this.groupByColumns,
        collapsedGroups: this.collapsedGroups,
        hiddenRowReasons: this.hiddenRowReasons,
        expandedRows: this.expandedRows,
        expandedTreeRows: this.expandedTreeRows,
        currentPage: this.currentPage,
        pageSize: this.pageSize,
        rowSize: this.getRowSize(),
      });
    }

    const elapsedMs = now() - started;
    const result = {
      iterations: loops,
      totalMs: elapsedMs,
      averageMs: elapsedMs / loops,
      visibleRows: lastResult.visibleRows.length,
      renderedItems: lastResult.displayItems.length,
    };

    this.gridApi.core.raise.benchmarkComplete(result);
    return result;
  }
}

export function createVanillaGridController(options: GridOptions): VanillaGridController {
  return new VanillaGridController(options);
}
