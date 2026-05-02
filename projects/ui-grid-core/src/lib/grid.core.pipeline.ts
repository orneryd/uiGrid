import { FEATURE_FILTERING, FEATURE_GROUPING, FEATURE_PAGINATION, FEATURE_SORTING, FEATURE_TREE_VIEW } from './grid.features';
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

  let visibleRows: GridRow[];

  if (FEATURE_TREE_VIEW && isTreeEnabled(context.options)) {
    visibleRows = filterAndFlattenGridTreeRows(
      rows,
      context.columns,
      context.options,
      context.activeFilters,
      context.expandedTreeRows,
      context.sortState
    );
  } else {
    const filtered = FEATURE_FILTERING
      ? rows.filter((row) => matchesGridRowFilters(row, context.columns, context.options, context.activeFilters))
      : rows.filter((row) => row.visible);

    visibleRows = FEATURE_SORTING
      ? sortGridRows(filtered, context.columns, context.options, context.sortState)
      : filtered;
  }

  const totalItems = context.options.useExternalPagination === true
    ? context.options.totalItems ?? visibleRows.length
    : visibleRows.length;

  const pagedRows = FEATURE_PAGINATION
    ? paginateGridRows(visibleRows, context.options, context.currentPage, context.pageSize, totalItems)
    : visibleRows;

  const displayItems = FEATURE_GROUPING
    ? buildGridDisplayItems(pagedRows, context.columns, context.options, context.groupByColumns, context.collapsedGroups)
    : buildGridDisplayItems(pagedRows, context.columns, context.options, [], context.collapsedGroups);

  const virtualizationEnabled = isVirtualizationEnabled(context.options, displayItems.length);

  return {
    visibleRows: pagedRows,
    displayItems,
    virtualizationEnabled,
    pipelineMs: ((context.now ?? performance.now.bind(performance))() - startedAt),
    totalItems
  };
}
