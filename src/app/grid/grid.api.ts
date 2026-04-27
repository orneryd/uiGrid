import { SortDirection } from './grid.constants';
import { GridBenchmarkResult, GridRecord, GridRow } from './grid.models';

type Listener<Args extends unknown[]> = (...args: Args) => void;

class GridEvent<Args extends unknown[]> {
  private readonly listeners = new Set<Listener<Args>>();

  subscribe(listener: Listener<Args>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(...args: Args): void {
    for (const listener of this.listeners) {
      listener(...args);
    }
  }
}

export interface GridApiBindings {
  refresh: () => void;
  getVisibleRows: () => GridRow[];
  setRowInvisible: (row: GridRow | GridRecord | string, reason?: string) => void;
  clearRowInvisible: (row: GridRow | GridRecord | string, reason?: string) => void;
  setFilter: (columnName: string, value: string) => void;
  clearAllFilters: () => void;
  sortColumn: (columnName: string, direction?: SortDirection) => void;
  moveColumn: (fromIndex: number, toIndex: number) => void;
  toggleGrouping: (columnName: string) => void;
  clearGrouping: () => void;
  benchmark: (iterations?: number) => GridBenchmarkResult;
  exportCsv: () => void;
}

export interface UiGridApi {
  core: {
    on: {
      renderingComplete: (listener: Listener<[UiGridApi]>) => () => void;
      filterChanged: (listener: Listener<[Record<string, string>]>) => () => void;
      rowsVisibleChanged: (listener: Listener<[GridRow[]]>) => () => void;
      rowsRendered: (listener: Listener<[GridRow[]]>) => () => void;
      scrollBegin: (listener: Listener<[]>) => () => void;
      scrollEnd: (listener: Listener<[]>) => () => void;
      canvasHeightChanged: (listener: Listener<[number, number]>) => () => void;
      gridDimensionChanged: (listener: Listener<[number, number, number, number]>) => () => void;
      sortChanged: (listener: Listener<[string | null, SortDirection]>) => () => void;
      groupingChanged: (listener: Listener<[string[]]>) => () => void;
      columnOrderChanged: (listener: Listener<[string[]]>) => () => void;
      benchmarkComplete: (listener: Listener<[GridBenchmarkResult]>) => () => void;
    };
    raise: {
      renderingComplete: (gridApi: UiGridApi) => void;
      filterChanged: (filters: Record<string, string>) => void;
      rowsVisibleChanged: (rows: GridRow[]) => void;
      rowsRendered: (rows: GridRow[]) => void;
      scrollBegin: () => void;
      scrollEnd: () => void;
      canvasHeightChanged: (oldHeight: number, newHeight: number) => void;
      gridDimensionChanged: (oldHeight: number, oldWidth: number, newHeight: number, newWidth: number) => void;
      sortChanged: (columnName: string | null, direction: SortDirection) => void;
      groupingChanged: (groupBy: string[]) => void;
      columnOrderChanged: (order: string[]) => void;
      benchmarkComplete: (result: GridBenchmarkResult) => void;
    };
    refresh: () => void;
    queueGridRefresh: () => void;
    queueRefresh: () => void;
    refreshRows: () => void;
    getVisibleRows: () => GridRow[];
    setRowInvisible: (row: GridRow | GridRecord | string, reason?: string) => void;
    clearRowInvisible: (row: GridRow | GridRecord | string, reason?: string) => void;
    setFilter: (columnName: string, value: string) => void;
    clearAllFilters: () => void;
    sortColumn: (columnName: string, direction?: SortDirection) => void;
    moveColumn: (fromIndex: number, toIndex: number) => void;
    groupByColumn: (columnName: string) => void;
    clearGrouping: () => void;
    benchmark: (iterations?: number) => GridBenchmarkResult;
    exportCsv: () => void;
  };
}

export function createGridApi(bindings: GridApiBindings): UiGridApi {
  const renderingComplete = new GridEvent<[UiGridApi]>();
  const filterChanged = new GridEvent<[Record<string, string>]>();
  const rowsVisibleChanged = new GridEvent<[GridRow[]]>();
  const rowsRendered = new GridEvent<[GridRow[]]>();
  const scrollBegin = new GridEvent<[]>();
  const scrollEnd = new GridEvent<[]>();
  const canvasHeightChanged = new GridEvent<[number, number]>();
  const gridDimensionChanged = new GridEvent<[number, number, number, number]>();
  const sortChanged = new GridEvent<[string | null, SortDirection]>();
  const groupingChanged = new GridEvent<[string[]]>();
  const columnOrderChanged = new GridEvent<[string[]]>();
  const benchmarkComplete = new GridEvent<[GridBenchmarkResult]>();

  const api: UiGridApi = {
    core: {
      on: {
        renderingComplete: (listener) => renderingComplete.subscribe(listener),
        filterChanged: (listener) => filterChanged.subscribe(listener),
        rowsVisibleChanged: (listener) => rowsVisibleChanged.subscribe(listener),
        rowsRendered: (listener) => rowsRendered.subscribe(listener),
        scrollBegin: (listener) => scrollBegin.subscribe(listener),
        scrollEnd: (listener) => scrollEnd.subscribe(listener),
        canvasHeightChanged: (listener) => canvasHeightChanged.subscribe(listener),
        gridDimensionChanged: (listener) => gridDimensionChanged.subscribe(listener),
        sortChanged: (listener) => sortChanged.subscribe(listener),
        groupingChanged: (listener) => groupingChanged.subscribe(listener),
        columnOrderChanged: (listener) => columnOrderChanged.subscribe(listener),
        benchmarkComplete: (listener) => benchmarkComplete.subscribe(listener)
      },
      raise: {
        renderingComplete: (gridApi) => renderingComplete.emit(gridApi),
        filterChanged: (filters) => filterChanged.emit(filters),
        rowsVisibleChanged: (rows) => rowsVisibleChanged.emit(rows),
        rowsRendered: (rows) => rowsRendered.emit(rows),
        scrollBegin: () => scrollBegin.emit(),
        scrollEnd: () => scrollEnd.emit(),
        canvasHeightChanged: (oldHeight, newHeight) => canvasHeightChanged.emit(oldHeight, newHeight),
        gridDimensionChanged: (oldHeight, oldWidth, newHeight, newWidth) =>
          gridDimensionChanged.emit(oldHeight, oldWidth, newHeight, newWidth),
        sortChanged: (columnName, direction) => sortChanged.emit(columnName, direction),
        groupingChanged: (groupBy) => groupingChanged.emit(groupBy),
        columnOrderChanged: (order) => columnOrderChanged.emit(order),
        benchmarkComplete: (result) => benchmarkComplete.emit(result)
      },
      refresh: bindings.refresh,
      queueGridRefresh: bindings.refresh,
      queueRefresh: bindings.refresh,
      refreshRows: bindings.refresh,
      getVisibleRows: bindings.getVisibleRows,
      setRowInvisible: bindings.setRowInvisible,
      clearRowInvisible: bindings.clearRowInvisible,
      setFilter: bindings.setFilter,
      clearAllFilters: bindings.clearAllFilters,
      sortColumn: bindings.sortColumn,
      moveColumn: bindings.moveColumn,
      groupByColumn: bindings.toggleGrouping,
      clearGrouping: bindings.clearGrouping,
      benchmark: bindings.benchmark,
      exportCsv: bindings.exportCsv
    }
  };

  return api;
}