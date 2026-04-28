import { BuildGridPipelineContext, PipelineResult } from './grid.core.types';
import { GridRow } from './grid.models';
import { isVirtualizationEnabled, paginateGridRows } from './grid.core.pagination';
import { matchesGridRowFilters } from './grid.core.filtering';
import { buildGridDisplayItems } from './grid.core.grouping';
import { sortGridRows } from './grid.core.sorting';
import { buildGridRows, filterAndFlattenGridTreeRows, isTreeEnabled } from './grid.core.tree';

export function buildGridPipeline(context: BuildGridPipelineContext): PipelineResult {
  const startedAt = (context.now ?? performance.now.bind(performance))();
  const rows = buildGridRows(context.options, context.rowSize, context.hiddenRowReasons, context.expandedRows);

  const visibleRows = isTreeEnabled(context.options)
    ? filterAndFlattenGridTreeRows(
        rows,
        context.columns,
        context.options,
        context.activeFilters,
        context.expandedTreeRows,
        context.sortState
      )
    : sortGridRows(
        rows.filter((row) => matchesGridRowFilters(row, context.columns, context.options, context.activeFilters)),
        context.columns,
        context.options,
        context.sortState
      );

  const totalItems = context.options.useExternalPagination === true
    ? context.options.totalItems ?? visibleRows.length
    : visibleRows.length;
  const pagedRows = paginateGridRows(visibleRows, context.options, context.currentPage, context.pageSize, totalItems);
  const displayItems = buildGridDisplayItems(pagedRows, context.columns, context.options, context.groupByColumns, context.collapsedGroups);
  const virtualizationEnabled = isVirtualizationEnabled(context.options, displayItems.length);

  return {
    visibleRows: pagedRows,
    displayItems,
    virtualizationEnabled,
    pipelineMs: ((context.now ?? performance.now.bind(performance))() - startedAt),
    totalItems
  };
}