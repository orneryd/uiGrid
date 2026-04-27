import { vi } from 'vitest';
import { SORT_DIRECTIONS } from './grid.constants';
import { createGridApi } from './grid.api';
import { GridRow } from './grid.models';

describe('createGridApi', () => {
  it('delegates core methods to the provided bindings', () => {
    const refresh = vi.fn();
    const getVisibleRows = vi.fn(() => [new GridRow('row-1', { id: 1 }, 0)]);
    const setRowInvisible = vi.fn();
    const clearRowInvisible = vi.fn();
    const setFilter = vi.fn();
    const clearAllFilters = vi.fn();
    const sortColumn = vi.fn();
    const moveColumn = vi.fn();
    const toggleGrouping = vi.fn();
    const clearGrouping = vi.fn();
    const benchmark = vi.fn(() => ({
      iterations: 2,
      totalMs: 6,
      averageMs: 3,
      visibleRows: 1,
      renderedItems: 1
    }));
    const exportCsv = vi.fn();

    const api = createGridApi({
      refresh,
      getVisibleRows,
      setRowInvisible,
      clearRowInvisible,
      setFilter,
      clearAllFilters,
      sortColumn,
      moveColumn,
      toggleGrouping,
      clearGrouping,
      benchmark,
      exportCsv
    });

    api.core.refresh();
    api.core.queueGridRefresh();
    api.core.queueRefresh();
    api.core.refreshRows();
    expect(refresh).toHaveBeenCalledTimes(4);

    expect(api.core.getVisibleRows()).toHaveLength(1);
    expect(getVisibleRows).toHaveBeenCalledTimes(1);

    api.core.setRowInvisible('row-1', 'manual');
    api.core.clearRowInvisible('row-1', 'manual');
    api.core.setFilter('status', 'Active');
    api.core.clearAllFilters();
    api.core.sortColumn('name', SORT_DIRECTIONS.desc);
    api.core.moveColumn(0, 2);
    api.core.groupByColumn('status');
    api.core.clearGrouping();
    expect(api.core.benchmark(2)).toEqual({
      iterations: 2,
      totalMs: 6,
      averageMs: 3,
      visibleRows: 1,
      renderedItems: 1
    });
    api.core.exportCsv();

    expect(setRowInvisible).toHaveBeenCalledWith('row-1', 'manual');
    expect(clearRowInvisible).toHaveBeenCalledWith('row-1', 'manual');
    expect(setFilter).toHaveBeenCalledWith('status', 'Active');
    expect(clearAllFilters).toHaveBeenCalledTimes(1);
    expect(sortColumn).toHaveBeenCalledWith('name', SORT_DIRECTIONS.desc);
    expect(moveColumn).toHaveBeenCalledWith(0, 2);
    expect(toggleGrouping).toHaveBeenCalledWith('status');
    expect(clearGrouping).toHaveBeenCalledTimes(1);
    expect(benchmark).toHaveBeenCalledWith(2);
    expect(exportCsv).toHaveBeenCalledTimes(1);
  });

  it('raises events and supports unsubscribe semantics', () => {
    const api = createGridApi({
      refresh: vi.fn(),
      getVisibleRows: vi.fn(() => []),
      setRowInvisible: vi.fn(),
      clearRowInvisible: vi.fn(),
      setFilter: vi.fn(),
      clearAllFilters: vi.fn(),
      sortColumn: vi.fn(),
      moveColumn: vi.fn(),
      toggleGrouping: vi.fn(),
      clearGrouping: vi.fn(),
      benchmark: vi.fn(() => ({
        iterations: 1,
        totalMs: 0,
        averageMs: 0,
        visibleRows: 0,
        renderedItems: 0
      })),
      exportCsv: vi.fn()
    });

    const filterChanged = vi.fn();
    const renderingComplete = vi.fn();
    const rowsVisibleChanged = vi.fn();
    const rowsRendered = vi.fn();
    const scrollBegin = vi.fn();
    const scrollEnd = vi.fn();
    const sortChanged = vi.fn();
    const canvasHeightChanged = vi.fn();
    const gridDimensionChanged = vi.fn();
    const groupingChanged = vi.fn();
    const columnOrderChanged = vi.fn();
    const benchmarkComplete = vi.fn();
    const unsubscribeFilter = api.core.on.filterChanged(filterChanged);
    api.core.on.renderingComplete(renderingComplete);
    api.core.on.rowsVisibleChanged(rowsVisibleChanged);
    api.core.on.rowsRendered(rowsRendered);
    api.core.on.scrollBegin(scrollBegin);
    api.core.on.scrollEnd(scrollEnd);
    api.core.on.sortChanged(sortChanged);
    api.core.on.canvasHeightChanged(canvasHeightChanged);
    api.core.on.gridDimensionChanged(gridDimensionChanged);
    api.core.on.groupingChanged(groupingChanged);
    api.core.on.columnOrderChanged(columnOrderChanged);
    api.core.on.benchmarkComplete(benchmarkComplete);

    api.core.raise.renderingComplete(api);
    api.core.raise.filterChanged({ status: 'Pilot' });
    api.core.raise.rowsVisibleChanged([]);
    api.core.raise.rowsRendered([]);
    api.core.raise.scrollBegin();
    api.core.raise.scrollEnd();
    api.core.raise.sortChanged('name', SORT_DIRECTIONS.asc);
    api.core.raise.canvasHeightChanged(10, 50);
    api.core.raise.gridDimensionChanged(10, 20, 30, 40);
    api.core.raise.groupingChanged(['status']);
    api.core.raise.columnOrderChanged(['status', 'name']);
    api.core.raise.benchmarkComplete({
      iterations: 2,
      totalMs: 6,
      averageMs: 3,
      visibleRows: 1,
      renderedItems: 1
    });

    expect(renderingComplete).toHaveBeenCalledWith(api);
    expect(filterChanged).toHaveBeenCalledWith({ status: 'Pilot' });
    expect(rowsVisibleChanged).toHaveBeenCalledWith([]);
    expect(rowsRendered).toHaveBeenCalledWith([]);
    expect(scrollBegin).toHaveBeenCalledTimes(1);
    expect(scrollEnd).toHaveBeenCalledTimes(1);
    expect(sortChanged).toHaveBeenCalledWith('name', SORT_DIRECTIONS.asc);
    expect(canvasHeightChanged).toHaveBeenCalledWith(10, 50);
    expect(gridDimensionChanged).toHaveBeenCalledWith(10, 20, 30, 40);
    expect(groupingChanged).toHaveBeenCalledWith(['status']);
    expect(columnOrderChanged).toHaveBeenCalledWith(['status', 'name']);
    expect(benchmarkComplete).toHaveBeenCalledWith({
      iterations: 2,
      totalMs: 6,
      averageMs: 3,
      visibleRows: 1,
      renderedItems: 1
    });

    unsubscribeFilter();
    api.core.raise.filterChanged({ status: 'Active' });
    expect(filterChanged).toHaveBeenCalledTimes(1);
  });
});