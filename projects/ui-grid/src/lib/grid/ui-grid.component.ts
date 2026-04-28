import { NgTemplateOutlet, isPlatformServer } from '@angular/common';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import {
  CdkFixedSizeVirtualScroll,
  CdkVirtualForOf,
  CdkVirtualScrollViewport
} from '@angular/cdk/scrolling';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  PLATFORM_ID,
  TemplateRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  signal
} from '@angular/core';
import { createGridApi, UiGridApi } from './grid.api';
import {
  FEATURE_AUTO_RESIZE,
  FEATURE_CELL_EDIT,
  FEATURE_COLUMN_MOVING,
  FEATURE_CSV_EXPORT,
  FEATURE_EXPANDABLE,
  FEATURE_FILTERING,
  FEATURE_GROUPING,
  FEATURE_INFINITE_SCROLL,
  FEATURE_PAGINATION,
  FEATURE_SAVE_STATE,
  FEATURE_SORTING,
  FEATURE_TREE_VIEW
} from './grid.features';
import { FILTER_CONDITIONS, SORT_DIRECTIONS, SortDirection } from './grid.constants';
import {
  GridBenchmarkResult,
  GridCellEditableContext,
  GridCellPosition,
  GridCellTemplateContext,
  GridColumnDef,
  GridExpandableTemplateContext,
  GridLabels,
  GridOptions,
  GridRecord,
  GridRow,
  GridSavedState,
  SortState
} from './grid.models';
import { runColumnFilter, setupFilters } from './row-searcher';
import { getSortFn } from './row-sorter';
import { getCellValue, getPathValue, setPathValue } from './grid.utils';
import {
  addGridRowInvisibleReason,
  areAllGridRowsExpanded,
  buildGridCellContext,
  buildGridFocusCellResult,
  buildGridSavedState,
  buildGridSortState,
  buildGridPipeline,
  buildGridRows,
  canGridExpandRows,
  canGridMoveColumns,
  clearGridRowInvisibleReason,
  exportCsvRows,
  findGridRowById as coreFindGridRowById,
  findNextGridCell,
  formatGridCellDisplayValue,
  GridInfiniteScrollState,
  getGridTreeRowChildren,
  gridCellIndent,
  gridColumnWidth,
  gridEditorInputType,
  gridExpandToggleLabelForRow,
  gridFilterPlaceholder,
  gridGroupDisclosureLabel,
  gridGroupingButtonLabel,
  gridSortAriaSort,
  gridSortButtonLabel,
  gridTreeToggleLabelForRow,
  isGridTreeRowExpanded,
  resolveGridLabels,
  isGridColumnFilterable,
  isGridColumnGrouped,
  isGridColumnSortable,
  isGridFilteringEnabled,
  isGridGroupingEnabled,
  isGridInfiniteScrollEnabled,
  isGridPaginationEnabled,
  isGridPrimaryColumn,
  isGridSortingEnabled,
  isGridTreeEnabled,
  isPrintableGridKey,
  isGridCellPosition,
  isVirtualizationEnabled as coreIsVirtualizationEnabled,
  getCurrentPageValue as coreGetCurrentPageValue,
  getEffectivePageSize as coreGetEffectivePageSize,
  getFirstRowIndexValue as coreGetFirstRowIndexValue,
  getLastRowIndexValue as coreGetLastRowIndexValue,
  getTotalPagesValue as coreGetTotalPagesValue,
  parseGridEditedValue,
  resolveGridRowId as coreResolveGridRowId,
  shouldShowGridExpandToggle,
  shouldShowGridPaginationControls,
  shouldShowGridTreeToggle,
  shouldGridEditOnFocus,
  stringifyGridEditorValue,
  headerLabel as coreHeaderLabel,
  normalizeBooleanMap,
  sanitizeDownloadFilename
} from './grid.core';
import type { DisplayItem, ExpandableItem, GroupItem, PipelineResult } from './grid.core';
import {
  applyGridSortStateCommand,
  beginGridCellEditCommand,
  cancelGridCellEditCommand,
  collapseAllGridRowsCommand,
  collapseAllGridTreeRowsCommand,
  clearGridFiltersCommand,
  clearGridGroupingCommand,
  commitGridCellEditCommand,
  completeGridInfiniteScrollDataLoadCommand,
  expandAllGridRowsCommand,
  expandAllGridTreeRowsCommand,
  maybeRequestInfiniteScrollCommand,
  moveGridColumnCommand,
  moveGridVisibleColumnCommand,
  resetGridInfiniteScrollCommand,
  restoreGridStateCommand,
  saveGridInfiniteScrollPercentageCommand,
  seekGridPaginationCommand,
  setGridInfiniteScrollDirectionsCommand,
  setGridTreeRowExpandedCommand,
  setGridPaginationPageSizeCommand,
  sortGridColumnCommand,
  toggleGridRowExpansionCommand,
  toggleGridGroupingCommand,
  toggleGridTreeRowCommand,
  updateGridFilterCommand
} from './ui-grid.commands';
import { downloadGridCsvFile, focusGridEditor, focusGridRenderedCell, observeGridHostSize } from './ui-grid.host';
import {
  raiseGridBenchmarkComplete,
  raiseGridCanvasHeightChanged,
  raiseGridDimensionChanged,
  raiseGridRenderingComplete,
  raiseGridRowsRendered,
  raiseGridRowsVisibleChanged,
  raiseGridScrollBegin,
  raiseGridScrollEnd
} from './ui-grid.events';

@Component({
  selector: 'app-ui-grid',
  imports: [
    NgTemplateOutlet,
    CdkVirtualScrollViewport,
    CdkFixedSizeVirtualScroll,
    CdkVirtualForOf,
    CdkDropList,
    CdkDrag
  ],
  templateUrl: './ui-grid.component.html',
  styleUrl: './ui-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.ShadowDom,
  host: {
    class: 'ui-grid-host'
  }
})
export class UiGridComponent {
  readonly options = input.required<GridOptions>();

  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly platformId = inject(PLATFORM_ID);
  protected readonly activeFilters = signal<Record<string, string>>({});
  protected readonly groupByColumns = signal<string[]>([]);
  protected readonly collapsedGroups = signal<Record<string, boolean>>({});
  protected readonly columnOrder = signal<string[]>([]);
  protected readonly hiddenRowReasons = signal<Record<string, string[]>>({});
  protected readonly benchmarkResult = signal<GridBenchmarkResult | null>(null);
  protected readonly focusedCell = signal<GridCellPosition | null>(null);
  protected readonly editingCell = signal<GridCellPosition | null>(null);
  protected readonly editingValue = signal('');
  protected readonly expandedRows = signal<Record<string, boolean>>({});
  protected readonly expandedTreeRows = signal<Record<string, boolean>>({});
  protected readonly currentPage = signal(1);
  protected readonly pageSize = signal(0);
  protected readonly autoViewportHeight = signal<number | null>(null);
  protected readonly infiniteScrollState = signal<GridInfiniteScrollState>({
    scrollUp: false,
    scrollDown: true,
    dataLoading: false,
    previousVisibleRows: 0
  });
  protected readonly sortState = signal<SortState>({
    columnName: null,
    direction: SORT_DIRECTIONS.none
  });
  protected readonly gridApi: UiGridApi;

  private initializedGridId: string | null = null;
  private lastCanvasHeight = 0;
  private lastGridHeight = 0;
  private lastGridWidth = 0;
  private scrollEndHandle?: number;
  private scrolling = false;
  private editorFocusToken = 0;
  private renderedCellFocusToken = 0;

  constructor() {
    this.gridApi = createGridApi({
      refresh: () => this.refresh(),
      getVisibleRows: () => this.pipeline().visibleRows,
      setRowInvisible: (row, reason) => this.setRowInvisible(row, reason),
      clearRowInvisible: (row, reason) => this.clearRowInvisible(row, reason),
      setFilter: (columnName, value) => this.updateFilter(columnName, value),
      clearAllFilters: () => this.clearAllFilters(),
      sortColumn: (columnName, direction) => this.sortColumn(columnName, direction),
      moveColumn: (fromIndex, toIndex) => this.moveColumn(fromIndex, toIndex),
      toggleGrouping: (columnName) => this.toggleGroupingByName(columnName),
      clearGrouping: () => this.clearGrouping(),
      benchmark: (iterations) => this.runBenchmark(iterations),
      exportCsv: () => this.exportCsv(),
      paginationGetPage: () => this.getCurrentPageValue(),
      paginationGetTotalPages: () => this.getTotalPagesValue(),
      paginationGetFirstRowIndex: () => this.getFirstRowIndexValue(),
      paginationGetLastRowIndex: () => this.getLastRowIndexValue(),
      paginationNextPage: () => this.nextPage(),
      paginationPreviousPage: () => this.previousPage(),
      paginationSeek: (page) => this.seekPage(page),
      paginationSetPageSize: (pageSize) => this.setPaginationPageSize(pageSize),
      toggleRowExpansion: (row) => this.toggleRowExpansionByRef(row),
      expandAllRows: () => this.expandAllRows(),
      collapseAllRows: () => this.collapseAllRows(),
      toggleAllRows: () => this.toggleAllRows(),
      treeExpandAllRows: () => this.expandAllTreeRows(),
      treeCollapseAllRows: () => this.collapseAllTreeRows(),
      treeToggleRow: (row) => this.toggleTreeRowByRef(row),
      treeExpandRow: (row) => this.expandTreeRowByRef(row),
      treeCollapseRow: (row) => this.collapseTreeRowByRef(row),
      treeGetRowChildren: (row) => this.getTreeRowChildren(row),
      treeGetState: () => this.expandedTreeRows(),
      treeSetState: (state) => this.expandedTreeRows.set({ ...state }),
      infiniteScrollDataLoaded: (scrollUp, scrollDown) => this.infiniteScrollDataLoaded(scrollUp, scrollDown),
      infiniteScrollReset: (scrollUp, scrollDown) => this.resetInfiniteScroll(scrollUp, scrollDown),
      infiniteScrollSaveScrollPercentage: () => this.saveScrollPercentage(),
      infiniteScrollDataRemovedTop: (scrollUp, scrollDown) => this.handleInfiniteDataRemovedTop(scrollUp, scrollDown),
      infiniteScrollDataRemovedBottom: (scrollUp, scrollDown) => this.handleInfiniteDataRemovedBottom(scrollUp, scrollDown),
      infiniteScrollSetDirections: (scrollUp, scrollDown) => this.setInfiniteScrollDirections(scrollUp, scrollDown),
      saveState: () => this.saveState(),
      restoreState: (state) => this.restoreState(state),
      beginCellEdit: (row, columnName, triggerEvent) => this.beginCellEditByRef(row, columnName, triggerEvent),
      endCellEdit: () => this.commitCellEdit(),
      cancelCellEdit: () => this.cancelCellEdit(),
      getEditingCell: () => this.editingCell()
    });

    effect(() => {
      const options = this.options();
      if (this.initializedGridId === options.id) {
        return;
      }

      this.initializedGridId = options.id;
      this.activeFilters.set({});
      this.hiddenRowReasons.set({});
      this.collapsedGroups.set({});
      this.focusedCell.set(null);
      this.editingCell.set(null);
      this.editingValue.set('');
      this.expandedRows.set({});
      this.expandedTreeRows.set({});
      this.columnOrder.set(options.columnDefs.map((column) => column.name));
      this.groupByColumns.set(options.grouping?.groupBy ?? []);
      this.currentPage.set(options.paginationCurrentPage ?? 1);
      this.pageSize.set(this.initialPageSize(options));
      this.infiniteScrollState.set({
        scrollUp: options.infiniteScrollUp === true,
        scrollDown: options.infiniteScrollDown !== false,
        dataLoading: false,
        previousVisibleRows: 0
      });
      const initialSort = options.columnDefs.find(
        (column) => column.sort?.direction && !column.sort.ignoreSort
      );
      this.sortState.set({
        columnName: initialSort?.name ?? null,
        direction: initialSort?.sort?.direction ?? SORT_DIRECTIONS.none
      });
      options.onRegisterApi?.(this.gridApi);
      raiseGridRenderingComplete(this.gridApi);
    });

    effect(() => {
      const pipeline = this.pipeline();
      raiseGridRowsRendered(this.gridApi, pipeline.visibleRows);
      raiseGridRowsVisibleChanged(this.gridApi, pipeline.visibleRows);

      const newHeight = pipeline.displayItems.length * this.rowSize();
      if (newHeight !== this.lastCanvasHeight) {
        raiseGridCanvasHeightChanged(this.gridApi, this.lastCanvasHeight, newHeight);
        this.lastCanvasHeight = newHeight;
      }
    });

    effect((onCleanup) => {
      if (!FEATURE_AUTO_RESIZE || !this.options().enableAutoResize) {
        return;
      }

      const observer = observeGridHostSize(this.hostElement.nativeElement, ({ height: nextHeight, width: nextWidth }) => {
        if (nextHeight === this.lastGridHeight && nextWidth === this.lastGridWidth) {
          return;
        }

        raiseGridDimensionChanged(
          this.gridApi,
          this.lastGridHeight,
          this.lastGridWidth,
          nextHeight,
          nextWidth
        );
        this.lastGridHeight = nextHeight;
        this.lastGridWidth = nextWidth;

        if (!this.options().viewportHeight && nextHeight > 0) {
          this.autoViewportHeight.set(nextHeight);
        }
      });

      if (!observer) {
        return;
      }

      onCleanup(() => observer.disconnect());
    });
  }

  protected readonly visibleColumns = computed(() => {
    const order = this.columnOrder();
    return [...this.options().columnDefs]
      .filter((column) => column.visible !== false)
      .sort((left, right) => order.indexOf(left.name) - order.indexOf(right.name));
  });

  private readonly pipeline = computed<PipelineResult>(() => this.buildPipeline());

  protected readonly gridTemplateColumns = computed(() =>
    this.visibleColumns().map((column) => this.columnWidth(column)).join(' ')
  );
  protected readonly totalRows = computed(() => this.pipeline().totalItems);
  protected readonly visibleRowCount = computed(() => this.pipeline().visibleRows.length);
  protected readonly displayItems = computed(() => this.pipeline().displayItems);
  protected readonly renderVirtualViewport = computed(() => this.virtualizationEnabled() && !isPlatformServer(this.platformId));
  protected readonly renderedDisplayItems = computed(() => {
    const items = this.displayItems();
    if (!this.virtualizationEnabled() || !isPlatformServer(this.platformId)) {
      return items;
    }

    return items.slice(0, this.ssrVisibleItemCount());
  });
  protected readonly pipelineMs = computed(() => this.pipeline().pipelineMs);
  protected readonly virtualizationEnabled = computed(() => this.pipeline().virtualizationEnabled);
  protected readonly labels = computed<GridLabels>(() => resolveGridLabels(this.options().labels));
  protected readonly paginationCurrentPage = computed(() => this.getCurrentPageValue());
  protected readonly paginationTotalPages = computed(() => this.getTotalPagesValue());
  protected readonly paginationSelectedPageSize = computed(() => this.effectivePageSize(this.pipeline().totalItems));

  private isVirtualizationEnabled(itemCount = this.pipeline().totalItems): boolean {
    return coreIsVirtualizationEnabled(this.options(), itemCount);
  }

  private buildPipeline(): PipelineResult {
    return buildGridPipeline({
      options: this.options(),
      columns: this.visibleColumns(),
      activeFilters: this.activeFilters(),
      sortState: this.sortState(),
      groupByColumns: this.groupByColumns(),
      collapsedGroups: this.collapsedGroups(),
      hiddenRowReasons: this.hiddenRowReasons(),
      expandedRows: this.expandedRows(),
      expandedTreeRows: this.expandedTreeRows(),
      currentPage: this.currentPage(),
      pageSize: this.pageSize(),
      rowSize: this.rowSize()
    });
  }

  protected headerLabel(column: GridColumnDef): string {
    return coreHeaderLabel(column);
  }

  protected isGroupItem(item: DisplayItem): item is GroupItem {
    return item.kind === 'group';
  }

  protected isExpandableItem(item: DisplayItem): item is ExpandableItem {
    return item.kind === 'expandable';
  }

  protected isOddStripedRow(item: DisplayItem): boolean {
    return item.kind === 'row' && item.visibleIndex % 2 === 0;
  }

  protected sortButtonLabel(column: GridColumnDef): string {
    return gridSortButtonLabel(this.sortDirection(column), this.labels());
  }

  protected sortAriaSort(column: GridColumnDef): string {
    return gridSortAriaSort(this.sortDirection(column));
  }

  protected groupingButtonLabel(column: GridColumnDef): string {
    return gridGroupingButtonLabel(this.isGrouped(column), this.labels());
  }

  protected filterValue(columnName: string): string {
    return this.activeFilters()[columnName] ?? '';
  }

  protected filterPlaceholder(column: GridColumnDef): string {
    return gridFilterPlaceholder(this.isColumnFilterable(column), this.labels());
  }

  protected isFilterInputDisabled(column: GridColumnDef): boolean {
    return !this.isColumnFilterable(column);
  }

  protected groupDisclosureLabel(item: GroupItem): string {
    return gridGroupDisclosureLabel(item.collapsed, this.labels());
  }

  protected displayValue(row: GridRow, column: GridColumnDef): string {
    return formatGridCellDisplayValue(this.cellContext(row, column));
  }

  protected isFocusedCell(row: GridRow, column: GridColumnDef): boolean {
    return isGridCellPosition(this.focusedCell(), row.id, column.name);
  }

  protected isEditingCell(row: GridRow, column: GridColumnDef): boolean {
    return isGridCellPosition(this.editingCell(), row.id, column.name);
  }

  protected editorInputType(column: GridColumnDef): string {
    return gridEditorInputType(column);
  }

  protected cellTemplate(column: GridColumnDef): TemplateRef<GridCellTemplateContext> | null {
    return column.cellTemplate ?? null;
  }

  protected expandableTemplate(): TemplateRef<GridExpandableTemplateContext> | null {
    return this.options().expandableRowTemplate ?? null;
  }

  protected cellContext(row: GridRow, column: GridColumnDef): GridCellTemplateContext {
    return buildGridCellContext(row, column);
  }

  protected sortDirection(column: GridColumnDef): SortDirection {
    const sortState = this.sortState();
    return sortState.columnName === column.name ? sortState.direction : SORT_DIRECTIONS.none;
  }

  protected toggleSort(column: GridColumnDef): void {
    if (!FEATURE_SORTING || !this.isColumnSortable(column)) {
      return;
    }

    const currentDirection = this.sortDirection(column);
    const nextDirection =
      currentDirection === SORT_DIRECTIONS.none
        ? SORT_DIRECTIONS.asc
        : currentDirection === SORT_DIRECTIONS.asc
          ? SORT_DIRECTIONS.desc
          : SORT_DIRECTIONS.none;

    applyGridSortStateCommand(this.gridApi, (state) => this.sortState.set(state), {
      columnName: nextDirection === SORT_DIRECTIONS.none ? null : column.name,
      direction: nextDirection
    });
  }

  protected updateFilter(columnName: string, value: string): void {
    updateGridFilterCommand(
      this.gridApi,
      (updater) => this.activeFilters.update(updater),
      () => this.activeFilters(),
      columnName,
      value
    );
  }

  protected clearAllFilters(): void {
    clearGridFiltersCommand(this.gridApi, (filters) => this.activeFilters.set(filters));
  }

  protected expandedContext(row: GridRow): GridExpandableTemplateContext & Record<string, unknown> {
    return {
      $implicit: row.entity,
      row: row.entity,
      rowIndex: row.index,
      expanded: true,
      ...(this.options().expandableRowScope ?? {})
    };
  }

  protected columnWidth(column: GridColumnDef): string {
    return gridColumnWidth(column);
  }

  protected isColumnSortable(column: GridColumnDef): boolean {
    return isGridColumnSortable(this.options(), column);
  }

  protected isColumnFilterable(column: GridColumnDef): boolean {
    return isGridColumnFilterable(this.options(), column);
  }

  protected isCellEditable(row: GridRow, column: GridColumnDef, triggerEvent?: Event | KeyboardEvent | null): boolean {
    if (!FEATURE_CELL_EDIT) return false;
    const editable = column.enableCellEdit ?? this.options().enableCellEdit ?? false;
    if (!editable) {
      return false;
    }

    const condition = column.cellEditableCondition ?? this.options().cellEditableCondition ?? true;
    if (typeof condition === 'boolean') {
      return condition;
    }

    const context: GridCellEditableContext = {
      row: row.entity,
      column,
      rowIndex: row.index,
      triggerEvent
    };
    return condition(context);
  }

  protected shouldEditOnFocus(column: GridColumnDef): boolean {
    return column.enableCellEditOnFocus ?? this.options().enableCellEditOnFocus ?? false;
  }

  // Build-time feature flag accessors for the template.
  // When a flag is false the bundler eliminates the guarded template block.
  protected readonly sortingFeature = FEATURE_SORTING;
  protected readonly filteringFeature = FEATURE_FILTERING;
  protected readonly groupingFeature = FEATURE_GROUPING;
  protected readonly paginationFeature = FEATURE_PAGINATION;
  protected readonly cellEditFeature = FEATURE_CELL_EDIT;
  protected readonly expandableFeature = FEATURE_EXPANDABLE;
  protected readonly treeViewFeature = FEATURE_TREE_VIEW;
  protected readonly infiniteScrollFeature = FEATURE_INFINITE_SCROLL;
  protected readonly columnMovingFeature = FEATURE_COLUMN_MOVING;
  protected readonly csvExportFeature = FEATURE_CSV_EXPORT;
  protected readonly autoResizeFeature = FEATURE_AUTO_RESIZE;

  protected isGroupingEnabled(): boolean {
    return FEATURE_GROUPING && isGridGroupingEnabled(this.options());
  }

  protected isTreeEnabled(): boolean {
    return FEATURE_TREE_VIEW && isGridTreeEnabled(this.options());
  }

  protected canExpandRows(): boolean {
    return FEATURE_EXPANDABLE && canGridExpandRows(this.options());
  }

  protected isPaginationEnabled(): boolean {
    return FEATURE_PAGINATION && isGridPaginationEnabled(this.options());
  }

  protected showPaginationControls(): boolean {
    return FEATURE_PAGINATION && shouldShowGridPaginationControls(this.options());
  }

  protected isInfiniteScrollEnabled(): boolean {
    return FEATURE_INFINITE_SCROLL && isGridInfiniteScrollEnabled(this.options());
  }

  protected isSortingEnabled(): boolean {
    return FEATURE_SORTING && isGridSortingEnabled(this.options());
  }

  protected isFilteringEnabled(): boolean {
    return FEATURE_FILTERING && isGridFilteringEnabled(this.options());
  }

  protected canMoveColumns(): boolean {
    return FEATURE_COLUMN_MOVING && canGridMoveColumns(this.options());
  }

  protected isPrimaryColumn(column: GridColumnDef): boolean {
    return isGridPrimaryColumn(this.visibleColumns(), column);
  }

  protected showTreeToggle(row: GridRow, column: GridColumnDef): boolean {
    return shouldShowGridTreeToggle(this.options(), this.visibleColumns(), row, column);
  }

  protected showExpandToggle(row: GridRow, column: GridColumnDef): boolean {
    return shouldShowGridExpandToggle(this.options(), this.visibleColumns(), column);
  }

  protected cellIndent(row: GridRow, column: GridColumnDef): string {
    return gridCellIndent(this.options(), this.visibleColumns(), row, column);
  }

  protected treeToggleLabel(row: GridRow): string {
    return gridTreeToggleLabelForRow(this.expandedTreeRows(), row, this.labels());
  }

  protected isTreeRowExpanded(row: GridRow): boolean {
    return isGridTreeRowExpanded(this.expandedTreeRows(), row);
  }

  protected expandToggleLabel(row: GridRow): string {
    return gridExpandToggleLabelForRow(row, this.labels());
  }

  protected isGrouped(column: GridColumnDef): boolean {
    return isGridColumnGrouped(this.groupByColumns(), column);
  }

  protected toggleGrouping(column: GridColumnDef, event?: Event): void {
    event?.stopPropagation();
    this.toggleGroupingByName(column.name);
  }

  private toggleGroupingByName(columnName: string): void {
    toggleGridGroupingCommand(
      this.gridApi,
      this.isGroupingEnabled(),
      (updater) => this.groupByColumns.update(updater),
      () => this.groupByColumns(),
      columnName
    );
  }

  private clearGrouping(): void {
    clearGridGroupingCommand(this.gridApi, (grouping) => this.groupByColumns.set(grouping), false);
  }

  protected toggleGroup(item: GroupItem): void {
    this.collapsedGroups.update((current) => ({
      ...current,
      [item.id]: !current[item.id]
    }));
  }

  protected rowSize(): number {
    return this.options().rowHeight ?? 44;
  }

  protected ssrVisibleItemCount(): number {
    const viewportHeight = this.options().viewportHeight ?? this.autoViewportHeight() ?? 560;
    return Math.max(1, Math.ceil(viewportHeight / this.rowSize()));
  }

  protected viewportHeight(): string {
    return `${this.options().viewportHeight ?? this.autoViewportHeight() ?? 560}px`;
  }

  protected pageSizeOptions(): number[] {
    return this.options().paginationPageSizes ?? [];
  }

  protected paginationSummary(): string {
    const totalItems = this.pipeline().totalItems;
    if (totalItems === 0) {
      return '0-0 of 0';
    }

    return `${this.getFirstRowIndexValue(totalItems) + 1}-${this.getLastRowIndexValue(totalItems) + 1} of ${totalItems}`;
  }

  protected onPageSizeChange(value: string): void {
    this.setPaginationPageSize(Number(value));
  }

  protected nextPage(): void {
    this.seekPage(this.getCurrentPageValue() + 1);
  }

  protected previousPage(): void {
    this.seekPage(this.getCurrentPageValue() - 1);
  }

  protected onColumnDrop(event: CdkDragDrop<GridColumnDef[], GridColumnDef[], GridColumnDef>): void {
    if (!this.canMoveColumns()) {
      return;
    }

    const draggedColumn = event.item.data as GridColumnDef | undefined;
    const dropListColumns = event.container.data as readonly GridColumnDef[] | undefined;
    const targetColumn = dropListColumns?.[event.currentIndex];

    if (!draggedColumn || !targetColumn || draggedColumn.name === targetColumn.name) {
      return;
    }

    this.moveVisibleColumn(draggedColumn.name, targetColumn.name);
  }

  private moveColumn(fromIndex: number, toIndex: number): void {
    moveGridColumnCommand(
      this.gridApi,
      this.canMoveColumns(),
      (updater) => this.columnOrder.update(updater),
      fromIndex,
      toIndex
    );
  }

  private moveVisibleColumn(columnName: string, targetColumnName: string): void {
    moveGridVisibleColumnCommand(
      this.gridApi,
      this.canMoveColumns(),
      this.columnOrder(),
      this.visibleColumns().map((column) => column.name),
      columnName,
      targetColumnName,
      (order) => this.columnOrder.set(order)
    );
  }

  protected trackDisplayItem = (_index: number, item: DisplayItem): string => item.id;

  protected focusCell(row: GridRow, column: GridColumnDef, triggerEvent?: Event | KeyboardEvent | null): void {
    const nextFocusResult = buildGridFocusCellResult({
      currentFocusedCell: this.focusedCell(),
      currentEditingCell: this.editingCell(),
      rowId: row.id,
      columnName: column.name,
      shouldEditOnFocus: this.shouldEditOnFocus(column),
      isCellEditable: this.isCellEditable(row, column, triggerEvent)
    });
    this.focusedCell.set(nextFocusResult.focusedCell);

    if (nextFocusResult.shouldBeginEdit) {
      this.startCellEdit(row, column, triggerEvent);
    }
  }

  protected handleCellKeyDown(row: GridRow, column: GridColumnDef, event: KeyboardEvent): void {
    this.focusCell(row, column, event);

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        this.moveFocus(row, column, 'left', event);
        return;
      case 'ArrowRight':
        event.preventDefault();
        this.moveFocus(row, column, 'right', event);
        return;
      case 'ArrowUp':
        event.preventDefault();
        this.moveFocus(row, column, 'up', event);
        return;
      case 'ArrowDown':
        event.preventDefault();
        this.moveFocus(row, column, 'down', event);
        return;
      case 'Tab':
        event.preventDefault();
        this.moveFocus(row, column, event.shiftKey ? 'left' : 'right', event);
        return;
      case 'Enter':
        event.preventDefault();
        this.moveFocus(row, column, event.shiftKey ? 'up' : 'down', event);
        return;
      case 'F2':
        event.preventDefault();
        if (this.isCellEditable(row, column, event)) {
          this.startCellEdit(row, column, event);
        }
        return;
      case 'Backspace':
      case 'Delete':
        if (this.isCellEditable(row, column, event)) {
          event.preventDefault();
          this.startCellEdit(row, column, event, '');
        }
        return;
      default:
        break;
    }

    if (this.isPrintableKey(event) && this.isCellEditable(row, column, event)) {
      event.preventDefault();
      this.startCellEdit(row, column, event, event.key);
    }
  }

  protected handleCellDoubleClick(row: GridRow, column: GridColumnDef, event: MouseEvent): void {
    this.focusCell(row, column, event);
    if (this.isCellEditable(row, column, event)) {
      this.startCellEdit(row, column, event);
    }
  }

  protected updateEditingValue(value: string): void {
    this.editingValue.set(value);
  }

  protected handleEditorKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelCellEdit();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitCellEdit(event.shiftKey ? 'up' : 'down');
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      this.commitCellEdit(event.shiftKey ? 'left' : 'right');
    }
  }

  protected handleEditorBlur(event: FocusEvent): void {
    const editingCell = this.editingCell();
    const target = event.target as HTMLElement | null;
    if (!editingCell || !target) {
      return;
    }

    if (target.dataset['rowId'] !== editingCell.rowId || target.dataset['colName'] !== editingCell.columnName) {
      return;
    }

    this.commitCellEdit(undefined, false);
  }

  protected onViewportIndexChange(startIndex = 0): void {
    if (!this.scrolling) {
      this.scrolling = true;
      raiseGridScrollBegin(this.gridApi);
    }

    if (this.scrollEndHandle) {
      window.clearTimeout(this.scrollEndHandle);
    }

    this.scrollEndHandle = window.setTimeout(() => {
      this.scrolling = false;
      raiseGridScrollEnd(this.gridApi);
    }, 120);

    this.maybeRequestMoreData(startIndex);
  }

  protected runBenchmark(iterations = this.options().benchmark?.iterations ?? 25): GridBenchmarkResult {
    const safeIterations = Math.max(1, iterations);
    const startedAt = performance.now();
    let lastResult = this.buildPipeline();

    for (let index = 1; index < safeIterations; index += 1) {
      lastResult = this.buildPipeline();
    }

    const totalMs = performance.now() - startedAt;
    const result: GridBenchmarkResult = {
      iterations: safeIterations,
      totalMs,
      averageMs: totalMs / safeIterations,
      visibleRows: lastResult.visibleRows.length,
      renderedItems: lastResult.displayItems.length
    };

    this.benchmarkResult.set(result);
    raiseGridBenchmarkComplete(this.gridApi, result);
    return result;
  }

  protected exportCsv(): void {
    if (!FEATURE_CSV_EXPORT) return;
    const columns = this.visibleColumns();
    const csv = exportCsvRows(columns, this.pipeline().visibleRows);
    this.downloadCsv(csv, `${sanitizeDownloadFilename(this.options().id)}.csv`);
  }

  private downloadCsv(csv: string, filename: string): void {
    if (isPlatformServer(this.platformId)) {
      return;
    }

    downloadGridCsvFile(csv, filename);
  }

  private refresh(): void {
    this.activeFilters.update((current) => ({ ...current }));
  }

  private isPrintableKey(event: KeyboardEvent): boolean {
    return isPrintableGridKey(event.key, event.ctrlKey, event.metaKey, event.altKey);
  }

  private beginCellEditByRef(row: GridRow | GridRecord | string, columnName: string, triggerEvent?: Event | KeyboardEvent | null): void {
    const rowId = this.resolveRowId(row);
    const gridRow = this.findRowById(rowId);
    const column = this.visibleColumns().find((candidate) => candidate.name === columnName);
    if (!gridRow || !column || !this.isCellEditable(gridRow, column, triggerEvent)) {
      return;
    }

    this.startCellEdit(gridRow, column, triggerEvent);
  }

  private startCellEdit(row: GridRow, column: GridColumnDef, triggerEvent?: Event | KeyboardEvent | null, initialValue?: string): void {
    const currentValue = getCellValue(row.entity, column);
    const focusToken = ++this.editorFocusToken;
    const editingCell = beginGridCellEditCommand(
      this.gridApi,
      {
        setFocusedCell: (focusedCell) => this.focusedCell.set(focusedCell),
        setEditingCell: (editingCellState) => this.editingCell.set(editingCellState),
        setEditingValue: (editingValue) => this.editingValue.set(editingValue)
      },
      row,
      column,
      currentValue,
      triggerEvent,
      initialValue
    );

    if (editingCell) {
      queueMicrotask(() => this.focusEditorInput(focusToken));
    }
  }

  private commitCellEdit(direction?: 'left' | 'right' | 'up' | 'down', restoreFocus = true): void {
    const result = commitGridCellEditCommand(this.gridApi, {
      getEditingCell: () => this.editingCell(),
      getEditingValue: () => this.editingValue(),
      setEditingCell: (editingCell) => this.editingCell.set(editingCell),
      setEditingValue: (editingValue) => this.editingValue.set(editingValue),
      findRowById: (rowId) => this.findRowById(rowId),
      findColumnByName: (columnName) => this.visibleColumns().find((candidate) => candidate.name === columnName),
      parseEditedValue: (column, value, oldValue) => this.parseEditedValue(column, value, oldValue),
      setCellValue: (rowEntity, column, value) => this.setCellValue(rowEntity, column, value)
    });

    if (!result.committed || !result.row || !result.column || !result.focusTarget) {
      return;
    }

    this.editorFocusToken += 1;

    if (direction) {
      const moved = this.moveFocus(result.row, result.column, direction);
      if (!moved) {
        this.focusRenderedCell(result.focusTarget);
      }
    } else if (restoreFocus) {
      this.focusRenderedCell(result.focusTarget);
    }
  }

  private cancelCellEdit(): void {
    const hadEditingCell = this.editingCell() !== null;
    const result = cancelGridCellEditCommand(this.gridApi, {
      getEditingCell: () => this.editingCell(),
      setEditingCell: (editingCell) => this.editingCell.set(editingCell),
      setEditingValue: (editingValue) => this.editingValue.set(editingValue),
      findRowById: (rowId) => this.findRowById(rowId),
      findColumnByName: (columnName) => this.visibleColumns().find((candidate) => candidate.name === columnName)
    });

    if (!hadEditingCell) {
      return;
    }

    this.editorFocusToken += 1;

    if (result.focusTarget) {
      this.focusRenderedCell(result.focusTarget);
    }
  }

  private stringifyEditorValue(value: unknown): string {
    return stringifyGridEditorValue(value);
  }

  private parseEditedValue(column: GridColumnDef, value: string, oldValue: unknown): unknown {
    return parseGridEditedValue(column, value, oldValue);
  }

  private editFieldPath(column: GridColumnDef): string {
    return column.editModelField ?? column.field ?? column.name;
  }

  private setCellValue(rowEntity: GridRecord, column: GridColumnDef, value: unknown): void {
    setPathValue(rowEntity, this.editFieldPath(column), value);
  }

  private moveFocus(
    row: GridRow,
    column: GridColumnDef,
    direction: 'left' | 'right' | 'up' | 'down',
    triggerEvent?: Event | KeyboardEvent | null,
    editableOnly = false
  ): boolean {
    const nextCell = findNextGridCell({
      rows: this.pipeline().visibleRows,
      columns: this.visibleColumns(),
      rowId: row.id,
      columnName: column.name,
      direction,
      isCellAllowed: editableOnly
        ? (nextRow, nextColumn) => this.isCellEditable(nextRow, nextColumn, triggerEvent)
        : undefined
    });
    if (!nextCell) {
      return false;
    }

    this.focusedCell.set({ rowId: nextCell.row.id, columnName: nextCell.column.name });
    this.focusRenderedCell({ rowId: nextCell.row.id, columnName: nextCell.column.name });

    if (this.shouldEditOnFocus(nextCell.column) && this.isCellEditable(nextCell.row, nextCell.column, triggerEvent)) {
      this.startCellEdit(nextCell.row, nextCell.column, triggerEvent);
    }

    return true;
  }

  private focusRenderedCell(position: GridCellPosition): void {
    const focusToken = ++this.renderedCellFocusToken;
    focusGridRenderedCell(this.hostElement.nativeElement, position, () => focusToken === this.renderedCellFocusToken);
  }

  private focusEditorInput(focusToken: number, retry = true): void {
    if (focusToken !== this.editorFocusToken) {
      return;
    }

    const editingCell = this.editingCell();
    if (!editingCell) {
      return;
    }

    if (!retry) {
      return;
    }

    focusGridEditor(
      this.hostElement.nativeElement,
      editingCell,
      () => focusToken === this.editorFocusToken && this.editingCell()?.rowId === editingCell.rowId && this.editingCell()?.columnName === editingCell.columnName
    );
  }

  private initialPageSize(options: GridOptions): number {
    return coreGetEffectivePageSize(options, 0, options.data.length);
  }

  private effectivePageSize(totalItems: number): number {
    return coreGetEffectivePageSize(this.options(), this.pageSize(), totalItems);
  }

  private getCurrentPageValue(totalItems = this.pipeline().totalItems): number {
    return coreGetCurrentPageValue(this.options(), this.currentPage(), totalItems, this.pageSize());
  }

  private getTotalPagesValue(totalItems = this.pipeline().totalItems): number {
    return coreGetTotalPagesValue(this.options(), totalItems, this.pageSize());
  }

  private getFirstRowIndexValue(totalItems = this.pipeline().totalItems): number {
    return coreGetFirstRowIndexValue(this.options(), this.currentPage(), totalItems, this.pageSize());
  }

  private getLastRowIndexValue(totalItems = this.pipeline().totalItems): number {
    return coreGetLastRowIndexValue(this.options(), this.currentPage(), totalItems, this.pageSize());
  }

  private seekPage(page: number): void {
    seekGridPaginationCommand(
      this.gridApi,
      (nextPage) => this.currentPage.set(nextPage),
      () => this.getTotalPagesValue(),
      () => this.effectivePageSize(this.pipeline().totalItems),
      page
    );
  }

  private setPaginationPageSize(pageSize: number): void {
    setGridPaginationPageSizeCommand(
      this.gridApi,
      (nextPageSize) => this.pageSize.set(nextPageSize),
      (nextPage) => this.currentPage.set(nextPage),
      pageSize
    );
  }

  private buildRows(data: readonly GridRecord[]): GridRow[] {
    return buildGridRows(
      { ...this.options(), data },
      this.rowSize(),
      this.hiddenRowReasons(),
      this.expandedRows()
    );
  }

  private resolveRowId(row: GridRow | GridRecord | string): string {
    return coreResolveGridRowId(this.options(), row);
  }

  private findRowById(rowId: string): GridRow | null {
    return coreFindGridRowById(this.buildRows(this.options().data), rowId);
  }

  private toggleRowExpansionByRef(row: GridRow | GridRecord | string): void {
    const rowId = this.resolveRowId(row);
    toggleGridRowExpansionCommand(
      this.gridApi,
      this.canExpandRows(),
      this.expandedRows(),
      rowId,
      (expandedRows) => this.expandedRows.set(expandedRows),
      (resolvedRowId) => this.findRowById(resolvedRowId)
    );
  }

  protected toggleRowExpansion(row: GridRow, event?: Event): void {
    event?.stopPropagation();
    this.toggleRowExpansionByRef(row);
  }

  private expandAllRows(): void {
    if (!this.canExpandRows()) {
      return;
    }

    expandAllGridRowsCommand(
      (data) => this.buildRows(data),
      this.options().data,
      (expandedRows) => this.expandedRows.set(expandedRows)
    );
  }

  private collapseAllRows(): void {
    collapseAllGridRowsCommand((expandedRows) => this.expandedRows.set(expandedRows));
  }

  private toggleAllRows(): void {
    const allExpanded = areAllGridRowsExpanded(this.buildRows(this.options().data), this.expandedRows());
    if (allExpanded) {
      this.collapseAllRows();
    } else {
      this.expandAllRows();
    }
  }

  protected toggleTreeRow(row: GridRow, event?: Event): void {
    event?.stopPropagation();
    this.toggleTreeRowByRef(row);
  }

  private toggleTreeRowByRef(row: GridRow | GridRecord | string): void {
    const rowId = this.resolveRowId(row);
    toggleGridTreeRowCommand(
      this.gridApi,
      this.expandedTreeRows(),
      rowId,
      (expandedRows) => this.expandedTreeRows.set(expandedRows),
      (resolvedRowId) => this.findRowById(resolvedRowId)
    );
  }

  private expandTreeRowByRef(row: GridRow | GridRecord | string): void {
    const rowId = this.resolveRowId(row);
    setGridTreeRowExpandedCommand(
      this.gridApi,
      this.expandedTreeRows(),
      rowId,
      true,
      (expandedRows) => this.expandedTreeRows.set(expandedRows),
      (resolvedRowId) => this.findRowById(resolvedRowId)
    );
  }

  private collapseTreeRowByRef(row: GridRow | GridRecord | string): void {
    const rowId = this.resolveRowId(row);
    setGridTreeRowExpandedCommand(
      this.gridApi,
      this.expandedTreeRows(),
      rowId,
      false,
      (expandedRows) => this.expandedTreeRows.set(expandedRows),
      (resolvedRowId) => this.findRowById(resolvedRowId)
    );
  }

  private expandAllTreeRows(): void {
    expandAllGridTreeRowsCommand(
      (data) => this.buildRows(data),
      this.options().data,
      (expandedRows) => this.expandedTreeRows.set(expandedRows)
    );
  }

  private collapseAllTreeRows(): void {
    collapseAllGridTreeRowsCommand((expandedRows) => this.expandedTreeRows.set(expandedRows));
  }

  private getTreeRowChildren(row: GridRow | GridRecord | string): GridRow[] {
    const rowId = this.resolveRowId(row);
    return getGridTreeRowChildren(this.buildRows(this.options().data), rowId);
  }

  private setRowInvisible(row: GridRow | GridRecord | string, reason = 'user'): void {
    const rowId = this.resolveRowId(row);
    this.hiddenRowReasons.update((current) => addGridRowInvisibleReason(current, rowId, reason));
  }

  private clearRowInvisible(row: GridRow | GridRecord | string, reason = 'user'): void {
    const rowId = this.resolveRowId(row);
    this.hiddenRowReasons.update((current) => clearGridRowInvisibleReason(current, rowId, reason));
  }

  private sortColumn(columnName: string, direction?: SortDirection): void {
    sortGridColumnCommand(this.gridApi, (sortState) => this.sortState.set(sortState), columnName, direction);
  }

  private maybeRequestMoreData(startIndex: number): void {
    maybeRequestInfiniteScrollCommand(this.gridApi, {
      enabled: this.isInfiniteScrollEnabled(),
      virtualizationEnabled: this.virtualizationEnabled(),
      state: this.infiniteScrollState(),
      startIndex,
      visibleRows: this.pipeline().visibleRows.length,
      viewportRows: Math.max(1, Math.ceil((this.options().viewportHeight ?? this.autoViewportHeight() ?? 560) / this.rowSize())),
      threshold: this.options().infiniteScrollRowsFromEnd ?? 20,
      setState: (state) => this.infiniteScrollState.set(state)
    });
  }

  private infiniteScrollDataLoaded(scrollUp = this.infiniteScrollState().scrollUp, scrollDown = this.infiniteScrollState().scrollDown): Promise<void> {
    return completeGridInfiniteScrollDataLoadCommand(
      this.infiniteScrollState(),
      (state) => this.infiniteScrollState.set(state),
      scrollUp,
      scrollDown
    );
  }

  private resetInfiniteScroll(scrollUp = this.infiniteScrollState().scrollUp, scrollDown = this.infiniteScrollState().scrollDown): void {
    resetGridInfiniteScrollCommand((state) => this.infiniteScrollState.set(state), scrollUp, scrollDown);
  }

  private saveScrollPercentage(): void {
    saveGridInfiniteScrollPercentageCommand(
      this.infiniteScrollState(),
      this.pipeline().visibleRows.length,
      (state) => this.infiniteScrollState.set(state)
    );
  }

  private handleInfiniteDataRemovedTop(scrollUp = this.infiniteScrollState().scrollUp, scrollDown = this.infiniteScrollState().scrollDown): void {
    this.resetInfiniteScroll(scrollUp, scrollDown);
  }

  private handleInfiniteDataRemovedBottom(scrollUp = this.infiniteScrollState().scrollUp, scrollDown = this.infiniteScrollState().scrollDown): void {
    this.resetInfiniteScroll(scrollUp, scrollDown);
  }

  private setInfiniteScrollDirections(scrollUp: boolean, scrollDown: boolean): void {
    setGridInfiniteScrollDirectionsCommand(
      this.infiniteScrollState(),
      (state) => this.infiniteScrollState.set(state),
      scrollUp,
      scrollDown
    );
  }

  private saveState(): GridSavedState {
    return buildGridSavedState({
      columnOrder: this.columnOrder(),
      activeFilters: this.activeFilters(),
      sortState: this.sortState(),
      groupByColumns: this.groupByColumns(),
      currentPage: this.currentPage(),
      pageSize: this.pageSize(),
      totalItems: this.pipeline().totalItems,
      expandedRows: this.expandedRows(),
      expandedTreeRows: this.expandedTreeRows()
    });
  }

  private restoreState(state: GridSavedState): void {
    restoreGridStateCommand(this.gridApi, state, {
      setColumnOrder: (order) => this.columnOrder.set(order),
      setActiveFilters: (filters) => this.activeFilters.set(filters),
      setSortState: (sortState) => this.sortState.set(sortState),
      setGroupByColumns: (grouping) => this.groupByColumns.set(grouping),
      setCurrentPage: (page) => this.currentPage.set(page),
      setPageSize: (pageSize) => this.pageSize.set(pageSize),
      setExpandedRows: (expandedRows) => this.expandedRows.set(expandedRows),
      setExpandedTreeRows: (expandedRows) => this.expandedTreeRows.set(expandedRows),
      getEffectivePageSize: () => this.effectivePageSize(this.pipeline().totalItems)
    });
  }

}
