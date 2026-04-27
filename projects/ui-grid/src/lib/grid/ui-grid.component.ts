import { NgTemplateOutlet } from '@angular/common';
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

interface GroupItem {
  kind: 'group';
  id: string;
  depth: number;
  field: string;
  label: string;
  count: number;
  collapsed: boolean;
}

interface RowItem {
  kind: 'row';
  id: string;
  row: GridRow;
}

interface ExpandableItem {
  kind: 'expandable';
  id: string;
  row: GridRow;
}

type DisplayItem = GroupItem | RowItem | ExpandableItem;

interface PipelineResult {
  visibleRows: GridRow[];
  displayItems: DisplayItem[];
  virtualizationEnabled: boolean;
  pipelineMs: number;
  totalItems: number;
}

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
  protected readonly infiniteScrollState = signal({
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
  protected readonly pipelineMs = computed(() => this.pipeline().pipelineMs);
  protected readonly virtualizationEnabled = computed(() => this.pipeline().virtualizationEnabled);
  protected readonly paginationCurrentPage = computed(() => this.getCurrentPageValue());
  protected readonly paginationTotalPages = computed(() => this.getTotalPagesValue());
  protected readonly paginationSelectedPageSize = computed(() => this.effectivePageSize(this.pipeline().totalItems));

  private buildPipeline(): PipelineResult {
    const startedAt = performance.now();
    const options = this.options();
    const rows = this.buildRows(options.data);
    const columns = this.visibleColumns();

    const visibleRows = this.isTreeEnabled()
      ? this.filterAndFlattenTreeRows(rows, columns)
      : this.sortRows(rows.filter((row) => this.matchesFilters(row, columns)), columns);
    const totalItems = options.useExternalPagination === true
      ? options.totalItems ?? visibleRows.length
      : visibleRows.length;
    const pagedRows = this.paginateRows(visibleRows, totalItems);
    const displayItems = this.buildDisplayItems(pagedRows);
    const virtualizationEnabled = this.isVirtualizationEnabled(displayItems.length);

    return {
      visibleRows: pagedRows,
      displayItems,
      virtualizationEnabled,
      pipelineMs: performance.now() - startedAt,
      totalItems
    };
  }

  private buildRows(data: readonly GridRecord[]): GridRow[] {
    const rows: GridRow[] = [];
    let nextIndex = 0;

    const visit = (entities: readonly GridRecord[], treeLevel: number, parentId: string | null): void => {
      for (const entity of entities) {
        const childEntities = this.getTreeChildren(entity);
        const row = this.createRow(entity, nextIndex, treeLevel, parentId, childEntities.length);
        nextIndex += 1;
        rows.push(row);

        if (this.isTreeEnabled() && childEntities.length > 0) {
          visit(childEntities, treeLevel + 1, row.id);
        }
      }
    };

    visit(data, 0, null);
    return rows;
  }

  private createRow(
    entity: GridRecord,
    index: number,
    treeLevel = 0,
    parentId: string | null = null,
    childCount = 0
  ): GridRow {
    const rowIdentity = this.options().rowIdentity?.(entity, index) ?? `${this.options().id}-${index}`;
    const row = new GridRow(rowIdentity, entity, index, this.rowSize());
    const hiddenReasons = this.hiddenRowReasons()[row.id] ?? [];

    row.treeLevel = treeLevel;
    row.parentId = parentId;
    row.childCount = childCount;
    row.hasChildren = childCount > 0;
    row.expanded = this.isRowExpanded(row.id);
    row.expandedRowHeight = this.options().expandableRowHeight ?? 150;

    for (const reason of hiddenReasons) {
      row.setThisRowInvisible(reason);
    }

    return row;
  }

  private getTreeChildren(entity: GridRecord): GridRecord[] {
    if (!this.isTreeEnabled()) {
      return [];
    }

    const treeChildren = getPathValue(entity, this.options().treeChildrenField ?? 'children');
    return Array.isArray(treeChildren) ? treeChildren as GridRecord[] : [];
  }

  private filterAndFlattenTreeRows(rows: readonly GridRow[], columns: readonly GridColumnDef[]): GridRow[] {
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
      const selfIncluded = this.matchesFilters(row, columns);

      if (childIncluded) {
        this.clearFilterReasons(row);
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
      const siblings = this.sortRows((rowsByParent.get(parentId) ?? []).filter((row) => included.has(row.id)), columns);
      for (const row of siblings) {
        flattened.push(row);
        if (row.hasChildren && this.expandedTreeRows()[row.id]) {
          flatten(row.id);
        }
      }
    };

    flatten(null);
    return flattened;
  }

  private clearFilterReasons(row: GridRow): void {
    for (const reason of [...row.invisibleReasons]) {
      if (reason.startsWith('filter:')) {
        row.clearThisRowInvisible(reason);
      }
    }
  }

  private matchesFilters(row: GridRow, columns: readonly GridColumnDef[]): boolean {
    if (!this.isFilteringEnabled()) {
      return row.visible;
    }

    const filters = this.activeFilters();
    for (const column of columns) {
      const term = filters[column.name]?.trim();
      if (!term || !this.isColumnFilterable(column)) {
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

  private sortRows(rows: readonly GridRow[], columns: readonly GridColumnDef[]): GridRow[] {
    const sortState = this.sortState();
    if (!sortState.columnName || sortState.direction === SORT_DIRECTIONS.none || !this.isSortingEnabled()) {
      return [...rows];
    }

    const sortColumn = columns.find((column) => column.name === sortState.columnName);
    if (!sortColumn || !this.isColumnSortable(sortColumn)) {
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

  private buildDisplayItems(rows: readonly GridRow[]): DisplayItem[] {
    if (this.isTreeEnabled()) {
      return this.buildRowDisplayItems(rows);
    }

    if (!this.isGroupingEnabled() || this.groupByColumns().length === 0) {
      return this.buildRowDisplayItems(rows);
    }

    return this.buildGroupedItems(rows, this.groupByColumns(), 0, '');
  }

  private buildRowDisplayItems(rows: readonly GridRow[]): DisplayItem[] {
    const items: DisplayItem[] = [];
    for (const row of rows) {
      items.push({ kind: 'row', id: row.id, row });
      if (row.expanded && this.canExpandRows()) {
        items.push({ kind: 'expandable', id: `${row.id}:expandable`, row });
      }
    }

    return items;
  }

  private buildGroupedItems(
    rows: readonly GridRow[],
    groupBy: readonly string[],
    depth: number,
    path: string
  ): DisplayItem[] {
    if (groupBy.length === 0) {
      return this.buildRowDisplayItems(rows);
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

    const collapsedGroups = this.collapsedGroups();
    const items: DisplayItem[] = [];
    for (const [label, groupedRows] of groups) {
      const groupId = `${path}${currentField}:${label}`;
      const collapsed = collapsedGroups[groupId] ?? this.options().grouping?.startCollapsed ?? false;
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
        items.push(...this.buildGroupedItems(groupedRows, rest, depth + 1, `${groupId}|`));
      }
    }

    return items;
  }

  protected headerLabel(column: GridColumnDef): string {
    return column.displayName ?? titleize(column.name);
  }

  protected isGroupItem(item: DisplayItem): item is GroupItem {
    return item.kind === 'group';
  }

  protected isExpandableItem(item: DisplayItem): item is ExpandableItem {
    return item.kind === 'expandable';
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
    const focusedCell = this.focusedCell();
    return focusedCell?.rowId === row.id && focusedCell.columnName === column.name;
  }

  protected isEditingCell(row: GridRow, column: GridColumnDef): boolean {
    const editingCell = this.editingCell();
    return editingCell?.rowId === row.id && editingCell.columnName === column.name;
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
    const nextFocusedCell = { rowId: row.id, columnName: column.name };
    const currentFocusedCell = this.focusedCell();
    this.focusedCell.set(nextFocusedCell);

    if (
      this.shouldEditOnFocus(column)
      && this.isCellEditable(row, column, triggerEvent)
      && (currentFocusedCell?.rowId !== row.id || currentFocusedCell.columnName !== column.name)
      && !this.isEditingCell(row, column)
    ) {
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
    link.download = `${this.options().id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private refresh(): void {
    this.activeFilters.update((current) => ({ ...current }));
  }

  private isPrintableKey(event: KeyboardEvent): boolean {
    return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
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
    this.focusedCell.set({ rowId: row.id, columnName: column.name });
    this.editingCell.set({ rowId: row.id, columnName: column.name });
    this.editingValue.set(initialValue ?? this.stringifyEditorValue(currentValue));
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
    const newValue = this.parseEditedValue(column, this.editingValue(), oldValue);
    this.setCellValue(row.entity, column, newValue);
    this.editingCell.set(null);
    this.editorFocusToken += 1;
    this.gridApi.edit.raise.afterCellEdit(row.entity, column, newValue, oldValue);

    this.editingValue.set('');

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
    this.editingCell.set(null);
    this.editingValue.set('');
    this.editorFocusToken += 1;
    if (row && column) {
      this.gridApi.edit.raise.cancelCellEdit(row.entity, column);
      this.focusRenderedCell(editingCell);
    }
  }

  private stringifyEditorValue(value: unknown): string {
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    return value === null || value === undefined ? '' : String(value);
  }

  private parseEditedValue(column: GridColumnDef, value: string, oldValue: unknown): unknown {
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
    const rows = this.pipeline().visibleRows;
    const columns = this.visibleColumns();
    const rowIndex = rows.findIndex((candidate) => candidate.id === row.id);
    const columnIndex = columns.findIndex((candidate) => candidate.name === column.name);
    if (rowIndex === -1 || columnIndex === -1) {
      return false;
    }

    let nextRowIndex = rowIndex;
    let nextColumnIndex = columnIndex;

    while (true) {
      switch (direction) {
        case 'left':
          nextColumnIndex -= 1;
          if (nextColumnIndex < 0) {
            nextRowIndex -= 1;
            nextColumnIndex = columns.length - 1;
          }
          break;
        case 'right':
          nextColumnIndex += 1;
          if (nextColumnIndex >= columns.length) {
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
        || nextRowIndex >= rows.length
        || nextColumnIndex < 0
        || nextColumnIndex >= columns.length
      ) {
        return false;
      }

      const nextRow = rows[nextRowIndex];
      const nextColumn = columns[nextColumnIndex];
      if (!nextRow || !nextColumn) {
        return false;
      }

      if (!editableOnly || this.isCellEditable(nextRow, nextColumn, triggerEvent)) {
        this.focusedCell.set({ rowId: nextRow.id, columnName: nextColumn.name });
        this.focusRenderedCell({ rowId: nextRow.id, columnName: nextColumn.name });

        if (this.shouldEditOnFocus(nextColumn) && this.isCellEditable(nextRow, nextColumn, triggerEvent)) {
          this.startCellEdit(nextRow, nextColumn, triggerEvent);
        }

        return true;
      }
    }
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
    if (options.paginationPageSize) {
      return options.paginationPageSize;
    }

    if (options.paginationPageSizes && options.paginationPageSizes.length > 0) {
      return options.paginationPageSizes[0];
    }

    return options.data.length;
  }

  private effectivePageSize(totalItems: number): number {
    if (!this.isPaginationEnabled()) {
      return totalItems;
    }

    const pageSize = this.pageSize() || this.initialPageSize(this.options());
    return pageSize > 0 ? pageSize : totalItems;
  }

  private getCurrentPageValue(totalItems = this.pipeline().totalItems): number {
    const totalPages = this.getTotalPagesValue(totalItems);
    return Math.min(Math.max(this.currentPage(), 1), totalPages);
  }

  private getTotalPagesValue(totalItems = this.pipeline().totalItems): number {
    if (!this.isPaginationEnabled() || this.effectivePageSize(totalItems) <= 0) {
      return 1;
    }

    return Math.max(1, Math.ceil(totalItems / this.effectivePageSize(totalItems)));
  }

  private getFirstRowIndexValue(totalItems = this.pipeline().totalItems): number {
    if (!this.isPaginationEnabled() || totalItems === 0 || this.options().useExternalPagination === true) {
      return 0;
    }

    return (this.getCurrentPageValue(totalItems) - 1) * this.effectivePageSize(totalItems);
  }

  private getLastRowIndexValue(totalItems = this.pipeline().totalItems): number {
    if (totalItems === 0) {
      return 0;
    }

    if (!this.isPaginationEnabled() || this.options().useExternalPagination === true) {
      return totalItems - 1;
    }

    return Math.min(this.getFirstRowIndexValue(totalItems) + this.effectivePageSize(totalItems), totalItems) - 1;
  }

  private paginateRows(rows: readonly GridRow[], totalItems: number): GridRow[] {
    if (!this.isPaginationEnabled() || this.options().useExternalPagination === true) {
      return [...rows];
    }

    const pageSize = this.effectivePageSize(totalItems);
    const firstRow = this.getFirstRowIndexValue(totalItems);
    return [...rows].slice(firstRow, firstRow + pageSize);
  }

  private seekPage(page: number): void {
    const nextPage = Math.min(Math.max(page, 1), this.getTotalPagesValue());
    this.currentPage.set(nextPage);
    this.gridApi.pagination.raise.paginationChanged(nextPage, this.effectivePageSize(this.pipeline().totalItems));
  }

  private setPaginationPageSize(pageSize: number): void {
    if (!Number.isFinite(pageSize) || pageSize <= 0) {
      return;
    }

    this.pageSize.set(pageSize);
    this.currentPage.set(1);
    this.gridApi.pagination.raise.paginationChanged(1, pageSize);
  }

  private resolveRowId(row: GridRow | GridRecord | string): string {
    if (typeof row === 'string') {
      return row;
    }

    if (row instanceof GridRow) {
      return row.id;
    }

    const index = this.options().data.indexOf(row);
    return this.options().rowIdentity?.(row, index) ?? `${this.options().id}-${index}`;
  }

  private findRowById(rowId: string): GridRow | null {
    return this.buildRows(this.options().data).find((row) => row.id === rowId) ?? null;
  }

  private isRowExpanded(rowId: string): boolean {
    return this.expandedRows()[rowId] === true;
  }

  private toggleRowExpansionByRef(row: GridRow | GridRecord | string): void {
    if (!this.canExpandRows()) {
      return;
    }

    const rowId = this.resolveRowId(row);
    const expanded = !this.expandedRows()[rowId];
    this.expandedRows.update((current) => ({
      ...current,
      [rowId]: expanded
    }));

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

    const nextState: Record<string, boolean> = {};
    for (const row of this.buildRows(this.options().data)) {
      nextState[row.id] = true;
    }
    this.expandedRows.set(nextState);
  }

  private collapseAllRows(): void {
    this.expandedRows.set({});
  }

  private toggleAllRows(): void {
    const allExpanded = this.buildRows(this.options().data).every((row) => this.expandedRows()[row.id] === true);
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
    const nextExpanded = !this.expandedTreeRows()[rowId];
    this.expandedTreeRows.update((current) => ({
      ...current,
      [rowId]: nextExpanded
    }));

    const gridRow = this.findRowById(rowId);
    if (gridRow) {
      if (nextExpanded) {
        this.gridApi.treeBase.raise.rowExpanded(gridRow);
      } else {
        this.gridApi.treeBase.raise.rowCollapsed(gridRow);
      }
    }
  }

  private expandTreeRowByRef(row: GridRow | GridRecord | string): void {
    const rowId = this.resolveRowId(row);
    this.expandedTreeRows.update((current) => ({ ...current, [rowId]: true }));
    const gridRow = this.findRowById(rowId);
    if (gridRow) {
      this.gridApi.treeBase.raise.rowExpanded(gridRow);
    }
  }

  private collapseTreeRowByRef(row: GridRow | GridRecord | string): void {
    const rowId = this.resolveRowId(row);
    this.expandedTreeRows.update((current) => ({ ...current, [rowId]: false }));
    const gridRow = this.findRowById(rowId);
    if (gridRow) {
      this.gridApi.treeBase.raise.rowCollapsed(gridRow);
    }
  }

  private expandAllTreeRows(): void {
    const nextState: Record<string, boolean> = {};
    for (const row of this.buildRows(this.options().data)) {
      if (row.hasChildren) {
        nextState[row.id] = true;
      }
    }
    this.expandedTreeRows.set(nextState);
  }

  private collapseAllTreeRows(): void {
    this.expandedTreeRows.set({});
  }

  private getTreeRowChildren(row: GridRow | GridRecord | string): GridRow[] {
    const rowId = this.resolveRowId(row);
    return this.buildRows(this.options().data).filter((candidate) => candidate.parentId === rowId);
  }

  private setRowInvisible(row: GridRow | GridRecord | string, reason = 'user'): void {
    const rowId = this.resolveRowId(row);
    this.hiddenRowReasons.update((current) => {
      const reasons = new Set(current[rowId] ?? []);
      reasons.add(reason);
      return { ...current, [rowId]: [...reasons] };
    });
  }

  private clearRowInvisible(row: GridRow | GridRecord | string, reason = 'user'): void {
    const rowId = this.resolveRowId(row);
    this.hiddenRowReasons.update((current) => {
      const reasons = new Set(current[rowId] ?? []);
      reasons.delete(reason);
      const next = { ...current };
      if (reasons.size === 0) {
        delete next[rowId];
      } else {
        next[rowId] = [...reasons];
      }
      return next;
    });
  }

  private sortColumn(columnName: string, direction?: SortDirection): void {
    const nextDirection = direction ?? SORT_DIRECTIONS.asc;
    this.sortState.set({ columnName, direction: nextDirection });
    this.gridApi.core.raise.sortChanged(columnName, nextDirection);
  }

  private maybeRequestMoreData(startIndex: number): void {
    if (!this.isInfiniteScrollEnabled() || !this.virtualizationEnabled()) {
      return;
    }

    const state = this.infiniteScrollState();
    if (state.dataLoading) {
      return;
    }

    const visibleRows = this.pipeline().visibleRows.length;
    const viewportRows = Math.max(1, Math.ceil((this.options().viewportHeight ?? this.autoViewportHeight() ?? 560) / this.rowSize()));
    const threshold = this.options().infiniteScrollRowsFromEnd ?? 20;

    if (state.scrollUp && startIndex <= threshold) {
      this.infiniteScrollState.update((current) => ({
        ...current,
        dataLoading: true,
        previousVisibleRows: visibleRows
      }));
      this.gridApi.infiniteScroll.raise.needLoadMoreDataTop();
      return;
    }

    if (state.scrollDown && startIndex + viewportRows >= Math.max(visibleRows - threshold, 0)) {
      this.infiniteScrollState.update((current) => ({
        ...current,
        dataLoading: true,
        previousVisibleRows: visibleRows
      }));
      this.gridApi.infiniteScroll.raise.needLoadMoreData();
    }
  }

  private infiniteScrollDataLoaded(scrollUp = this.infiniteScrollState().scrollUp, scrollDown = this.infiniteScrollState().scrollDown): Promise<void> {
    this.infiniteScrollState.update((current) => ({
      ...current,
      scrollUp,
      scrollDown,
      dataLoading: false
    }));
    return Promise.resolve();
  }

  private resetInfiniteScroll(scrollUp = this.infiniteScrollState().scrollUp, scrollDown = this.infiniteScrollState().scrollDown): void {
    this.infiniteScrollState.set({
      scrollUp,
      scrollDown,
      dataLoading: false,
      previousVisibleRows: 0
    });
  }

  private saveScrollPercentage(): void {
    this.infiniteScrollState.update((current) => ({
      ...current,
      previousVisibleRows: this.pipeline().visibleRows.length
    }));
  }

  private handleInfiniteDataRemovedTop(scrollUp = this.infiniteScrollState().scrollUp, scrollDown = this.infiniteScrollState().scrollDown): void {
    this.resetInfiniteScroll(scrollUp, scrollDown);
  }

  private handleInfiniteDataRemovedBottom(scrollUp = this.infiniteScrollState().scrollUp, scrollDown = this.infiniteScrollState().scrollDown): void {
    this.resetInfiniteScroll(scrollUp, scrollDown);
  }

  private setInfiniteScrollDirections(scrollUp: boolean, scrollDown: boolean): void {
    this.infiniteScrollState.update((current) => ({
      ...current,
      scrollUp,
      scrollDown
    }));
  }

  private saveState(): GridSavedState {
    return {
      columnOrder: [...this.columnOrder()],
      filters: { ...this.activeFilters() },
      sort: { ...this.sortState() },
      grouping: [...this.groupByColumns()],
      pagination: {
        paginationCurrentPage: this.getCurrentPageValue(),
        paginationPageSize: this.effectivePageSize(this.pipeline().totalItems)
      },
      expandable: { ...this.expandedRows() },
      treeView: { ...this.expandedTreeRows() }
    };
  }

  private restoreState(state: GridSavedState): void {
    if (state.columnOrder) {
      this.columnOrder.set([...state.columnOrder]);
    }

    if (state.filters) {
      this.activeFilters.set({ ...state.filters });
      this.gridApi.core.raise.filterChanged(this.activeFilters());
    }

    if (state.sort) {
      this.sortState.set({ ...state.sort });
    }

    if (state.grouping) {
      this.groupByColumns.set([...state.grouping]);
      this.gridApi.core.raise.groupingChanged(this.groupByColumns());
    }

    if (state.pagination) {
      this.pageSize.set(state.pagination.paginationPageSize);
      this.currentPage.set(state.pagination.paginationCurrentPage);
      this.gridApi.pagination.raise.paginationChanged(
        state.pagination.paginationCurrentPage,
        state.pagination.paginationPageSize
      );
    }

    if (state.expandable) {
      this.expandedRows.set({ ...state.expandable });
    }

    if (state.treeView) {
      this.expandedTreeRows.set({ ...state.treeView });
    }
  }

  private isVirtualizationEnabled(itemCount: number): boolean {
    return this.options().enableVirtualization !== false
      && itemCount >= (this.options().virtualizationThreshold ?? 40);
  }
}
