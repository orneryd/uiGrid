import { SortDirection } from './grid.constants';
import { GridBenchmarkResult, GridRecord, GridRow, GridSavedState } from './grid.models';

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
  paginationGetPage?: () => number;
  paginationGetTotalPages?: () => number;
  paginationGetFirstRowIndex?: () => number;
  paginationGetLastRowIndex?: () => number;
  paginationNextPage?: () => void;
  paginationPreviousPage?: () => void;
  paginationSeek?: (page: number) => void;
  paginationSetPageSize?: (pageSize: number) => void;
  toggleRowExpansion?: (row: GridRow | GridRecord | string) => void;
  expandAllRows?: () => void;
  collapseAllRows?: () => void;
  toggleAllRows?: () => void;
  treeExpandAllRows?: () => void;
  treeCollapseAllRows?: () => void;
  treeToggleRow?: (row: GridRow | GridRecord | string) => void;
  treeExpandRow?: (row: GridRow | GridRecord | string) => void;
  treeCollapseRow?: (row: GridRow | GridRecord | string) => void;
  treeGetRowChildren?: (row: GridRow | GridRecord | string) => GridRow[];
  treeGetState?: () => Record<string, boolean>;
  treeSetState?: (state: Record<string, boolean>) => void;
  infiniteScrollDataLoaded?: (scrollUp?: boolean, scrollDown?: boolean) => void | Promise<void>;
  infiniteScrollReset?: (scrollUp?: boolean, scrollDown?: boolean) => void;
  infiniteScrollSaveScrollPercentage?: () => void;
  infiniteScrollDataRemovedTop?: (scrollUp?: boolean, scrollDown?: boolean) => void;
  infiniteScrollDataRemovedBottom?: (scrollUp?: boolean, scrollDown?: boolean) => void;
  infiniteScrollSetDirections?: (scrollUp: boolean, scrollDown: boolean) => void;
  saveState?: () => GridSavedState;
  restoreState?: (state: GridSavedState) => void;
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
  pagination: {
    on: {
      paginationChanged: (listener: Listener<[number, number]>) => () => void;
    };
    raise: {
      paginationChanged: (currentPage: number, pageSize: number) => void;
    };
    getPage: () => number;
    getTotalPages: () => number;
    getFirstRowIndex: () => number;
    getLastRowIndex: () => number;
    nextPage: () => void;
    previousPage: () => void;
    seek: (page: number) => void;
    setPageSize: (pageSize: number) => void;
  };
  expandable: {
    on: {
      rowExpandedStateChanged: (listener: Listener<[GridRow, boolean]>) => () => void;
    };
    raise: {
      rowExpandedStateChanged: (row: GridRow, expanded: boolean) => void;
    };
    toggleRowExpansion: (row: GridRow | GridRecord | string) => void;
    expandAllRows: () => void;
    collapseAllRows: () => void;
    toggleAllRows: () => void;
  };
  treeBase: {
    on: {
      rowExpanded: (listener: Listener<[GridRow]>) => () => void;
      rowCollapsed: (listener: Listener<[GridRow]>) => () => void;
    };
    raise: {
      rowExpanded: (row: GridRow) => void;
      rowCollapsed: (row: GridRow) => void;
    };
    expandAllRows: () => void;
    collapseAllRows: () => void;
    toggleRowTreeState: (row: GridRow | GridRecord | string) => void;
    expandRow: (row: GridRow | GridRecord | string) => void;
    collapseRow: (row: GridRow | GridRecord | string) => void;
    getRowChildren: (row: GridRow | GridRecord | string) => GridRow[];
  };
  treeView: {
    getTreeView: () => Record<string, boolean>;
    setTreeView: (state: Record<string, boolean>) => void;
  };
  infiniteScroll: {
    on: {
      needLoadMoreData: (listener: Listener<[]>) => () => void;
      needLoadMoreDataTop: (listener: Listener<[]>) => () => void;
    };
    raise: {
      needLoadMoreData: () => void;
      needLoadMoreDataTop: () => void;
    };
    dataLoaded: (scrollUp?: boolean, scrollDown?: boolean) => void | Promise<void>;
    resetScroll: (scrollUp?: boolean, scrollDown?: boolean) => void;
    saveScrollPercentage: () => void;
    dataRemovedTop: (scrollUp?: boolean, scrollDown?: boolean) => void;
    dataRemovedBottom: (scrollUp?: boolean, scrollDown?: boolean) => void;
    setScrollDirections: (scrollUp: boolean, scrollDown: boolean) => void;
  };
  saveState: {
    save: () => GridSavedState;
    restore: (state: GridSavedState) => void;
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
  const paginationChanged = new GridEvent<[number, number]>();
  const rowExpandedStateChanged = new GridEvent<[GridRow, boolean]>();
  const treeRowExpanded = new GridEvent<[GridRow]>();
  const treeRowCollapsed = new GridEvent<[GridRow]>();
  const needLoadMoreData = new GridEvent<[]>();
  const needLoadMoreDataTop = new GridEvent<[]>();

  const noop = (): void => {};
  const falseState = (): Record<string, boolean> => ({});
  const emptyRows = (): GridRow[] => [];
  const saveState = (): GridSavedState => ({});
  const paginationGetPage = bindings.paginationGetPage ?? (() => 1);
  const paginationGetTotalPages = bindings.paginationGetTotalPages ?? (() => 1);
  const paginationGetFirstRowIndex = bindings.paginationGetFirstRowIndex ?? (() => 0);
  const paginationGetLastRowIndex = bindings.paginationGetLastRowIndex ?? (() => 0);
  const paginationNextPage = bindings.paginationNextPage ?? noop;
  const paginationPreviousPage = bindings.paginationPreviousPage ?? noop;
  const paginationSeek = bindings.paginationSeek ?? noop;
  const paginationSetPageSize = bindings.paginationSetPageSize ?? noop;
  const toggleRowExpansion = bindings.toggleRowExpansion ?? noop;
  const expandAllRows = bindings.expandAllRows ?? noop;
  const collapseAllRows = bindings.collapseAllRows ?? noop;
  const toggleAllRows = bindings.toggleAllRows ?? noop;
  const treeExpandAllRows = bindings.treeExpandAllRows ?? noop;
  const treeCollapseAllRows = bindings.treeCollapseAllRows ?? noop;
  const treeToggleRow = bindings.treeToggleRow ?? noop;
  const treeExpandRow = bindings.treeExpandRow ?? noop;
  const treeCollapseRow = bindings.treeCollapseRow ?? noop;
  const treeGetRowChildren = bindings.treeGetRowChildren ?? emptyRows;
  const treeGetState = bindings.treeGetState ?? falseState;
  const treeSetState = bindings.treeSetState ?? noop;
  const infiniteScrollDataLoaded = bindings.infiniteScrollDataLoaded ?? noop;
  const infiniteScrollReset = bindings.infiniteScrollReset ?? noop;
  const infiniteScrollSaveScrollPercentage = bindings.infiniteScrollSaveScrollPercentage ?? noop;
  const infiniteScrollDataRemovedTop = bindings.infiniteScrollDataRemovedTop ?? noop;
  const infiniteScrollDataRemovedBottom = bindings.infiniteScrollDataRemovedBottom ?? noop;
  const infiniteScrollSetDirections = bindings.infiniteScrollSetDirections ?? noop;
  const saveStateBinding = bindings.saveState ?? saveState;
  const restoreState = bindings.restoreState ?? noop;

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
    },
    pagination: {
      on: {
        paginationChanged: (listener) => paginationChanged.subscribe(listener)
      },
      raise: {
        paginationChanged: (currentPage, pageSize) => paginationChanged.emit(currentPage, pageSize)
      },
      getPage: paginationGetPage,
      getTotalPages: paginationGetTotalPages,
      getFirstRowIndex: paginationGetFirstRowIndex,
      getLastRowIndex: paginationGetLastRowIndex,
      nextPage: paginationNextPage,
      previousPage: paginationPreviousPage,
      seek: paginationSeek,
      setPageSize: paginationSetPageSize
    },
    expandable: {
      on: {
        rowExpandedStateChanged: (listener) => rowExpandedStateChanged.subscribe(listener)
      },
      raise: {
        rowExpandedStateChanged: (row, expanded) => rowExpandedStateChanged.emit(row, expanded)
      },
      toggleRowExpansion,
      expandAllRows,
      collapseAllRows,
      toggleAllRows
    },
    treeBase: {
      on: {
        rowExpanded: (listener) => treeRowExpanded.subscribe(listener),
        rowCollapsed: (listener) => treeRowCollapsed.subscribe(listener)
      },
      raise: {
        rowExpanded: (row) => treeRowExpanded.emit(row),
        rowCollapsed: (row) => treeRowCollapsed.emit(row)
      },
      expandAllRows: treeExpandAllRows,
      collapseAllRows: treeCollapseAllRows,
      toggleRowTreeState: treeToggleRow,
      expandRow: treeExpandRow,
      collapseRow: treeCollapseRow,
      getRowChildren: treeGetRowChildren
    },
    treeView: {
      getTreeView: treeGetState,
      setTreeView: treeSetState
    },
    infiniteScroll: {
      on: {
        needLoadMoreData: (listener) => needLoadMoreData.subscribe(listener),
        needLoadMoreDataTop: (listener) => needLoadMoreDataTop.subscribe(listener)
      },
      raise: {
        needLoadMoreData: () => needLoadMoreData.emit(),
        needLoadMoreDataTop: () => needLoadMoreDataTop.emit()
      },
      dataLoaded: infiniteScrollDataLoaded,
      resetScroll: infiniteScrollReset,
      saveScrollPercentage: infiniteScrollSaveScrollPercentage,
      dataRemovedTop: infiniteScrollDataRemovedTop,
      dataRemovedBottom: infiniteScrollDataRemovedBottom,
      setScrollDirections: infiniteScrollSetDirections
    },
    saveState: {
      save: saveStateBinding,
      restore: restoreState
    }
  };

  return api;
}