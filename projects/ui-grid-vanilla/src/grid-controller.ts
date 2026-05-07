import {
  SORT_DIRECTIONS,
  beginGridCellEditCommand,
  buildGridRows,
  buildGridCellContext,
  buildInitialPinnedState,
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
  resolveGridSelectionOptions,
  createGridSelectionState,
  toggleGridRowSelection as coreToggleGridRowSelection,
  shiftGridRowSelection as coreShiftGridRowSelection,
  selectAllGridRows as coreSelectAllGridRows,
  selectAllVisibleGridRows as coreSelectAllVisibleGridRows,
  clearAllGridSelection as coreClearAllGridSelection,
  findGridRowByKey as coreFindGridRowByKey,
  reconcileGridSelection as coreReconcileGridSelection,
  mapSelectedRowsToEntities as coreMapSelectedRowsToEntities,
  buildGridCsv,
  buildGridExcelSheetData,
  buildGridPdfDocDefinition,
  buildGridExporterMenuItems,
  resolveGridExporterExcelOptions,
  resolveGridExporterOptions,
  resolveGridExporterPdfOptions,
  resolveExporterFilename,
  downloadGridCsvFile,
  sanitizeDownloadFilename,
  createGridRowEditState,
  markGridRowDirty,
  markGridRowClean,
  markGridRowSaving,
  markGridRowError,
  isGridRowEditTimerEnabled,
  resolveGridRowEditWaitInterval,
  type GridRowEditState,
  type GridExporterExcelSheetData,
  type GridExporterMenuItem,
  type GridExporterOptions,
  type GridExporterColumnType,
  type GridExporterPdfDocDefinition,
  type GridExporterRowType,
  type GridSelectionState,
  type GridInfiniteScrollState,
  maybeRequestInfiniteScrollData,
  completeInfiniteScrollDataLoad,
  resetInfiniteScrollState,
  saveInfiniteScrollPercentage,
  setInfiniteScrollDirectionsState,
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
  type GridRowColumn,
  type GridLabels,
  type GridOptions,
  type GridRecord,
  type GridRow,
  type GridSavedState,
  type PipelineResult,
  type PinDirection,
  type PinnedColumnState,
  type SortDirection,
  type GroupItem,
  type SortState,
  type UiGridApi,
} from '@ornery/ui-grid-core';

/**
 * Complete grid save state — parity with the old `ui.grid.saveState`
 * module. Every field is optional so partial saves / restores work too.
 *
 * Opt-in/out behaviour mirrors the old module: by default save() serialises
 * everything; consumers can disable per-field capture via
 * `saveSort`/`saveFilter`/... options on `GridOptions`. Restore tolerates
 * missing fields.
 */
export interface GridSaveState {
  sortState?: SortState;
  activeFilters?: Record<string, string>;
  groupByColumns?: string[];
  collapsedGroups?: Record<string, boolean>;
  pinnedColumns?: PinnedColumnState;
  columnOrder?: string[];
  columnWidthOverrides?: Record<string, string>;
  currentPage?: number;
  pageSize?: number;
  selectedRowIds?: string[];
  focusedCell?: GridCellPosition | null;
  expandedRows?: Record<string, boolean>;
  expandedTreeRows?: Record<string, boolean>;
  scrollTop?: number;
  scrollLeft?: number;
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
  /** Row ids currently selected. A ReadonlySet for surgical DOM updates —
   * the renderer toggles the .ui-grid-row-selected class on every cell
   * whose data-row matches one of these ids. */
  selectedRowIds: ReadonlySet<string>;
  selectAll: boolean;
  focusedRowId: string | null;
  selectedCount: number;
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
  private columnWidthOverrides: Record<string, string> = {};
  private currentPage = 1;
  private pageSize = 0;
  private editingCell: GridCellPosition | null = null;
  private editingValue = '';
  private exporterOverrides: GridExporterOptions = {};
  private rowEditState: GridRowEditState = createGridRowEditState();
  private rowEditTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private rowEditSavePromiseOverrides = new Map<string, Promise<void>>();
  private selectionState: GridSelectionState = createGridSelectionState();
  /** cellNav state. Persists the last focused cell so the public API's
   * getFocusedCell returns the right value across re-renders, and tracks
   * the focused-cells history for getCurrentSelection. */
  private cellNavLastRowCol: { rowId: string; columnName: string } | null = null;
  private cellNavFocusedCells: { rowId: string; columnName: string }[] = [];
  /** Infinite-scroll state. Direction flags seed from options; dataLoading
   * + previousVisibleRows are runtime bookkeeping for saveScrollPercentage /
   * dataRemovedTop / dataRemovedBottom. */
  private infiniteScrollState: GridInfiniteScrollState = {
    scrollUp: false,
    scrollDown: true,
    dataLoading: false,
    previousVisibleRows: 0,
  };
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
    this.groupByColumns = options.grouping?.groupBy ? [...options.grouping.groupBy] : [];
    this.pinnedColumns = buildInitialPinnedState(options.columnDefs);

    this.infiniteScrollState = resetInfiniteScrollState(
      options.infiniteScrollUp === true,
      options.infiniteScrollDown !== false,
    );

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
      exportCsv: (rowType, colType) => this.exportCsv(rowType, colType),
      buildCsv: (rowType, colType) => this.buildCsv(rowType, colType),
      pdfExport: (rowType, colType) => this.exportPdf(rowType, colType),
      buildPdfDocDefinition: (rowType, colType) =>
        this.buildPdfDocDefinition(rowType, colType),
      excelExport: (rowType, colType) => this.exportExcel(rowType, colType),
      buildExcelSheetData: (rowType, colType) => this.buildExcelSheetData(rowType, colType),
      getExporterMenuItems: () => this.buildExporterMenuItems(),
      getExporterOptions: () => ({ ...this.exporterOverrides, ...resolveGridExporterOptions(this.options) }),
      setExporterOptions: (overrides) => {
        this.exporterOverrides = { ...this.exporterOverrides, ...overrides };
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
      toggleRowSelection: (rowEntity, evt) => this.toggleRowSelectionByEntity(rowEntity, evt),
      selectRow: (rowEntity, evt) => this.selectRow(rowEntity, evt),
      selectRowByVisibleIndex: (rowNum, evt) => this.selectRowByVisibleIndex(rowNum, evt),
      selectRowByKey: (isInEntity, key, comparator, evt, lookInRows) =>
        this.selectRowByKey(isInEntity, key, comparator, evt, lookInRows),
      unSelectRow: (rowEntity, evt) => this.unSelectRow(rowEntity, evt),
      unSelectRowByVisibleIndex: (rowNum, evt) => this.unSelectRowByVisibleIndex(rowNum, evt),
      unSelectRowByKey: (isInEntity, key, comparator, evt, lookInRows) =>
        this.unSelectRowByKey(isInEntity, key, comparator, evt, lookInRows),
      selectAllRows: (evt) => this.selectAllRows(evt),
      selectAllVisibleRows: (evt) => this.selectAllVisibleRows(evt),
      clearSelectedRows: (evt) => this.clearSelectedRows(evt),
      getSelectedRows: () => this.getSelectedRows(),
      getUnSelectedRows: () => this.getUnSelectedRows(),
      getSelectedGridRows: () => this.getSelectedGridRows(),
      getUnSelectedGridRows: () => this.getUnSelectedGridRows(),
      getSelectedCount: () => this.selectionState.selectedRowIds.size,
      setMultiSelect: (multiSelect) => this.setMultiSelect(multiSelect),
      setModifierKeysToMultiSelect: (value) => this.setModifierKeysToMultiSelect(value),
      getSelectAllState: () => this.selectionState.selectAll,
      shiftSelectRow: (rowEntity, evt) => this.shiftSelectRow(rowEntity, evt),
      // cellNav bindings — thin wrappers over the same focus state the
      // element uses. The element raises `cellNav.navigate` via
      // controller.setCellNavFocus(); these methods let consumers inspect
      // and re-drive that state.
      scrollToFocus: (rowEntity, colDef) => this.cellNavScrollToFocus(rowEntity, colDef),
      getFocusedCell: () => this.cellNavGetFocusedCell(),
      getCurrentSelection: () => this.cellNavGetCurrentSelection(),
      rowColSelectIndex: (rowCol) => this.cellNavRowColSelectIndex(rowCol),
      // SaveState bindings — ports ui.grid.saveState public API.
      saveState: () => this.getState() as GridSavedState,
      restoreState: (state) => this.setState(state as Partial<GridSaveState>),
      // Infinite-scroll bindings — ports ui.grid.infiniteScroll public API.
      infiniteScrollDataLoaded: (scrollUp, scrollDown) =>
        this.infiniteScrollDataLoaded(scrollUp, scrollDown),
      infiniteScrollReset: (scrollUp, scrollDown) =>
        this.infiniteScrollResetScroll(scrollUp, scrollDown),
      infiniteScrollSaveScrollPercentage: () => this.infiniteScrollSavePercentage(),
      infiniteScrollDataRemovedTop: (scrollUp, scrollDown) =>
        this.infiniteScrollDataRemovedTop(scrollUp, scrollDown),
      infiniteScrollDataRemovedBottom: (scrollUp, scrollDown) =>
        this.infiniteScrollDataRemovedBottom(scrollUp, scrollDown),
      infiniteScrollSetDirections: (scrollUp, scrollDown) =>
        this.infiniteScrollSetDirections(scrollUp, scrollDown),
      // Row-edit bindings — port of ui.grid.rowEdit public API.
      rowEditSetSavePromise: (rowEntity, promise) =>
        this.rowEditSetSavePromise(rowEntity, promise),
      rowEditGetDirtyRows: () => this.rowEditGetDirtyRows(),
      rowEditGetErrorRows: () => this.rowEditGetErrorRows(),
      rowEditFlushDirtyRows: () => this.rowEditFlushDirtyRows(),
      rowEditSetRowsDirty: (rowEntities) => this.rowEditSetRowsDirty(rowEntities),
      rowEditSetRowsClean: (rowEntities) => this.rowEditSetRowsClean(rowEntities),
    });

    // Subscribe row-edit to the edit events so a committed change flips the
    // row into dirty state + schedules a save, and cancelling restarts the
    // timer when the row was already dirty.
    this.gridApi.edit.on.afterCellEdit((rowEntity, _col, newValue, previousValue) => {
      const rowId = this.resolveRowId(rowEntity);
      const gridRow = this.findRowById(rowId);
      if (!gridRow) return;
      if (newValue === previousValue && !gridRow.isDirty) return;
      markGridRowDirty(this.rowEditState, gridRow);
      this.considerSetRowEditTimer(gridRow);
      this.emit();
    });
    this.gridApi.edit.on.beginCellEdit((rowEntity) => {
      const rowId = this.resolveRowId(rowEntity);
      const gridRow = this.findRowById(rowId);
      if (gridRow) this.cancelRowEditTimer(gridRow);
    });
    this.gridApi.edit.on.cancelCellEdit((rowEntity) => {
      const rowId = this.resolveRowId(rowEntity);
      const gridRow = this.findRowById(rowId);
      if (gridRow) this.considerSetRowEditTimer(gridRow);
    });
    // Cellnav navigate — if the user leaves a dirty row, start its timer
    // (matches old grid: a row only autosaves when focus moves off it or
    // the debounce elapses).
    this.gridApi.cellNav.on.navigate((_newRowCol, oldRowCol) => {
      if (!oldRowCol) return;
      this.considerSetRowEditTimer(oldRowCol.row);
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

    // Apply declarative grouping from options when provided. Matches the
    // Angular element's behaviour — the consumer can set
    // `grouping: { groupBy: [...] }` and it takes effect immediately.
    // When the option is absent, leave the current groupByColumns untouched
    // so interactive toggles persist across non-grouping option updates.
    if (options.grouping?.groupBy !== undefined) {
      this.groupByColumns = [...options.grouping.groupBy];
    }

    // Re-seed pinned state from columnDefs whenever a columnDef declares
    // `pinnedLeft` / `pinnedRight`. This mirrors the Angular element, which
    // re-derives pinned state on every options update, so switching demo
    // scenarios (different column sets) picks up their declarative pins.
    const declaresPin = options.columnDefs.some(
      (col) => col.pinnedLeft === true || col.pinnedRight === true,
    );
    if (declaresPin) {
      this.pinnedColumns = buildInitialPinnedState(options.columnDefs);
    }

    // Re-seed infinite-scroll directions when the options declare them,
    // so consumers can flip scrollUp/scrollDown through `grid.options`
    // without needing to go through setScrollDirections.
    if (options.infiniteScrollUp !== undefined || options.infiniteScrollDown !== undefined) {
      this.infiniteScrollState = setInfiniteScrollDirectionsState(
        this.infiniteScrollState,
        options.infiniteScrollUp ?? this.infiniteScrollState.scrollUp,
        options.infiniteScrollDown ?? this.infiniteScrollState.scrollDown,
      );
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
      selectedRowIds: this.selectionState.selectedRowIds,
      selectAll: this.selectionState.selectAll,
      focusedRowId: this.selectionState.focusedRowId,
      selectedCount: this.selectionState.selectedRowIds.size,
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
    initialValue?: string,
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
      initialValue,
    );

    this.refresh();
  }

  updateEditingValue(value: string): void {
    this.editingValue = value;
    this.emit();
  }

  commitCellEdit(): void {
    // Guard against re-entry: committing rebuilds the cell markup, which
    // removes the focused <input> and fires blur — whose handler also tries
    // to commit. Without this early-return, the nested render mutates DOM
    // that the outer render hasn't finished unwinding yet, throwing
    // "node to be removed is no longer a child of this node."
    if (this.editingCell === null) {
      return;
    }

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
    if (this.editingCell === null) {
      return;
    }

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

  // ---- Row selection -------------------------------------------------
  // Thin method layer on top of grid.core.selection. Each call mutates
  // this.selectionState + row instances in place, raises the appropriate
  // public-API event (single vs batch), then refreshes so the element
  // re-renders with the updated `isSelected` / `isFocused` flags.

  /** Internal: run a core selection mutation, raise events, trigger a render. */
  private applySelectionChange(
    apply: () => { changed: GridRow[] },
    evt?: Event | null,
  ): void {
    const { changed } = apply();
    if (changed.length === 0) {
      return;
    }
    if (this.options.enableSelectionBatchEvent !== false && changed.length > 1) {
      this.gridApi.selection.raise.rowSelectionChangedBatch(changed, evt);
    } else {
      for (const row of changed) {
        this.gridApi.selection.raise.rowSelectionChanged(row, evt);
      }
    }
    this.refresh();
  }

  private allGridRows(): GridRow[] {
    // Use the cached pipeline row list when possible — it already reflects
    // `options.data`. Fall back to rebuilding when the pipeline is empty
    // (e.g. before first refresh).
    return this.pipeline.visibleRows.length > 0
      ? this.pipeline.visibleRows
      : this.buildRowsFromData(this.options.data);
  }

  toggleRowSelectionByEntity(rowEntity: GridRecord, evt?: Event | null): void {
    const row = this.findRowById(this.resolveRowId(rowEntity));
    if (!row) return;
    const resolved = resolveGridSelectionOptions(this.options);
    this.applySelectionChange(
      () =>
        coreToggleGridRowSelection(this.selectionState, this.allGridRows(), row, {
          multiSelect: resolved.multiSelect,
          noUnselect: resolved.noUnselect,
        }),
      evt,
    );
  }

  selectRow(rowEntity: GridRecord, evt?: Event | null): void {
    const row = this.findRowById(this.resolveRowId(rowEntity));
    if (!row || row.isSelected) return;
    const resolved = resolveGridSelectionOptions(this.options);
    this.applySelectionChange(
      () =>
        coreToggleGridRowSelection(this.selectionState, this.allGridRows(), row, {
          multiSelect: resolved.multiSelect,
          noUnselect: resolved.noUnselect,
        }),
      evt,
    );
  }

  selectRowByVisibleIndex(rowNum: number, evt?: Event | null): void {
    const rows = this.pipeline.visibleRows;
    const row = rows[rowNum];
    if (!row || row.isSelected) return;
    const resolved = resolveGridSelectionOptions(this.options);
    this.applySelectionChange(
      () =>
        coreToggleGridRowSelection(this.selectionState, rows, row, {
          multiSelect: resolved.multiSelect,
          noUnselect: resolved.noUnselect,
          canBeInvisible: false,
        }),
      evt,
    );
  }

  selectRowByKey(
    isInEntity: boolean,
    key: string,
    comparator: unknown,
    evt?: Event | null,
    lookInRows?: readonly GridRow[],
  ): void {
    const rows = lookInRows ?? this.allGridRows();
    const row = coreFindGridRowByKey(rows, isInEntity, key, comparator);
    if (!row || row.isSelected) return;
    const resolved = resolveGridSelectionOptions(this.options);
    this.applySelectionChange(
      () =>
        coreToggleGridRowSelection(this.selectionState, this.allGridRows(), row, {
          multiSelect: resolved.multiSelect,
          noUnselect: resolved.noUnselect,
          canBeInvisible: false,
        }),
      evt,
    );
  }

  unSelectRow(rowEntity: GridRecord, evt?: Event | null): void {
    const row = this.findRowById(this.resolveRowId(rowEntity));
    if (!row || !row.isSelected) return;
    const resolved = resolveGridSelectionOptions(this.options);
    this.applySelectionChange(
      () =>
        coreToggleGridRowSelection(this.selectionState, this.allGridRows(), row, {
          multiSelect: resolved.multiSelect,
          noUnselect: resolved.noUnselect,
        }),
      evt,
    );
  }

  unSelectRowByVisibleIndex(rowNum: number, evt?: Event | null): void {
    const row = this.pipeline.visibleRows[rowNum];
    if (!row || !row.isSelected) return;
    const resolved = resolveGridSelectionOptions(this.options);
    this.applySelectionChange(
      () =>
        coreToggleGridRowSelection(this.selectionState, this.allGridRows(), row, {
          multiSelect: resolved.multiSelect,
          noUnselect: resolved.noUnselect,
          canBeInvisible: false,
        }),
      evt,
    );
  }

  unSelectRowByKey(
    isInEntity: boolean,
    key: string,
    comparator: unknown,
    evt?: Event | null,
    lookInRows?: readonly GridRow[],
  ): void {
    const rows = lookInRows ?? this.allGridRows();
    const row = coreFindGridRowByKey(rows, isInEntity, key, comparator);
    if (!row || !row.isSelected) return;
    const resolved = resolveGridSelectionOptions(this.options);
    this.applySelectionChange(
      () =>
        coreToggleGridRowSelection(this.selectionState, this.allGridRows(), row, {
          multiSelect: resolved.multiSelect,
          noUnselect: resolved.noUnselect,
          canBeInvisible: false,
        }),
      evt,
    );
  }

  selectAllRows(evt?: Event | null): void {
    const resolved = resolveGridSelectionOptions(this.options);
    this.applySelectionChange(
      () =>
        coreSelectAllGridRows(this.selectionState, this.allGridRows(), {
          multiSelect: resolved.multiSelect,
          isRowSelectable: resolved.isRowSelectable,
        }),
      evt,
    );
  }

  selectAllVisibleRows(evt?: Event | null): void {
    const resolved = resolveGridSelectionOptions(this.options);
    this.applySelectionChange(
      () =>
        coreSelectAllVisibleGridRows(this.selectionState, this.allGridRows(), {
          multiSelect: resolved.multiSelect,
          isRowSelectable: resolved.isRowSelectable,
        }),
      evt,
    );
  }

  clearSelectedRows(evt?: Event | null): void {
    this.applySelectionChange(
      () => coreClearAllGridSelection(this.selectionState, this.allGridRows()),
      evt,
    );
  }

  shiftSelectRow(rowEntity: GridRecord, evt?: Event | null): void {
    const row = this.findRowById(this.resolveRowId(rowEntity));
    if (!row) return;
    const resolved = resolveGridSelectionOptions(this.options);
    this.applySelectionChange(
      () =>
        coreShiftGridRowSelection(this.selectionState, this.pipeline.visibleRows, row, {
          multiSelect: resolved.multiSelect,
        }),
      evt,
    );
  }

  getSelectedRows(): GridRecord[] {
    return coreMapSelectedRowsToEntities(this.getSelectedGridRows());
  }

  getUnSelectedRows(): GridRecord[] {
    return coreMapSelectedRowsToEntities(this.getUnSelectedGridRows());
  }

  getSelectedGridRows(): GridRow[] {
    return this.allGridRows().filter((row) => row.isSelected);
  }

  getUnSelectedGridRows(): GridRow[] {
    return this.allGridRows().filter((row) => !row.isSelected);
  }

  setMultiSelect(multiSelect: boolean): void {
    this.options = { ...this.options, multiSelect };
  }

  setModifierKeysToMultiSelect(value: boolean): void {
    this.options = { ...this.options, modifierKeysToMultiSelect: value };
  }

  /** Focus a row by id — the old module's `row.setFocused(true)` with all
   * the book-keeping. Raises rowFocusChanged and refreshes. */
  setRowFocused(rowId: string, focused: boolean, evt?: Event | null): void {
    const row = this.findRowById(rowId);
    if (!row) return;
    const previousFocusedId = this.selectionState.focusedRowId;
    if (focused) {
      if (previousFocusedId && previousFocusedId !== rowId) {
        const previous = this.findRowById(previousFocusedId);
        previous?.setFocused(false);
      }
      row.setFocused(true);
      this.selectionState.focusedRowId = rowId;
    } else {
      row.setFocused(false);
      if (previousFocusedId === rowId) this.selectionState.focusedRowId = null;
    }
    this.gridApi.selection.raise.rowFocusChanged(row, evt);
    this.refresh();
  }

  getRowSelectionState(): Readonly<GridSelectionState> {
    return this.selectionState;
  }

  /** Resolved/defaulted selection options — exposed for the element layer
   * so it can decide whether to wire pointer handlers without duplicating
   * default logic. */
  getResolvedSelectionOptions(): ReturnType<typeof resolveGridSelectionOptions> {
    return resolveGridSelectionOptions(this.options);
  }

  /** Public analogue of findRowById — the element uses this during drag
   * painting to resolve a row-id back to its entity without calling the
   * selection API methods that would double-raise events. */
  findRowByIdPublic(rowId: string): GridRow | null {
    return this.findRowById(rowId);
  }

  // ---- End row selection ---------------------------------------------

  // ---- cellNav -------------------------------------------------------
  // State + accessors for the cellNav public API. Element owns the DOM
  // focus; controller owns the logical "last focused cell" and the
  // focused-cells history. Element calls setCellNavFocus() whenever the
  // active cell changes.

  /** Record a navigation event. Pushes to the focused-cells history,
   * updates lastRowCol, and raises cellNav.navigate on the public API. */
  setCellNavFocus(
    rowId: string | null,
    columnName: string | null,
    opts: { appendToSelection?: boolean } = {},
  ): void {
    const previous = this.cellNavLastRowCol;
    const previousRowCol = this.resolveCellNavRowCol(previous);
    if (rowId && columnName) {
      this.cellNavLastRowCol = { rowId, columnName };
      if (opts.appendToSelection) {
        this.cellNavFocusedCells = [
          ...this.cellNavFocusedCells.filter(
            (entry) => !(entry.rowId === rowId && entry.columnName === columnName),
          ),
          { rowId, columnName },
        ];
      } else {
        this.cellNavFocusedCells = [{ rowId, columnName }];
      }
    } else {
      this.cellNavLastRowCol = null;
      this.cellNavFocusedCells = [];
    }
    const nextRowCol = this.resolveCellNavRowCol(this.cellNavLastRowCol);
    this.gridApi.cellNav.raise.navigate(nextRowCol, previousRowCol);
  }

  /** Raise viewPortKeyDown / viewPortKeyPress on behalf of the element.
   * Element gates this with `options.keyDownOverrides`. */
  raiseCellNavKeyEvent(
    type: 'keydown' | 'keypress',
    event: KeyboardEvent,
  ): void {
    const rowCol = this.resolveCellNavRowCol(this.cellNavLastRowCol);
    if (type === 'keydown') this.gridApi.cellNav.raise.viewPortKeyDown(event, rowCol);
    else this.gridApi.cellNav.raise.viewPortKeyPress(event, rowCol);
  }

  private cellNavGetFocusedCell(): GridRowColumn | null {
    return this.resolveCellNavRowCol(this.cellNavLastRowCol);
  }

  private cellNavGetCurrentSelection(): GridRowColumn[] {
    const out: GridRowColumn[] = [];
    for (const entry of this.cellNavFocusedCells) {
      const rowCol = this.resolveCellNavRowCol(entry);
      if (rowCol) out.push(rowCol);
    }
    return out;
  }

  private cellNavRowColSelectIndex(rowCol: GridRowColumn): number {
    for (let i = 0; i < this.cellNavFocusedCells.length; i++) {
      const entry = this.cellNavFocusedCells[i]!;
      if (entry.rowId === rowCol.row.id && entry.columnName === rowCol.col.name) {
        return i;
      }
    }
    return -1;
  }

  private resolveCellNavRowCol(
    position: { rowId: string; columnName: string } | null,
  ): GridRowColumn | null {
    if (!position) return null;
    const row = this.findRowById(position.rowId);
    const col = this.findColumnByName(position.columnName);
    if (!row || !col) return null;
    return { row, col };
  }

  /** cellNav.scrollToFocus — resolves rowEntity + colDef into a logical
   * focus and delegates to the element (if attached) for actual scrolling.
   * When the element isn't wired (e.g. bare controller in tests), the
   * state still updates and the promise resolves immediately. */
  private async cellNavScrollToFocus(
    rowEntity: GridRecord | null,
    colDef: GridColumnDef | null,
  ): Promise<void> {
    const rowId = rowEntity ? this.resolveRowId(rowEntity) : null;
    const columnName = colDef?.name ?? null;
    this.setCellNavFocus(rowId, columnName);
    this.cellNavScrollRequest?.(rowId, columnName);
    return Promise.resolve();
  }

  /** Element registers its scroll-and-focus handler here so the API
   * binding above can delegate DOM work. Controller stays DOM-free. */
  private cellNavScrollRequest: ((rowId: string | null, columnName: string | null) => void) | null = null;
  setCellNavScrollHandler(handler: ((rowId: string | null, columnName: string | null) => void) | null): void {
    this.cellNavScrollRequest = handler;
  }

  /** Read-only accessor for the current options. Used by the element to
   * inspect keyDownOverrides / modifierKeysToMultiSelectCells without
   * coupling it to a private field. */
  getOptions(): GridOptions {
    return this.options;
  }

  // ---- End cellNav ---------------------------------------------------

  // ---- Infinite scroll ----------------------------------------------
  // Thin wrappers over grid.core.infinite-scroll's pure helpers. The
  // element calls `evaluateInfiniteScroll` from its scroll-frame callback;
  // these helpers raise needLoadMoreData / needLoadMoreDataTop when the
  // user approaches the end/top of the dataset.

  /** Evaluate whether the current scroll position should request more
   * data at the top or bottom. Called from the element's scroll frame. */
  evaluateInfiniteScroll(startIndex: number, visibleRows: number, viewportRows: number): void {
    if (this.options.enableInfiniteScroll === false) return;
    const threshold = this.options.infiniteScrollRowsFromEnd ?? 20;
    const { request, nextState } = maybeRequestInfiniteScrollData({
      state: this.infiniteScrollState,
      startIndex,
      visibleRows,
      viewportRows,
      threshold,
    });
    if (request === null) return;
    this.infiniteScrollState = nextState;
    if (request === 'top') this.gridApi.infiniteScroll.raise.needLoadMoreDataTop();
    else this.gridApi.infiniteScroll.raise.needLoadMoreData();
  }

  private infiniteScrollDataLoaded(scrollUp?: boolean, scrollDown?: boolean): Promise<void> {
    this.infiniteScrollState = completeInfiniteScrollDataLoad(
      this.infiniteScrollState,
      scrollUp ?? this.infiniteScrollState.scrollUp,
      scrollDown ?? this.infiniteScrollState.scrollDown,
    );
    this.refresh();
    return Promise.resolve();
  }

  private infiniteScrollResetScroll(scrollUp?: boolean, scrollDown?: boolean): void {
    this.infiniteScrollState = resetInfiniteScrollState(
      scrollUp ?? false,
      scrollDown ?? true,
    );
    this.infiniteScrollScrollToTopRequest?.();
  }

  private infiniteScrollSavePercentage(): void {
    this.infiniteScrollState = saveInfiniteScrollPercentage(
      this.infiniteScrollState,
      this.pipeline.visibleRows.length,
    );
  }

  private infiniteScrollDataRemovedTop(scrollUp?: boolean, scrollDown?: boolean): void {
    this.infiniteScrollState = setInfiniteScrollDirectionsState(
      this.infiniteScrollState,
      scrollUp ?? this.infiniteScrollState.scrollUp,
      scrollDown ?? this.infiniteScrollState.scrollDown,
    );
    this.refresh();
  }

  private infiniteScrollDataRemovedBottom(scrollUp?: boolean, scrollDown?: boolean): void {
    this.infiniteScrollState = setInfiniteScrollDirectionsState(
      this.infiniteScrollState,
      scrollUp ?? this.infiniteScrollState.scrollUp,
      scrollDown ?? this.infiniteScrollState.scrollDown,
    );
    this.refresh();
  }

  private infiniteScrollSetDirections(scrollUp: boolean, scrollDown: boolean): void {
    this.infiniteScrollState = setInfiniteScrollDirectionsState(
      this.infiniteScrollState,
      scrollUp,
      scrollDown,
    );
  }

  /** Element registers a scroll-to-top handler here so resetScroll can
   * bring the viewport back to 0. Keeps the controller DOM-free. */
  private infiniteScrollScrollToTopRequest: (() => void) | null = null;
  setInfiniteScrollResetHandler(handler: (() => void) | null): void {
    this.infiniteScrollScrollToTopRequest = handler;
  }

  getInfiniteScrollState(): Readonly<GridInfiniteScrollState> {
    return this.infiniteScrollState;
  }

  // ---- End infinite scroll ------------------------------------------

  canResizeColumns(): boolean {
    return this.options.enableColumnResizing !== false;
  }

  setColumnWidthOverride(columnName: string, widthPx: number): void {
    const nextWidth = `${Math.max(88, Math.round(widthPx))}px`;
    this.columnWidthOverrides = { ...this.columnWidthOverrides, [columnName]: nextWidth };
    this.refresh();
  }

  /** Returns the grid-template-columns string as if `columnName` had the given width,
   * without triggering a full refresh. Used for smooth drag-resize DOM updates. */
  buildTemplateColumnsWithOverride(columnName: string, widthPx: number): string {
    const widthStr = `${Math.max(88, Math.round(widthPx))}px`;
    return buildGridTemplateColumns(
      this.visibleColumns.map((c) =>
        c.name === columnName ? { ...c, width: widthStr } : c,
      ),
    );
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

  /** True when the given column is editable in principle — does NOT evaluate
   * a per-row `cellEditableCondition`. Use isCellEditable for that. */
  isColumnEditable(column: GridColumnDef): boolean {
    return column.enableCellEdit ?? this.options.enableCellEdit ?? false;
  }

  /** True when the (row, column) cell is editable, respecting both the
   * column's `enableCellEdit` flag and any `cellEditableCondition`. */
  isCellEditable(row: GridRow, column: GridColumnDef): boolean {
    if (!this.isColumnEditable(column)) return false;
    const condition = column.cellEditableCondition ?? this.options.cellEditableCondition ?? true;
    if (typeof condition === 'boolean') return condition;
    return condition({ row: row.entity, column, rowIndex: row.index });
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

  /**
   * Serialise the current grid state. Mirrors `ui.grid.saveState.save`:
   * every field is gated by an `options.save*` flag with the old grid's
   * defaults. A missing flag keeps the matching field out of the result.
   */
  getState(): GridSaveState {
    const opts = this.options;
    const saveWidths = opts.saveWidths !== false;
    const saveOrder = opts.saveOrder !== false;
    const saveVisible = opts.saveVisible !== false;
    const saveSort = opts.saveSort !== false;
    const saveFilter = opts.saveFilter !== false;
    const saveSelection = opts.saveSelection !== false;
    const saveGrouping = opts.saveGrouping !== false;
    const saveGroupingExpandedStates = opts.saveGroupingExpandedStates === true;
    const savePinning = opts.savePinning !== false;
    const saveTreeView = opts.saveTreeView !== false;
    const savePagination = opts.savePagination !== false;
    const saveScroll = opts.saveScroll === true;
    const saveFocus = saveScroll ? false : opts.saveFocus !== false;
    void saveVisible; // Visible column state is derived from columnOrder + defs;
                     // kept as an opt-flag for forward compat.

    const state: GridSaveState = {};
    if (saveSort) state.sortState = { ...this.sortState };
    if (saveFilter) state.activeFilters = { ...this.activeFilters };
    if (saveGrouping) state.groupByColumns = [...this.groupByColumns];
    if (saveGrouping && saveGroupingExpandedStates) {
      state.collapsedGroups = { ...this.collapsedGroups };
    }
    if (savePinning) state.pinnedColumns = { ...this.pinnedColumns };
    if (saveOrder) state.columnOrder = [...this.columnOrder];
    if (saveWidths) state.columnWidthOverrides = { ...this.columnWidthOverrides };
    if (savePagination) {
      state.currentPage = this.currentPage;
      state.pageSize = this.pageSize;
    }
    if (saveSelection) {
      state.selectedRowIds = [...this.selectionState.selectedRowIds];
    }
    if (saveTreeView) {
      state.expandedRows = { ...this.expandedRows };
      state.expandedTreeRows = { ...this.expandedTreeRows };
    }
    if (saveFocus) {
      state.focusedCell = this.cellNavLastRowCol
        ? {
            rowId: this.cellNavLastRowCol.rowId,
            columnName: this.cellNavLastRowCol.columnName,
          }
        : null;
    }
    if (saveScroll && this.saveStateScrollSnapshot) {
      const snap = this.saveStateScrollSnapshot();
      state.scrollTop = snap.scrollTop;
      state.scrollLeft = snap.scrollLeft;
    }
    return state;
  }

  /**
   * Apply a previously saved state. All fields are optional — missing
   * fields are left at whatever the controller currently has. Matches the
   * old grid's `ui.grid.saveState.restore`.
   */
  setState(state: Partial<GridSaveState>): void {
    if (state.sortState !== undefined) this.sortState = { ...state.sortState };
    if (state.activeFilters !== undefined) this.activeFilters = { ...state.activeFilters };
    if (state.groupByColumns !== undefined) this.groupByColumns = [...state.groupByColumns];
    if (state.collapsedGroups !== undefined) this.collapsedGroups = { ...state.collapsedGroups };
    if (state.pinnedColumns !== undefined) this.pinnedColumns = { ...state.pinnedColumns };
    if (state.columnOrder !== undefined) this.columnOrder = [...state.columnOrder];
    if (state.columnWidthOverrides !== undefined) this.columnWidthOverrides = { ...state.columnWidthOverrides };
    if (state.currentPage !== undefined) this.currentPage = state.currentPage;
    if (state.pageSize !== undefined) this.pageSize = state.pageSize;
    if (state.expandedRows !== undefined) this.expandedRows = { ...state.expandedRows };
    if (state.expandedTreeRows !== undefined) this.expandedTreeRows = { ...state.expandedTreeRows };
    if (state.selectedRowIds !== undefined) {
      // Rebuild the selection Set in place — selectedRowIds is readonly on
      // GridSelectionState so we mutate the existing collection rather
      // than replacing the reference.
      this.selectionState.selectedRowIds.clear();
      for (const id of state.selectedRowIds) this.selectionState.selectedRowIds.add(id);
      this.selectionState.selectAll = false;
    }
    if (state.focusedCell !== undefined) {
      if (state.focusedCell) {
        this.cellNavLastRowCol = {
          rowId: state.focusedCell.rowId,
          columnName: state.focusedCell.columnName,
        };
        this.cellNavFocusedCells = [{ ...this.cellNavLastRowCol }];
      } else {
        this.cellNavLastRowCol = null;
        this.cellNavFocusedCells = [];
      }
    }
    this.refresh();
    // Scroll restoration needs to run after render so the scroll container
    // exists and its scrollHeight is final.
    if (state.scrollTop !== undefined || state.scrollLeft !== undefined) {
      this.saveStateScrollRestore?.(state.scrollTop ?? 0, state.scrollLeft ?? 0);
    }
  }

  /** Element injects its scroll accessor so save() can capture scrollTop/
   * scrollLeft. Controller stays DOM-free. */
  private saveStateScrollSnapshot: (() => { scrollTop: number; scrollLeft: number }) | null = null;
  private saveStateScrollRestore: ((scrollTop: number, scrollLeft: number) => void) | null = null;
  setSaveStateScrollHandlers(
    snapshot: (() => { scrollTop: number; scrollLeft: number }) | null,
    restore: ((scrollTop: number, scrollLeft: number) => void) | null,
  ): void {
    this.saveStateScrollSnapshot = snapshot;
    this.saveStateScrollRestore = restore;
  }

  private refresh(): void {
    const orderedColumns = orderVisibleColumns(this.options.columnDefs, this.columnOrder);
    const applyWidthOverrides = (columns: GridColumnDef[]): GridColumnDef[] =>
      columns.map((col) => {
        const override = this.columnWidthOverrides[col.name];
        return override == null ? col : { ...col, width: override };
      });
    const pinnedEntries = Object.entries(this.pinnedColumns);

    if (pinnedEntries.length === 0) {
      this.visibleColumns = applyWidthOverrides(orderedColumns);
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
      this.visibleColumns = applyWidthOverrides([...pinnedLeft, ...middleColumns, ...pinnedRight]);
    }

    // Selection row-header column. Injected in front of everything else
    // (including left-pinned columns) so it always sits at the far left,
    // mirroring the old grid's addRowHeaderColumn(def, 0). The width is
    // configurable via selectionRowHeaderWidth.
    const resolvedSelection = resolveGridSelectionOptions(this.options);
    if (resolvedSelection.enableRowSelection && resolvedSelection.enableRowHeaderSelection) {
      const selectionCol: GridColumnDef = {
        name: 'selectionRowHeaderCol',
        displayName: '',
        width: `${resolvedSelection.selectionRowHeaderWidth}px`,
        enableSorting: false,
        enableFiltering: false,
        enableGrouping: false,
        enableCellEdit: false,
        enablePinning: false,
        align: 'center',
      };
      // Dedupe if already present (setOptions could be re-entering).
      if (!this.visibleColumns.some((c) => c.name === 'selectionRowHeaderCol')) {
        this.visibleColumns = [selectionCol, ...this.visibleColumns];
      }
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

    // Re-apply the persisted selection/focus flags to the fresh row instances
    // produced by the pipeline. Without this, every refresh would wipe the
    // selected-row indicators because new GridRow objects default to
    // isSelected=false. Also evaluates isRowSelectable per row.
    coreReconcileGridSelection(
      this.selectionState,
      this.pipeline.visibleRows,
      this.options.isRowSelectable ?? null,
    );

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
    // Prefer the pipeline's current row instances — they carry the live
    // isSelected / isFocused / enableSelection flags that callers mutate.
    // Fall back to a fresh build when the pipeline is still empty (before
    // the first refresh).
    const fromPipeline = coreFindGridRowById(this.pipeline.visibleRows, rowId);
    if (fromPipeline) return fromPipeline;
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

  /** Returns the rows that match the requested exporter row-type. Mirrors
   * the old grid's row selection logic: `all` uses the full data set (or
   * `exporterAllDataFn` when provided), `visible` uses the current pipeline
   * output, `selected` uses the selection state. */
  private exporterRowsFor(rowType: GridExporterRowType): readonly GridRow[] {
    if (rowType === 'visible') return this.pipeline.visibleRows;
    if (rowType === 'selected') return this.getSelectedGridRows();
    // 'all' — fall back to the full grid rows, including filtered-out ones.
    // The `exporterAllDataFn` escape hatch is left to the caller; we only
    // bundle the in-memory data here.
    return this.buildRowsFromData(this.options.data);
  }

  private resolveExporterOptions(): GridExporterOptions {
    return { ...resolveGridExporterOptions(this.options), ...this.exporterOverrides };
  }

  private buildCsv(
    rowType: GridExporterRowType = 'visible',
    colType: GridExporterColumnType = 'visible',
  ): string {
    const exporterOptions = this.resolveExporterOptions();
    const columns = colType === 'all' ? this.options.columnDefs : this.visibleColumns;
    return buildGridCsv(columns, this.exporterRowsFor(rowType), exporterOptions, colType);
  }

  private exportCsv(
    rowType: GridExporterRowType = 'visible',
    colType: GridExporterColumnType = 'visible',
  ): void {
    const csv = this.buildCsv(rowType, colType);
    const resolved = this.resolveExporterOptions();
    const filename = sanitizeDownloadFilename(
      resolveExporterFilename(resolved.csvFilename, 'download.csv', rowType, colType),
    );
    downloadGridCsvFile(csv, filename);
  }

  private buildPdfDocDefinition(
    rowType: GridExporterRowType = 'visible',
    colType: GridExporterColumnType = 'visible',
  ): GridExporterPdfDocDefinition {
    const exporterOptions = this.resolveExporterOptions();
    const pdfOptions = resolveGridExporterPdfOptions(this.options);
    const columns = colType === 'all' ? this.options.columnDefs : this.visibleColumns;
    return buildGridPdfDocDefinition(
      columns,
      this.exporterRowsFor(rowType),
      pdfOptions,
      exporterOptions,
      colType,
    );
  }

  private exportPdf(
    rowType: GridExporterRowType = 'visible',
    colType: GridExporterColumnType = 'visible',
  ): GridExporterPdfDocDefinition {
    const doc = this.buildPdfDocDefinition(rowType, colType);
    // pdfMake is an optional global (consumers load it separately). When
    // present, open the generated PDF the same way the old module did;
    // when missing, just return the doc definition so the caller can
    // render it themselves. This mirrors `uiGridExporterService.pdfExport`.
    const win = typeof window !== 'undefined' ? (window as typeof window & {
      pdfMake?: { createPdf: (doc: GridExporterPdfDocDefinition) => { open: () => void; download: (filename: string) => void } };
    }) : undefined;
    if (win?.pdfMake) {
      const resolved = this.resolveExporterOptions();
      const pdfOpts = resolveGridExporterPdfOptions(this.options);
      const filename = resolveExporterFilename(
        pdfOpts.filename,
        'download.pdf',
        rowType,
        colType,
      );
      const pdf = win.pdfMake.createPdf(doc);
      // Prefer download when the consumer supplied a filename; otherwise
      // fall back to .open() which pops the pdf in a new browser tab.
      if (resolved.csvFilename || pdfOpts.filename) {
        pdf.download(filename);
      } else {
        pdf.open();
      }
    }
    return doc;
  }

  private buildExcelSheetData(
    rowType: GridExporterRowType = 'visible',
    colType: GridExporterColumnType = 'visible',
  ): GridExporterExcelSheetData {
    const exporterOptions = this.resolveExporterOptions();
    const columns = colType === 'all' ? this.options.columnDefs : this.visibleColumns;
    return buildGridExcelSheetData(columns, this.exporterRowsFor(rowType), exporterOptions, colType);
  }

  private exportExcel(
    rowType: GridExporterRowType = 'visible',
    colType: GridExporterColumnType = 'visible',
  ): GridExporterExcelSheetData {
    const sheetData = this.buildExcelSheetData(rowType, colType);
    // ExcelBuilder is an optional global (consumers load it separately).
    // When present, produce + download the xlsx the same way the old module
    // did; when missing, just return the raw sheet data.
    const win = typeof window !== 'undefined' ? (window as typeof window & {
      ExcelBuilder?: {
        Worksheet: new (config: { name: string }) => { setData: (data: unknown) => void };
        Workbook: new () => { addWorksheet: (sheet: unknown) => void };
        Builder: { createFile: (workbook: unknown, options: { type: 'blob' }) => Promise<Blob> };
      };
    }) : undefined;
    const ExcelBuilder = win?.ExcelBuilder;
    if (!ExcelBuilder) {
      return sheetData;
    }
    const excelOptions = resolveGridExporterExcelOptions(this.options);
    const sheetName = typeof excelOptions.sheetName === 'function'
      ? excelOptions.sheetName(rowType, colType)
      : (excelOptions.sheetName ?? 'Sheet1');
    const filename = sanitizeDownloadFilename(
      resolveExporterFilename(excelOptions.filename, 'download.xlsx', rowType, colType),
    );
    const sheet = new ExcelBuilder.Worksheet({ name: sheetName });
    const workbook = new ExcelBuilder.Workbook();
    workbook.addWorksheet(sheet);
    sheet.setData(sheetData);
    void ExcelBuilder.Builder.createFile(workbook, { type: 'blob' }).then((result) => {
      if (typeof URL === 'undefined' || typeof document === 'undefined') return;
      const url = URL.createObjectURL(result);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    });
    return sheetData;
  }

  private buildExporterMenuItems(): GridExporterMenuItem[] {
    // Pass the full resolved label bundle — the menu module pulls only
    // the `exporter*` keys it needs via `Partial<GridLabels>`.
    return buildGridExporterMenuItems(
      this.options,
      this.labels,
      {
        csvExport: (rowType, colType) => this.exportCsv(rowType, colType),
        pdfExport: (rowType, colType) => {
          this.exportPdf(rowType, colType);
        },
        excelExport: (rowType, colType) => {
          this.exportExcel(rowType, colType);
        },
      },
      () => this.selectionState.selectedRowIds.size > 0,
    );
  }

  // ---- Row-edit — ports ui.grid.rowEdit -----------------------------------

  private rowEditSetSavePromise(rowEntity: GridRecord, savePromise: Promise<void>): void {
    const rowId = this.resolveRowId(rowEntity);
    this.rowEditSavePromiseOverrides.set(rowId, savePromise);
  }

  private rowEditGetDirtyRows(): GridRow[] {
    return this.pipeline.visibleRows.filter((row) =>
      this.rowEditState.dirtyRowIds.has(row.id),
    );
  }

  private rowEditGetErrorRows(): GridRow[] {
    return this.pipeline.visibleRows.filter((row) =>
      this.rowEditState.errorRowIds.has(row.id),
    );
  }

  private rowEditFlushDirtyRows(): Promise<void> {
    const dirty = [...this.rowEditState.dirtyRowIds]
      .map((id) => this.findRowById(id))
      .filter((row): row is GridRow => row !== undefined);
    const promises = dirty.map((row) => this.runRowEditSave(row));
    return Promise.all(promises).then(() => undefined);
  }

  private rowEditSetRowsDirty(rowEntities: readonly GridRecord[]): void {
    for (const entity of rowEntities) {
      const rowId = this.resolveRowId(entity);
      const row = this.findRowById(rowId);
      if (!row) continue;
      markGridRowDirty(this.rowEditState, row);
      this.considerSetRowEditTimer(row);
    }
    this.emit();
  }

  private rowEditSetRowsClean(rowEntities: readonly GridRecord[]): void {
    for (const entity of rowEntities) {
      const rowId = this.resolveRowId(entity);
      const row = this.findRowById(rowId);
      if (!row) continue;
      markGridRowClean(this.rowEditState, row);
      this.cancelRowEditTimer(row);
    }
    this.emit();
  }

  private considerSetRowEditTimer(row: GridRow): void {
    this.cancelRowEditTimer(row);
    if (!row.isDirty || row.isSaving) return;
    const waitInterval = this.options.rowEditWaitInterval;
    if (!isGridRowEditTimerEnabled(waitInterval)) return;
    const effective = resolveGridRowEditWaitInterval(waitInterval);
    const timer = setTimeout(() => {
      this.rowEditTimers.delete(row.id);
      void this.runRowEditSave(row);
    }, effective);
    this.rowEditTimers.set(row.id, timer);
  }

  private cancelRowEditTimer(row: GridRow): void {
    const timer = this.rowEditTimers.get(row.id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.rowEditTimers.delete(row.id);
    }
  }

  private runRowEditSave(row: GridRow): Promise<void> {
    if (row.isSaving) {
      // Re-entrance — return the in-flight promise so `flushDirtyRows`
      // still awaits the existing save. Matches the old module's
      // `rowEditSavePromise` short-circuit.
      return this.rowEditState.savePromises.get(row.id) ?? Promise.resolve();
    }
    markGridRowSaving(this.rowEditState, row);
    this.rowEditSavePromiseOverrides.delete(row.id);
    this.gridApi.rowEdit.raise.saveRow(row.entity);
    const savePromise =
      this.rowEditSavePromiseOverrides.get(row.id) ?? Promise.resolve();
    this.rowEditState.savePromises.set(row.id, savePromise);
    this.emit();
    return savePromise
      .then(() => {
        markGridRowClean(this.rowEditState, row);
        this.emit();
      })
      .catch(() => {
        markGridRowError(this.rowEditState, row);
        this.emit();
      });
  }

  /** Test hook — reports the current row-edit dirty / error / saving state. */
  getRowEditState(): {
    dirtyRowIds: string[];
    errorRowIds: string[];
    savingRowIds: string[];
  } {
    return {
      dirtyRowIds: [...this.rowEditState.dirtyRowIds],
      errorRowIds: [...this.rowEditState.errorRowIds],
      savingRowIds: [...this.rowEditState.savingRowIds],
    };
  }
}

export function createVanillaGridController(options: GridOptions): VanillaGridController {
  return new VanillaGridController(options);
}
