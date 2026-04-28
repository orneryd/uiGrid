import { NgTemplateOutlet, isPlatformServer } from '@angular/common';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
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
import { FILTER_CONDITIONS, SORT_DIRECTIONS, SortDirection } from './grid.constants';
import {
  GridBenchmarkResult,
  GridCellEditableContext,
  GridCellPosition,
  GridCellTemplateContext,
  GridColumnDef,
  GridExpandableTemplateContext,
  GridOptions,
  GridRecord,
  GridRow,
  GridSavedState,
  SortState
} from './grid.models';
import { runColumnFilter, setupFilters } from './row-searcher';
import { getSortFn } from './row-sorter';
import { getCellValue, getPathValue, setPathValue, stringifyCellValue, titleize, toCsvValue } from './grid.utils';
import {
  addGridRowInvisibleReason,
  areAllGridRowsExpanded,
  beginGridEditSession,
  buildGridFocusCellResult,
  buildGridSavedState,
  buildGridSortState,
  buildGridPipeline,
  buildGridRows,
  clearGridRowInvisibleReason,
  clearGridEditSession,
  completeInfiniteScrollDataLoad,
  expandAllGridRows,
  expandAllGridTreeRows,
  findGridRowById as coreFindGridRowById,
  findNextGridCell,
  GridInfiniteScrollState,
  getGridTreeRowChildren,
  isPrintableGridKey,
  isGridCellPosition,
  isVirtualizationEnabled as coreIsVirtualizationEnabled,
  getCurrentPageValue as coreGetCurrentPageValue,
  getEffectivePageSize as coreGetEffectivePageSize,
  getFirstRowIndexValue as coreGetFirstRowIndexValue,
  getLastRowIndexValue as coreGetLastRowIndexValue,
  getTotalPagesValue as coreGetTotalPagesValue,
  maybeRequestInfiniteScrollData,
  normalizeGridSavedState,
  parseGridEditedValue,
  resetInfiniteScrollState,
  resolveGridPageSize,
  resolveGridRowId as coreResolveGridRowId,
  saveInfiniteScrollPercentage,
  seekGridPage,
  setGridTreeRowExpanded,
  setInfiniteScrollDirectionsState,
  shouldGridEditOnFocus,
  stringifyGridEditorValue,
  headerLabel as coreHeaderLabel
  , normalizeBooleanMap,
  sanitizeDownloadFilename,
  toggleGridRowExpanded,
  toggleGridTreeRowExpanded
} from './grid.core';
import type { DisplayItem, ExpandableItem, GroupItem, PipelineResult } from './grid.core';

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
      clearGrouping: () => this.groupByColumns.set([]),
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
      this.gridApi.core.raise.renderingComplete(this.gridApi);
    });

    effect(() => {
      const pipeline = this.pipeline();
      this.gridApi.core.raise.rowsRendered(pipeline.visibleRows);
      this.gridApi.core.raise.rowsVisibleChanged(pipeline.visibleRows);

      const newHeight = pipeline.displayItems.length * this.rowSize();
      if (newHeight !== this.lastCanvasHeight) {
        this.gridApi.core.raise.canvasHeightChanged(this.lastCanvasHeight, newHeight);
        this.lastCanvasHeight = newHeight;
      }
    });

    effect((onCleanup) => {
      if (!this.options().enableAutoResize || typeof ResizeObserver === 'undefined') {
        return;
      }

      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) {
          return;
        }

        const nextHeight = Math.round(entry.contentRect.height);
        const nextWidth = Math.round(entry.contentRect.width);
        if (nextHeight === this.lastGridHeight && nextWidth === this.lastGridWidth) {
          return;
        }

        this.gridApi.core.raise.gridDimensionChanged(
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

      observer.observe(this.hostElement.nativeElement);
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
    switch (this.sortDirection(column)) {
      case SORT_DIRECTIONS.asc:
        return 'Asc';
      case SORT_DIRECTIONS.desc:
        return 'Desc';
      default:
        return 'Sort';
    }
  }

  protected groupingButtonLabel(column: GridColumnDef): string {
    return this.isGrouped(column) ? 'Grouped' : 'Group';
  }

  protected filterValue(columnName: string): string {
    return this.activeFilters()[columnName] ?? '';
  }

  protected filterPlaceholder(column: GridColumnDef): string {
    return this.isColumnFilterable(column) ? 'Filter…' : 'Filter disabled';
  }

  protected isFilterInputDisabled(column: GridColumnDef): boolean {
    return !this.isColumnFilterable(column);
  }

  protected groupDisclosureLabel(item: GroupItem): string {
    return item.collapsed ? 'Expand' : 'Collapse';
  }

  protected displayValue(row: GridRow, column: GridColumnDef): string {
    const context = this.cellContext(row, column);
    if (column.cellRenderer) {
      return column.cellRenderer(context);
    }

    return column.formatter
      ? column.formatter(context.value, row.entity)
      : stringifyCellValue(context.value);
  }

  protected isFocusedCell(row: GridRow, column: GridColumnDef): boolean {
    return isGridCellPosition(this.focusedCell(), row.id, column.name);
  }

  protected isEditingCell(row: GridRow, column: GridColumnDef): boolean {
    return isGridCellPosition(this.editingCell(), row.id, column.name);
  }

  protected editorInputType(column: GridColumnDef): string {
    switch (column.type) {
      case 'number':
        return 'number';
      case 'date':
        return 'date';
      default:
        return 'text';
    }
  }

  protected cellTemplate(column: GridColumnDef): TemplateRef<GridCellTemplateContext> | null {
    return column.cellTemplate ?? null;
  }

  protected expandableTemplate(): TemplateRef<GridExpandableTemplateContext> | null {
    return this.options().expandableRowTemplate ?? null;
  }

  protected cellContext(row: GridRow, column: GridColumnDef): GridCellTemplateContext {
    const value = getCellValue(row.entity, column);
    return {
      $implicit: value,
      value,
      row: row.entity,
      column,
      rowIndex: row.index
    };
  }

  protected sortDirection(column: GridColumnDef): SortDirection {
    const sortState = this.sortState();
    return sortState.columnName === column.name ? sortState.direction : SORT_DIRECTIONS.none;
  }

  protected toggleSort(column: GridColumnDef): void {
    if (!this.isColumnSortable(column)) {
      return;
    }

    const currentDirection = this.sortDirection(column);
    const nextDirection =
      currentDirection === SORT_DIRECTIONS.none
        ? SORT_DIRECTIONS.asc
        : currentDirection === SORT_DIRECTIONS.asc
          ? SORT_DIRECTIONS.desc
          : SORT_DIRECTIONS.none;

    this.sortState.set({
      columnName: nextDirection === SORT_DIRECTIONS.none ? null : column.name,
      direction: nextDirection
    });
    this.gridApi.core.raise.sortChanged(
      nextDirection === SORT_DIRECTIONS.none ? null : column.name,
      nextDirection
    );
  }

  protected updateFilter(columnName: string, value: string): void {
    this.activeFilters.update((current) => ({
      ...current,
      [columnName]: value
    }));
    this.gridApi.core.raise.filterChanged(this.activeFilters());
  }

  protected clearAllFilters(): void {
    this.activeFilters.set({});
    this.gridApi.core.raise.filterChanged({});
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
    return column.width ?? 'minmax(11rem, 1fr)';
  }

  protected isColumnSortable(column: GridColumnDef): boolean {
    return this.isSortingEnabled() && column.sortable !== false && column.enableSorting !== false;
  }

  protected isColumnFilterable(column: GridColumnDef): boolean {
    return this.isFilteringEnabled() && column.filterable !== false && column.enableFiltering !== false;
  }

  protected isCellEditable(row: GridRow, column: GridColumnDef, triggerEvent?: Event | KeyboardEvent | null): boolean {
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

  protected isGroupingEnabled(): boolean {
    return this.options().enableGrouping === true && !this.isTreeEnabled();
  }

  protected isTreeEnabled(): boolean {
    return this.options().enableTreeView === true;
  }

  protected canExpandRows(): boolean {
    return this.options().enableExpandable === true && !!this.options().expandableRowTemplate;
  }

  protected isPaginationEnabled(): boolean {
    return this.options().enablePagination === true || (this.options().paginationPageSize ?? 0) > 0;
  }

  protected showPaginationControls(): boolean {
    return this.isPaginationEnabled() && this.options().enablePaginationControls !== false;
  }

  protected isInfiniteScrollEnabled(): boolean {
    return this.options().infiniteScrollRowsFromEnd !== undefined
      || this.options().infiniteScrollUp === true
      || this.options().infiniteScrollDown !== undefined;
  }

  protected isSortingEnabled(): boolean {
    return this.options().enableSorting !== false;
  }

  protected isFilteringEnabled(): boolean {
    return this.options().enableFiltering !== false;
  }

  protected canMoveColumns(): boolean {
    return this.options().enableColumnMoving === true;
  }

  protected isPrimaryColumn(column: GridColumnDef): boolean {
    return this.visibleColumns()[0]?.name === column.name;
  }

  protected showTreeToggle(row: GridRow, column: GridColumnDef): boolean {
    return this.isPrimaryColumn(column)
      && this.isTreeEnabled()
      && (row.hasChildren || this.options().showTreeExpandNoChildren !== false);
  }

  protected showExpandToggle(row: GridRow, column: GridColumnDef): boolean {
    return this.isPrimaryColumn(column) && this.canExpandRows();
  }

  protected cellIndent(row: GridRow, column: GridColumnDef): string {
    if (!this.isPrimaryColumn(column) || !this.isTreeEnabled()) {
      return '0px';
    }

    return `${row.treeLevel * (this.options().treeIndent ?? 10)}px`;
  }

  protected treeToggleLabel(row: GridRow): string {
    return this.expandedTreeRows()[row.id] ? 'Collapse' : 'Expand';
  }

  protected treeToggleSymbol(row: GridRow): string {
    return this.expandedTreeRows()[row.id] ? '−' : '+';
  }

  protected expandToggleLabel(row: GridRow): string {
    return row.expanded ? 'Collapse detail' : 'Expand detail';
  }

  protected expandToggleSymbol(row: GridRow): string {
    return row.expanded ? '▾' : '▸';
  }

  protected isGrouped(column: GridColumnDef): boolean {
    return this.groupByColumns().includes(column.name);
  }

  protected toggleGrouping(column: GridColumnDef, event?: Event): void {
    event?.stopPropagation();
    this.toggleGroupingByName(column.name);
  }

  private toggleGroupingByName(columnName: string): void {
    if (!this.isGroupingEnabled()) {
      return;
    }

    this.groupByColumns.update((current) =>
      current.includes(columnName)
        ? current.filter((name) => name !== columnName)
        : [...current, columnName]
    );
    this.gridApi.core.raise.groupingChanged(this.groupByColumns());
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
    if (!this.canMoveColumns()) {
      return;
    }

    this.columnOrder.update((current) => {
      const next = [...current];
      moveItemInArray(next, fromIndex, toIndex);
      this.gridApi.core.raise.columnOrderChanged(next);
      return next;
    });
  }

  private moveVisibleColumn(columnName: string, targetColumnName: string): void {
    if (!this.canMoveColumns()) {
      return;
    }

    const currentOrder = this.columnOrder();
    const visibleNames = new Set(this.visibleColumns().map((column) => column.name));
    const visibleOrder = currentOrder.filter((name) => visibleNames.has(name));
    const fromIndex = visibleOrder.indexOf(columnName);
    const toIndex = visibleOrder.indexOf(targetColumnName);

    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      return;
    }

    moveItemInArray(visibleOrder, fromIndex, toIndex);

    const nextOrder: string[] = [];
    let visibleCursor = 0;

    for (const name of currentOrder) {
      if (visibleNames.has(name)) {
        nextOrder.push(visibleOrder[visibleCursor++] ?? name);
      } else {
        nextOrder.push(name);
      }
    }

    this.columnOrder.set(nextOrder);
    this.gridApi.core.raise.columnOrderChanged(nextOrder);
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
      this.gridApi.core.raise.scrollBegin();
    }

    if (this.scrollEndHandle) {
      window.clearTimeout(this.scrollEndHandle);
    }

    this.scrollEndHandle = window.setTimeout(() => {
      this.scrolling = false;
      this.gridApi.core.raise.scrollEnd();
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
    this.gridApi.core.raise.benchmarkComplete(result);
    return result;
  }

  protected exportCsv(): void {
    const columns = this.visibleColumns();
    const header = columns.map((column) => toCsvValue(this.headerLabel(column))).join(',');
    const rows = this.pipeline().visibleRows.map((row) =>
      columns.map((column) => toCsvValue(this.displayValue(row, column))).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeDownloadFilename(this.options().id)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
    const nextEditSession = beginGridEditSession(
      row.id,
      column.name,
      initialValue ?? stringifyGridEditorValue(currentValue)
    );
    this.focusedCell.set(nextEditSession.focusedCell);
    this.editingCell.set(nextEditSession.editingCell);
    this.editingValue.set(nextEditSession.editingValue);
    this.gridApi.edit.raise.beginCellEdit(row.entity, column, triggerEvent);
    queueMicrotask(() => this.focusEditorInput(focusToken));
  }

  private commitCellEdit(direction?: 'left' | 'right' | 'up' | 'down', restoreFocus = true): void {
    const editingCell = this.editingCell();
    if (!editingCell) {
      return;
    }

    const row = this.findRowById(editingCell.rowId);
    const column = this.visibleColumns().find((candidate) => candidate.name === editingCell.columnName);
    if (!row || !column) {
      this.editingCell.set(null);
      return;
    }

    const oldValue = getCellValue(row.entity, column);
    const newValue = parseGridEditedValue(column, this.editingValue(), oldValue);
    this.setCellValue(row.entity, column, newValue);
    const clearedEditSession = clearGridEditSession();
    this.editingCell.set(clearedEditSession.editingCell);
    this.editorFocusToken += 1;
    this.gridApi.edit.raise.afterCellEdit(row.entity, column, newValue, oldValue);

    this.editingValue.set(clearedEditSession.editingValue);

    if (direction) {
      const moved = this.moveFocus(row, column, direction);
      if (!moved) {
        this.focusRenderedCell({ rowId: row.id, columnName: column.name });
      }
    } else if (restoreFocus) {
      this.focusRenderedCell({ rowId: row.id, columnName: column.name });
    }
  }

  private cancelCellEdit(): void {
    const editingCell = this.editingCell();
    if (!editingCell) {
      return;
    }

    const row = this.findRowById(editingCell.rowId);
    const column = this.visibleColumns().find((candidate) => candidate.name === editingCell.columnName);
    const clearedEditSession = clearGridEditSession();
    this.editingCell.set(clearedEditSession.editingCell);
    this.editingValue.set(clearedEditSession.editingValue);
    this.editorFocusToken += 1;
    if (row && column) {
      this.gridApi.edit.raise.cancelCellEdit(row.entity, column);
      this.focusRenderedCell(editingCell);
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
    const focusCell = (retry = true): void => {
      if (focusToken !== this.renderedCellFocusToken) {
        return;
      }

      const shadowRoot = this.hostElement.nativeElement.shadowRoot;
      const selector = `.body-cell[data-row-id="${position.rowId}"][data-col-name="${position.columnName}"]`;
      const target = shadowRoot?.querySelector(selector) as HTMLElement | null;
      if (!target) {
        if (retry) {
          requestAnimationFrame(() => focusCell(false));
        }
        return;
      }

      target.focus();
      if (retry && shadowRoot?.activeElement !== target) {
        requestAnimationFrame(() => focusCell(false));
      }
    };

    queueMicrotask(() => focusCell(true));
  }

  private focusEditorInput(focusToken: number, retry = true): void {
    if (focusToken !== this.editorFocusToken) {
      return;
    }

    const editingCell = this.editingCell();
    if (!editingCell) {
      return;
    }

    const shadowRoot = this.hostElement.nativeElement.shadowRoot;
    const selector = `.cell-editor[data-row-id="${editingCell.rowId}"][data-col-name="${editingCell.columnName}"]`;
    const input = shadowRoot?.querySelector(selector) as HTMLInputElement | null;
    if (!input && retry) {
      requestAnimationFrame(() => this.focusEditorInput(focusToken, false));
      return;
    }

    input?.focus();
    input?.select();
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
    const nextPage = seekGridPage(page, this.getTotalPagesValue());
    this.currentPage.set(nextPage);
    this.gridApi.pagination.raise.paginationChanged(nextPage, this.effectivePageSize(this.pipeline().totalItems));
  }

  private setPaginationPageSize(pageSize: number): void {
    const nextPageSize = resolveGridPageSize(pageSize);
    if (nextPageSize === null) {
      return;
    }

    this.pageSize.set(nextPageSize);
    this.currentPage.set(1);
    this.gridApi.pagination.raise.paginationChanged(1, nextPageSize);
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
    if (!this.canExpandRows()) {
      return;
    }

    const rowId = this.resolveRowId(row);
    const { expanded, nextExpandedRows } = toggleGridRowExpanded(this.expandedRows(), rowId);
    this.expandedRows.set(nextExpandedRows);

    const gridRow = this.findRowById(rowId);
    if (gridRow) {
      gridRow.expanded = expanded;
      this.gridApi.expandable.raise.rowExpandedStateChanged(gridRow, expanded);
    }
  }

  protected toggleRowExpansion(row: GridRow, event?: Event): void {
    event?.stopPropagation();
    this.toggleRowExpansionByRef(row);
  }

  private expandAllRows(): void {
    if (!this.canExpandRows()) {
      return;
    }

    this.expandedRows.set(expandAllGridRows(this.buildRows(this.options().data)));
  }

  private collapseAllRows(): void {
    this.expandedRows.set({});
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
    const { expanded, nextExpandedTreeRows } = toggleGridTreeRowExpanded(this.expandedTreeRows(), rowId);
    this.expandedTreeRows.set(nextExpandedTreeRows);

    const gridRow = this.findRowById(rowId);
    if (gridRow) {
      if (expanded) {
        this.gridApi.treeBase.raise.rowExpanded(gridRow);
      } else {
        this.gridApi.treeBase.raise.rowCollapsed(gridRow);
      }
    }
  }

  private expandTreeRowByRef(row: GridRow | GridRecord | string): void {
    const rowId = this.resolveRowId(row);
    this.expandedTreeRows.set(setGridTreeRowExpanded(this.expandedTreeRows(), rowId, true));
    const gridRow = this.findRowById(rowId);
    if (gridRow) {
      this.gridApi.treeBase.raise.rowExpanded(gridRow);
    }
  }

  private collapseTreeRowByRef(row: GridRow | GridRecord | string): void {
    const rowId = this.resolveRowId(row);
    this.expandedTreeRows.set(setGridTreeRowExpanded(this.expandedTreeRows(), rowId, false));
    const gridRow = this.findRowById(rowId);
    if (gridRow) {
      this.gridApi.treeBase.raise.rowCollapsed(gridRow);
    }
  }

  private expandAllTreeRows(): void {
    this.expandedTreeRows.set(expandAllGridTreeRows(this.buildRows(this.options().data)));
  }

  private collapseAllTreeRows(): void {
    this.expandedTreeRows.set({});
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
    const nextSortState = buildGridSortState(columnName, direction);
    this.sortState.set(nextSortState);
    this.gridApi.core.raise.sortChanged(nextSortState.columnName!, nextSortState.direction);
  }

  private maybeRequestMoreData(startIndex: number): void {
    if (!this.isInfiniteScrollEnabled() || !this.virtualizationEnabled()) {
      return;
    }

    const visibleRows = this.pipeline().visibleRows.length;
    const viewportRows = Math.max(1, Math.ceil((this.options().viewportHeight ?? this.autoViewportHeight() ?? 560) / this.rowSize()));
    const threshold = this.options().infiniteScrollRowsFromEnd ?? 20;
    const { request, nextState } = maybeRequestInfiniteScrollData({
      state: this.infiniteScrollState(),
      startIndex,
      visibleRows,
      viewportRows,
      threshold
    });

    if (request === 'top') {
      this.infiniteScrollState.set(nextState);
      this.gridApi.infiniteScroll.raise.needLoadMoreDataTop();
      return;
    }

    if (request === 'bottom') {
      this.infiniteScrollState.set(nextState);
      this.gridApi.infiniteScroll.raise.needLoadMoreData();
    }
  }

  private infiniteScrollDataLoaded(scrollUp = this.infiniteScrollState().scrollUp, scrollDown = this.infiniteScrollState().scrollDown): Promise<void> {
    this.infiniteScrollState.set(completeInfiniteScrollDataLoad(this.infiniteScrollState(), scrollUp, scrollDown));
    return Promise.resolve();
  }

  private resetInfiniteScroll(scrollUp = this.infiniteScrollState().scrollUp, scrollDown = this.infiniteScrollState().scrollDown): void {
    this.infiniteScrollState.set(resetInfiniteScrollState(scrollUp, scrollDown));
  }

  private saveScrollPercentage(): void {
    this.infiniteScrollState.set(saveInfiniteScrollPercentage(this.infiniteScrollState(), this.pipeline().visibleRows.length));
  }

  private handleInfiniteDataRemovedTop(scrollUp = this.infiniteScrollState().scrollUp, scrollDown = this.infiniteScrollState().scrollDown): void {
    this.resetInfiniteScroll(scrollUp, scrollDown);
  }

  private handleInfiniteDataRemovedBottom(scrollUp = this.infiniteScrollState().scrollUp, scrollDown = this.infiniteScrollState().scrollDown): void {
    this.resetInfiniteScroll(scrollUp, scrollDown);
  }

  private setInfiniteScrollDirections(scrollUp: boolean, scrollDown: boolean): void {
    this.infiniteScrollState.set(setInfiniteScrollDirectionsState(this.infiniteScrollState(), scrollUp, scrollDown));
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
    const normalizedState = normalizeGridSavedState(state);

    if (normalizedState.columnOrder) {
      this.columnOrder.set(normalizedState.columnOrder);
    }

    if (normalizedState.filters) {
      this.activeFilters.set(normalizedState.filters);
      this.gridApi.core.raise.filterChanged(this.activeFilters());
    }

    if (normalizedState.sort) {
      this.sortState.set(normalizedState.sort);
    }

    if (normalizedState.grouping) {
      this.groupByColumns.set(normalizedState.grouping);
      this.gridApi.core.raise.groupingChanged(this.groupByColumns());
    }

    if (normalizedState.pagination) {
      this.currentPage.set(normalizedState.pagination.paginationCurrentPage);
      this.pageSize.set(normalizedState.pagination.paginationPageSize);

      this.gridApi.pagination.raise.paginationChanged(
        this.getCurrentPageValue(),
        this.effectivePageSize(this.pipeline().totalItems)
      );
    }

    if (normalizedState.expandable) {
      this.expandedRows.set(normalizedState.expandable);
    }

    if (normalizedState.treeView) {
      this.expandedTreeRows.set(normalizedState.treeView);
    }
  }

}
