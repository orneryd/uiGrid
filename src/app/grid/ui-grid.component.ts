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
  TemplateRef,
  ViewEncapsulation,
  computed,
  effect,
  input,
  signal
} from '@angular/core';
import { createGridApi, UiGridApi } from './grid.api';
import { FILTER_CONDITIONS, SORT_DIRECTIONS, SortDirection } from './grid.constants';
import {
  GridBenchmarkResult,
  GridCellTemplateContext,
  GridColumnDef,
  GridOptions,
  GridRecord,
  GridRow,
  SortState
} from './grid.models';
import { runColumnFilter, setupFilters } from './row-searcher';
import { getSortFn } from './row-sorter';
import { getCellValue, getPathValue, stringifyCellValue, titleize, toCsvValue } from './grid.utils';

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

type DisplayItem = GroupItem | RowItem;

interface PipelineResult {
  visibleRows: GridRow[];
  displayItems: DisplayItem[];
  virtualizationEnabled: boolean;
  pipelineMs: number;
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

  protected readonly activeFilters = signal<Record<string, string>>({});
  protected readonly groupByColumns = signal<string[]>([]);
  protected readonly collapsedGroups = signal<Record<string, boolean>>({});
  protected readonly columnOrder = signal<string[]>([]);
  protected readonly hiddenRowReasons = signal<Record<string, string[]>>({});
  protected readonly benchmarkResult = signal<GridBenchmarkResult | null>(null);
  protected readonly sortState = signal<SortState>({
    columnName: null,
    direction: SORT_DIRECTIONS.none
  });
  protected readonly gridApi: UiGridApi;

  private initializedGridId: string | null = null;
  private lastCanvasHeight = 0;
  private scrollEndHandle?: number;
  private scrolling = false;

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
      exportCsv: () => this.exportCsv()
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
      this.columnOrder.set(options.columnDefs.map((column) => column.name));
      this.groupByColumns.set(options.grouping?.groupBy ?? []);
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
  protected readonly totalRows = computed(() => this.options().data.length);
  protected readonly visibleRowCount = computed(() => this.pipeline().visibleRows.length);
  protected readonly displayItems = computed(() => this.pipeline().displayItems);
  protected readonly pipelineMs = computed(() => this.pipeline().pipelineMs);
  protected readonly virtualizationEnabled = computed(() => this.pipeline().virtualizationEnabled);

  private buildPipeline(): PipelineResult {
    const startedAt = performance.now();
    const options = this.options();
    const rows = options.data.map((entity, index) => this.createRow(entity as GridRecord, index));
    const columns = this.visibleColumns();

    const filteredRows = rows.filter((row) => this.matchesFilters(row, columns));
    const sortedRows = this.sortRows(filteredRows, columns);
    const displayItems = this.buildDisplayItems(sortedRows);
    const virtualizationEnabled = this.isVirtualizationEnabled(displayItems.length);

    return {
      visibleRows: sortedRows,
      displayItems,
      virtualizationEnabled,
      pipelineMs: performance.now() - startedAt
    };
  }

  private createRow(entity: GridRecord, index: number): GridRow {
    const rowIdentity = this.options().rowIdentity?.(entity, index) ?? `${this.options().id}-${index}`;
    const row = new GridRow(rowIdentity, entity, index, this.rowSize());
    const hiddenReasons = this.hiddenRowReasons()[row.id] ?? [];

    for (const reason of hiddenReasons) {
      row.setThisRowInvisible(reason);
    }

    return row;
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
    if (!this.isGroupingEnabled() || this.groupByColumns().length === 0) {
      return rows.map((row) => ({ kind: 'row', id: row.id, row }));
    }

    return this.buildGroupedItems(rows, this.groupByColumns(), 0, '');
  }

  private buildGroupedItems(
    rows: readonly GridRow[],
    groupBy: readonly string[],
    depth: number,
    path: string
  ): DisplayItem[] {
    if (groupBy.length === 0) {
      return rows.map((row) => ({ kind: 'row', id: row.id, row }));
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

  protected displayValue(row: GridRow, column: GridColumnDef): string {
    const context = this.cellContext(row, column);
    if (column.cellRenderer) {
      return column.cellRenderer(context);
    }

    return column.formatter
      ? column.formatter(context.value, row.entity)
      : stringifyCellValue(context.value);
  }

  protected cellTemplate(column: GridColumnDef): TemplateRef<GridCellTemplateContext> | null {
    return column.cellTemplate ?? null;
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

  protected columnWidth(column: GridColumnDef): string {
    return column.width ?? 'minmax(11rem, 1fr)';
  }

  protected isColumnSortable(column: GridColumnDef): boolean {
    return this.isSortingEnabled() && column.sortable !== false && column.enableSorting !== false;
  }

  protected isColumnFilterable(column: GridColumnDef): boolean {
    return this.isFilteringEnabled() && column.filterable !== false && column.enableFiltering !== false;
  }

  protected isGroupingEnabled(): boolean {
    return this.options().enableGrouping === true;
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
    return `${this.options().viewportHeight ?? 560}px`;
  }

  protected onColumnDrop(event: CdkDragDrop<readonly GridColumnDef[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    this.moveColumn(event.previousIndex, event.currentIndex);
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

  protected trackDisplayItem = (_index: number, item: DisplayItem): string => item.id;

  protected onViewportIndexChange(): void {
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

  private isVirtualizationEnabled(itemCount: number): boolean {
    return this.options().enableVirtualization !== false
      && itemCount >= (this.options().virtualizationThreshold ?? 40);
  }
}
